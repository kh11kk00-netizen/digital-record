export const fields = ['title','brand','merchant','purchaseDate','price','currency','invoiceNumber','warrantyMonths','warrantyEndsOn','returnPeriodDays','dueDate','detail'];
export const schema = {type:'OBJECT', properties:Object.fromEntries(fields.map(k=>[k,{type:'STRING',nullable:true}])), required:fields};
const dates = new Set(['purchaseDate','warrantyEndsOn','dueDate']);
const integers = new Set(['warrantyMonths','returnPeriodDays']);
export function cleanExtraction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_RESULT');
  const result = {};
  for (const key of fields) {
    const raw = value[key];
    if (raw == null || raw === '') continue;
    if (typeof raw !== 'string') throw Error('INVALID_RESULT');
    let text = raw.trim();
    if (dates.has(key) || integers.has(key) || key === 'price') {
      text = text.replace(/[\u0660-\u0669]/g,c=>String(c.charCodeAt(0)-0x0660))
        .replace(/[\u06f0-\u06f9]/g,c=>String(c.charCodeAt(0)-0x06f0)).replace(/٫/g,'.');
    }
    if (!text || text.length > (key === 'detail' ? 2000 : 200)) continue;
    if (dates.has(key)) {
      // Never treat an unconverted Hijri year as a Gregorian purchase date.
      if (Number(text.slice(0,4)) < 1900 || Number(text.slice(0,4)) > 2200) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) continue;
      const date = new Date(text + 'T00:00:00Z');
      if (!Number.isFinite(+date) || date.toISOString().slice(0,10) !== text) continue;
    }
    if (key === 'currency' && !/^[A-Z]{3}$/.test(text)) continue;
    if (key === 'price' && (!/^\d+(\.\d{1,4})?$/.test(text) || !Number.isFinite(Number(text)))) continue;
    if (integers.has(key) && (!/^\d+$/.test(text) || Number(text) > 1200)) continue;
    result[key] = text;
  }
  return result;
}
export function validateImage(body) {
  if (typeof body?.image !== 'string' || body.image.length > 8_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.image)) throw Error('INVALID_IMAGE');
  const bytes = Buffer.from(body.image, 'base64');
  if (bytes.toString('base64') !== body.image) throw Error('INVALID_IMAGE');
  const jpeg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (!jpeg && !png) throw Error('INVALID_IMAGE');
  return jpeg ? 'image/jpeg' : 'image/png';
}
