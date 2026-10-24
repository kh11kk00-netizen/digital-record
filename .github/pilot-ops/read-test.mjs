// Real end-to-end check against the deployed reader with the fictional sample invoice.
// Prints only statuses, extracted fields (fictional) and usage. Never prints the token or invite code.
import {readFileSync} from 'node:fs';

const base = process.env.READER_URL;
const invite = process.env.OCR_INVITE_CODE?.trim();
if (process.env.SKIP_READ === '1') { console.log('Real reading test skipped for this run.'); process.exit(0); }
if (!invite) {
  console.log('::warning::OCR_INVITE_CODE secret is not set in GitHub; skipping the real reading test.');
  process.exit(0);
}
const call = async (path, init = {}) => {
  const response = await fetch(base + path, init);
  let data = {};
  try { data = await response.json(); } catch {}
  return {status: response.status, data};
};
const reg = await call('/v1/register', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({inviteCode: invite})});
console.log('register:', reg.status, reg.data.error ?? JSON.stringify(reg.data.usage));
if (reg.status !== 201) process.exit(1);
const token = reg.data.token;
const auth = {Authorization: `Bearer ${token}`};

console.log('wrong invite:', (await call('/v1/register', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({inviteCode: 'definitely-wrong-code'})})).data.error);
console.log('forged token:', (await call('/v1/usage', {headers: {Authorization: `Bearer dr1.${'A'.repeat(16)}.${'B'.repeat(43)}`}})).data.error);
console.log('not an image:', (await call('/v1/extract', {method: 'POST', headers: {...auth, 'Content-Type': 'application/json'}, body: JSON.stringify({image: 'aGVsbG8gd29ybGQh'})})).data.error);

const image = readFileSync(new URL('../../docs/pilot/fictional-invoice.jpg', import.meta.url)).toString('base64');
const started = Date.now();
const read = await call('/v1/extract', {method: 'POST', headers: {...auth, 'Content-Type': 'application/json'}, body: JSON.stringify({image})});
console.log(`extract: ${read.status} in ${Date.now() - started} ms`);
console.log(JSON.stringify(read.data, null, 2));
const usage = await call('/v1/usage', {headers: auth});
console.log('usage after read:', JSON.stringify(usage.data.usage));
if (read.status !== 200) process.exit(1);
const f = read.data.fields;
const checks = {price: f.price === '459.00' || f.price === '459', currency: f.currency === 'SAR', purchaseDate: f.purchaseDate === '2026-10-20', invoiceNumber: f.invoiceNumber === 'INV-2026-0457'};
console.log('field checks:', JSON.stringify(checks));
