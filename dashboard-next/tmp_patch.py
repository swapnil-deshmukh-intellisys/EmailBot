from pathlib import Path
path = Path('app/dashboard/page.js')
text = path.read_text()
if 'const loadScript' in text:
    start = text.index('const loadScript')
