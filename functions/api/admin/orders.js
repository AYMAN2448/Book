// جلب الطلبات المعلقة
export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('Authorization');
  if (!auth) return Response.json({ success: false }, { status: 401 });

  const orders = await env.DB.prepare(
    "SELECT * FROM orders WHERE status IN ('pending_review', 'pending') ORDER BY created_at DESC"
  ).all();

  return Response.json({ success: true, orders: orders.results });
}

// الموافقة أو الرفض
export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization');
  if (!auth) return Response.json({ success: false }, { status: 401 });

  const { orderId, action } = await request.json();

  if (action === 'approve') {
    const order = await env.DB.prepare("SELECT book_id FROM orders WHERE id =?").bind(orderId).first();
    const books = await fetch('https://' + request.headers.get('host') + '/books.json').then(r => r.json());
    const book = books.find(b => b.id == order.book_id);
    
    await env.DB.prepare(
      "UPDATE orders SET status ='approved', file_url =? WHERE id =?"
    ).bind(book.file_url, orderId).run();
  } else if (action === 'reject') {
    await env.DB.prepare("UPDATE orders SET status ='rejected' WHERE id =?").bind(orderId).run();
  }

  return Response.json({ success: true });
}