export async function onRequestPost({ request, env }) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return Response.json({ success: false, error: "الإيميل وكلمة المرور مطلوبة" }, { status: 400 });
    }

    // تحقق لو المستخدم موجود
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email).first();
    
    if (existing) {
      return Response.json({ success: false, error: "الإيميل مستخدم مسبقاً" }, { status: 400 });
    }

    // أنشئ المستخدم
    const result = await env.DB.prepare(
      "INSERT INTO users (email, password) VALUES (?, ?) RETURNING id"
    ).bind(email, password).first();

    const token = btoa(email + ":" + result.id);

    return Response.json({ success: true, token });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
