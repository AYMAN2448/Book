let sessionId = localStorage.getItem('session_id');
if (!sessionId) {
  sessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now();
  localStorage.setItem('session_id', sessionId);
}

async function api(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

function toast(msg, isError = false) {
  alert(msg); // يمكنك تحسينها لاستخدام div منبثق
}
