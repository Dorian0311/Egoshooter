import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';

let files=0,original=0,compressed=0;
async function visit(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);
  if(entry.isDirectory()){await visit(path);continue;}
  if(!/\.(js|css|json|gltf|glb|bin|hdr|svg)$/.test(entry.name))continue;
  const source=await readFile(path);if(source.length<1024)continue;
  const br=brotliCompressSync(source,{params:{[constants.BROTLI_PARAM_QUALITY]:5}});
  if(br.length>=source.length*.95)continue;
  await writeFile(path+'.br',br);await writeFile(path+'.gz',gzipSync(source,{level:6}));
  files++;original+=source.length;compressed+=br.length;
 }
}
await visit('dist');
console.log(`Compressed ${files} client assets: ${(original/1048576).toFixed(1)} -> ${(compressed/1048576).toFixed(1)} MiB (Brotli)`);
