export async function onRequestGet({ request, env }) {
  const sessionId = request.headers.get('X-Session-Id');
  if (!sessionId) return Response.json({ success: false, orders: [] });

  const orders = await env.DB.prepare(
    `SELECT o.*, b.title as book_title, b.file_url as book_file_url, o.download_token, o.token_expires_at
     FROM orders o
     LEFT JOIN books b ON o.book_id = b.id
     WHERE o.session_id = ?
     ORDER BY o.created_at DESC`
  ).bind(sessionId).all();

  // تحويل token_expires_at إلى timestamp readable (اختياري)
  const results = orders.results.map(o => ({
    ...o,
    token_expires_at: o.token_expires_at ? new Date(o.token_expires_at).toISOString() : null
  }));

  return Response.json({ success: true, orders: results });
}
