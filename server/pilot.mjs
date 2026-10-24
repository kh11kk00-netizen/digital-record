import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {createReader} from './index.mjs';

if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error('GEMINI_API_KEY is missing. Run this in the original terminal where you entered the key.');
  process.exit(1);
}
const token=process.env.OCR_ACCESS_TOKEN?.trim();
if (!token || token.length < 24) {
  console.error('OCR_ACCESS_TOKEN must be set to a stable private access code of at least 24 characters.');
  process.exit(1);
}
const server=createReader({
  key:process.env.GEMINI_API_KEY.trim(), token,
  usagePath:resolve(homedir(),'.digital-record-reader','usage.json'),
  dailyLimit:20
});
server.requestTimeout=30000;
server.on('error',()=>{console.error('Could not start port 8787. Check whether the reader is already running.');process.exitCode=1;});
server.listen(8787,'0.0.0.0',()=>{
  console.log('READER READY - keep this terminal open');
  if (process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
    console.log('READER URL: https://'+process.env.CODESPACE_NAME+'-8787.'+process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN);
  }
  console.log('Access code loaded from OCR_ACCESS_TOKEN (not printed).');
  console.log('Forward port 8787 over HTTPS before using a physical device. Use fictional invoices for this pilot.');
});
