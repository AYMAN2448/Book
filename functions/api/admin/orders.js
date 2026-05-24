export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return Response.json({ success: false }, { status: 401 });
  const token = auth.slice(7);
  if (token !== 'secret_admin_token') return Response.json({ success: false }, { status: 401 });

  const url = new URL(request.url);
  const pendingPage = parseInt(url.searchParams.get('pending_page') || '1');
  const approvedPage = parseInt(url.searchParams.get('approved_page') || '1');
  const pendingLimit = 10;
  const approvedLimit = 5;
  const pendingOffset = (pendingPage - 1) * pendingLimit;
  const approvedOffset = (approvedPage - 1) * approvedLimit;

  // 1. الكتب المجانية (آخر 4 فقط)
  const freeOrders = await env.DB.prepare(
    `SELECT o.*, b.title as book_title 
     FROM orders o
     LEFT JOIN books b ON o.book_id = b.id
     WHERE o.status = 'approved' AND o.method = 'free'
     ORDER BY o.created_at DESC
     LIMIT 4`
  ).all();

  // 2. إجمالي عدد الكتب المجانية (للعداد)
  const freeCountResult = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM orders WHERE status = 'approved' AND method = 'free'`
  ).first();
  const freeTotal = freeCountResult ? freeCountResult.count : 0;

  // 3. الطلبات المكتملة (غير المجانية) – آخر 5 مع ترحيل
  const approvedOrders = await env.DB.prepare(
    `SELECT o.*, b.title as book_title 
     FROM orders o
     LEFT JOIN books b ON o.book_id = b.id
     WHERE o.status = 'approved' AND (o.method != 'free' OR o.method IS NULL)
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(approvedLimit, approvedOffset).all();

  const approvedTotalResult = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM orders WHERE status = 'approved' AND (method != 'free' OR method IS NULL)`
  ).first();
  const approvedTotal = approvedTotalResult ? approvedTotalResult.count : 0;
  const approvedHasMore = approvedOffset + approvedLimit < approvedTotal;

  // 4. الطلبات المعلقة (pending + pending_review) – 10 مع ترحيل
  const pendingOrders = await env.DB.prepare(
    `SELECT o.*, b.title as book_title 
     FROM orders o
     LEFT JOIN books b ON o.book_id = b.id
     WHERE o.status IN ('pending', 'pending_review')
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(pendingLimit, pendingOffset).all();

  const pendingTotalResult = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'pending_review')`
  ).first();
  const pendingTotal = pendingTotalResult ? pendingTotalResult.count : 0;
  const pendingHasMore = pendingOffset + pendingLimit < pendingTotal;

  // إثراء البيانات بأسماء الكتب (في حال فشل LEFT JOIN بسبب عدم وجود جدول books)
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
    free: freeOrders.results.map(enrich),
    freeTotal,
    approved: approvedOrders.results.map(enrich),
    approvedTotal,
    approvedHasMore,
    approvedPage,
    pending: pendingOrders.results.map(enrich),
    pendingTotal,
    pendingHasMore,
    pendingPage
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
