export async function onRequestPost({ request, env }) {
  try {
    const { orderId, method, expectedAmount } = await request.json();
    const sessionId = request.headers.get('X-Session-Id');
    if (!sessionId) return Response.json({ success: false, error: 'لا توجد جلسة' });

    const order = await env.DB.prepare(
      `SELECT * FROM orders WHERE id = ? AND session_id = ?`
    ).bind(orderId, sessionId).first();
    if (!order) return Response.json({ success: false, error: 'الطلب غير موجود' });
    if (order.status !== 'pending') return Response.json({ success: false, error: 'تمت معالجة الطلب مسبقاً' });

    // العنوان الموحد لاستقبال TRX و USDT
    const RECEIVER_ADDRESS = "TArc3MovymaBrNmR4e4iRidLFx15BbDQ5L";
    const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    const apiKey = env.TRONGRID_API_KEY || '';

    let verified = false;
    let txHash = null;

    if (method === 'trx') {
      const url = `https://api.trongrid.io/v1/accounts/${RECEIVER_ADDRESS}/transactions?limit=20&sort=-timestamp`;
      const response = await fetch(url, { headers: apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {} });
      const data = await response.json();
      for (const tx of data.data || []) {
        const contract = tx.raw_data?.contract[0];
        if (contract?.type === 'TransferContract') {
          const toAddress = contract.parameter?.value?.to_address;
          if (toAddress && (toAddress === RECEIVER_ADDRESS || toAddress === RECEIVER_ADDRESS.toLowerCase())) {
            const amountTRX = contract.parameter.value.amount / 1e6;
            const memo = tx.raw_data?.data ? Buffer.from(tx.raw_data.data, 'hex').toString() : '';
            if (amountTRX >= expectedAmount && (memo.includes(orderId.toString()) || memo.includes(sessionId))) {
              verified = true;
              txHash = tx.txID;
              break;
            }
          }
        }
      }
    } else if (method === 'usdt') {
      const url = `https://api.trongrid.io/v1/accounts/${RECEIVER_ADDRESS}/transactions/trc20?limit=20&contract_address=${USDT_CONTRACT}`;
      const response = await fetch(url, { headers: apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {} });
      const data = await response.json();
      for (const tx of data.data || []) {
        if (tx.to && tx.to.toLowerCase() === RECEIVER_ADDRESS.toLowerCase() && tx.token_info?.address?.toLowerCase() === USDT_CONTRACT.toLowerCase()) {
          const amountUSDT = parseInt(tx.value) / 1e6;
          if (amountUSDT >= order.amount) {
            verified = true;
            txHash = tx.transaction_id;
            break;
          }
        }
      }
    }

    if (verified) {
      const booksRes = await fetch('https://' + request.headers.get('host') + '/books.json');
      const books = await booksRes.json();
      const book = books.find(b => b.id == order.book_id);
      if (!book) return Response.json({ success: false, error: 'الكتاب غير موجود' });

      const downloadToken = crypto.randomUUID();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

      await env.DB.prepare(
        `UPDATE orders SET status = 'approved', download_token = ?, token_expires_at = ?, tx_hash = ?, updated_at = ? WHERE id = ?`
      ).bind(downloadToken, expiresAt, txHash, Date.now(), orderId).run();

      return Response.json({ success: true, approved: true });
    } else {
      return Response.json({ success: false, error: 'لم يتم العثور على دفعة مطابقة', approved: false });
    }
  } catch (e) {
    console.error(e);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
} 
