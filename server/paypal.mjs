// Server-only. Sandbox is deliberately the only reachable PayPal environment.
const BASE='https://api-m.sandbox.paypal.com';
export class PayPalSandbox {
 constructor(env,fetcher=fetch){this.env=env;this.fetcher=fetcher;}
 async token(){
  if(!this.env.PAYPAL_CLIENT_ID||!this.env.PAYPAL_CLIENT_SECRET)throw new Error('PayPal sandbox credentials are not configured');
  const response=await this.fetcher(`${BASE}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${this.env.PAYPAL_CLIENT_ID}:${this.env.PAYPAL_CLIENT_SECRET}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('PayPal sandbox authentication failed');return (await response.json()).access_token;
 }
 async request(path,{method='GET',body,requestId}={}){
  const token=await this.token();const response=await this.fetcher(BASE+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(requestId?{'PayPal-Request-Id':requestId,Prefer:'return=representation'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok){const err=new Error(`PayPal sandbox returned HTTP ${response.status}${data.name?` (${data.name})`:''}`);err.status=response.status;throw err;}return data;
 }
 capture(authorizationId,amountCents,currency,requestId){return this.request(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,{method:'POST',requestId,body:{amount:{value:(amountCents/100).toFixed(2),currency_code:currency},final_capture:true}});}
 getCapture(captureId){return this.request(`/v2/payments/captures/${encodeURIComponent(captureId)}`);}
 refund(captureId,amountCents,currency,requestId){return this.request(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,{method:'POST',requestId,body:{amount:{value:(amountCents/100).toFixed(2),currency_code:currency},note_to_payer:'Partial refund for evidenced missing item'}});}
 refundStored(captureId,payload,requestId){return this.request(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,{method:'POST',requestId,body:payload});}
 getRefund(refundId){return this.request(`/v2/payments/refunds/${encodeURIComponent(refundId)}`);}
}
export function sandboxConfig(env){let captures={};try{captures=JSON.parse(env.PAYPAL_SANDBOX_CAPTURE_MAP||'{}');}catch{}return {ready:env.PAYPAL_SANDBOX_ENABLED==='true'&&!!env.PAYPAL_CLIENT_ID&&!!env.PAYPAL_CLIENT_SECRET,captures};}
