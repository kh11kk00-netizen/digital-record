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
    assert.deepEqual((await client.readInvoice('img','token',new AbortController().signal)).fields,{title:'Phone',dueDate:'2027-01-31',returnPeriodDays:'14'});
    fields.price='99.50';fields.currency='SAR';
    const {fields:result}=await client.readInvoice('img','token',new AbortController().signal);
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

test('client calls the versioned API, registers anonymously and keeps the usage snapshot from errors',async()=>{
  const originalFetch=globalThis.fetch;
  const oldURL=process.env.EXPO_PUBLIC_OCR_URL;
  process.env.EXPO_PUBLIC_OCR_URL='https://reader.example.invalid/';
  const client={};new Function('exports',code)(client);
  const usage={plan:'free',used:10,limit:10,remaining:0,period:'2026-10',resetsAt:'2026-11-01T00:00:00.000Z'};
  const token='dr1.'+'a'.repeat(16)+'.'+'b'.repeat(43);
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push([url,options.method,options.body]);
    if(url.endsWith('/v1/register')) return new Response(JSON.stringify({token,usage:{...usage,used:0,remaining:10}}),{status:201,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({error:'QUOTA_EXCEEDED',usage}),{status:429,headers:{'content-type':'application/json'}});
  };
  try {
    const created=await client.registerReader('  invite-code-12  ');
    assert.equal(created.token,token);assert.equal(created.usage.remaining,10);
    assert.deepEqual(JSON.parse(calls[0][2]),{inviteCode:'invite-code-12'});
    await assert.rejects(client.readInvoice('img',token,new AbortController().signal),(error)=>error.message==='QUOTA_EXCEEDED'&&error.usage.limit===10);
    assert.equal(calls[1][0],'https://reader.example.invalid/v1/extract');
    globalThis.fetch=async()=>new Response(JSON.stringify({token:'forged'}),{status:201,headers:{'content-type':'application/json'}});
    await assert.rejects(client.registerReader(''),/SERVER_UNAVAILABLE/);
  } finally {globalThis.fetch=originalFetch;if(oldURL===undefined)delete process.env.EXPO_PUBLIC_OCR_URL;else process.env.EXPO_PUBLIC_OCR_URL=oldURL;}
});
