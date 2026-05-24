export async function onRequestGet({ request, env }) {
  const sessionId = request.headers.get('X-Session-Id');
  if (!sessionId) {
    return Response.json({ success: false, orders: [], message: 'Missing session' });
  }

  // 1. جلب آخر 5 طلبات للمستخدم
  const ordersResult = await env.DB.prepare(
    `SELECT * FROM orders 
     WHERE session_id = ? 
     ORDER BY created_at DESC 
     LIMIT 5`
  ).bind(sessionId).all();

  if (!ordersResult.results.length) {
    return Response.json({ success: true, orders: [] });
  }

  // 2. استخراج book_ids الفريدة
  const bookIds = [...new Set(ordersResult.results.map(o => o.book_id))];
  
  // 3. جلب بيانات الكتب من books.json
  let booksMap = new Map();
  try {
    const url = new URL(request.url);
    const booksRes = await fetch(`${url.protocol}//${url.host}/books.json`);
    const allBooks = await booksRes.json();
    allBooks.forEach(book => booksMap.set(book.id, book));
  } catch (e) {
    console.error('Failed to fetch books data', e);
  }

  // 4. دمج البيانات مع تحديد العملة المناسبة (بدون فودافون كاش)
  const ordersWithDetails = ordersResult.results.map(order => {
    const book = booksMap.get(order.book_id);
    
    let currencyDisplay = '';
    let amountDisplay = '';
    let paymentMethodDisplay = '';

    switch (order.payment_method) {
      case 'usdt':
        currencyDisplay = 'USDT (TRC20)';
        amountDisplay = `${order.amount} USDT`;
        paymentMethodDisplay = 'USDT (TRC20)';
        break;
      case 'trx':
        currencyDisplay = 'TRX';
        amountDisplay = `${order.amount} TRX`;
        paymentMethodDisplay = 'TRX';
        break;
      case 'bank':
      case 'cash':
        currencyDisplay = 'جنيه سوداني (تحويل كاشي)';
        amountDisplay = `${order.amount} جنيه`;
        paymentMethodDisplay = 'تحويل كاشي';
        break;
      case 'balance':
        currencyDisplay = 'دولار (رصيد داخلي)';
        amountDisplay = `${order.amount} دولار`;
        paymentMethodDisplay = 'رصيد داخلي';
        break;
      default:
        currencyDisplay = 'غير محدد';
        amountDisplay = `${order.amount} ${order.currency === 'EGP' ? 'جنيه' : 'دولار'}`;
        paymentMethodDisplay = order.payment_method || 'غير معروف';
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
    default: return status;
  }
} 
