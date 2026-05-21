export async function onRequestPost({ request, env }) {
  try {
    const { title, author, description, price, file_url, cover_url, category } = await request.json();

    if (!title || !author || !description || !price || !file_url) {
      return Response.json({ success: false, error: "الحقول المطلوبة ناقصة" }, { status: 400 });
    }

    const result = await env.DB.prepare(
      `INSERT INTO books (title, author, description, price, file_url, cover_url, category, created_at) 
       VALUES (?, ?, datetime('now')) 
       RETURNING id`
    ).bind(title, author, description, price, file_url, cover_url || '', category || 'عام').first();

    return Response.json({ success: true, id: result.id });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}