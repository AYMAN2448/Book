// api/migrate.js
export async function onRequestGet({ env }) {
  try {
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        author TEXT,
        description TEXT,
        price REAL,
        file_url TEXT,
        cover_url TEXT,
        category TEXT,
        created_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        book_id INTEGER,
        method TEXT,
        amount REAL,
        status TEXT DEFAULT 'pending',
        proof TEXT,
        tx_hash TEXT,
        file_url TEXT,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        password TEXT
      );
    `);
    // إضافة مشرف افتراضي إذا لم يكن موجوداً
    await env.DB.prepare(`INSERT OR IGNORE INTO admins (username, password) VALUES ('admin', 'admin123')`).run();
    return Response.json({ success: true, message: "Tables created" });
  } catch (e) {
    return Response.json({ success: false, error: e.message });
  }
}