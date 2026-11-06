import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.woff':'font/woff','.json':'application/json; charset=utf-8'};
export function createPreview(siteRoot=root){return http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  const file=path.resolve(siteRoot,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(siteRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
  const type=types[path.extname(file)];if(!type){res.writeHead(404).end();return;}
  const stat=fs.statSync(file),etag='"'+stat.size+'-'+Math.round(stat.mtimeMs)+'"';
  const headers={'Content-Type':type,'Cache-Control':/\.(?:webp|woff|svg)$/.test(file)?'public, max-age=86400':'no-cache','ETag':etag,'X-Content-Type-Options':'nosniff'};
  if(req.headers['if-none-match']===etag){res.writeHead(304,headers).end();return;}
  if(req.method==='HEAD'){res.writeHead(200,headers).end();return;}
  let body=fs.readFileSync(file);if(/^(?:text\/|image\/svg)/.test(type)&&body.length>1024&&req.headers['accept-encoding']?.includes('gzip')){body=zlib.gzipSync(body);headers['Content-Encoding']='gzip';headers.Vary='Accept-Encoding';}
  res.writeHead(200,headers);res.end(body);
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||4173);createPreview().listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
}
