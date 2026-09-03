from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from collection.views import parse_backup_txt, restore_cards_from_data, BASE_DIR

class Command(BaseCommand):
    help = 'Restore collected cards from a backup text file'

    def add_arguments(self, parser):
        parser.add_argument('--file', type=str, help='Path to backup text file')
        parser.add_argument('--set', type=str, help='Specific set ID backup file to restore from backend/backups/')

    def handle(self, *args, **options):
        file_arg = options.get('file')
        set_arg = options.get('set')

        if file_arg:
            file_path = Path(file_arg)
        elif set_arg:
            file_path = BASE_DIR / 'backups' / f'backup_{set_arg}.txt'
        else:
            file_path = BASE_DIR / 'backups' / 'backup_all_sets.txt'

        if not file_path.exists():
            raise CommandError(f'Backup file not found at {file_path}')

        content = file_path.read_text(encoding='utf-8')
        cards_data = parse_backup_txt(content)
        if not cards_data:
            raise CommandError('No valid card data found in backup file')

        count = restore_cards_from_data(cards_data)
        self.stdout.write(self.style.SUCCESS(f'Successfully restored {count} cards from {file_path}'))
