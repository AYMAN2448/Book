export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json();
  const admin = await env.DB.prepare(`SELECT * FROM admins WHERE username = ?`).bind(username).first();
  if (!admin || admin.password !== password) {
    return Response.json({ success: false }, { status: 401 });
  }
  // توليد توكن بسيط (للتوثيق)
  const token = btoa(username + ':' + Date.now());
  return Response.json({ success: true, token, username });
}
