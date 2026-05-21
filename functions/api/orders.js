export async function onRequestGet({ request, env }) {
  const sessionId = request.headers.get('X-Session-Id');
  const orders = await env.DB.prepare(
    "SELECT * FROM orders WHERE session_id =? ORDER BY created_at DESC"
  ).bind(sessionId).all();

  return Response.json({ success: true, orders: orders.results || [] });
}
