export class Repository {
 constructor(db){if(!db)throw new Error('The case ledger is unavailable');this.db=db;}
 async list(session){return (await this.db.prepare("SELECT * FROM operations WHERE session = ? OR mode = 'sandbox' ORDER BY created_at").bind(session).all()).results;}
 async get(id){return this.db.prepare('SELECT * FROM operations WHERE id = ?').bind(id).first();}
 async events(session){return (await this.db.prepare('SELECT * FROM audit WHERE session = ? ORDER BY created_at, rowid').bind(session).all()).results;}
 async event(session,caseId,event,detail){await this.db.prepare('INSERT INTO audit (id,session,case_id,event,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),session,caseId,event,detail,new Date().toISOString()).run();}
 async claim(op){const r=await this.db.prepare('INSERT OR IGNORE INTO operations (id,session,case_id,mode,amount,request_id,status,created_at,updated_at,capture_id,provider_payload,attempts) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)').bind(op.id,op.session,op.caseId,op.mode,op.amount,op.requestId,'processing',op.createdAt,op.createdAt,op.captureId,JSON.stringify(op.providerPayload)).run();return r.meta.changes===1;}
 async patch(id,fields){const allowed=['status','refund_id','provider_status','updated_at'];const entries=Object.entries(fields).filter(([k])=>allowed.includes(k));await this.db.prepare(`UPDATE operations SET ${entries.map(([k])=>`${k} = ?`).join(', ')} WHERE id = ?`).bind(...entries.map(([,v])=>v),id).run();}
 async attempt(id){await this.db.prepare('UPDATE operations SET attempts = attempts + 1 WHERE id = ?').bind(id).run();}
}
