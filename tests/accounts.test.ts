import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Accounts} from '../server/accounts';

test('profiles persist with salted hashes; sessions are opaque, expiring and revocable',async()=>{
 const path='artifacts/account-test-'+randomUUID()+'.sqlite',password='Test-only-password-291!';let store=new Accounts(path);
 try{
  const user=await store.register('TestSoldat',password),token=store.createSession(user,1000);
  assert.deepEqual(store.session(token,2000),user);assert.equal(store.session(token,8*86400000),undefined);
  store.close();store=new Accounts(path);
  assert.deepEqual(await store.login('testsoldat',password),user);assert.deepEqual(store.session(token,2000),user);
  const bytes=await readFile(path);assert.equal(bytes.includes(Buffer.from(password)),false);assert.equal(bytes.includes(Buffer.from(token)),false);
  store.logout(token);assert.equal(store.session(token,2000),undefined);
 }finally{store.close();await rm(path,{force:true});}
});
test('duplicate profiles, wrong passwords and invalid account input are rejected',async()=>{
 const store=new Accounts(':memory:');
 try{
  await store.register('Alpha_1','Test-password-1919!');
  await assert.rejects(()=>store.register('ALPHA_1','Another-password-19!'),/vergeben/);
  await assert.rejects(()=>store.login('alpha_1','wrong-password-1919'),/falsch/);
  await assert.rejects(()=>store.login('missing_user','wrong-password-1919'),/falsch/);
  for(const [name,password]of [['a','password123'],['<script>','password123'],['Valid_Name','short'],['A'.repeat(25),'password123']])await assert.rejects(()=>store.register(name,password));
 }finally{store.close();}
});
