import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReader} from './index.mjs';
import {cleanExtraction} from './extraction.mjs';

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
test('private reader authenticates, forwards image, sanitizes output and persists daily cap', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'reader-test-'));
  const token='private-test-code-1234567890';
  let calls=0;
  const config={key:'fake-provider-key',token,usagePath:join(dir,'usage.json'),dailyLimit:1,fetcher:async(url,options)=>{
    calls++;
    assert.equal(options.headers['x-goog-api-key'],'fake-provider-key');
    const body=JSON.parse(options.body);
    assert.equal(body.contents[0].parts[0].inlineData.mimeType,'image/jpeg');
    return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({title:'Test invoice',price:'12.50',warrantyMonths:null})}]}}]}));
  }};
  let server;
  const start=async()=>{server=createReader(config);await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;};
  const stop=()=>new Promise(r=>server.close(r));
  const options=(image,code=token)=>({method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+code},body:JSON.stringify({image})});
  try {
    let url=await start();
    assert.equal((await fetch(url+'/extract',options('/9j/','wrong'))).status,401);
    assert.equal((await fetch(url+'/extract',options('not-an-image'))).status,400);
    const response=await fetch(url+'/extract',options('/9j/'));
    assert.deepEqual(await response.json(),{fields:{title:'Test invoice',price:'12.50'}});
    await stop();url=await start();
    const limited=await fetch(url+'/extract',options('/9j/'));
    assert.equal(limited.status,429);assert.equal((await limited.json()).error,'DAILY_LIMIT');
    assert.equal(calls,1);
  } finally {await stop();rmSync(dir,{recursive:true,force:true});}
});
