export async function onRequestPost({ request, env }) {
  try {
    const { username, password } = await request.json();
    
    const admin = await env.DB.prepare(
      "SELECT * FROM admins WHERE username =?"
    ).bind(username).first();

    if (!admin || password !== 'admin123') {
      return Response.json({ success: false, error: "بيانات خاطئة" }, { status: 401 });
    }

    const token = btoa(username + ':' + Date.now());
    return Response.json({ success: true, token });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}