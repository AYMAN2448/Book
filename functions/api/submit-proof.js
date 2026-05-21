export async function onRequestPost({ request, env }) {
  const { orderId, proof } = await request.json();
  const sessionId = request.headers.get('X-Session-Id');

  await env.DB.prepare(
    "UPDATE orders SET proof =?, status ='pending_review' WHERE id =? AND session_id =? AND status ='pending'"
  ).bind(proof, orderId, sessionId).run();

  return Response.json({ success: true });
}
