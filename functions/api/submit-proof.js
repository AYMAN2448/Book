export async function onRequestPost({ request, env }) {
  try {
    const { orderId, proof } = await request.json();
    const sessionId = request.headers.get('X-Session-Id');
    if (!sessionId) return Response.json({ success: false, error: 'غير مصرح' }, { status: 401 });

    const order = await env.DB.prepare(`SELECT * FROM orders WHERE id = ? AND session_id = ?`).bind(orderId, sessionId).first();
    if (!order) return Response.json({ success: false, error: 'الطلب غير موجود' });

    if (order.method !== 'bank') return Response.json({ success: false, error: 'هذه الطريقة لا تتطلب إيصالاً' });

    await env.DB.prepare(
      `UPDATE orders SET proof = ?, status = 'pending_review', updated_at = ? WHERE id = ?`
    ).bind(proof, Date.now(), orderId).run();

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
