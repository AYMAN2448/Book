export async function onRequestPost({ request, env }) {
  const { orderId, txNumber } = await request.json();
  
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first();
  if(!order) return Response.json({ success: false, error: "الطلب غير موجود" });
  
  await env.DB.prepare(
    "UPDATE orders SET status = 'approved', tx_number = ?, file_url = ?, approved_at = datetime('now') WHERE id = ?"
  ).bind(txNumber, order.file_url, orderId).run();
  
  // هنا تقدر تضيف إرسال إيميل أو واتساب للزبون بالرابط
  // حالياً الرابط هيظهر للزبون لما يعمل refresh لصفحة الطلبات
  
  return Response.json({ success: true });
}