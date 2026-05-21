export async function onRequestPost({ request, env }) {
  try {
    const { bookId, method, amount } = await request.json();
    const sessionId = request.headers.get('X-Session-Id');

    if (!bookId || !method || !sessionId) {
      return Response.json({ success: false, error: "بيانات ناقصة" }, { status: 400 });
    }

    const books = await fetch('https://' + request.headers.get('host') + '/books.json').then(r => r.json());
    const book = books.find(b => b.id == bookId);
    if (!book) return Response.json({ success: false, error: "الكتاب غير موجود" }, { status: 404 });

    const autoApprove = ['trx', 'usdt'].includes(method.toLowerCase());
    const status = autoApprove ? 'approved' : 'pending';

    const result = await env.DB.prepare(
      "INSERT INTO orders (session_id, book_id, book_title, method, amount, status) VALUES (?, ?, 'pending') RETURNING id"
    ).bind(sessionId, bookId, book.title, method, amount).first();

    if (autoApprove) {
      await env.DB.prepare("UPDATE orders SET file_url =?, status ='approved' WHERE id =?").bind(book.file_url, result.id).run();
    }

    return Response.json({ success: true, orderId: result.id, autoApprove });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
