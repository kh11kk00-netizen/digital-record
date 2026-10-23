import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the real storage helper with a native-filesystem adapter, without a device.
function storage(failCopy=false) {
  const paths=new Set(['file:///cache/picked.jpg','file:///photos/original.jpg']);
  class Directory { constructor(){this.uri='file:///documents/invoices/';this.exists=true;} }
  class File {
    constructor(parent,name){this.uri=name ? parent.uri+name : parent;}
    get exists(){return paths.has(this.uri);}
    get size(){return this.exists?100:0;}
    copy(dest){if(failCopy)throw Error('disk full');paths.add(dest.uri);}
    delete(){paths.delete(this.uri);}
  }
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL('../src/lib/files.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','exports',code)(name=>name==='react-native'?{Platform:{OS:'ios'}}:{Directory,File,Paths:{cache:{uri:'file:///cache/'},document:{uri:'file:///documents/'}}},exports);
  return {helpers:exports,paths};
}
test('image copy failure is surfaced instead of accepting a temporary URI',()=>{
  const {helpers,paths}=storage(true);
  assert.throws(()=>helpers.persistImage('file:///cache/picked.jpg'),/IMAGE_SAVE_FAILED/);
  assert.deepEqual([...paths],['file:///cache/picked.jpg','file:///photos/original.jpg']);
});
test('a successful image copy survives cache cleanup; library originals are never deleted',()=>{
  const {helpers,paths}=storage();
  const saved=helpers.persistImage('file:///cache/picked.jpg');
  assert.match(saved,/^file:\/\/\/documents\/invoices\//);
  helpers.deleteCachedImage('file:///cache/picked.jpg');
  helpers.deleteCachedImage('file:///photos/original.jpg');
  assert.equal(paths.has(saved),true);
  assert.equal(paths.has('file:///cache/picked.jpg'),false);
  assert.equal(paths.has('file:///photos/original.jpg'),true);
  helpers.deleteImage(saved);
  assert.equal(paths.has(saved),false);
});
