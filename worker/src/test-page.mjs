// Owner test page for the pilot (GET /test). It uses the same public API as the app, so it needs the
// invite code and counts against the same per-user limit. Turn it off with OCR_TEST_PAGE=0.
export const TEST_PAGE_HTML = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>اختبار قراءة الفاتورة</title>
<style>
body{font:17px/1.6 -apple-system,system-ui,sans-serif;margin:0;background:#f5f7fb;color:#13233a}
main{max-width:560px;margin:auto;padding:20px 16px 48px}
h1{font-size:22px;margin:0 0 4px}.note{background:#fff4e5;border:1px solid #f3cf9b;border-radius:10px;padding:10px 12px;font-size:15px}
label{display:block;font-weight:600;margin:16px 0 6px}input{width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #c7d2e3;border-radius:10px;background:#fff}
button{font:inherit;font-weight:700;width:100%;padding:12px;margin-top:14px;border:0;border-radius:12px;background:#2463eb;color:#fff}
button.secondary{background:#e8eefc;color:#13233a}button:disabled{opacity:.5}
#out{margin-top:18px;background:#fff;border-radius:12px;padding:12px;white-space:pre-wrap;word-break:break-word;direction:ltr;text-align:left;font:14px/1.5 ui-monospace,Menlo,monospace;min-height:40px}
#status{margin-top:12px;font-weight:600}img{max-width:100%;border-radius:10px;margin-top:10px}
</style></head><body><main>
<h1>اختبار قراءة الفاتورة</h1>
<p class="note">استخدم <b>فاتورة وهمية</b> فقط بلا أي بيانات شخصية. تُرسل الصورة إلى Google Gemini (الفئة المجانية) وقد تستخدمها Google لتحسين منتجاتها ويراجعها أشخاص.</p>
<label for="invite">رمز الدعوة (مرة واحدة على هذا الجهاز)</label>
<input id="invite" autocomplete="off" autocapitalize="off" spellcheck="false">
<label for="file">صورة الفاتورة الوهمية</label>
<input id="file" type="file" accept="image/*">
<img id="preview" alt="">
<button id="read">قراءة الفاتورة</button>
<button id="usage" class="secondary">عرض القراءات المتبقية</button>
<div id="status" role="status"></div>
<div id="out"></div>
</main><script src="/test.js"></script></body></html>`;

export const TEST_PAGE_JS = `(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = 'drPilotTestToken';
  const messages = {INVALID_INVITE:'رمز الدعوة غير صحيح.', NOT_CONFIGURED:'الخادم لم يُضبط بعد (رمز الدعوة أو مفتاح Gemini).', QUOTA_EXCEEDED:'انتهت قراءات هذا الشهر.',
    DAILY_LIMIT:'وصل الحد اليومي العام.', TOO_MANY_REQUESTS:'طلبات كثيرة، انتظر دقيقة.', UNAUTHORIZED:'انتهت الجلسة، أعد المحاولة.', UNREADABLE:'لم تظهر بيانات واضحة.',
    PROVIDER_LIMIT:'وصل Gemini إلى حده المجاني، حاول لاحقًا.', PROVIDER_UNAVAILABLE:'تعذر الوصول إلى Gemini (تحقق من المفتاح).', INVALID_IMAGE:'الصورة غير صالحة.', IMAGE_TOO_LARGE:'الصورة كبيرة.'};
  let token = null;
  try { token = localStorage.getItem(KEY); } catch {}
  const show = (status, data) => { $('status').textContent = status; $('out').textContent = JSON.stringify(data, null, 2); };
  const api = async (path, options = {}) => {
    const response = await fetch(path, options);
    let data = {};
    try { data = await response.json(); } catch {}
    return {status: response.status, data};
  };
  async function ensureToken() {
    if (token) return token;
    const r = await api('/v1/register', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({inviteCode: $('invite').value.trim()})});
    if (r.status !== 201) throw r;
    token = r.data.token;
    try { localStorage.setItem(KEY, token); } catch {}
    return token;
  }
  async function shrink(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let url = canvas.toDataURL('image/jpeg', 0.75);
    if (url.length > 1400000) url = canvas.toDataURL('image/jpeg', 0.5);
    return url.split(',')[1];
  }
  $('file').addEventListener('change', () => { const f = $('file').files[0]; if (f) $('preview').src = URL.createObjectURL(f); });
  $('read').addEventListener('click', async () => {
    const file = $('file').files[0];
    if (!file) return show('اختر صورة أولًا.', {});
    $('read').disabled = true; show('جارٍ القراءة…', {});
    try {
      const image = await shrink(file);
      const r = await api('/v1/extract', {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer ' + await ensureToken()}, body: JSON.stringify({image})});
      if (r.status === 401) { token = null; try { localStorage.removeItem(KEY); } catch {} }
      show(r.status === 200 ? 'تمت القراءة ✓' : (messages[r.data.error] || 'تعذرت القراءة') + ' (' + r.status + ')', r.data);
    } catch (e) {
      if (e && e.status) show((messages[e.data && e.data.error] || 'تعذر التسجيل') + ' (' + e.status + ')', e.data);
      else show('تعذر الاتصال بالخادم أو قراءة الصورة.', {error: String(e)});
    } finally { $('read').disabled = false; }
  });
  $('usage').addEventListener('click', async () => {
    if (!token) return show('لا توجد جلسة بعد. اقرأ فاتورة أولًا.', {});
    const r = await api('/v1/usage', {headers:{Authorization:'Bearer ' + token}});
    show(r.status === 200 ? 'القراءات المتبقية: ' + r.data.usage.remaining + ' من ' + r.data.usage.limit : (messages[r.data.error] || 'خطأ'), r.data);
  });
})();`;
