export async function onRequestPost({ request, env }) {
  try {
    // Ensure tables exist
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT, author TEXT, description TEXT, price REAL,
      file_url TEXT, cover_url TEXT, category TEXT, created_at TIMESTAMP
    )`);
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT, book_id INTEGER, method TEXT, amount REAL,
      status TEXT DEFAULT 'pending', proof TEXT, tx_hash TEXT,
      file_url TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
    )`);
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT, password TEXT
    )`);
    // insert default admin if not exists
    await env.DB.exec(`INSERT OR IGNORE INTO admins (username, password) VALUES ('admin', 'admin123')`);

    const { bookId, method, amount, proof } = await request.json();
    const sessionId = request.headers.get('X-Session-Id');
    if (!sessionId) return Response.json({ success: false, error: 'لا توجد جلسة' }, { status: 400 });

    // جلب بيانات الكتاب من books.json (يمكن تخزينها في D1 أيضاً)
    const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
    const books = await booksRes.json();
    const book = books.find(b => b.id == bookId);
    if (!book) return Response.json({ success: false, error: 'الكتاب غير موجود' });

    let status = 'pending';
    if (method === 'bank' && proof) {
      status = 'pending_review';
    }

    const now = Date.now();
    const result = await env.DB.prepare(
      `INSERT INTO orders (session_id, book_id, method, amount, status, proof, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, bookId, method, amount, status, proof || null, now, now).run();

    return Response.json({ success: true, orderId: result.meta.last_row_id });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
