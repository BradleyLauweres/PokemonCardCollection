import time
import requests
import json
from pathlib import Path
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.core.cache import cache
from django.http import HttpResponse
from .models import CollectedCard
from .serializers import CollectedCardSerializer

POKEMON_TCG_API_BASE = "https://api.pokemontcg.io/v2"
DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
}

BASE_DIR = Path(__file__).resolve().parent

def fetch_tcg_api(url, max_retries=6, delay=0.8):
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=DEFAULT_HEADERS, timeout=12)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            pass
        time.sleep(delay)
    return None


@api_view(['GET'])
def list_collection(request):
    set_id = request.query_params.get('set_id', None)
    wanted_only = request.query_params.get('wanted', None)

    cards = CollectedCard.objects.all()
    if set_id:
        cards = cards.filter(set_id=set_id)
    if wanted_only == 'true':
        # Strictly return cards marked as wanted that are not yet owned (or explicitly wanted)
        cards = cards.filter(is_wanted=True)

    serializer = CollectedCardSerializer(cards, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def reset_wanted_status(request):
    """Reset is_wanted to False for all cards"""
    count = CollectedCard.objects.all().update(is_wanted=False)
    return Response({'message': f'Successfully reset wanted status for {count} cards', 'reset_count': count})


@api_view(['POST'])
def toggle_card(request):
    card_id = request.data.get('card_id')
    set_id = request.data.get('set_id', '')
    name = request.data.get('name', '')
    number = request.data.get('number', '')
    rarity = request.data.get('rarity', '')
    image_url = request.data.get('image_url', '')
    market_price = request.data.get('market_price', 0.0)

    if not card_id:
        return Response({'error': 'card_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    existing = CollectedCard.objects.filter(card_id=card_id).first()
    if existing:
        if existing.quantity > 0:
            if existing.is_wanted:
                existing.quantity = 0
                existing.save()
                serializer = CollectedCardSerializer(existing)
                return Response({'owned': False, 'wanted': True, 'card': serializer.data})
            else:
                existing.delete()
                return Response({'owned': False, 'wanted': False, 'card_id': card_id})
        else:
            existing.quantity = 1
            # Preserve existing is_wanted status
            existing.save()
            serializer = CollectedCardSerializer(existing)
            return Response({'owned': True, 'wanted': existing.is_wanted, 'card': serializer.data})
    else:
        card = CollectedCard.objects.create(
            card_id=card_id,
            set_id=set_id,
            name=name,
            number=number,
            rarity=rarity,
            image_url=image_url,
            market_price=float(market_price or 0.0),
            quantity=1,
            is_wanted=False
        )
        serializer = CollectedCardSerializer(card)
        return Response({'owned': True, 'wanted': False, 'card': serializer.data})


@api_view(['POST'])
def toggle_wanted(request):
    card_id = request.data.get('card_id')
    set_id = request.data.get('set_id', '')
    name = request.data.get('name', '')
    number = request.data.get('number', '')
    rarity = request.data.get('rarity', '')
    image_url = request.data.get('image_url', '')
    market_price = request.data.get('market_price', 0.0)

    if not card_id:
        return Response({'error': 'card_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    card = CollectedCard.objects.filter(card_id=card_id).first()
    if card:
        new_wanted = not card.is_wanted
        card.is_wanted = new_wanted
        if not new_wanted and card.quantity <= 0:
            card.delete()
            return Response({'wanted': False, 'card_id': card_id})
        else:
            if name and not card.name:
                card.name = name
            if set_id and not card.set_id:
                card.set_id = set_id
            if number and not card.number:
                card.number = number
            if rarity and not card.rarity:
                card.rarity = rarity
            if image_url and not card.image_url:
                card.image_url = image_url
            if market_price and (card.market_price == 0.0 or not card.market_price):
                try:
                    card.market_price = float(market_price)
                except (ValueError, TypeError):
                    pass
            card.save()
            serializer = CollectedCardSerializer(card)
            return Response({'wanted': new_wanted, 'card': serializer.data})
    else:
        card = CollectedCard.objects.create(
            card_id=card_id,
            set_id=set_id,
            name=name,
            number=number,
            rarity=rarity,
            image_url=image_url,
            market_price=float(market_price or 0.0),
            quantity=0,
            is_wanted=True
        )
        serializer = CollectedCardSerializer(card)
        return Response({'wanted': True, 'card': serializer.data})


@api_view(['POST'])
def update_quantity(request):
    card_id = request.data.get('card_id')
    quantity = request.data.get('quantity')

    if not card_id or quantity is None:
        return Response({'error': 'card_id and quantity are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        quantity = int(quantity)
    except ValueError:
        return Response({'error': 'quantity must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    card = CollectedCard.objects.filter(card_id=card_id).first()
    if quantity <= 0:
        if card:
            if card.is_wanted:
                card.quantity = 0
                card.save()
                serializer = CollectedCardSerializer(card)
                return Response({'owned': False, 'wanted': True, 'card': serializer.data})
            else:
                card.delete()
                return Response({'owned': False, 'wanted': False, 'card_id': card_id})
        return Response({'owned': False, 'card_id': card_id})

    if card:
        card.quantity = quantity
        card.save()
    else:
        card = CollectedCard.objects.create(
            card_id=card_id,
            set_id=request.data.get('set_id', ''),
            name=request.data.get('name', ''),
            number=request.data.get('number', ''),
            rarity=request.data.get('rarity', ''),
            image_url=request.data.get('image_url', ''),
            market_price=float(request.data.get('market_price', 0.0)),
            quantity=quantity,
            is_wanted=False
        )
    serializer = CollectedCardSerializer(card)
    return Response({'owned': True, 'card': serializer.data})


@api_view(['POST'])
def update_card_price(request):
    card_id = request.data.get('card_id')
    custom_price = request.data.get('custom_price')
    notes = request.data.get('notes')

    if not card_id:
        return Response({'error': 'card_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    card = CollectedCard.objects.filter(card_id=card_id).first()
    if not card:
        return Response({'error': 'Card is not in database'}, status=status.HTTP_404_NOT_FOUND)

    if custom_price is not None:
        try:
            card.custom_price = float(custom_price)
        except ValueError:
            pass

    if notes is not None:
        card.notes = notes

    card.save()
    serializer = CollectedCardSerializer(card)
    return Response({'owned': card.quantity > 0, 'card': serializer.data})


@api_view(['POST'])
def bulk_toggle(request):
    set_id = request.data.get('set_id')
    action = request.data.get('action')
    cards_data = request.data.get('cards', [])

    if not set_id or not action:
        return Response({'error': 'set_id and action are required'}, status=status.HTTP_400_BAD_REQUEST)

    if action == 'clear_all':
        # Preserve wishlist: set quantity to 0 for wanted cards, delete non-wanted cards
        CollectedCard.objects.filter(set_id=set_id, is_wanted=True).update(quantity=0)
        count, _ = CollectedCard.objects.filter(set_id=set_id, is_wanted=False).delete()
        return Response({'message': f'Cleared collected cards for set {set_id}'})
    elif action == 'mark_all':
        created_count = 0
        for item in cards_data:
            c_id = item.get('id')
            if not c_id:
                continue
            
            m_price = 0.0
            cm_price = item.get('cardmarket', {}).get('prices', {}).get('averageSellPrice')
            tcg_price = item.get('tcgplayer', {}).get('prices', {}).get('holofoil', {}).get('market') or item.get('tcgplayer', {}).get('prices', {}).get('normal', {}).get('market')
            if cm_price: m_price = cm_price
            elif tcg_price: m_price = tcg_price

            card, created = CollectedCard.objects.get_or_create(
                card_id=c_id,
                defaults={
                    'set_id': set_id,
                    'name': item.get('name', ''),
                    'number': item.get('number', ''),
                    'rarity': item.get('rarity', ''),
                    'image_url': item.get('images', {}).get('small', ''),
                    'market_price': float(m_price or 0.0),
                    'quantity': 1,
                    'is_wanted': False
                }
            )
            if created:
                created_count += 1
            else:
                card.quantity = max(card.quantity, 1)
                # Keep card.is_wanted intact
                card.save()
        return Response({'message': f'Marked set {set_id} cards as collected (added {created_count})'})

    return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_stats(request):
    all_cards = CollectedCard.objects.all()
    
    owned_cards = all_cards.filter(quantity__gt=0)
    wanted_cards = all_cards.filter(is_wanted=True)

    total_market_value = 0.0
    total_custom_value = 0.0
    set_counts = {}
    set_values = {}

    for card in owned_cards:
        qty = card.quantity or 1
        val_m = (card.market_price or 0.0) * qty
        val_c = (card.custom_price or card.market_price or 0.0) * qty

        total_market_value += val_m
        total_custom_value += val_c

        set_counts[card.set_id] = set_counts.get(card.set_id, 0) + 1
        set_values[card.set_id] = set_values.get(card.set_id, 0.0) + val_m

    total_wanted_cost = sum((c.market_price or 0.0) for c in wanted_cards)

    return Response({
        'total_collected': owned_cards.count(),
        'total_wanted': wanted_cards.count(),
        'total_wanted_cost': round(total_wanted_cost, 2),
        'total_sets_tracked': len(set_counts),
        'total_market_value': round(total_market_value, 2),
        'total_custom_value': round(total_custom_value, 2),
        'set_counts': set_counts,
        'set_values': set_values
    })


def format_backup_txt(cards, scope='all_sets'):
    lines = [
        f"# PokéTrack TCG Collection Backup",
        f"# Scope: {scope}",
        f"# Total Cards: {len(cards)}",
        f"# Format: card_id | set_id | number | quantity | is_wanted | market_price | custom_price | name | rarity | image_url | notes"
    ]
    for c in cards:
        name = (c.name or '').replace('|', ' ')
        rarity = (c.rarity or '').replace('|', ' ')
        notes = (c.notes or '').replace('\n', ' ').replace('|', ' ')
        img = c.image_url or ''
        line = f"{c.card_id} | {c.set_id} | {c.number} | {c.quantity} | {1 if c.is_wanted else 0} | {c.market_price:.2f} | {c.custom_price:.2f} | {name} | {rarity} | {img} | {notes}"
        lines.append(line)
    return "\n".join(lines) + "\n"


def parse_backup_txt(txt_content):
    cards_to_save = []
    lines = txt_content.strip().splitlines()
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue

        if line.startswith('{') and line.endswith('}'):
            try:
                data = json.loads(line)
                if 'card_id' in data:
                    cards_to_save.append(data)
                    continue
            except Exception:
                pass

        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 1:
            c_id = parts[0]
            if not c_id:
                continue

            c_set_id = parts[1] if len(parts) > 1 else (c_id.split('-')[0] if '-' in c_id else '')
            c_number = parts[2] if len(parts) > 2 else (c_id.split('-')[1] if '-' in c_id else '')

            try:
                c_qty = int(parts[3]) if len(parts) > 3 and parts[3] else 1
            except ValueError:
                c_qty = 1

            c_wanted = False
            if len(parts) > 4:
                val = parts[4].lower()
                c_wanted = val in ('1', 'true', 'yes', 'y')

            try:
                c_market = float(parts[5]) if len(parts) > 5 and parts[5] else 0.0
            except ValueError:
                c_market = 0.0

            try:
                c_custom = float(parts[6]) if len(parts) > 6 and parts[6] else 0.0
            except ValueError:
                c_custom = 0.0

            c_name = parts[7] if len(parts) > 7 else ''
            c_rarity = parts[8] if len(parts) > 8 else ''
            c_img = parts[9] if len(parts) > 9 else ''
            c_notes = parts[10] if len(parts) > 10 else ''

            cards_to_save.append({
                'card_id': c_id,
                'set_id': c_set_id,
                'number': c_number,
                'quantity': c_qty,
                'is_wanted': c_wanted,
                'market_price': c_market,
                'custom_price': c_custom,
                'name': c_name,
                'rarity': c_rarity,
                'image_url': c_img,
                'notes': c_notes
            })
    return cards_to_save


def restore_cards_from_data(cards_data):
    restored_count = 0
    for item in cards_data:
        c_id = item.get('card_id')
        if not c_id:
            continue
        CollectedCard.objects.update_or_create(
            card_id=c_id,
            defaults={
                'set_id': item.get('set_id', ''),
                'name': item.get('name', ''),
                'number': item.get('number', ''),
                'rarity': item.get('rarity', ''),
                'image_url': item.get('image_url', ''),
                'quantity': item.get('quantity', 1),
                'is_wanted': item.get('is_wanted', False),
                'market_price': float(item.get('market_price', 0.0)),
                'custom_price': float(item.get('custom_price', 0.0)),
                'notes': item.get('notes', '')
            }
        )
        restored_count += 1
    return restored_count


@api_view(['GET', 'POST'])
def backup_collection(request):
    set_id = request.query_params.get('set_id') or request.data.get('set_id')
    download = request.query_params.get('download', '').lower() == 'true'

    cards = CollectedCard.objects.all().order_by('set_id', 'number')
    if set_id and set_id not in ('all', 'all_owned', 'wanted_list'):
        cards = cards.filter(set_id=set_id)

    scope_name = set_id if (set_id and set_id not in ('all', 'all_owned', 'wanted_list')) else 'all_sets'
    card_list = list(cards)
    txt_content = format_backup_txt(card_list, scope=scope_name)

    backups_dir = BASE_DIR / 'backups'
    backups_dir.mkdir(parents=True, exist_ok=True)
    filename = f'backup_{scope_name}.txt'
    file_path = backups_dir / filename
    try:
        file_path.write_text(txt_content, encoding='utf-8')
    except Exception:
        pass

    if download:
        response = HttpResponse(txt_content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    return Response({
        'message': f'Backup created with {len(card_list)} cards for {scope_name}',
        'filename': filename,
        'file_path': str(file_path),
        'total_cards': len(card_list),
        'content': txt_content
    })


@api_view(['POST'])
def restore_collection(request):
    uploaded_file = request.FILES.get('file')
    txt_content = None

    if uploaded_file:
        try:
            txt_content = uploaded_file.read().decode('utf-8')
        except Exception as e:
            return Response({'error': f'Failed to read file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
    elif 'content' in request.data:
        txt_content = request.data.get('content', '')
    else:
        set_id = request.data.get('set_id') or 'all_sets'
        backups_dir = BASE_DIR / 'backups'
        file_path = backups_dir / f'backup_{set_id}.txt'
        if not file_path.exists() and set_id != 'all_sets':
            file_path = backups_dir / 'backup_all_sets.txt'
        if file_path.exists():
            txt_content = file_path.read_text(encoding='utf-8')
        else:
            return Response({'error': 'No file uploaded, content provided, or local backup found on server'}, status=status.HTTP_400_BAD_REQUEST)

    if not txt_content:
        return Response({'error': 'Backup file or content is empty'}, status=status.HTTP_400_BAD_REQUEST)

    parsed_cards = parse_backup_txt(txt_content)
    if not parsed_cards:
        return Response({'error': 'No valid card records found in backup'}, status=status.HTTP_400_BAD_REQUEST)

    restored_count = restore_cards_from_data(parsed_cards)
    return Response({
        'message': f'Successfully restored {restored_count} cards into database',
        'restored_count': restored_count
    })


@api_view(['GET'])
def proxy_sets(request):
    cache_key = 'pokemon_tcg_sets_v5'
    cached_data = cache.get(cache_key)
    if cached_data:
        return Response(cached_data)

    seed_file = BASE_DIR / 'seed_sets.json'

    data = fetch_tcg_api(f"{POKEMON_TCG_API_BASE}/sets")
    if data:
        cache.set(cache_key, data, timeout=3600 * 24)
        try:
            with open(seed_file, 'w') as f:
                json.dump(data, f)
        except Exception:
            pass
        return Response(data)

    if seed_file.exists():
        with open(seed_file, 'r') as f:
            fallback_data = json.load(f)
            return Response(fallback_data)

    return Response({'error': 'Failed to reach Pokémon TCG API after retries'}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(['GET'])
def proxy_set_cards(request):
    set_id = request.query_params.get('set_id')
    if not set_id:
        return Response({'error': 'set_id query param is required'}, status=status.HTTP_400_BAD_REQUEST)

    cache_key = f'pokemon_tcg_set_cards_{set_id}'
    cached_data = cache.get(cache_key)
    if cached_data:
        return Response(cached_data)

    seed_file = BASE_DIR / f'seed_cards_{set_id}.json'

    url = f"{POKEMON_TCG_API_BASE}/cards?q=set.id:{set_id}&pageSize=250"
    data = fetch_tcg_api(url)
    if data:
        cache.set(cache_key, data, timeout=3600 * 24)
        try:
            with open(seed_file, 'w') as f:
                json.dump(data, f)
        except Exception:
            pass
        return Response(data)

    if seed_file.exists():
        with open(seed_file, 'r') as f:
            fallback_data = json.load(f)
            return Response(fallback_data)

    return Response({'error': f'Failed to reach Pokémon TCG API for set {set_id}'}, status=status.HTTP_502_BAD_GATEWAY)
