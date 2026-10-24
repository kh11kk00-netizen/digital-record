import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler, costMicroUsd} from '../worker/src/handler.mjs';
import {d1Store, SCHEMA} from '../worker/src/store.mjs';
import {readFileSync} from 'node:fs';
import {loadConfig} from '../worker/src/config.mjs';
import {cleanExtraction, validateImage} from '../worker/src/extraction.mjs';
import {sqlFor} from '../worker/admin.mjs';
import {createD1} from './d1-shim.mjs';

const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD'.padEnd(64, 'A');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'.padEnd(64, 'A');

test('unknown fields, impossible dates and invented numeric formats are rejected',()=>{
  assert.deepEqual(cleanExtraction({title:' Phone ',purchaseDate:'2026-02-30',warrantyMonths:'two',price:'1,000',currency:'SAR',extra:'secret'}),{title:'Phone',currency:'SAR'});
  assert.deepEqual(cleanExtraction({purchaseDate:'2026-02-28',warrantyMonths:null,price:'100.50'}),{purchaseDate:'2026-02-28',price:'100.50'});
});
test('Arabic and Persian numerals are normalized; Hijri years are not mislabelled Gregorian',()=>{
  assert.deepEqual(cleanExtraction({purchaseDate:'٢٠٢٦-١٠-٢٤',price:'١٢٣٫٥٠',warrantyMonths:'۲۴'}),{purchaseDate:'2026-10-24',price:'123.50',warrantyMonths:'24'});
  assert.deepEqual(cleanExtraction({purchaseDate:'1448-04-10',price:'1,000'}),{});
  assert.throws(()=>cleanExtraction({title:{unexpected:'object'}}),/INVALID_RESULT/);
});
test('image validation accepts JPEG and PNG base64 and rejects anything else cheaply',()=>{
  assert.equal(validateImage({image:JPEG}),'image/jpeg');
  assert.equal(validateImage({image:PNG}),'image/png');
  for (const image of [undefined,'','not-an-image','R0lGODlhAQABAIAAAP'.padEnd(64,'A'),JPEG.slice(0,-1),'%%%%'+JPEG.slice(4),'A'.repeat(2_000_004)]) assert.throws(()=>validateImage({image}),/INVALID_IMAGE/);
});
test('cost uses provider token counts and bills thinking tokens as output',()=>{
  assert.deepEqual(costMicroUsd({promptTokenCount:1400,candidatesTokenCount:200,thoughtsTokenCount:300},{inputUsdPerM:0.30,outputUsdPerM:2.50}),{inputTokens:1400,outputTokens:500,costMicroUsd:1670});
  assert.deepEqual(costMicroUsd(undefined,{inputUsdPerM:1,outputUsdPerM:1}),{inputTokens:0,outputTokens:0,costMicroUsd:0});
});
test('config validates plans and limits',()=>{
  assert.equal(loadConfig({}).plans.free.monthlyReads,20);
  assert.equal(loadConfig({}).testPage,true);assert.equal(loadConfig({OCR_TEST_PAGE:'0'}).testPage,false);
  assert.equal(loadConfig({OCR_PLANS:'{"free":{"monthlyReads":3},"paid":{"monthlyReads":50}}'}).plans.paid.monthlyReads,50);
  assert.throws(()=>loadConfig({OCR_PLANS:'{"paid":{"monthlyReads":5}}'}),/free/);
  assert.throws(()=>loadConfig({OCR_DAILY_READS:'-1'}),/OCR_DAILY_READS/);
  assert.throws(()=>loadConfig({OCR_INVITE_CODE:'short'}),/12/);
});
test('built-in schema matches the migration and is idempotent', async()=>{
  const migration=readFileSync(new URL('../worker/migrations/0001_init.sql',import.meta.url),'utf8').replace(/--[^\n]*/g,'').replace(/\s+/g,' ');
  for (const statement of SCHEMA) assert.ok(migration.includes(statement),statement.slice(0,40));
  const db=createD1();
  await d1Store(db).ensureSchema();await d1Store(db).ensureSchema();
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get().n,3);
});
test('admin SQL only accepts validated identifiers, plans and limits',()=>{
  assert.match(sqlFor('set-limit',['abcdefghijklmnop','25'])[0],/monthly_limit = 25 WHERE id = 'abcdefghijklmnop'/);
  assert.match(sqlFor('set-limit',['abcdefghijklmnop','default'])[0],/monthly_limit = NULL/);
  assert.match(sqlFor('report',['2026-10'])[0],/period = '2026-10'/);
  assert.equal(sqlFor('drop',[]),null);
});

