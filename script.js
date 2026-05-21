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
  alert(msg);
}
// زر الدعم العائم - إظهار/إخفاء القائمة
function toggleSupportMenu() {
  const menu = document.getElementById('supportMenu');
  if (menu) {
    if (menu.style.display === 'flex') {
      menu.style.display = 'none';
    } else {
      menu.style.display = 'flex';
    }
  }
}

// إغلاق القائمة عند النقر خارجها
document.addEventListener('click', function(event) {
  const menu = document.getElementById('supportMenu');
  const btn = document.getElementById('supportBtn');
  if (menu && btn && !btn.contains(event.target) && !menu.contains(event.target)) {
    menu.style.display = 'none';
  }
});
