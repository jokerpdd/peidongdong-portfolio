import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../dist');
const paths=new Set();
function check(reference){
 if(!reference||/^(https?:|data:|mailto:|tel:|#)/.test(reference))return;
 const candidate=path.resolve(root,reference.split(/[?#]/)[0]);
 assert(candidate.startsWith(root+path.sep),'Asset escaped public directory');
 assert(fs.existsSync(candidate),`Missing asset: ${reference}`);
 assert(fs.statSync(candidate).isFile(),`Not a file: ${reference}`);paths.add(candidate);
}
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'projects.js'),'utf8'),context);
const projects=context.window.PORTFOLIO_PROJECTS;
assert(projects.length>0,'No projects');assert.equal(new Set(projects.map(p=>p.id)).size,projects.length,'Duplicate project IDs');
for(const project of projects){
 assert(['aigc','brand','explore'].includes(project.group));assert(project.title&&project.media.length);
 check(project.cover);
 if(project.longform){assert.equal(project.media.reduce((sum,m)=>sum+m.height,0),project.longformHeight,'Long image continuity mismatch');assert.equal(new Set(project.media.map(m=>m.width)).size,1,'Long image widths differ');}
 for(const m of project.media){check(m.src);check(m.poster);if(m.type==='image')assert(m.width>0&&m.height>0);}
}
for(const file of ['script.js','water.js','flow.js','projects.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href|srcset)="([^"]+)"/g))check(match[1]);
for(const match of fs.readFileSync(path.join(root,'styles.css'),'utf8').matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g))check(match[1]);
for(let i=1;i<=3;i++){check(`assets/scene-0${i}.webp`);check(`assets/mobile-0${i}.webp`);}
for(let i=1;i<=2;i++)check(`assets/transition-0${i}.mp4`);
assert(!html.includes('MAKE VISUAL MOVE'),'Stale prototype copy');
const maxFile=[...paths].map(p=>({file:path.basename(p),bytes:fs.statSync(p).size})).sort((a,b)=>b.bytes-a.bytes)[0];
console.log(`Validated ${projects.length} projects; ${paths.size} referenced files; all JS syntax passes.`);
console.log(`Largest public asset: ${maxFile.file} (${(maxFile.bytes/1048576).toFixed(2)} MiB).`);
