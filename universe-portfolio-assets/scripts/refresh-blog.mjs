// Refresh local blog covers before publishing. The browser never writes server files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {devPackage} from './dependencies.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),imageDir=path.join(root,'universe-portfolio-assets/universe-images'),sharp=devPackage('sharp');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
export function findCover(post){
  const candidates=[post.thumbnail,post.enclosure?.link];
  for(const [tag]of String(post.content||post.description||'').matchAll(/<img\b[^>]*>/gi)){
    if(/\b(?:width|height)\s*=\s*["']?[12](?:["'\s>])/i.test(tag))continue;
    const src=tag.match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i);if(src)candidates.push(src[1]||src[2]);
  }
  for(const value of candidates){if(typeof value!=='string'||!value)continue;try{const url=new URL(decode(value));if(url.protocol==='https:'&&!url.username&&!url.password&&!url.pathname.startsWith('/_/stat'))return url.href;}catch{}}
  return null;
}
export function renderPosts(posts){return posts.map(post=>{
  const date=new Date(post.pubDate.replace(' ','T')+'Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  return `<a class="post" href="${escape(post.link)}" target="_blank" rel="noopener noreferrer"><div class="post-art post-cover" aria-hidden="true"><span class="post-cover-fallback">NOTES &amp; IDEAS</span><img src="${post.cover}" srcset="${post.small} 640w, ${post.cover} 960w" sizes="(max-width:640px) calc(100vw - 40px), 552px" width="${post.width}" height="${post.height}" alt="" loading="lazy" decoding="async"></div><div class="post-body"><div class="post-meta"><span>FROM THE BLOG</span><span>${date}</span></div><h3 lang="tr">${escape(post.title)}</h3><span class="post-read">READ THE ARTICLE <b aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="universe-portfolio-assets/universe-images/sprite.svg#ui-arrow-up-right"/></svg></b></span></div></a>`;
}).join('\n');}
async function refresh(){
  const response=await fetch('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent('https://medium.com/feed/@hakancengiz'),{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Feed request failed: '+response.status);
  const feed=await response.json();if(feed.status!=='ok'||!Array.isArray(feed.items)||feed.items.length<4)throw Error('Four feed articles are required');
  const oldScript=fs.readFileSync(path.join(root,'universe-portfolio-assets/js/blog-data.js'),'utf8'),oldPosts=JSON.parse(oldScript.replace(/^window\.PORTFOLIO_BLOG=/,'').replace(/;\s*$/,''));
  const posts=[],written=[];
  try{
    for(const post of feed.items.slice(0,4)){
      const url=new URL(post.link),cover=findCover(post);if(url.protocol!=='https:'||!post.title||!cover)throw Error('Invalid article or missing cover');
      const res=await fetch(cover,{signal:AbortSignal.timeout(20000)});if(!res.ok||!res.headers.get('content-type')?.startsWith('image/'))throw Error('Cover request failed');
      const bytes=Buffer.from(await res.arrayBuffer());if(bytes.length>15_000_000)throw Error('Cover is too large');
      const name='blog-'+crypto.createHash('sha256').update(post.link).digest('hex').slice(0,12),large='universe-portfolio-assets/universe-images/'+name+'.webp',small='universe-portfolio-assets/universe-images/'+name+'-small.webp';
      const image=sharp(bytes,{limitInputPixels:40_000_000});
      const buffer=await image.clone().resize({width:960,withoutEnlargement:true}).webp({quality:90,effort:6}).toBuffer(),metadata=await sharp(buffer).metadata();
      fs.writeFileSync(path.join(root,large),buffer);written.push(large);await image.clone().resize({width:640,withoutEnlargement:true}).webp({quality:90,effort:6}).toFile(path.join(root,small));written.push(small);
      posts.push({title:post.title,link:url.href,pubDate:post.pubDate,cover:large,small,width:metadata.width,height:metadata.height});
    }
    const file=path.join(root,'index.html'),html=fs.readFileSync(file,'utf8'),start=html.indexOf('<div class="blog-layout" id="blog-posts">'),end=html.indexOf('<p class="blog-offline"',start);if(start<0||end<0)throw Error('Blog region missing');
    fs.writeFileSync(file,html.slice(0,start)+'<div class="blog-layout" id="blog-posts">'+renderPosts(posts)+'</div>\n        '+html.slice(end));
    fs.writeFileSync(path.join(root,'universe-portfolio-assets/js/blog-data.js'),'window.PORTFOLIO_BLOG='+JSON.stringify(posts)+';\n');
    const keep=new Set(posts.flatMap(post=>[post.cover,post.small]));
    for(const file of oldPosts.flatMap(post=>[post.cover,post.small])){
      const absolute=path.resolve(root,file);if(!keep.has(file)&&absolute.startsWith(imageDir+path.sep)&&/^(?:article-\d+|blog-[\da-f]{12})(?:-small)?\.webp$/.test(path.basename(absolute))&&fs.existsSync(absolute))fs.unlinkSync(absolute);
    }
    console.log('Updated four articles and their local WebP covers.');
  }catch(error){
    const previous=new Set(oldPosts.flatMap(post=>[post.cover,post.small]));for(const file of written)if(!previous.has(file)&&fs.existsSync(path.join(root,file)))fs.unlinkSync(path.join(root,file));throw error;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await refresh();
