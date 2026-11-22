'use strict';
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const out=path.join(root,'public');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const allowed=/\.(html|css|js|png|jpg|jpeg|svg|webp|ico)$/i;
for(const name of ['assets','Bouncebash_CS'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true,filter:(src)=>fs.statSync(src).isDirectory()||allowed.test(src)});
fs.copyFileSync(path.join(root,'index.html'),path.join(out,'index.html'));
console.log('Built explicit public asset directory. Database, config, tests and backend source excluded.');
