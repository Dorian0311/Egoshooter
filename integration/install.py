"""Install only shooter-owned files and surgical integration anchors. Idempotent."""
from pathlib import Path
import json
import shutil
import sys
root = Path(__file__).resolve().parents[1]
target = Path(sys.argv[1]).resolve()
shell = target / 'app/modules/casino/components/CasinoShell.tsx'
main = target / 'backend/app/main.py'
if not shell.is_file() or not main.is_file():
    raise SystemExit('Not a supported Ticketsystem checkout')
text = shell.read_text(encoding='utf-8-sig')
anchor = 'export function CasinoShell(props: CasinoShellProps) {'
if 'function CasinoShellContent' not in text:
    if text.count(anchor) != 1:
        raise SystemExit('CasinoShell anchor changed; no files modified')
    text = text.replace(anchor, 'function CasinoShellContent(props: CasinoShellProps) {', 1)
    text = 'import { ShooterGate } from "./ShooterGate";\n' + text
    text += '\nexport function CasinoShell(props: CasinoShellProps) {\n  return <><ShooterGate accessToken={props.accessToken}/><CasinoShellContent {...props}/></>;\n}\n'
main_text = main.read_text(encoding='utf-8-sig')
main_anchor = 'app.include_router(casino_router)'
if main_anchor not in main_text:
    raise SystemExit('Backend anchor changed; no files modified')
if 'app.include_router(shooter_router)' not in main_text:
    main_text = main_text.replace(main_anchor, main_anchor + '\nfrom .modules.casino.shooter import router as shooter_router\napp.include_router(shooter_router)')
destination = target / 'app/modules/casino/shooter'
for folder in ['client', 'shared']:
    (destination / folder).mkdir(parents=True, exist_ok=True)
    for source in (root / folder).iterdir():
        if source.name == 'main.tsx': continue
        shutil.copy2(source, destination / folder / source.name)
shutil.copytree(root / 'public/shooter', target / 'public/shooter', dirs_exist_ok=True)
shutil.copy2(root / 'integration/ShooterGate.tsx', shell.parent / 'ShooterGate.tsx')
shutil.copy2(root / 'integration/shooter.py', target / 'backend/app/modules/casino/shooter.py')
shutil.copy2(root / 'deploy/supporthub-shooter.override.yml', target / 'compose.shooter.yml')
shutil.copy2(root / 'integration/test_shooter.py', target / 'backend/tests/test_shooter.py')
shell.write_text(text, encoding='utf-8')
main.write_text(main_text, encoding='utf-8')
package = target / 'package.json'
manifest = json.loads(package.read_text(encoding='utf-8-sig'))
manifest['dependencies']['@colyseus/sdk'] = '0.18.10'
package.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Shooter integrated; existing uncommitted changes preserved. Run npm install in target.')
