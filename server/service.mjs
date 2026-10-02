import {resolveCase,evaluate,authorize,operationId,isRetryAllowed} from './domain.mjs';
export async function approveRefund(repo,adapter,session,input){
 const c=resolveCase(input.caseId);const p=authorize(c,input.amountCents,input.approved===true);const mode=input.mode==='sandbox'?'sandbox':'demo';const id=operationId(session,c.id,mode);const createdAt=new Date().toISOString();
 const claimed=await repo.claim({id,session,caseId:c.id,mode,amount:p.amountCents,requestId:crypto.randomUUID(),createdAt,captureId:adapter.captureId||c.capture,providerPayload:{amount:{value:(p.amountCents/100).toFixed(2),currency_code:p.currency},note_to_payer:'Partial refund for evidenced missing item'}});
 if(!claimed){await repo.attempt(id);const existing=await repo.get(id);await repo.event(session,c.id,'Duplicate suppressed','Existing operation reused. No new refund instruction was created.');return existing;}
 const op=await repo.get(id);await repo.event(session,c.id,'Merchant approved',`${p.amountCents} cents USD under ${p.policyVersion}. Request ${op.request_id}`);
 try{
  const result=await adapter.refund(c,p,op.request_id,op);
  const status=result.status==='COMPLETED'?'completed':result.status==='PENDING'?'pending':'failed';
  await repo.patch(id,{status:input.injectTimeout&&mode==='demo'?'uncertain':status,refund_id:result.id,provider_status:result.status,updated_at:new Date().toISOString()});
  await repo.event(session,c.id,input.injectTimeout&&mode==='demo'?'Response lost after commit':`Refund ${status}`,input.injectTimeout&&mode==='demo'?'Demo processor committed the refund. Merchant response was deliberately dropped. Reconcile the existing operation.':`${mode==='demo'?'Simulated':'PayPal sandbox'} refund ${result.id} · ${result.status}`);
 }catch(error){await repo.patch(id,{status:'uncertain',updated_at:new Date().toISOString()});await repo.event(session,c.id,'Outcome unknown','The provider response was unavailable. Reconcile using the original request ID. Never generate a replacement refund.');}
 return repo.get(id);
}
export async function reconcileRefund(repo,adapter,session,input){
 const c=resolveCase(input.caseId);const mode=input.mode==='sandbox'?'sandbox':'demo';const id=operationId(session,c.id,mode);const op=await repo.get(id);if(!op)throw new Error('No approved operation exists');
 if(op.status==='completed'){await repo.event(session,c.id,'Reconciliation verified','Previously completed refund retained. No payment request sent.');return op;}
 if(!op.refund_id&&!isRetryAllowed(op.created_at))throw new Error('Retry safety window expired. Check the provider dashboard manually; do not create a new refund.');
 // Reuse the exact payload and idempotency key. A refund ID permits a read-only status lookup.
 const result=op.refund_id?await adapter.getRefund(op.refund_id,op):await adapter.refund(c,{amountCents:op.amount,currency:JSON.parse(op.provider_payload).amount.currency_code},op.request_id,op);
 const status=result.status==='COMPLETED'?'completed':result.status==='PENDING'?'pending':'failed';await repo.patch(id,{status,refund_id:result.id,provider_status:result.status,updated_at:new Date().toISOString()});await repo.event(session,c.id,'Reconciled',`${result.id} · ${result.status}. Original request ID retained; no duplicate operation.`);return repo.get(id);
}
export function demoAdapter(){return {async refund(c,p,key){return {id:`DEMO-${key.slice(0,8)}`,status:'COMPLETED'};},async getRefund(id){return {id,status:'COMPLETED'};}};}
