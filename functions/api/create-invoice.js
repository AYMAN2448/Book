export async function onRequestPost({ request, env }) {
  try {
    const { bookId, method, amount, proof } = await request.json();
    const sessionId = request.headers.get('X-Session-Id');
    if (!sessionId) return Response.json({ success: false, error: 'لا توجد جلسة' }, { status: 400 });

    // جلب بيانات الكتاب من books.json
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    const books = await booksRes.json();
    const book = books.find(b => b.id == bookId);
    if (!book) return Response.json({ success: false, error: 'الكتاب غير موجود' });

    let status = 'pending';
    let downloadToken = null;
    let expiresAt = null;

    // إذا كان الكتاب مجانياً (السعر 0) أو الطريقة "free"
    if (book.price === 0 || method === 'free') {
      status = 'approved';
      downloadToken = crypto.randomUUID();
      expiresAt = Date.now() + 24 * 60 * 60 * 1000; // صلاحية 24 ساعة
    } else if (method === 'bank' && proof) {
      status = 'pending_review';
    }

    const now = Date.now();
    const result = await env.DB.prepare(
      `INSERT INTO orders (session_id, book_id, method, amount, status, proof, download_token, token_expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, bookId, method, amount, status, proof || null, downloadToken, expiresAt, now, now).run();

    const orderId = result.meta.last_row_id;

    if (status === 'approved' && downloadToken) {
      // إرجاع رابط التحميل مباشرة
      return Response.json({ success: true, orderId, downloadToken, autoDownload: true });
    }

    return Response.json({ success: true, orderId });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
