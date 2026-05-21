export async function onRequestPost({ request, env }) {
  try {
    const { bookId, method, amount } = await request.json();
    const sessionId = request.headers.get('X-Session-Id');
    if (!sessionId) return Response.json({ success: false, error: 'لا توجد جلسة' }, { status: 400 });

    // جلب بيانات الكتاب من books.json (يمكن تخزينها في D1 أيضاً)
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    const books = await booksRes.json();
    const book = books.find(b => b.id == bookId);
    if (!book) return Response.json({ success: false, error: 'الكتاب غير موجود' });

    let autoApprove = false;
    let status = 'pending';
    if (method === 'trx' || method === 'usdt') {
      // للدفع التلقائي، سيتم التحقق لاحقاً عبر Webhook أو مستخدم يضغط "تحققت"
      // هنا نضع الطلب في حالة pending وسيتم التحقق عند استدعاء verify-payment
      status = 'pending';
    } else if (method === 'bank') {
      status = 'pending'; // سيتم رفع إيصال
    }

    const now = Date.now();
    const result = await env.DB.prepare(
      `INSERT INTO orders (session_id, book_id, method, amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, bookId, method, amount, status, now, now).run();

    return Response.json({ success: true, orderId: result.meta.last_row_id, autoApprove: false });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
