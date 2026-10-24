import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, cpSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
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
test('10: direct server entry starts from a relative Unicode path with spaces',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'reader عربي space '));
  cpSync(new URL('../server/',import.meta.url),join(dir,'server'),{recursive:true});
  const child=spawn(process.execPath,['--disable-warning=ExperimentalWarning','server/index.mjs'],{cwd:dir,env:{...process.env,GEMINI_API_KEY:'test-key',PORT:'0',HOST:'127.0.0.1',OCR_DB_PATH:join(dir,'reader.db')},stdio:['ignore','pipe','pipe']});
  try {
    await new Promise((resolve,reject)=>{
      let output='';const timeout=setTimeout(()=>reject(Error('server did not start')),5000);
      child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('Invoice reader ready')){clearTimeout(timeout);resolve();}});
      child.once('error',error=>{clearTimeout(timeout);reject(error);});
      child.once('exit',code=>{clearTimeout(timeout);reject(Error('early exit '+code));});
    });
  } finally {child.kill();await new Promise(resolve=>child.once('close',resolve));rmSync(dir,{recursive:true,force:true});}
});
test('9: admin tool reports usage and adjusts per-user plan and limit on the host only',()=>{
  const dir=mkdtempSync(join(tmpdir(),'reader-admin-'));
  const env={...process.env,OCR_DB_PATH:join(dir,'reader.db')};
  const run=(...args)=>spawnSync(process.execPath,['--disable-warning=ExperimentalWarning','server/admin.mjs',...args],{cwd:new URL('../',import.meta.url),env,encoding:'utf8',timeout:5000});
  try {
    const setup=spawnSync(process.execPath,['--disable-warning=ExperimentalWarning','--input-type=module','-e',"import {openStore} from './server/store.mjs';const s=openStore(process.env.OCR_DB_PATH);console.log(s.register(5).id);s.close();"],{cwd:new URL('../',import.meta.url),env,encoding:'utf8'});
    const id=setup.stdout.trim();
    assert.match(id,/^[\w-]{16}$/);
    assert.equal(run('set-plan',id,'paid').stdout.trim(),'OK');
    assert.equal(run('set-limit',id,'25').stdout.trim(),'OK');
    assert.match(run('user',id).stdout,/plan: 'paid'[\s\S]*limit: 25/);
    assert.notEqual(run('set-plan',id,'gold').status,0);
    assert.match(run('report').stdout,/Period \d{4}-\d{2}/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
