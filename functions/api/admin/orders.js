export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return Response.json({ success: false }, { status: 401 });
  const token = auth.slice(7);
  if (token !== 'secret_admin_token') return Response.json({ success: false }, { status: 401 });

  const orders = await env.DB.prepare(
    `SELECT o.*, b.title as book_title
     FROM orders o
     LEFT JOIN books b ON o.book_id = b.id
     WHERE o.status IN ('pending', 'pending_review')
     ORDER BY o.created_at DESC`
  ).all();

  return Response.json({ success: true, orders: orders.results });
}

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return Response.json({ success: false }, { status: 401 });
  const token = auth.slice(7);
  if (token !== 'secret_admin_token') return Response.json({ success: false }, { status: 401 });

  const { orderId, action } = await request.json();
  const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
  if (!order) return Response.json({ success: false, error: 'الطلب غير موجود' });

  if (action === 'approve') {
    // جلب رابط الكتاب من books.json
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    const books = await booksRes.json();
    const book = books.find(b => b.id == order.book_id);
    if (!book) return Response.json({ success: false, error: 'الكتاب غير موجود' });
    
    const downloadToken = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 ساعة
    
    await env.DB.prepare(
      `UPDATE orders SET status = 'approved', download_token = ?, token_expires_at = ?, updated_at = ? WHERE id = ?`
    ).bind(downloadToken, expiresAt, Date.now(), orderId).run();
    
    return Response.json({ success: true });
  } else if (action === 'reject') {
    await env.DB.prepare(`UPDATE orders SET status = 'rejected', updated_at = ? WHERE id = ?`).bind(Date.now(), orderId).run();
    return Response.json({ success: true });
  } else {
    return Response.json({ success: false, error: 'إجراء غير معروف' });
  }
} 
