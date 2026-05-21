export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token) return new Response('رابط غير صالح', { status: 400 });
    
    const order = await env.DB.prepare(
        `SELECT * FROM orders WHERE download_token = ? AND status = 'approved' AND token_expires_at > ?`
    ).bind(token, Date.now()).first();
    
    if (!order) return new Response('انتهت صلاحية الرابط أو الطلب غير موجود', { status: 404 });
    
    // جلب رابط الملف الأصلي
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    const books = await booksRes.json();
    const book = books.find(b => b.id == order.book_id);
    if (!book) return new Response('الكتاب غير موجود', { status: 404 });
    
    // اختياري: منع التحميل أكثر من مرة (حذف التوكن بعد الاستخدام)
    await env.DB.prepare(`UPDATE orders SET download_token = NULL, token_expires_at = NULL WHERE id = ?`).bind(order.id).run();
    
    // إعادة توجيه إلى رابط الملف (مع هيدرات تمنع التخزين المؤقت)
    return new Response(null, {
        status: 302,
        headers: {
            'Location': book.file_url,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
    });
}