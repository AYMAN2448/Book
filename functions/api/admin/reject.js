export async function onRequestPost({ request, env }) {
  const { orderId } = await request.json();
  await env.DB.prepare("UPDATE orders SET status = 'rejected' WHERE id = ?").bind(orderId).run();
  return Response.json({ success: true });
}