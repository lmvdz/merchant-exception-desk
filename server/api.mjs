import {CASES,POLICY,resolveCase,evaluate} from './domain.mjs';
import {Repository} from './repository.mjs';
import {PayPalSandbox,sandboxConfig} from './paypal.mjs';
import {explainEvidence} from './ai.mjs';
import {approveRefund,reconcileRefund,demoAdapter} from './service.mjs';
export async function handleDesk(request,env){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/desk'))return null;
 let session=request.headers.get('cookie')?.match(/(?:^|;\s*)desk_session=([a-f0-9-]{36})(?:;|$)/)?.[1]||crypto.randomUUID();
 const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':`desk_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${url.protocol==='https:'?'; Secure':''}`}});
 try{
  const repo=new Repository(env.DB);const config=sandboxConfig(env);
  if(request.method==='GET')return respond({cases:CASES,policy:POLICY,operations:await repo.list(session),audit:await repo.events(session),integration:{sandboxReady:config.ready,sandboxCases:Object.keys(config.captures),aiReady:!!env.OPENAI_API_KEY},session});
  if(request.method!=='POST')return respond({error:'Method not allowed'},405);
  const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return respond({error:'Cross-origin request rejected'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return respond({error:'JSON request required'},415);
  const raw=await request.text();if(raw.length>10000)return respond({error:'Request too large'},413);const input=JSON.parse(raw);
  if(input.action==='reset'){session=crypto.randomUUID();return respond({ok:true});}
  const c=resolveCase(input.caseId);
  if(input.action==='analyze'){
   const proposal=evaluate(c);let explanation;try{explanation=await explainEvidence(env,c,proposal);}catch(error){explanation={engine:'Deterministic fallback',text:proposal.summary,warning:error.message};}
   await repo.event(session,c.id,'Evidence evaluated',`Order, capture fixture and fulfillment checked against ${POLICY.version}.${proposal.blockedInstruction?' Customer instructions excluded from policy authority.':''}`);
   return respond({proposal,explanation});
  }
  if(!['approve','reconcile'].includes(input.action))return respond({error:'Unknown action'},400);
  let adapter=demoAdapter();
  if(input.mode==='sandbox'){
   if(!config.ready||(input.action==='approve'&&!config.captures[c.id]))return respond({error:'Sandbox is not configured for this case. Use the labeled demo.'},409);
   const client=new PayPalSandbox(env);const captureId=config.captures[c.id];
   adapter={captureId,async refund(caseData,proposal,key,op){const capture=await client.getCapture(op.capture_id);if(!['COMPLETED','PARTIALLY_REFUNDED'].includes(capture.status)||capture.amount?.currency_code!=='USD'||Math.round(Number(capture.amount?.value)*100)!==caseData.paymentCents)throw new Error('Sandbox capture does not match trusted case evidence');return client.refundStored(op.capture_id,JSON.parse(op.provider_payload),key);},getRefund:id=>client.getRefund(id)};
  }
  const operation=await (input.action==='approve'?approveRefund:reconcileRefund)(repo,adapter,session,input);return respond({operation});
 }catch(error){console.error('Desk operation unavailable',error?.message);return respond({error:error?.message||'The case ledger is unavailable. Please retry.'},400);}
}
