import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {createReader, costMicroUsd} from './index.mjs';
import {cleanExtraction} from './extraction.mjs';
import {loadConfig} from './config.mjs';

test('unknown fields, impossible dates and invented numeric formats are rejected',()=>{
  assert.deepEqual(cleanExtraction({title:' Phone ',purchaseDate:'2026-02-30',warrantyMonths:'two',price:'1,000',currency:'SAR',extra:'secret'}),{title:'Phone',currency:'SAR'});
  assert.deepEqual(cleanExtraction({purchaseDate:'2026-02-28',warrantyMonths:null,price:'100.50'}),{purchaseDate:'2026-02-28',price:'100.50'});
});
test('Arabic and Persian numerals are normalized; Hijri years are not mislabelled Gregorian',()=>{
  assert.deepEqual(cleanExtraction({purchaseDate:'٢٠٢٦-١٠-٢٤',price:'١٢٣٫٥٠',warrantyMonths:'۲۴'}),
    {purchaseDate:'2026-10-24',price:'123.50',warrantyMonths:'24'});
  assert.deepEqual(cleanExtraction({purchaseDate:'1448-04-10',price:'1,000'}),{});
  assert.throws(()=>cleanExtraction({title:{unexpected:'object'}}),/INVALID_RESULT/);
});
test('cost uses provider token counts and bills thinking tokens as output',()=>{
  assert.deepEqual(costMicroUsd({promptTokenCount:1400,candidatesTokenCount:200,thoughtsTokenCount:300},{inputUsdPerM:0.30,outputUsdPerM:2.50}),
    {inputTokens:1400,outputTokens:500,costMicroUsd:1670});
  assert.deepEqual(costMicroUsd(undefined,{inputUsdPerM:1,outputUsdPerM:1}),{inputTokens:0,outputTokens:0,costMicroUsd:0});
});
test('config validates plans and limits',()=>{
  assert.equal(loadConfig({}).plans.free.monthlyReads,10);
  assert.equal(loadConfig({OCR_PLANS:'{"free":{"monthlyReads":3},"paid":{"monthlyReads":50}}'}).plans.paid.monthlyReads,50);
  assert.throws(()=>loadConfig({OCR_PLANS:'{"paid":{"monthlyReads":5}}'}),/free/);
  assert.throws(()=>loadConfig({OCR_DAILY_READS:'-1'}),/OCR_DAILY_READS/);
  assert.throws(()=>loadConfig({OCR_INVITE_CODE:'short'}),/12/);
});

const providerReply=(fields,usage={promptTokenCount:1400,candidatesTokenCount:100})=>new Response(JSON.stringify({usageMetadata:usage,candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(fields)}]}}]}));
async function withReader(overrides, fetcher, fn){
  const dir=mkdtempSync(join(tmpdir(),'reader-test-'));
  const config={...loadConfig({GEMINI_API_KEY:'fake-provider-key',OCR_DB_PATH:join(dir,'reader.db')}),...overrides};
  let server;
  const start=async()=>{server=createReader(config,{fetcher});await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;};
  const stop=()=>new Promise(r=>server.close(r));
  try {await fn({start,stop,dir,config});} finally {if(server?.listening) await stop();rmSync(dir,{recursive:true,force:true});}
}
const post=(url,body,token)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
const register=async(url,body={})=>{const r=await post(url+'/v1/register',body);return {status:r.status,...await r.json()};};

test('per-user monthly limit is enforced, persisted and isolated between users', async()=>{
  let calls=0;
  await withReader({plans:{free:{monthlyReads:2},paid:{monthlyReads:5}}}, async(url,options)=>{
    calls++;
    assert.equal(options.headers['x-goog-api-key'],'fake-provider-key');
    assert.equal(JSON.parse(options.body).contents[0].parts[0].inlineData.mimeType,'image/jpeg');
    return providerReply({title:'Test invoice',price:'12.50',warrantyMonths:null});
  }, async({start,stop})=>{
    let url=await start();
    const a=await register(url), b=await register(url);
    assert.equal(a.status,201);assert.match(a.token,/^dr1\.[\w-]{16}\.[\w-]{43}$/);
    assert.deepEqual({used:a.usage.used,limit:a.usage.limit,remaining:a.usage.remaining},{used:0,limit:2,remaining:2});
    const first=await(await post(url+'/v1/extract',{image:'/9j/'},a.token)).json();
    assert.deepEqual(first.fields,{title:'Test invoice',price:'12.50'});
    assert.equal(first.usage.remaining,1);
    await stop();url=await start();
    assert.equal((await post(url+'/v1/extract',{image:'/9j/'},a.token)).status,200);
    const blocked=await post(url+'/v1/extract',{image:'/9j/'},a.token);
    assert.equal(blocked.status,429);assert.equal((await blocked.json()).error,'QUOTA_EXCEEDED');
    assert.equal((await post(url+'/v1/extract',{image:'/9j/'},b.token)).status,200);
    const usage=await(await fetch(url+'/v1/usage',{headers:{Authorization:'Bearer '+a.token}})).json();
    assert.deepEqual({used:usage.usage.used,remaining:usage.usage.remaining},{used:2,remaining:0});
    assert.equal(calls,3);
  });
});

