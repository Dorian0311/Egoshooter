import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';

const host=process.argv[2]?.toLowerCase();
if(process.argv.length!==3||!host||host.length>253||!host.split('.').every(part=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))){
 console.error('Usage: node scripts/configure-docker.mjs game.example.org (hostname only, without https:// or port)');
 process.exitCode=1;
}else{
 const value=[`GAME_HOST=${host}`,`SHOOTER_ORIGINS=https://${host}`,
  `SHOOTER_TICKET_SECRET=${randomBytes(48).toString('hex')}`,
  `POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}`,''].join('\n');
 try{
  await writeFile('.env',value,{flag:'wx',mode:0o600});
  console.log(`Created private .env for https://${host}. Existing files are never overwritten.`);
  console.log('Start: docker compose up -d --build');
 }catch(error){
  if(error.code==='EEXIST'){console.error('.env already exists. Keep its secrets; update GAME_HOST and SHOOTER_ORIGINS manually.');process.exitCode=1;}
  else throw error;
 }
}
