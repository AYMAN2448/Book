export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM orders ORDER BY id DESC LIMIT 100"
  ).all();
  return Response.json({ success: true, orders: results });
}
