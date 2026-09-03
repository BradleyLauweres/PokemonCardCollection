from pathlib import Path
from django.core.management.base import BaseCommand
from collection.models import CollectedCard
from collection.views import format_backup_txt, BASE_DIR

class Command(BaseCommand):
    help = 'Backup collected cards to a text file'

    def add_arguments(self, parser):
        parser.add_argument('--set', type=str, help='Specific set ID to backup (e.g. sv6pt5), or leave blank for all')
        parser.add_argument('--file', type=str, help='Target file path for backup')

    def handle(self, *args, **options):
        set_id = options.get('set')
        target_file = options.get('file')

        cards = CollectedCard.objects.all().order_by('set_id', 'number')
        if set_id and set_id not in ('all', 'all_sets'):
            cards = cards.filter(set_id=set_id)

        scope_name = set_id if (set_id and set_id not in ('all', 'all_sets')) else 'all_sets'
        card_list = list(cards)
        content = format_backup_txt(card_list, scope=scope_name)

        if target_file:
            file_path = Path(target_file)
        else:
            backups_dir = BASE_DIR / 'backups'
            backups_dir.mkdir(parents=True, exist_ok=True)
            file_path = backups_dir / f'backup_{scope_name}.txt'

        file_path.write_text(content, encoding='utf-8')
        self.stdout.write(self.style.SUCCESS(f'Successfully backed up {len(card_list)} cards to {file_path}'))
