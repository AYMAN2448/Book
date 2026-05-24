export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return Response.json({ success: false }, { status: 401 });
  const token = auth.slice(7);
  if (token !== 'secret_admin_token') return Response.json({ success: false }, { status: 401 });

  // جلب الطلبات من قاعدة البيانات
  const ordersResult = await env.DB.prepare(
    `SELECT * FROM orders WHERE status IN ('pending', 'pending_review') ORDER BY created_at DESC`
  ).all();
  
  // جلب بيانات الكتب من books.json
  let books = [];
  try {
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    books = await booksRes.json();
  } catch (e) {
    console.error('Failed to fetch books.json', e);
  }

  // إضافة اسم الكتاب و session_id كمعرف للمستخدم
  const ordersWithDetails = ordersResult.results.map(order => {
    const book = books.find(b => b.id == order.book_id);
    return {
      ...order,
      book_title: book ? book.title : 'غير معروف',
      user_display: order.session_id ? order.session_id.substring(0, 12) + '...' : 'غير معروف'
    };
  });

  return Response.json({ success: true, orders: ordersWithDetails });
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
    // جلب بيانات الكتاب من books.json
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
