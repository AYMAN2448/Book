export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json();
  const admin = await env.DB.prepare(`SELECT * FROM admins WHERE username = ?`).bind(username).first();
  if (!admin || admin.password !== password) {
    return Response.json({ success: false }, { status: 401 });
  }
  // استخدام التوكن الثابت الذي يتحقق منه orders.js
  const token = 'secret_admin_token';
  return Response.json({ success: true, token, username });
}
