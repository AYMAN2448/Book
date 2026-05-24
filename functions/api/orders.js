export async function onRequestGet({ request, env }) {
  const sessionId = request.headers.get('X-Session-Id');
  if (!sessionId) return Response.json({ success: false, orders: [] });

  // 1. جلب جميع طلبات المستخدم
  const ordersResult = await env.DB.prepare(
    `SELECT * FROM orders WHERE session_id = ? ORDER BY created_at DESC`
  ).bind(sessionId).all();

  // 2. جلب بيانات الكتب من books.json
  let books = [];
  try {
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    books = await booksRes.json();
  } catch (e) {
    console.error('Failed to fetch books.json', e);
  }

  // 3. دمج اسم الكتاب مع كل طلب
  const ordersWithBook = ordersResult.results.map(order => {
    const book = books.find(b => b.id == order.book_id);
    return {
      ...order,
      book_title: book ? book.title : 'كتاب غير معروف',
      book_cover: book ? book.cover : '',
      file_url: order.file_url || (book ? book.file_url : null)
    };
  });

  return Response.json({ success: true, orders: ordersWithBook });
}
