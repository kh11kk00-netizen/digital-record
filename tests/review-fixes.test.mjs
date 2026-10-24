import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path) {
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('exports',code)(exports);
  return exports;
}
const dates=load('../src/lib/dates.ts');
const reader=load('../src/lib/invoice-reader.ts');
test('2: document extraction excludes hidden financial and merchant fields',()=>{
  assert.deepEqual(reader.usableExtraction('document',{title:'License',detail:'Note',dueDate:'2027-01-01',invoiceNumber:'123',price:'1299',currency:'SAR',merchant:'Shop',brand:'Brand'}),{title:'License',detail:'Note',dueDate:'2027-01-01',invoiceNumber:'123'});
  assert.equal(reader.usableExtraction('subscription',{invoiceNumber:'hidden',price:'10'}).invoiceNumber,undefined);
  assert.equal(reader.usableExtraction('purchase',{price:'10'}).price,'10');
});
test('3: amounts distinguish grouping from decimals and reject malformed/ambiguous values',()=>{
  for(const [raw,value] of [['1,299',1299],['1,234.50',1234.5],['١٬٢٩٩',1299],['٩٩٫٥',99.5],['12,50',12.5],['۱۲,۵۰',12.5],['1,234,567.89',1234567.89]]) assert.equal(dates.parseAmount(raw),value,raw);
  for(const raw of ['1,2','12,3456','1,23,456','1٬23','1,234٬567','1.234,50','-1','Infinity','', '1 299']) assert.equal(dates.parseAmount(raw),null,raw);
  assert.equal(dates.normalizeDigits('١,۲'),'1,2');
});
test('4: Gregorian input enforces 1900..2200 and flags Hijri-looking years',()=>{
  for(const raw of ['1447-03-15','١٤٤٧/٣/١٥','1899-12-31','2201-01-01','2025-02-29']) assert.equal(dates.coerceDateInput(raw),null);
  for(const raw of ['1900-01-01','2200-12-31','٢٠٢٤/٢/٢٩']) assert.ok(dates.coerceDateInput(raw));
  assert.equal(dates.looksHijri('١٤٤٧/٣/١٥'),true);
  assert.equal(dates.looksHijri('2026-01-01'),false);
});
test('5: existing and saved values are opt-in; selected fields still respect intervening edits',()=>{
  const snapshot={title:'Saved record',merchant:'Typed before scan',price:'',detail:''};
  const fields={title:'OCR title',merchant:'OCR shop',price:'99',detail:'OCR note'};
  const selected=reader.defaultExtractionSelection(snapshot,fields);
  assert.deepEqual(selected,{price:'99',detail:'OCR note'});
  assert.deepEqual(reader.mergeReviewedExtraction(snapshot,snapshot,selected),{...snapshot,price:'99',detail:'OCR note'});
  const optedIn={...selected,title:fields.title};delete optedIn.detail;
  const current={...snapshot,price:'Manually changed while waiting'};
  assert.deepEqual(reader.mergeReviewedExtraction(current,snapshot,optedIn),{...current,title:'OCR title'});
  assert.deepEqual(snapshot,{title:'Saved record',merchant:'Typed before scan',price:'',detail:''});
});
test('7: hosting errors and invalid JSON report SERVER_UNAVAILABLE; API errors remain specific',async()=>{
  const oldURL=process.env.EXPO_PUBLIC_OCR_URL, oldFetch=globalThis.fetch;
  process.env.EXPO_PUBLIC_OCR_URL='https://reader.invalid';
  const client=load('../src/lib/invoice-reader.ts');
  try {
    for(const [body,status,type] of [['<html>down</html>',200,'text/html'],['{}',404,'application/json'],['{}',503,'application/json'],['bad json',200,'application/json']]){
      globalThis.fetch=async()=>new Response(body,{status,headers:{'content-type':type}});
      await assert.rejects(client.readInvoice('image','token',new AbortController().signal),/SERVER_UNAVAILABLE/);
    }
    globalThis.fetch=async()=>new Response('{"error":"UNAUTHORIZED"}',{status:401,headers:{'content-type':'application/json'}});
    await assert.rejects(client.readInvoice('image','token',new AbortController().signal),/UNAUTHORIZED/);
    globalThis.fetch=async()=>new Response('{"fields":{"title":"Receipt"}}',{headers:{'content-type':'application/json; charset=utf-8'}});
    assert.deepEqual((await client.readInvoice('image','token',new AbortController().signal)).fields,{title:'Receipt'});
  } finally {globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.EXPO_PUBLIC_OCR_URL;else process.env.EXPO_PUBLIC_OCR_URL=oldURL;}
});
test('pilot builds point at the reader and upload only to internal testing and TestFlight',()=>{
  const eas=JSON.parse(readFileSync(new URL('../eas.json',import.meta.url),'utf8'));
  const app=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8')).expo;
  assert.equal(app.android.package,'com.kh11kk.digitalrecord');
  assert.equal(app.ios.bundleIdentifier,'com.kh11kk.digitalrecord');
  assert.equal(eas.build.pilot.env.EXPO_PUBLIC_OCR_URL,'https://digital-record-reader.kh11kk00.workers.dev');
  assert.equal(eas.submit.pilot.android.track,'internal');
  assert.equal(eas.submit.pilot.ios.ascAppId,'6825120606');
  assert.equal(eas.build.production.env?.EXPO_PUBLIC_OCR_URL,undefined);
});
