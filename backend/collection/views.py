import time
import requests
import json
from pathlib import Path
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.core.cache import cache
from django.db.models import Sum, F
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
    if set_id:
        cards = CollectedCard.objects.filter(set_id=set_id)
    else:
        cards = CollectedCard.objects.all()
    serializer = CollectedCardSerializer(cards, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def toggle_card(request):
    card_id = request.data.get('card_id')
    set_id = request.data.get('set_id', '')
    name = request.data.get('name', '')
    number = request.data.get('number', '')
    rarity = request.data.get('rarity', '')
    image_url = request.data.get('image_url', '')
    market_price = request.data.get('market_price', 0.0)
    custom_price = request.data.get('custom_price', 0.0)

    if not card_id:
        return Response({'error': 'card_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    existing = CollectedCard.objects.filter(card_id=card_id).first()
    if existing:
        existing.delete()
        return Response({
            'owned': False,
            'card_id': card_id,
            'message': f'Removed {card_id} from collection'
        })
    else:
        card = CollectedCard.objects.create(
            card_id=card_id,
            set_id=set_id,
            name=name,
            number=number,
            rarity=rarity,
            image_url=image_url,
            market_price=float(market_price or 0.0),
            custom_price=float(custom_price or 0.0),
            quantity=1
        )
        serializer = CollectedCardSerializer(card)
        return Response({
            'owned': True,
            'card': serializer.data,
            'message': f'Added {card_id} to collection'
        })


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

    if quantity <= 0:
        CollectedCard.objects.filter(card_id=card_id).delete()
        return Response({'owned': False, 'card_id': card_id, 'quantity': 0})

    card = CollectedCard.objects.filter(card_id=card_id).first()
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
            quantity=quantity
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
        return Response({'error': 'Card is not in collection'}, status=status.HTTP_404_NOT_FOUND)

    if custom_price is not None:
        try:
            card.custom_price = float(custom_price)
        except ValueError:
            pass

    if notes is not None:
        card.notes = notes

    card.save()
    serializer = CollectedCardSerializer(card)
    return Response({'owned': True, 'card': serializer.data})


@api_view(['POST'])
def bulk_toggle(request):
    set_id = request.data.get('set_id')
    action = request.data.get('action')
    cards_data = request.data.get('cards', [])

    if not set_id or not action:
        return Response({'error': 'set_id and action are required'}, status=status.HTTP_400_BAD_REQUEST)

    if action == 'clear_all':
        count, _ = CollectedCard.objects.filter(set_id=set_id).delete()
        return Response({'message': f'Cleared {count} cards for set {set_id}'})
    elif action == 'mark_all':
        created_count = 0
        for item in cards_data:
            c_id = item.get('id')
            if not c_id:
                continue
            
            # Extract market price
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
                    'quantity': 1
                }
            )
            if created:
                created_count += 1
        return Response({'message': f'Marked set {set_id} cards as collected (added {created_count})'})

    return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_stats(request):
    all_collected = CollectedCard.objects.all()
    total_cards = all_collected.count()

    total_market_value = 0.0
    total_custom_value = 0.0
    set_counts = {}
    set_values = {}

    for card in all_collected:
        qty = card.quantity or 1
        val_m = (card.market_price or 0.0) * qty
        val_c = (card.custom_price or card.market_price or 0.0) * qty

        total_market_value += val_m
        total_custom_value += val_c

        set_counts[card.set_id] = set_counts.get(card.set_id, 0) + 1
        set_values[card.set_id] = set_values.get(card.set_id, 0.0) + val_m

    return Response({
        'total_collected': total_cards,
        'total_sets_tracked': len(set_counts),
        'total_market_value': round(total_market_value, 2),
        'total_custom_value': round(total_custom_value, 2),
        'set_counts': set_counts,
        'set_values': set_values
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
