import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('data/source-manifest.json','utf8'));
for(const f of manifest.files){const digest=createHash('sha256').update(readFileSync(f.path)).digest('hex');if(digest!==f.sha256)throw new Error('Source digest mismatch: '+f.path);}
console.log(`Source manifest verified: ${manifest.files.length} immutable files; domain as-of ${manifest.snapshot}`);
