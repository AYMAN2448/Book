export async function onRequestGet({ request, env }) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth) return Response.json({ success: false, error: "غير مسجل دخول" }, { status: 401 });

    const token = auth.replace('Bearer ', '');
    const decoded = atob(token).split(':');
    const userId = decoded[1];

    const orders = await env.DB.prepare(
      "SELECT * FROM orders WHERE user_id =? ORDER BY created_at DESC"
    ).bind(userId).all();

    return Response.json({ success: true, orders: orders.results });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}