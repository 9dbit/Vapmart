#!/usr/bin/env python3
"""Idempotent finishing changes for the CP37-A candidate, source only."""
from pathlib import Path
import hashlib,json
path=Path('apps/web/src/app/admin/page.tsx')
text=path.read_text()
old=' async function loadWorkspace(token:string){'
new=" async function loadWorkspace(token:string|null){\n  if(!token)throw Error('Sesi berakhir. Silakan masuk ulang.');"
if old in text:
 text=text.replace(old,new,1)
 path.write_text(text)
elif new not in text:
 raise RuntimeError('Workspace guard does not match the reviewed CP37-A source')
manifest_path=Path('sources/cp37a-source-manifest.json')
manifest=json.loads(manifest_path.read_text())
manifest['files'][str(path)]['after']=hashlib.sha256(text.encode()).hexdigest()
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print('CP37A_FINISH_OK: session guarded before reads')
