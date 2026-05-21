export async function onRequestPost({ request, env }) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth) return Response.json({ success: false, error: "غير مسجل دخول" }, { status: 401 });

    const token = auth.replace('Bearer ', '');
    const decoded = atob(token).split(':');
    const userId = decoded[1];

    const { bookId } = await request.json();

    // جيب بيانات الكتاب من books.json
    const books = await fetch('https://' + request.headers.get('host') + '/books.json').then(r => r.json());
    const book = books.find(b => b.id == bookId);

    if (!book) return Response.json({ success: false, error: "الكتاب غير موجود" }, { status: 404 });

    // أنشئ الطلب في قاعدة البيانات
    const result = await env.DB.prepare(
      "INSERT INTO orders (user_id, book_id, book_title, status) VALUES (?,?, 'pending') RETURNING id"
    ).bind(userId, bookId, book.title).first();

    return Response.json({
      success: true,
      invoiceId: 'inv_' + result.id,
      orderId: result.id
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}