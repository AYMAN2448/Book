export async function onRequestPost({ request, env }) {
  try {
    const { orderId, method } = await request.json();
    const sessionId = request.headers.get('X-Session-Id');
    const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ? AND session_id = ?`).bind(orderId, sessionId).first();
    if (!order) return Response.json({ success: false, error: 'الطلب غير موجود' });
    if (order.status !== 'pending') return Response.json({ success: false, error: 'تمت معالجته مسبقاً' });

    const address = method === 'trx' ? 'TArc3MovymaBrNmR4e4iRidLFx15BbDQ5L' : '0x1b90069d9503e1931d30a8884080cdf16bd0cded';
    const expectedAmount = order.amount;
    let verified = false;
    if (method === 'trx') {
      const url = `https://api.trongrid.io/v1/accounts/${address}/transactions?limit=20`;
      const res = await fetch(url);
      const data = await res.json();
      for (let tx of data.data || []) {
        if (tx.raw_data?.contract?.[0]?.parameter?.value?.amount / 1e6 >= expectedAmount) {
          verified = true;
          break;
        }
      }
    } else if (method === 'usdt') {
      // مبسط، يمكنك استدعاء TronGrid للـ USDT
      const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=20&contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`;
      const res = await fetch(url);
      const data = await res.json();
      for (let tx of data.data || []) {
        if (tx.to === address.toLowerCase() && parseFloat(tx.value) >= expectedAmount) {
          verified = true;
          break;
        }
      }
    }
    if (verified) {
      const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
      const books = await booksRes.json();
      const book = books.find(b => b.id == order.book_id);
      await env.DB.prepare(
        `UPDATE orders SET status = 'approved', file_url = ?, updated_at = ? WHERE id = ?`
      ).bind(book.file_url, Date.now(), orderId).run();
      return Response.json({ success: true, approved: true });
    } else {
      return Response.json({ success: false, error: 'لم يتم العثور على الدفع' });
    }
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
} 
