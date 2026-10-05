import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
const files=['domain','paypal','ai-provider','ai','repository','service','api'];let code='';
for(const f of files)code+=(await readFile(`server/${f}.mjs`,'utf8')).replace(/^import[^\r\n]*;\r?$/gm,'')+'\n';
const assets={};for(const [path,file,type] of [['/','web/index.html','text/html'],['/app.js','web/app.js','text/javascript'],['/style.css','web/style.css','text/css'],['/favicon.svg','public/favicon.svg','image/svg+xml']])assets[path]={body:await readFile(file,'utf8'),type};
code+=`\nconst ASSETS=${JSON.stringify(assets)};\nexport default {async fetch(request,env){const apiResponse=await handleDesk(request,env);if(apiResponse)return apiResponse;const path=new URL(request.url).pathname;const asset=ASSETS[path];if(!asset)return new Response('Not found',{status:404});return new Response(asset.body,{headers:{'Content-Type':asset.type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'self' https://chatgpt.com; form-action 'self'\"}})}};\n`;
await writeFile('dist/server/index.js',code);console.log('Built dependency-free Worker with embedded static assets');

await import('./finish-site.mjs');
