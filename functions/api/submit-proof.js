export async function onRequestPost({ request, env }) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth) return Response.json({ success: false, error: "غير مسجل دخول" }, { status: 401 });

    const { orderId, proof } = await request.json();
    
    await env.DB.prepare(
      "UPDATE orders SET proof =?, status ='pending_review' WHERE id =?"
    ).bind(proof, orderId).run();

    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}