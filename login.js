export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();
    
    const user = await env.DB.prepare(
      "SELECT id, email FROM users WHERE email = ? AND password = ?"
    ).bind(email, password).first();
    
    if (!user) {
      return Response.json({ success: false, error: "الإيميل أو كلمة المرور خطأ" }, { status: 401 });
    }

    const token = btoa(email + ":" + user.id);
    return Response.json({ success: true, token });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}