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

test('client drops invalid dates, prices and currencies before filling fields',async()=>{
  const originalFetch=globalThis.fetch;
  const oldURL=process.env.EXPO_PUBLIC_OCR_URL;
  process.env.EXPO_PUBLIC_OCR_URL='https://reader.example.invalid';
  const client={};new Function('exports',code)(client);
  const fields={title:'Phone',purchaseDate:'2026-02-30',warrantyEndsOn:'1447-03-15',dueDate:'2027-01-31',price:'1,299',currency:'sar',warrantyMonths:'0',returnPeriodDays:'14'};
  globalThis.fetch=async()=>new Response(JSON.stringify({fields}),{headers:{'content-type':'application/json'}});
  try {
    assert.deepEqual(await client.readInvoice('img','token',new AbortController().signal),{title:'Phone',dueDate:'2027-01-31',returnPeriodDays:'14'});
    fields.price='99.50';fields.currency='SAR';
    const result=await client.readInvoice('img','token',new AbortController().signal);
    assert.equal(result.price,'99.50');assert.equal(result.currency,'SAR');
  } finally {globalThis.fetch=originalFetch;if(oldURL===undefined)delete process.env.EXPO_PUBLIC_OCR_URL;else process.env.EXPO_PUBLIC_OCR_URL=oldURL;}
});

test('connection failures are reported as NETWORK, not a generic failure',async()=>{
  const originalFetch=globalThis.fetch;
  const oldURL=process.env.EXPO_PUBLIC_OCR_URL;
  process.env.EXPO_PUBLIC_OCR_URL='https://reader.example.invalid';
  const client={};new Function('exports',code)(client);
  globalThis.fetch=async()=>{throw new TypeError('Network request failed');};
  try {await assert.rejects(client.readInvoice('img','token',new AbortController().signal),/NETWORK/);}
  finally {globalThis.fetch=originalFetch;if(oldURL===undefined)delete process.env.EXPO_PUBLIC_OCR_URL;else process.env.EXPO_PUBLIC_OCR_URL=oldURL;}
});
