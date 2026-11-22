"""Package application code without overwriting a user's environment or live data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json, sys
root=Path(__file__).resolve().parents[1]
archive=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root.parent/'BounceBash_Update.zip'
assert not archive.is_relative_to(root), 'Write the archive outside the application directory'
manifest={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
    for p in (root/'Bouncebash_Admin').rglob('*') if p.is_file() and not p.is_symlink()}
excluded={'node_modules','public','.git','.history','backups','__pycache__'}
with ZipFile(archive,'x',ZIP_DEFLATED,compresslevel=6) as z:
    for f in sorted(root.rglob('*')):
        if not f.is_file():continue
        rel=f.relative_to(root)
        if rel.parts[0]=='data' or any(p in excluded for p in rel.parts) or f.is_symlink():continue
        name=f.name.lower()
        if (name.startswith('.env') and name!='.env.example') or name=='cookies.txt' or name.endswith(('.sqlite','.sqlite3','.db','.sqlite-wal','.sqlite-shm','.sqlite3-wal','.sqlite3-shm','.db-wal','.db-shm')):continue
        z.write(f,'BounceBash/'+rel.as_posix())
    z.writestr('BounceBash/data/','')
with ZipFile(archive) as z:
    assert z.testzip() is None
    for name,digest in manifest.items():assert hashlib.sha256(z.read('BounceBash/'+name)).hexdigest()==digest
    assert not any(n.endswith('/.env') or n.endswith('.sqlite') or '/node_modules/' in n for n in z.namelist())
    assert 'BounceBash/START_WINDOWS.bat' in z.namelist()
    print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size,'files':len(z.namelist()),'admin_files_verified':len(manifest),'zip_integrity':'passed','private_settings_and_live_data':'excluded to preserve installed files'}))
