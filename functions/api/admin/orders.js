export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return Response.json({ success: false }, { status: 401 });
  const token = auth.slice(7);
  if (token !== 'secret_admin_token') return Response.json({ success: false }, { status: 401 });

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 10;
  const offset = (page - 1) * limit;

  // 1. الطلبات المكتملة (آخر 5)
  const approvedOrders = await env.DB.prepare(
    `SELECT o.*, b.title as book_title 
     FROM orders o
     LEFT JOIN books b ON o.book_id = b.id
     WHERE o.status = 'approved'
     ORDER BY o.created_at DESC
     LIMIT 5`
  ).all();

  // 2. الطلبات المعلقة (pending + pending_review) مع ترحيل
  const pendingOrders = await env.DB.prepare(
    `SELECT o.*, b.title as book_title 
     FROM orders o
     LEFT JOIN books b ON o.book_id = b.id
     WHERE o.status IN ('pending', 'pending_review')
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  // 3. إجمالي عدد الطلبات المعلقة (لحساب وجود صفحات إضافية)
  const totalPendingCount = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'pending_review')`
  ).first();
  const hasMore = offset + limit < (totalPendingCount ? totalPendingCount.count : 0);

  // 4. جلب الكتب المجانية (status = 'approved' AND method = 'free') – للإشعارات
  const freeOrders = await env.DB.prepare(
    `SELECT o.*, b.title as book_title 
     FROM orders o
     LEFT JOIN books b ON o.book_id = b.id
     WHERE o.status = 'approved' AND o.method = 'free'
     ORDER BY o.created_at DESC
     LIMIT 20`
  ).all();

  // جلب بيانات الكتب من books.json لضمان ظهور الأسماء (احتياطي)
  let booksMap = new Map();
  try {
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    const books = await booksRes.json();
    books.forEach(book => booksMap.set(book.id, book.title));
  } catch (e) { console.error('Failed to fetch books.json', e); }

  const enrich = (order) => ({
    ...order,
    book_title: order.book_title || booksMap.get(order.book_id) || 'غير معروف',
    user_display: order.session_id ? order.session_id.substring(0, 12) + '...' : 'غير معروف'
  });

  return Response.json({
    success: true,
    pending: pendingOrders.results.map(enrich),
    approved: approvedOrders.results.map(enrich),
    free: freeOrders.results.map(enrich),
    hasMore,
    page
  });
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
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    const books = await booksRes.json();
    const book = books.find(b => b.id == order.book_id);
    if (!book) return Response.json({ success: false, error: 'الكتاب غير موجود' });
    
    const downloadToken = crypto.randomUUID();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await env.DB.prepare(
      `UPDATE orders SET status = 'approved', download_token = ?, token_expires_at = ?, updated_at = ? WHERE id = ?`
    ).bind(downloadToken, expiresAt, Date.now(), orderId).run();
    
    return Response.json({ success: true });
  } else if (action === 'reject') {
    await env.DB.prepare(
      `UPDATE orders SET status = 'rejected', updated_at = ? WHERE id = ?`
    ).bind(Date.now(), orderId).run();
    return Response.json({ success: true });
  } else {
    return Response.json({ success: false, error: 'إجراء غير معروف' });
  }
} 