test('authentication rejects missing, forged and wrong-secret tokens before any provider call', async()=>{
  await withReader({}, async()=>{throw Error('provider must not be called');}, async({start})=>{
    const url=await start();
    const {token}=await register(url);
    const [prefix,id]=token.split('.');
    for (const bad of [undefined,'nonsense',`${prefix}.${id}.${'A'.repeat(43)}`,`${prefix}.${'B'.repeat(16)}.${'A'.repeat(43)}`]) {
      assert.equal((await post(url+'/v1/extract',{image:'/9j/'},bad)).status,401,String(bad));
    }
    assert.equal((await post(url+'/v1/extract',{image:'not-an-image'},token)).status,400);
  });
});

test('invite code gates registration during the pilot; registrations are rate limited per IP', async()=>{
  await withReader({inviteCode:'pilot-invite-code-1',registrationsPerIpPerHour:2}, async()=>providerReply({title:'x'}), async({start})=>{
    const url=await start();
    assert.equal((await register(url)).status,403);
    assert.equal((await register(url,{inviteCode:'wrong-invite-code-1'})).status,403);
    assert.equal((await register(url,{inviteCode:'pilot-invite-code-1'})).status,429);
  });
  await withReader({inviteCode:'pilot-invite-code-1'}, async()=>providerReply({title:'x'}), async({start})=>{
    const url=await start();
    assert.equal((await register(url,{inviteCode:'pilot-invite-code-1'})).status,201);
  });
});

test('provider failures are refunded; billed but unreadable results count and record cost', async()=>{
  let mode='fail';
  await withReader({plans:{free:{monthlyReads:1}}}, async()=>{
    if(mode==='fail') return new Response('{}',{status:503});
    if(mode==='network') throw new TypeError('fetch failed');
    return new Response(JSON.stringify({usageMetadata:{promptTokenCount:1000,candidatesTokenCount:10},candidates:[{finishReason:'SAFETY'}]}));
  }, async({start,dir})=>{
    const url=await start();
    const {token}=await register(url);
    assert.equal((await post(url+'/v1/extract',{image:'/9j/'},token)).status,502);
    mode='network';
    assert.equal((await post(url+'/v1/extract',{image:'/9j/'},token)).status,503);
    mode='unreadable';
    const unreadable=await post(url+'/v1/extract',{image:'/9j/'},token);
    assert.equal(unreadable.status,422);assert.equal((await unreadable.json()).usage.remaining,0);
    assert.equal((await post(url+'/v1/extract',{image:'/9j/'},token)).status,429);
    const {DatabaseSync}=await import('node:sqlite');
    const db=new DatabaseSync(join(dir,'reader.db'));
    const row=db.prepare('SELECT reads, refunds, input_tokens, output_tokens, cost_micro_usd FROM usage').get();
    db.close();
    assert.deepEqual({...row},{reads:1,refunds:2,input_tokens:1000,output_tokens:10,cost_micro_usd:325});
  });
});

test('global daily budget stops reads once estimated cost reaches the cap', async()=>{
  await withReader({dailyBudgetUsd:0.000001}, async()=>providerReply({title:'x'},{promptTokenCount:10,candidatesTokenCount:1}), async({start})=>{
    const url=await start();
    const {token}=await register(url);
    assert.equal((await post(url+'/v1/extract',{image:'/9j/'},token)).status,200);
    const blocked=await post(url+'/v1/extract',{image:'/9j/'},token);
    assert.equal(blocked.status,429);assert.equal((await blocked.json()).error,'DAILY_LIMIT');
  });
});

test('stored data contains no image, extracted text or token secret', async()=>{
  await withReader({}, async()=>providerReply({title:'Secret Product Name',merchant:'Private Shop'}), async({start,dir})=>{
    const url=await start();
    const {token}=await register(url);
    assert.equal((await post(url+'/v1/extract',{image:'/9j/AAAA'},token)).status,200);
    const raw=readFileSync(join(dir,'reader.db')).toString('latin1')+readFileSync(join(dir,'reader.db-wal')).toString('latin1');
    for (const needle of ['Secret Product Name','Private Shop','/9j/AAAA',token.split('.')[2]]) assert.equal(raw.includes(needle),false,needle);
  });
});

test('oversized uploads are refused from Content-Length before reading the body', async()=>{
  await withReader({}, async()=>{throw Error('must not call provider');}, async({start})=>{
    const url=await start();
    const {token}=await register(url);
    const status=await new Promise((resolve,reject)=>{
      const req=request(url+'/v1/extract',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,'Content-Length':'9000000'}},res=>{resolve(res.statusCode);res.resume();});
      req.on('error',reject);req.end();
    });
    assert.equal(status,413);
  });
});
