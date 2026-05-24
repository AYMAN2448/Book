export async function onRequestGet({ request, env }) {
  const sessionId = request.headers.get('X-Session-Id');
  if (!sessionId) {
    return Response.json({ success: false, orders: [], message: 'Missing session' });
  }

  // جلب آخر 5 طلبات للمستخدم
  const ordersResult = await env.DB.prepare(
    `SELECT * FROM orders 
     WHERE session_id = ? 
     ORDER BY created_at DESC 
     LIMIT 5`
  ).bind(sessionId).all();

  if (!ordersResult.results.length) {
    return Response.json({ success: true, orders: [] });
  }

  // جلب بيانات الكتب
  let booksMap = new Map();
  try {
    const url = new URL(request.url);
    const booksRes = await fetch(`${url.protocol}//${url.host}/books.json`);
    const allBooks = await booksRes.json();
    allBooks.forEach(book => booksMap.set(book.id, book));
  } catch (e) {
    console.error('Failed to fetch books', e);
  }

  // تحويل الطلبات مع تحديد طريقة الدفع والعملة (بدون فودافون كاش ولا رصيد داخلي)
  const ordersWithDetails = ordersResult.results.map(order => {
    const book = booksMap.get(order.book_id);
    let paymentMethod = order.payment_method || ''; // قد يكون null أو undefined
    let paymentMethodDisplay = '';
    let currencyDisplay = '';
    let amountDisplay = '';

    // تطبيع القيم: تحويل الحروف إلى صغيرة ومقارنة
    const pm = paymentMethod.toLowerCase();

    if (pm === 'usdt') {
      paymentMethodDisplay = 'USDT (TRC20)';
      currencyDisplay = 'USDT';
      amountDisplay = `${order.amount} USDT`;
    } else if (pm === 'trx') {
      paymentMethodDisplay = 'TRX';
      currencyDisplay = 'TRX';
      amountDisplay = `${order.amount} TRX`;
    } else {
      // أي طريقة دفع أخرى (بما في ذلك 'bank', 'cash', null, undefined) نعتبرها "تحويل كاشي"
      paymentMethodDisplay = 'تحويل كاشي';
      currencyDisplay = 'جنيه سوداني';
      amountDisplay = `${order.amount} جنيه`;
    }

    return {
      id: order.id,
      book_id: order.book_id,
      book_title: book ? book.title : 'كتاب غير معروف',
      book_cover: book ? book.cover : '',
      file_url: order.file_url || (book ? book.file_url : null),
      amount: order.amount,
      amount_display: amountDisplay,
      payment_method: order.payment_method,
      payment_method_display: paymentMethodDisplay,
      currency: currencyDisplay,
      status: order.status,
      status_text: getStatusText(order.status),
      created_at: order.created_at
    };
  });

  return Response.json({ success: true, orders: ordersWithDetails });
}

function getStatusText(status) {
  switch (status) {
    case 'completed': return '✅ مكتمل';
    case 'pending': return '⏳ قيد المراجعة';
    case 'failed': return '❌ مرفوض';
    case 'approved': return '✅ تمت الموافقة';
    default: return status || 'غير معروف';
  }
} 
