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

  // 2. استخراج book_ids الفريدة لجلب بيانات الكتب مرة واحدة فقط
  const bookIds = [...new Set(ordersResult.results.map(o => o.book_id))];
  
  // 3. جلب بيانات الكتب من قاعدة البيانات (يفضل من جدول books بدلاً من JSON)
  //    إذا كنت لا تزال تستخدم books.json، استخدم البديل أدناه
  let booksMap = new Map();
  try {
    // الخيار 1: من جدول الكتب (موصى به)
    // const booksData = await env.DB.prepare(`SELECT id, title, cover, file_url FROM books WHERE id IN (${bookIds.join(',')})`).all();
    // booksData.results.forEach(b => booksMap.set(b.id, b));
    
    // الخيار 2: من ملف books.json (إذا كان لا يزال موجوداً)
    const url = new URL(request.url);
    const booksRes = await fetch(`${url.protocol}//${url.host}/books.json`);
    const allBooks = await booksRes.json();
    allBooks.forEach(book => booksMap.set(book.id, book));
  } catch (e) {
    console.error('Failed to fetch books data', e);
  }

  // 4. دمج البيانات وإضافة الحقول المطلوبة
  const ordersWithDetails = ordersResult.results.map(order => {
    const book = booksMap.get(order.book_id);
    return {
      id: order.id,
      book_id: order.book_id,
      book_title: book ? book.title : 'كتاب غير معروف',
      book_cover: book ? book.cover : '',
      file_url: order.file_url || (book ? book.file_url : null),
      amount: order.amount,
      payment_method: order.payment_method,
      currency: getCurrencyDisplay(order.payment_method),
      status: order.status,
      status_text: getStatusText(order.status),
      created_at: order.created_at
    };
  });

  return Response.json({ success: true, orders: ordersWithDetails });
}

// دالة تحويل طريقة الدفع إلى العملة المناسبة
function getCurrencyDisplay(method) {
  switch (method) {
    case 'usdt': return 'USDT (TRC20)';
    case 'trx': return 'TRX';
    case 'vodafone': return 'جنيه مصري (كاش)';
    case 'bank': return 'تحويل بنكي (جنيه)';
    case 'balance': return 'دولار (رصيد)';
    default: return 'دولار';
  }
}

// دالة تحويل حالة الطلب إلى نص عربي
function getStatusText(status) {
  switch (status) {
    case 'completed': return '✅ مكتمل';
    case 'pending': return '⏳ قيد المراجعة';
    case 'failed': return '❌ فشل';
    default: return status;
  }
}
