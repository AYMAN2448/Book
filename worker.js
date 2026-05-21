import jwt from '@tsndr/cloudflare-worker-jwt'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}

    if(request.method=='OPTIONS') return new Response(null,{headers:cors})
    const path = url.pathname.replace('/api','')

    try {
      if(path=='/register') return await register(request,env,cors)
      if(path=='/login') return await login(request,env,cors)
      if(path=='/webhook/cryptobot') return await cryptoWebhook(request,env,cors)

      const user = await auth(request,env)
      if(!user) return json({error:'Unauthorized'},401,cors)

      if(path=='/create-invoice' && request.method=='POST') return await createInvoice(request,env,user,cors)
      if(path=='/submit-proof' && request.method=='POST') return await submitProof(request,env,user,cors)
      if(path=='/my-orders') return await myOrders(request,env,user,cors)
    } catch(e){
      return json({error:e.message},500,cors)
    }
    return new Response('Not Found',{status:404})
  }
}

async function register(req,env,cors){
  const {email,password} = await req.json()
  const hash = await hashPassword(password)
  try{
    await env.DB.prepare('INSERT INTO users(email,password_hash) VALUES(?,?)').bind(email,hash).run()
    const user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first()
    const token = await jwt.sign({id:user.id,email},env.JWT_SECRET)
    return json({success:true,token},200,cors)
  }catch(e){return json({success:false,error:'Email exists'},400,cors)}
}

async function login(req,env,cors){
  const {email,password} = await req.json()
  const user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first()
  if(!user ||!(await verifyPassword(password,user.password_hash)))
    return json({success:false,error:'Invalid credentials'},400,cors)
  const token = await jwt.sign({id:user.id,email},env.JWT_SECRET)
  return json({success:true,token},200,cors)
}

async function createInvoice(req,env,user,cors){
  const {bookId} = await req.json()
  const book = await fetch(env.SITE_URL+'/books.json').then(r=>r.json()).then(b=>b.find(x=>x.id==bookId))
  const order = await env.DB.prepare('INSERT INTO orders(user_id,book_id,book_title,price) VALUES(?,?,?,?)')
  .bind(user.id,bookId,book.title,book.price).run()

  const invoice = await fetch('https://pay.crypt.bot/api/createInvoice',{
    method:'POST',
    headers:{'Content-Type':'application/json','Crypto-Pay-API-Token':env.CRYPTBOT_TOKEN},
    body:JSON.stringify({asset:'USDT',amount:book.price,description:book.title})
  }).then(r=>r.json())

  await env.DB.prepare('UPDATE orders SET invoice_id=?,payment_method="crypto" WHERE id=?')
  .bind(invoice.result.invoice_id,order.meta.last_row_id).run()

  return json({success:true,invoiceId:invoice.result.invoice_id,orderId:order.meta.last_row_id},200,cors)
}

async function cryptoWebhook(req,env,cors){
  const data = await req.json()
  if(data.update_type=='invoice_paid'){
    const invoiceId = data.payload.invoice_id
    const order = await env.DB.prepare('SELECT * FROM orders WHERE invoice_id=?').bind(invoiceId).first()
    const book = await fetch(env.SITE_URL+'/books.json').then(r=>r.json()).then(b=>b.find(x=>x.id==order.book_id))
    await env.DB.prepare('UPDATE orders SET status="paid",file_url=? WHERE id=?').bind(book.file_url,order.id).run()
  }
  return json({ok:true},200,cors)
}

async function submitProof(req,env,user,cors){
  const {orderId,proof} = await req.json()
  await env.DB.prepare('UPDATE orders SET proof_url=?,payment_method="bank",status="pending_review" WHERE id=? AND user_id=?')
  .bind(proof,orderId,user.id).run()
  return json({success:true},200,cors)
}

async function myOrders(req,env,user,cors){
  const orders = await env.DB.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').bind(user.id).all()
  return json({orders:orders.results},200,cors)
}

async function auth(req,env){
  const auth = req.headers.get('Authorization')
  if(!auth) return null
  const token = auth.replace('Bearer ','')
  const {payload} = await jwt.verify(token,env.JWT_SECRET)
  return payload
}

function json(data,status=200,cors){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...cors}})}
async function hashPassword(p){return await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p)).then(h=>btoa(String.fromCharCode(...new Uint8Array(h))))}
async function verifyPassword(p,h){return await hashPassword(p)==h}