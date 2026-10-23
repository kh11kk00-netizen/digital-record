import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const exports={};
const source=readFileSync(new URL('../src/lib/invoice-reader.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
new Function('exports',code)(exports);

test('review keeps intervening manual edits and missing fields; source form is not mutated',()=>{
  const snapshot={title:'Old phone',price:'',merchant:'Local shop',detail:'My note'};
  const current={...snapshot,title:'Manually corrected phone'};
  const result=exports.mergeReviewedExtraction(current,snapshot,{title:'OCR phone',price:'99.50'});
  assert.deepEqual(result,{title:'Manually corrected phone',price:'99.50',merchant:'Local shop',detail:'My note'});
  assert.equal(current.price,'');
  assert.deepEqual(exports.mergeReviewedExtraction(current,null,{price:'5'}),current);
});

test('a late aborted request does not return data for application',async()=>{
  const originalFetch=globalThis.fetch;
  const oldURL=process.env.EXPO_PUBLIC_OCR_URL;
  process.env.EXPO_PUBLIC_OCR_URL='https://reader.example.invalid';
  const client={};new Function('exports',code)(client);
  const controller=new AbortController();controller.abort();
  globalThis.fetch=async(_url,options)=>{options.signal.throwIfAborted();throw Error('unexpected');};
  try {await assert.rejects(client.readInvoice('test','test-token',controller.signal),{name:'AbortError'});}
  finally {globalThis.fetch=originalFetch;if(oldURL===undefined)delete process.env.EXPO_PUBLIC_OCR_URL;else process.env.EXPO_PUBLIC_OCR_URL=oldURL;}
});
