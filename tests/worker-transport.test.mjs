import test from 'node:test';
import assert from 'node:assert/strict';
import {PayPalSandbox} from '../server/paypal.mjs';
test('default provider transport preserves the global receiver required by Workers',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async function(url){assert.equal(this,globalThis);calls++;return String(url).includes('oauth2/token')?Response.json({access_token:'fixture'}):Response.json({id:'fixture',status:'COMPLETED'});};
 try{const provider=new PayPalSandbox({PAYPAL_CLIENT_ID:'fixture',PAYPAL_CLIENT_SECRET:'fixture'});const capture=await provider.getCapture('fixture');assert.equal(capture.status,'COMPLETED');assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
