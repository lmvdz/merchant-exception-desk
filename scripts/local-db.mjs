import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function localDatabase(path=':memory:'){
 const db=new DatabaseSync(path);
 const exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='operations'").get();
 if(!exists)db.exec(readFileSync(new URL('../drizzle/0000_resolution_ledger.sql',import.meta.url),'utf8'));
 return {
  close:()=>db.close(),
  prepare(sql){return {
   bind(...args){const stmt=db.prepare(sql);return {
    async first(){return stmt.get(...args)||null;},
    async all(){return {results:stmt.all(...args)};},
    async run(){const result=stmt.run(...args);return {meta:{changes:Number(result.changes)}};}
   };}
  };}
 };
}