const providerReply=(fields,usage={promptTokenCount:1400,candidatesTokenCount:100})=>new Response(JSON.stringify({usageMetadata:usage,candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(fields)}]}}]}));
function setup(overrides={}, fetcher=async()=>providerReply({title:'x'})){
  const db=createD1();
  const config={...loadConfig({GEMINI_API_KEY:'fake-provider-key'}),openRegistration:true,...overrides};
  let clock=new Date('2026-10-24T10:00:00Z');
  const handle=createHandler(config,{store:d1Store(db),fetcher,now:()=>clock});
  const call=(path,{body,token,method='POST',headers={},ip='203.0.113.7'}={})=>handle(new Request('https://reader.test'+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)}),ip);
  const register=async(body={},ip)=>{const r=await call('/v1/register',{body,ip});return {status:r.status,...await r.json()};};
  const extract=(token,image=JPEG)=>call('/v1/extract',{body:{image},token});
  return {db,call,register,extract,setClock:(d)=>{clock=new Date(d);}};
}

test('per-user monthly limit is enforced, isolated between users and resets next month', async()=>{
  let calls=0;
  const {register,extract,call,setClock}=setup({plans:{free:{monthlyReads:2},paid:{monthlyReads:5}}},async(url,options)=>{
    calls++;
    assert.equal(options.headers['x-goog-api-key'],'fake-provider-key');
    assert.match(url,/models\/gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(JSON.parse(options.body).contents[0].parts[0].inlineData.mimeType,'image/jpeg');
    return providerReply({title:'Test invoice',price:'12.50',warrantyMonths:null});
  });
  const a=await register(), b=await register();
  assert.equal(a.status,201);assert.match(a.token,/^dr1\.[\w-]{16}\.[\w-]{43}$/);
  assert.deepEqual([a.usage.used,a.usage.limit,a.usage.remaining],[0,2,2]);
  const first=await(await extract(a.token)).json();
  assert.deepEqual(first.fields,{title:'Test invoice',price:'12.50'});
  assert.equal(first.usage.remaining,1);
  assert.equal((await extract(a.token)).status,200);
  const blocked=await extract(a.token);
  assert.equal(blocked.status,429);
  const blockedBody=await blocked.json();
  assert.equal(blockedBody.error,'QUOTA_EXCEEDED');assert.equal(blockedBody.usage.resetsAt,'2026-11-01T00:00:00.000Z');
  assert.equal((await extract(b.token)).status,200);
  const usage=await(await call('/v1/usage',{method:'GET',token:a.token})).json();
  assert.deepEqual([usage.usage.used,usage.usage.remaining],[2,0]);
  setClock('2026-11-01T00:00:01Z');
  assert.equal((await extract(a.token)).status,200);
  assert.equal(calls,4);
});

test('concurrent requests cannot exceed a user limit', async()=>{
  const {register,extract}=setup({plans:{free:{monthlyReads:3}},requestsPerUserPerMinute:50});
  const {token}=await register();
  const statuses=(await Promise.all(Array.from({length:8},()=>extract(token)))).map(r=>r.status);
  assert.equal(statuses.filter(s=>s===200).length,3);
  assert.equal(statuses.filter(s=>s===429).length,5);
});

test('authentication rejects missing, forged, wrong-secret and disabled tokens before any provider call', async()=>{
  const {register,extract,db}=setup({},async()=>{throw Error('provider must not be called');});
  const {token}=await register();
  const [prefix,id]=token.split('.');
  for (const bad of [undefined,'nonsense',`${prefix}.${id}.${'A'.repeat(43)}`,`${prefix}.${'B'.repeat(16)}.${'A'.repeat(43)}`]) assert.equal((await extract(bad)).status,401,String(bad));
  assert.equal((await extract(token,'not-an-image')).status,400);
  db.raw.prepare('UPDATE users SET disabled = 1 WHERE id = ?').run(id);
  assert.equal((await extract(token)).status,401);
});

test('invite code gates registration; registrations are limited per IP and per day', async()=>{
  const gated=setup({inviteCode:'pilot-invite-code-1',registrationsPerIpPerHour:2});
  assert.equal((await gated.register()).status,403);
  assert.equal((await gated.register({inviteCode:'wrong-invite-code-1'})).status,403);
  assert.equal((await gated.register({inviteCode:'pilot-invite-code-1'})).status,429);
  const open=setup({inviteCode:'pilot-invite-code-1',dailyRegistrations:2});
  assert.equal((await open.register({inviteCode:' pilot-invite-code-1 '},'198.51.100.1')).status,201);
  assert.equal((await open.register({inviteCode:'pilot-invite-code-1'},'198.51.100.2')).status,201);
  assert.equal((await open.register({inviteCode:'pilot-invite-code-1'},'198.51.100.3')).status,429);
});

test('registration stays closed until an invite code is configured; test page is served with a strict CSP', async()=>{
  const closed=setup({openRegistration:false});
  assert.equal((await closed.register()).status,503);
  const health=await(await closed.call('/health',{method:'GET'})).json();
  assert.equal(health.configured,false);
  const page=await closed.call('/test',{method:'GET'});
  assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
  assert.match(await page.text(),/فاتورة وهمية/);
  assert.equal((await closed.call('/test.js',{method:'GET'})).status,200);
  const off=setup({testPage:false});
  assert.equal((await off.call('/test',{method:'GET'})).status,404);
});

test('per-user requests per minute are limited', async()=>{
  const {register,extract,setClock}=setup({requestsPerUserPerMinute:2,plans:{free:{monthlyReads:10}}});
  const {token}=await register();
  assert.equal((await extract(token)).status,200);
  assert.equal((await extract(token)).status,200);
  assert.equal((await(await extract(token)).json()).error,'TOO_MANY_REQUESTS');
  setClock('2026-10-24T10:01:00Z');
  assert.equal((await extract(token)).status,200);
});

test('provider failures are refunded; billed but unreadable results count and record cost', async()=>{
  let mode='fail';
  const {register,extract,db}=setup({plans:{free:{monthlyReads:1}}},async()=>{
    if(mode==='fail') return new Response('{}',{status:503});
    if(mode==='limit') return new Response('{}',{status:429});
    if(mode==='network') throw new TypeError('fetch failed');
    return new Response(JSON.stringify({usageMetadata:{promptTokenCount:1000,candidatesTokenCount:10},candidates:[{finishReason:'SAFETY'}]}));
  });
  const {token}=await register();
  assert.equal((await extract(token)).status,502);
  mode='limit';
  assert.equal((await(await extract(token)).json()).error,'PROVIDER_LIMIT');
  mode='network';
  assert.equal((await extract(token)).status,503);
  mode='unreadable';
  const unreadable=await extract(token);
  assert.equal(unreadable.status,422);assert.equal((await unreadable.json()).usage.remaining,0);
  assert.equal((await extract(token)).status,429);
  const row=db.raw.prepare('SELECT reads, refunds, input_tokens, output_tokens, cost_micro_usd FROM usage').get();
  assert.deepEqual({...row},{reads:1,refunds:3,input_tokens:1000,output_tokens:10,cost_micro_usd:325});
  assert.equal(db.raw.prepare('SELECT reads FROM daily').get().reads,1);
});

test('daily read cap, daily budget and monthly budget stop reads globally', async()=>{
  const reads=setup({dailyReads:1});
  const r1=await reads.register(), r2=await reads.register();
  assert.equal((await reads.extract(r1.token)).status,200);
  assert.equal((await(await reads.extract(r2.token)).json()).error,'DAILY_LIMIT');
  const daily=setup({dailyBudgetUsd:0.000001},async()=>providerReply({title:'x'},{promptTokenCount:10,candidatesTokenCount:1}));
  const d=await daily.register();
  assert.equal((await daily.extract(d.token)).status,200);
  assert.equal((await(await daily.extract(d.token)).json()).error,'DAILY_LIMIT');
  const monthly=setup({monthlyBudgetUsd:0.000001},async()=>providerReply({title:'x'},{promptTokenCount:10,candidatesTokenCount:1}));
  const m1=await monthly.register(), m2=await monthly.register();
  assert.equal((await monthly.extract(m1.token)).status,200);
  monthly.setClock('2026-10-25T10:00:00Z');
  assert.equal((await monthly.extract(m2.token)).status,429);
});

test('stored data contains no image, extracted text, IP or token secret', async()=>{
  const {register,extract,db}=setup({},async()=>providerReply({title:'Secret Product Name',merchant:'Private Shop'}));
  const {token}=await register({}, '192.0.2.55');
  assert.equal((await extract(token,JPEG.slice(0,-8)+'SECRETAA')).status,200);
  const dump=JSON.stringify(['users','usage','daily'].map(t=>db.raw.prepare(`SELECT * FROM ${t}`).all()));
  for (const needle of ['Secret Product Name','Private Shop','SECRETAA','192.0.2.55',token.split('.')[2]]) assert.equal(dump.includes(needle),false,needle);
});

test('oversized uploads are refused from Content-Length before reading the body', async()=>{
  const {register,call}=setup({},async()=>{throw Error('must not call provider');});
  const {token}=await register();
  const response=await call('/v1/extract',{token,body:{image:JPEG},headers:{'Content-Length':'9000000'}});
  assert.equal(response.status,413);
});
