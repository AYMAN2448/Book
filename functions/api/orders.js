export async function onRequestGet({ request, env }) {
  const sessionId = request.headers.get('X-Session-Id');
  if (!sessionId) {
    return Response.json({ success: false, orders: [] });
  }

  const orders = await env.DB.prepare(
    `SELECT o.*, b.title as book_title, b.file_url as book_file_url
     FROM orders o
     LEFT JOIN books b ON o.book_id = b.id
     WHERE o.session_id = ?
     ORDER BY o.created_at DESC`
  ).bind(sessionId).all();

  return Response.json({ success: true, orders: orders.results });
}
