import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {addIslandStreet} from '../client/islandStreet';

test('street warmup waits for its images and settles when an image fails',async t=>{
  const downloads=new Map<string,(failed:boolean)=>void>();
  t.mock.method(T.TextureLoader.prototype,'load',function(this:T.TextureLoader,url:string){
    this.manager.itemStart(url);
    downloads.set(url,failed=>{
      if(failed)this.manager.itemError(url);
      this.manager.itemEnd(url);
    });
    return new T.Texture();
  });
  const street=addIslandStreet(new T.Group());
  try {
    const samples='/shooter/island-street/chandlery-samples.webp';
    assert.ok(downloads.has(samples));
    for(const [url,complete] of downloads)if(url!==samples)complete(false);
    let ready=false;
    void street.ready.then(()=>{ready=true;});
    await Promise.resolve();
    assert.equal(ready,false);
    downloads.get(samples)!(true);
    await Promise.resolve();
    assert.equal(ready,true);
  } finally { street.dispose(); }
});
