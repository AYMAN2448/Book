export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return Response.json({ success: false }, { status: 401 });
  const token = auth.slice(7);
  if (token !== 'secret_admin_token') return Response.json({ success: false }, { status: 401 });

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = 10;
  const offset = (page - 1) * limit;

  // 1. الطلبات المعلقة (لا نحتاج ترحيلها، عددها قليل عادة)
  const pendingOrders = await env.DB.prepare(
    `SELECT * FROM orders WHERE status IN ('pending', 'pending_review') ORDER BY created_at DESC`
  ).all();

  // 2. الطلبات المكتملة مع ترحيل
  const completedOrders = await env.DB.prepare(
    `SELECT * FROM orders WHERE status = 'approved' ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  // 3. العدد الإجمالي للطلبات المكتملة لتحديد وجود صفحات أخرى
  const totalCountResult = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM orders WHERE status = 'approved'`
  ).first();
  const totalCompleted = totalCountResult ? totalCountResult.count : 0;
  const hasMore = offset + limit < totalCompleted;

  // 4. جلب بيانات الكتب من books.json
  let books = [];
  try {
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    books = await booksRes.json();
  } catch (e) {
    console.error('Failed to fetch books.json', e);
  }

  // دالة لإضافة عنوان الكتاب لكل طلب
  const enrichOrders = (orders) => orders.results.map(order => {
    const book = books.find(b => b.id == order.book_id);
    return {
      ...order,
      book_title: book ? book.title : 'غير معروف',
      book_price: book ? book.price : order.amount
    };
  });

  return Response.json({
    success: true,
    pending: enrichOrders(pendingOrders),
    completed: enrichOrders(completedOrders),
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
    // جلب بيانات الكتاب من books.json (للتأكد من وجوده)
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
