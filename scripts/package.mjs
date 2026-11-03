import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const metadata=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const directory=path.join(root,'dist/extension');
const files=[];
async function collect(dir,relative='') {
  for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
    const name=relative?relative+'/'+entry.name:entry.name;
    if(entry.isSymbolicLink())throw new Error('Symlinks are not package inputs');
    if(entry.isDirectory())await collect(path.join(dir,entry.name),name);
    else files.push({name:'extension/'+name,data:await fs.readFile(path.join(dir,entry.name))});
  }
}
await collect(directory);
// A small deterministic ZIP writer (store method, UTF-8 names, fixed timestamp).
const table=Uint32Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
const crc=data=>{let value=0xffffffff;for(const byte of data)value=table[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;};
const bodies=[],central=[];let offset=0;
for(const file of files){
  const name=Buffer.from(file.name,'utf8'),checksum=crc(file.data),header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(checksum,14);header.writeUInt32LE(file.data.length,18);header.writeUInt32LE(file.data.length,22);header.writeUInt16LE(name.length,26);
  bodies.push(header,name,file.data);
  const index=Buffer.alloc(46);index.writeUInt32LE(0x02014b50);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);index.writeUInt16LE(0x800,8);index.writeUInt16LE(33,14);index.writeUInt32LE(checksum,16);index.writeUInt32LE(file.data.length,20);index.writeUInt32LE(file.data.length,24);index.writeUInt16LE(name.length,28);index.writeUInt32LE(offset,42);
  central.push(index,name);offset+=header.length+name.length+file.data.length;
}
const centralData=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralData.length,12);end.writeUInt32LE(offset,16);
const bytes=Buffer.concat([...bodies,centralData,end]),releaseDir=path.join(root,'releases');await fs.mkdir(releaseDir,{recursive:true});
const fileName=`jobfill-extension-${metadata.version}.zip`;
await fs.writeFile(path.join(releaseDir,fileName),bytes);
await fs.writeFile(path.join(releaseDir,fileName+'.sha256'),createHash('sha256').update(bytes).digest('hex')+'  '+fileName+'\n');
console.log(`Packaged ${files.length} extension files: releases/${fileName}`);
