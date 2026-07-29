(() => {
const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));

function glow(ctx, color, blur = 18) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function resetGlow(ctx) { ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.setLineDash([]); }
function circle(ctx, x, y, radius, color, fill = false, width = 3) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, radius), 0, TAU);
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.fillStyle = color;
  fill ? ctx.fill() : ctx.stroke();
}
function dashedGuide(ctx, x, y, radius, color = "rgba(255,255,255,.16)") {
  ctx.save(); ctx.setLineDash([5, 8]); circle(ctx, x, y, radius, color, false, 1.5); ctx.restore();
}
function diamond(ctx, x, y, size, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y-size); ctx.lineTo(x+size, y); ctx.lineTo(x, y+size); ctx.lineTo(x-size, y); ctx.closePath(); ctx.fill();
}
function motionProgress(p, variant) {
  p = Math.max(0, p);
  if (variant === 0) return Math.pow(p, 1.55);
  if (variant === 1) return 1 - Math.pow(Math.max(0, 1-p), 1.55);
  if (variant === 2) {
    if (p < .44) return p / .44 * .5;
    if (p < .62) return .5;
    return .5 + (p-.62) / .38 * .5;
  }
  if (p < .44) return p/.44*.62;
  if (p < .62) return .62-(p-.44)/.18*.18;
  return .44+(p-.62)/.38*.56;
}
function variantOf(options, max) { return (options.config?.variant || 0) % max; }
function pendulumAngle(progress, direction = 1) { return direction * .78 * Math.cos(clamp(progress) * Math.PI / 2); }

const roundTypes = [
  {
    id:"rings", title:"HALKALARI BİRLEŞTİR", mission:"Halkalar birleştiğinde dokun.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4), x=w/2, y=h/2+10, target=Math.min(w,h)*(.17+(o.config?.size||0)*.025);
      let radius = v===1 ? target*(1.9-.9*p) : target*(.22+.78*p);
      if(o.config?.targetStyle==="prism"){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.strokeStyle="rgba(255,255,255,.2)";ctx.lineWidth=2;ctx.strokeRect(-target*.7,-target*.7,target*1.4,target*1.4);ctx.restore();}else{dashedGuide(ctx,x,y,target);if(o.config?.targetStyle==="pulse")dashedGuide(ctx,x,y,target+12,"rgba(169,120,255,.18)");} glow(ctx,o.secondary);
      circle(ctx,x,y,radius,o.secondary,false,5); resetGlow(ctx);
      if(v>=2){ const fake=target*(1.55-.3*Math.sin(now/240)); ctx.globalAlpha=.28; circle(ctx,x,y,fake,o.accent,false,2); resetGlow(ctx); }
      glow(ctx,"#fff",12); circle(ctx,x,y,4,"#fff",true); resetGlow(ctx);
    }
  },
  {
    id:"lines", title:"ÇİZGİLERİ BULUŞTUR", mission:"Çizgiler buluştuğunda dokun.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4), cx=w/2, cy=h/2+8, gap=(v===3?Math.pow(Math.max(0,1-p),1.35):(1-p))*Math.min(w,h)*.38;
      ctx.lineCap="round"; ctx.lineWidth=7; glow(ctx,o.secondary);
      if(v===1){ ctx.strokeStyle=o.secondary;ctx.beginPath();ctx.moveTo(cx,cy-gap-82);ctx.lineTo(cx,cy-gap);ctx.stroke();ctx.strokeStyle=o.primary;ctx.beginPath();ctx.moveTo(cx,cy+gap);ctx.lineTo(cx,cy+gap+82);ctx.stroke(); }
      else if(v===2){ctx.strokeStyle=o.secondary;ctx.beginPath();ctx.moveTo(cx-gap-62,cy-gap-62);ctx.lineTo(cx-gap,cy-gap);ctx.stroke();ctx.strokeStyle=o.primary;ctx.beginPath();ctx.moveTo(cx+gap,cy+gap);ctx.lineTo(cx+gap+62,cy+gap+62);ctx.stroke();}
      else {ctx.strokeStyle=o.secondary;ctx.beginPath();ctx.moveTo(cx-gap-85,cy);ctx.lineTo(cx-gap,cy);ctx.stroke();ctx.strokeStyle=o.primary;ctx.beginPath();ctx.moveTo(cx+gap,cy);ctx.lineTo(cx+gap+85,cy);ctx.stroke();}
      resetGlow(ctx); circle(ctx,cx,cy,5,"rgba(255,255,255,.35)",true);
    }
  },
  {
    id:"stop", title:"HEDEFTE DURDUR", mission:"Tam hedefte durdur.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4), vertical=v===1, q=clamp(p), tx=vertical?w/2:w*.73, ty=vertical?h*.66:h/2+18;
      const x=vertical?tx:w*.1+(tx-w*.1)*q, y=vertical?h*.16+(ty-h*.16)*q:ty;
      ctx.strokeStyle="rgba(255,255,255,.12)";ctx.lineWidth=3;ctx.beginPath();vertical?(ctx.moveTo(tx,h*.12),ctx.lineTo(tx,h*.82)):(ctx.moveTo(w*.07,ty),ctx.lineTo(w*.93,ty));ctx.stroke();
      ctx.strokeStyle=o.primary;ctx.lineWidth=5;glow(ctx,o.primary);ctx.beginPath();vertical?(ctx.moveTo(tx-55,ty),ctx.lineTo(tx+55,ty)):(ctx.moveTo(tx,ty-55),ctx.lineTo(tx,ty+55));ctx.stroke();resetGlow(ctx);
      glow(ctx,o.secondary); v===2?diamond(ctx,x,y,17,o.secondary):circle(ctx,x,y,16,o.secondary,true); resetGlow(ctx);
    }
  },
  {
    id:"collision", title:"ÇARPIŞMAYI YAKALA", mission:"Temas anında dokun.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4), y=h/2+8, d=w*.34*(1-p), r1=v===2?14:19, r2=v===2?24:19, xs=[w/2-r1-d,w/2+r2+d];
      glow(ctx,o.secondary); v===1?diamond(ctx,xs[0],y,r1,o.secondary):circle(ctx,xs[0],y,r1,o.secondary,true); resetGlow(ctx);
      glow(ctx,o.primary); v===1?diamond(ctx,xs[1],y,r2,o.primary):circle(ctx,xs[1],y,r2,o.primary,true); resetGlow(ctx);
      if(p>.94){ctx.globalAlpha=Math.max(0,1-Math.abs(1-p)*8);circle(ctx,w/2,y,32+(p-.94)*90,"#fff",false,2);resetGlow(ctx);}
    }
  },
  {
    id:"countdown", title:"SIFIRI YAKALA", mission:"Sıfır anını yakala.", minRound:2, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4), remaining=Math.max(0,o.duration*(1-p)); let text=(remaining/1000).toFixed(3);
      if((v===1&&remaining<850)||(v===2&&remaining<1200&&Math.floor(remaining/180)%2===0)) text="•••";
      ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=`900 ${Math.min(68,w*.17)}px ui-monospace,monospace`;ctx.fillStyle=p>.86?o.primary:"#fff";glow(ctx,p>.86?o.primary:o.secondary,14);ctx.fillText(text,w/2,h/2+5);resetGlow(ctx);
      ctx.fillStyle="rgba(255,255,255,.4)";ctx.font="700 10px system-ui";ctx.fillText(v===1?"HİSSET":"SANİYE",w/2,h/2+60);
    }
  },
  {
    id:"center", title:"MERKEZE İSABET", mission:"Merkezdeyken dokun.", minRound:2, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4), vertical=v===1, cx=w/2,cy=h/2+10;
      ctx.fillStyle="rgba(255,255,255,.05)";vertical?ctx.fillRect(cx-90,cy-27,180,54):ctx.fillRect(cx-27,cy-95,54,190);ctx.strokeStyle=o.primary;ctx.lineWidth=2;ctx.setLineDash([5,6]);vertical?ctx.strokeRect(cx-90,cy-27,180,54):ctx.strokeRect(cx-27,cy-95,54,190);ctx.setLineDash([]);
      const x=vertical?cx:w*.08+w*.42*p, y=vertical?h*.13+(cy-h*.13)*p:cy+(v===2?Math.sin(p*Math.PI*4)*18:0);glow(ctx,o.secondary);circle(ctx,x,y,15,o.secondary,true);resetGlow(ctx);
    }
  },
  {
    id:"color", title:"RENK EŞLEŞMESİ", mission:"Hedef renkte ve yıldız göründüğünde dokun.", minRound:4, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4),x=w/2,y=h/2+15,r=48+(p>.88?12*(p-.88)/.12:0),startHue=[330,65,265,20][v],targetHue=190,hue=startHue+(targetHue-startHue)*clamp(p);
      ctx.textAlign="center";ctx.fillStyle="rgba(255,255,255,.55)";ctx.font="800 9px system-ui";ctx.fillText("HEDEF",x,y-105);circle(ctx,x,y-78,12,`hsl(${targetHue} 95% 65%)`,true);
      glow(ctx,`hsl(${hue} 95% 62%)`,20);circle(ctx,x,y,r,`hsl(${hue} 95% 62%)`,true);resetGlow(ctx);
      ctx.strokeStyle=p>.94?"#fff":"rgba(255,255,255,.3)";ctx.lineWidth=3;ctx.setLineDash([4,5]);circle(ctx,x,y,r+17,ctx.strokeStyle,false,3);resetGlow(ctx);
      ctx.fillStyle=p>.94?"#fff":"rgba(255,255,255,.35)";ctx.font="900 24px system-ui";ctx.fillText("✦",x,y+7);
    }
  },
  {
    id:"hidden", title:"GİZLİ HAREKET", mission:"Hareketi aklında tut; hedef anını tahmin et.", minRound:6, variants:3,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,3),y=h/2+20,from=w*.1,target=w*.76,x=from+(target-from)*p,hideAt=[.68,.55,.45][v];
      ctx.strokeStyle="rgba(255,255,255,.12)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(from,y);ctx.lineTo(target,y);ctx.stroke();ctx.strokeStyle=o.primary;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(target,y-52);ctx.lineTo(target,y+52);ctx.stroke();
      if(p<hideAt){glow(ctx,o.secondary);circle(ctx,x,y,15,o.secondary,true);resetGlow(ctx);} else {ctx.fillStyle="rgba(255,255,255,.24)";ctx.textAlign="center";ctx.font="800 11px system-ui";ctx.fillText("HAREKET DEVAM EDİYOR…",w/2,y-75);ctx.setLineDash([3,8]);ctx.strokeStyle="rgba(78,210,255,.18)";ctx.beginPath();ctx.moveTo(from+(target-from)*hideAt,y);ctx.lineTo(target,y);ctx.stroke();resetGlow(ctx);}
    }
  },
  {
    id:"fakeStop", title:"SAHTE DURUŞ", mission:"Sahte duruşa kanma; gerçek anı bekle.", minRound:7, variants:3,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,3),q=motionProgress(p,2),y=h/2+18,from=w*.1,target=w*.78,x=from+(target-from)*q;
      ctx.strokeStyle="rgba(255,255,255,.12)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(from,y);ctx.lineTo(target,y);ctx.stroke();dashedGuide(ctx,target,y,27,o.primary);
      glow(ctx,o.secondary);v===1?diamond(ctx,x,y,16,o.secondary):circle(ctx,x,y,16,o.secondary,true);resetGlow(ctx);
      if(p>.44&&p<.63){ctx.textAlign="center";ctx.font="900 10px system-ui";ctx.fillStyle=o.danger;ctx.fillText("BEKLE",x,y-35);}
    }
  },
  {
    id:"speed", title:"HIZ DEĞİŞİMİ", mission:"Hız değişse de hedefe ulaştığında dokun.", minRound:5, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4),q=motionProgress(p,v),y=h/2+18,from=w*.1,target=w*.78,x=from+(target-from)*q;
      ctx.strokeStyle="rgba(255,255,255,.1)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(from,y);ctx.lineTo(target,y);ctx.stroke();ctx.strokeStyle=o.primary;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(target,y-52);ctx.lineTo(target,y+52);ctx.stroke();
      glow(ctx,o.secondary);circle(ctx,x,y,15,o.secondary,true);resetGlow(ctx);ctx.fillStyle="rgba(255,255,255,.45)";ctx.font="800 10px system-ui";ctx.textAlign="center";ctx.fillText(["HIZLANIYOR","YAVAŞLIYOR","DUR • DEVAM","GERİ • İLERİ"][v],w/2,y-82);
    }
  },
  {
    id:"rhythm", title:"RİTİM ANI", mission:"Dördüncü parlama anında dokun.", minRound:6, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4),beats=4,phase=p*beats,index=Math.min(beats-1,Math.floor(phase)),pulse=1-(phase-Math.floor(phase));
      for(let i=0;i<beats;i++){const x=w*.2+i*w*.2, active=i===index, hidden=v===1&&i===2;ctx.globalAlpha=hidden?.16:1;circle(ctx,x,h/2+5,active?18+12*pulse:13,active?(i===3?o.primary:o.secondary):"rgba(255,255,255,.18)",active,3);ctx.fillStyle="rgba(255,255,255,.6)";ctx.font="800 9px system-ui";ctx.textAlign="center";ctx.fillText(String(i+1),x,h/2+52);}resetGlow(ctx);
      ctx.fillStyle="rgba(255,255,255,.45)";ctx.font="800 10px system-ui";ctx.fillText(v===1?"EKSİK VURUŞU HİSSET":"RİTMİ TAKİP ET",w/2,h/2-70);
    }
  },
  {
    id:"forbidden", title:"YASAK AN", mission:"İlk geçişte dokunma; ikinciyi bekle.", minRound:8, variants:3,
    reason:"Yasak anda dokundun.",
    draw(ctx,w,h,p,now,o) {
      let q,forbidden=false;if(p<.42){q=p/.42;forbidden=p>.31;}else if(p<.64){q=1-(p-.42)/.22*.45;forbidden=true;}else q=.55+(p-.64)/.36*.45;
      const y=h/2+15,from=w*.1,target=w*.72,x=from+(target-from)*q;
      if(forbidden){ctx.fillStyle="rgba(255,70,95,.09)";ctx.fillRect(0,0,w,h);ctx.fillStyle=o.danger;ctx.font="900 11px system-ui";ctx.textAlign="center";ctx.fillText("DOKUNMA",w/2,y-92);}
      ctx.strokeStyle="rgba(255,255,255,.12)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(from,y);ctx.lineTo(target,y);ctx.stroke();dashedGuide(ctx,target,y,27,forbidden?o.danger:o.primary);glow(ctx,forbidden?o.danger:o.secondary);circle(ctx,x,y,15,forbidden?o.danger:o.secondary,true);resetGlow(ctx);
    }
  },
  {
    id:"orbit", title:"ORBİTAL HİZALAMA", mission:"Işık yörüngenin tepesine geldiğinde dokun.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4),cx=w/2,cy=h/2+12,r=Math.min(w,h)*(.19+(v%2)*.025),direction=v<2?1:-1,angle=-Math.PI/2-direction*Math.PI*1.5*(1-p),x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r;
      dashedGuide(ctx,cx,cy,r,"rgba(255,255,255,.15)");circle(ctx,cx,cy-r,12,o.primary,false,3);glow(ctx,o.secondary);circle(ctx,x,y,11,o.secondary,true);resetGlow(ctx);circle(ctx,cx,cy,4,"rgba(255,255,255,.55)",true);
    }
  },
  {
    id:"pulsePeak", title:"NABIZ ZİRVESİ", mission:"Dördüncü ve en büyük nabızda dokun.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4),cx=w/2,cy=h/2+12,phase=p*4,beat=Math.min(3,Math.floor(phase)),local=phase-Math.floor(phase),pulse=Math.sin(Math.min(1,local)*Math.PI),radius=35+pulse*(beat===3?38:22+(v%2)*5);
      for(let i=0;i<4;i++){const x=w*.29+i*w*.14;circle(ctx,x,cy+105,5,i<=beat?(i===3?o.primary:o.secondary):"rgba(255,255,255,.14)",true);}
      glow(ctx,beat===3?o.primary:o.secondary,24);circle(ctx,cx,cy,radius,beat===3?o.primary:o.secondary,false,6);circle(ctx,cx,cy,13,"#fff",true);resetGlow(ctx);
    }
  },
  {
    id:"gate", title:"IŞIK KAPISI", mission:"Parçacık açık kapının merkezindeyken dokun.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4),vertical=v===1,cx=w/2,cy=h/2+14,targetX=vertical?cx:w*.72,targetY=vertical?h*.67:cy,x=vertical?cx:w*.1+(targetX-w*.1)*p,y=vertical?h*.14+(targetY-h*.14)*p:cy,gap=18+32*Math.abs(1-p);
      ctx.strokeStyle=o.primary;ctx.lineWidth=7;ctx.lineCap="round";glow(ctx,o.primary);ctx.beginPath();vertical?(ctx.moveTo(cx-gap,targetY),ctx.lineTo(cx-78,targetY),ctx.moveTo(cx+gap,targetY),ctx.lineTo(cx+78,targetY)):(ctx.moveTo(targetX,cy-gap),ctx.lineTo(targetX,cy-78),ctx.moveTo(targetX,cy+gap),ctx.lineTo(targetX,cy+78));ctx.stroke();resetGlow(ctx);glow(ctx,o.secondary);diamond(ctx,x,y,13,o.secondary);resetGlow(ctx);
    }
  },
  {
    id:"balance", title:"DENGE ANI", mission:"İki taraf tam dengelendiğinde dokun.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4),cx=w/2,cy=h/2+20,tilt=(1-p)*(v%2?-.48:.48),length=w*.58,dx=Math.cos(tilt)*length/2,dy=Math.sin(tilt)*length/2;
      ctx.strokeStyle=o.secondary;ctx.lineWidth=7;ctx.lineCap="round";glow(ctx,o.secondary);ctx.beginPath();ctx.moveTo(cx-dx,cy-dy);ctx.lineTo(cx+dx,cy+dy);ctx.stroke();resetGlow(ctx);circle(ctx,cx,cy+8,14,o.primary,true);ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(cx-length*.38,cy+68,length*.76,3);circle(ctx,cx-dx,cy-dy-15,13,o.primary,true);circle(ctx,cx+dx,cy+dy-15,13,o.primary,true);
    }
  },
  {
    id:"spiral", title:"SARMAL MERKEZ", mission:"Parçacık merkeze ulaştığında dokun.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4),cx=w/2,cy=h/2+12,maxR=Math.min(w,h)*.28,r=maxR*(1-p),turns=1.5+(v%3)*.5,angle=(v===3?-1:1)*turns*TAU*p,x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r;
      ctx.strokeStyle="rgba(255,255,255,.1)";ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=70;i++){const q=i/70,rr=maxR*(1-q),aa=(v===3?-1:1)*turns*TAU*q,px=cx+Math.cos(aa)*rr,py=cy+Math.sin(aa)*rr;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();dashedGuide(ctx,cx,cy,24,o.primary);glow(ctx,o.secondary);circle(ctx,x,y,11,o.secondary,true);resetGlow(ctx);
    }
  },
  {
    id:"tripleSync", title:"ÜÇLÜ SENKRON", mission:"Üç şekil merkezde birleştiğinde dokun.", minRound:1, variants:4,
    draw(ctx,w,h,p,now,o) {
      const v=variantOf(o,4),cx=w/2,cy=h/2+15,r=Math.min(w,h)*.3*(1-p),rotation=(v%2?-.35:.35)*p,colors=[o.primary,o.secondary,o.accent];
      for(let i=0;i<3;i++){const a=-Math.PI/2+i*TAU/3+rotation,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;glow(ctx,colors[i],16);v===2?diamond(ctx,x,y,13,colors[i]):circle(ctx,x,y,13,colors[i],true);resetGlow(ctx);}dashedGuide(ctx,cx,cy,22,"rgba(255,255,255,.2)");
    }
  },
  {
    id:"clockHand",title:"SAAT İBRESİ",mission:"İbre tam yukarıyı gösterdiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+15,r=Math.min(w,h)*.22,d=v%2?1:-1,a=-Math.PI/2+d*Math.PI*1.65*(1-p);circle(ctx,cx,cy,r,"rgba(255,255,255,.13)",false,2);for(let i=0;i<12;i++){const q=i*TAU/12;circle(ctx,cx+Math.cos(q)*r,cy+Math.sin(q)*r,2,i===9?o.primary:"rgba(255,255,255,.3)",true);}ctx.strokeStyle=o.secondary;ctx.lineWidth=6;ctx.lineCap="round";glow(ctx,o.secondary);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*r*.82,cy+Math.sin(a)*r*.82);ctx.stroke();resetGlow(ctx);circle(ctx,cx,cy,9,o.primary,true);}
  },
  {
    id:"pendulum",title:"SARKAÇ MERKEZİ",mission:"Sarkaç merkez çizgisindeyken dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,top=h*.25,length=Math.min(w,h)*.3,angle=pendulumAngle(p,v%2?1:-1),x=cx+Math.sin(angle)*length,y=top+Math.cos(angle)*length;ctx.strokeStyle="rgba(255,255,255,.18)";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,top);ctx.lineTo(x,y);ctx.stroke();ctx.strokeStyle=o.primary;ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(cx,top);ctx.lineTo(cx,top+length+30);ctx.stroke();resetGlow(ctx);glow(ctx,o.secondary);circle(ctx,x,y,18,o.secondary,true);resetGlow(ctx);}
  },
  {
    id:"eclipse",title:"TUTULMA ANI",mission:"İki ışık tam üst üste geldiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+12,d=Math.min(w,h)*.28*(1-p),vertical=v===1,ax=vertical?cx:cx-d,ay=vertical?cy-d:cy,bx=vertical?cx:cx+d,by=vertical?cy+d:cy;ctx.globalAlpha=.78;glow(ctx,o.secondary);circle(ctx,ax,ay,34,o.secondary,true);resetGlow(ctx);ctx.globalAlpha=.78;glow(ctx,o.primary);circle(ctx,bx,by,34,o.primary,true);resetGlow(ctx);if(p>.9)circle(ctx,cx,cy,46,"rgba(255,255,255,.3)",false,2);}
  },
  {
    id:"scanner",title:"TARAYICI ÇİZGİSİ",mission:"Tarayıcı merkez işaretine ulaştığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),vertical=v%2===0,cx=w/2,cy=h/2+10,pos=vertical?w*.08+(cx-w*.08)*p:h*.13+(cy-h*.13)*p;ctx.fillStyle="rgba(72,227,155,.06)";vertical?ctx.fillRect(cx-22,h*.15,44,h*.7):ctx.fillRect(w*.12,cy-22,w*.76,44);ctx.strokeStyle=o.primary;ctx.lineWidth=2;ctx.setLineDash([5,7]);vertical?ctx.strokeRect(cx-22,h*.15,44,h*.7):ctx.strokeRect(w*.12,cy-22,w*.76,44);resetGlow(ctx);ctx.strokeStyle=o.secondary;ctx.lineWidth=5;glow(ctx,o.secondary);ctx.beginPath();vertical?(ctx.moveTo(pos,h*.18),ctx.lineTo(pos,h*.82)):(ctx.moveTo(w*.12,pos),ctx.lineTo(w*.88,pos));ctx.stroke();resetGlow(ctx);}
  },
  {
    id:"aperture",title:"ODAK AÇIKLIĞI",mission:"Açıklık merkez halkayla eşleştiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+10,target=42,r=target+Math.min(w,h)*.22*(1-p),blades=6+(v%2)*2;dashedGuide(ctx,cx,cy,target,o.primary);ctx.strokeStyle=o.secondary;ctx.lineWidth=5;glow(ctx,o.secondary);for(let i=0;i<blades;i++){const a=i*TAU/blades+(1-p)*.7;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.lineTo(cx+Math.cos(a+.55)*r*.62,cy+Math.sin(a+.55)*r*.62);ctx.stroke();}resetGlow(ctx);}
  },
  {
    id:"stack",title:"BLOĞU OTURT",mission:"Kayan blok alt blokla hizalandığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,baseY=h*.67,bw=92,bh=28,startX=v%2?w*.15:w*.85,x=startX+(cx-startX)*p;ctx.fillStyle="rgba(255,255,255,.12)";ctx.fillRect(cx-bw/2,baseY,bw,bh);ctx.strokeStyle=o.primary;ctx.lineWidth=3;ctx.strokeRect(cx-bw/2,baseY,bw,bh);glow(ctx,o.secondary);ctx.fillStyle=o.secondary;ctx.fillRect(x-bw/2,baseY-bh-8,bw,bh);resetGlow(ctx);}
  },
  {
    id:"waveMeet",title:"DALGA BULUŞMASI",mission:"İki dalga merkezde buluştuğunda dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+10,d=w*.36*(1-p),amp=22+(v%3)*6,x1=cx-d,x2=cx+d,y1=cy+Math.sin(p*Math.PI*4)*amp*(1-p),y2=cy-Math.sin(p*Math.PI*4)*amp*(1-p);ctx.strokeStyle="rgba(255,255,255,.1)";ctx.beginPath();ctx.moveTo(w*.1,cy);ctx.lineTo(w*.9,cy);ctx.stroke();glow(ctx,o.secondary);circle(ctx,x1,y1,14,o.secondary,true);resetGlow(ctx);glow(ctx,o.primary);circle(ctx,x2,y2,14,o.primary,true);resetGlow(ctx);}
  },
  {
    id:"angleMatch",title:"AÇI EŞLEŞMESİ",mission:"Dönen prizma hedef açısına geldiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+12,size=55,angle=(v%2?1:-1)*(1-p)*Math.PI*1.35;ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);ctx.strokeStyle="rgba(255,255,255,.18)";ctx.lineWidth=2;ctx.strokeRect(-size*.72,-size*.72,size*1.44,size*1.44);ctx.restore();ctx.save();ctx.translate(cx,cy);ctx.rotate(angle+Math.PI/4);ctx.strokeStyle=o.secondary;ctx.lineWidth=6;glow(ctx,o.secondary);ctx.strokeRect(-size*.72,-size*.72,size*1.44,size*1.44);ctx.restore();resetGlow(ctx);}
  },
  {
    id:"tunnel",title:"TÜNEL HİZASI",mission:"Yaklaşan çerçeve hedefle eşleştiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+12,target=72,size=target+(1-p)*(140+(v%3)*25);for(let i=1;i<=3;i++){ctx.globalAlpha=.12+i*.06;ctx.strokeStyle=o.secondary;ctx.lineWidth=2;ctx.strokeRect(cx-(size+i*30)/2,cy-(size+i*30)/2,size+i*30,size+i*30);}resetGlow(ctx);ctx.strokeStyle=o.primary;ctx.lineWidth=4;ctx.strokeRect(cx-target/2,cy-target/2,target,target);glow(ctx,o.secondary);ctx.strokeStyle=o.secondary;ctx.lineWidth=5;ctx.strokeRect(cx-size/2,cy-size/2,size,size);resetGlow(ctx);}
  },
  {
    id:"apex",title:"TEPE NOKTASI",mission:"Işık en yüksek noktaya çıktığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,base=h*.72,height=h*.35,x=w*.18+(cx-w*.18)*p,y=base-height*(2*p-p*p);ctx.strokeStyle="rgba(255,255,255,.12)";ctx.setLineDash([4,7]);ctx.beginPath();for(let i=0;i<=40;i++){const q=i/40,px=w*.18+(cx-w*.18)*q,py=base-height*(2*q-q*q);i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();resetGlow(ctx);ctx.strokeStyle=o.primary;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-35,base-height);ctx.lineTo(cx+35,base-height);ctx.stroke();glow(ctx,o.secondary);circle(ctx,x,y,15,o.secondary,true);resetGlow(ctx);}
  },
  {
    id:"equalizer",title:"EŞİT SEVİYE",mission:"Tüm sütunlar aynı seviyeye geldiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+45,count=5,bw=24,gap=13,target=86;for(let i=0;i<count;i++){const start=35+((i*47+v*29)%110),height=start+(target-start)*p,x=cx-(count*(bw+gap)-gap)/2+i*(bw+gap);ctx.fillStyle=i%2?o.primary:o.secondary;ctx.globalAlpha=.82;ctx.fillRect(x,cy-height,bw,height);}resetGlow(ctx);ctx.strokeStyle="rgba(255,255,255,.22)";ctx.setLineDash([5,6]);ctx.beginPath();ctx.moveTo(cx-120,cy-target);ctx.lineTo(cx+120,cy-target);ctx.stroke();resetGlow(ctx);}
  },
  {
    id:"starPath",title:"YILDIZ YOLU",mission:"Işık son yıldıza ulaştığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),points=[[w*.18,h*.67],[w*.34,h*.38],[w*.52,h*.58],[w*.72,h*.3]],segment=Math.min(2,Math.floor(p*3)),local=Math.min(1,p*3-segment),a=points[segment],b=points[segment+1],x=a[0]+(b[0]-a[0])*local,y=a[1]+(b[1]-a[1])*local;ctx.strokeStyle="rgba(255,255,255,.14)";ctx.lineWidth=2;ctx.beginPath();points.forEach((pt,i)=>i?ctx.lineTo(...pt):ctx.moveTo(...pt));ctx.stroke();points.forEach((pt,i)=>{ctx.fillStyle=i===3?o.primary:"rgba(255,255,255,.25)";ctx.font="900 22px system-ui";ctx.textAlign="center";ctx.fillText("✦",pt[0],pt[1]+7);});glow(ctx,o.secondary);circle(ctx,x,y,9,o.secondary,true);resetGlow(ctx);}
  },
  {
    id:"shutters",title:"MERKEZ PERDESİ",mission:"İki perde merkez aralığını oluşturduğunda dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+12,horizontal=v%2===0,gap=24+(1-p)*w*.26;ctx.fillStyle="rgba(255,255,255,.09)";horizontal?(ctx.fillRect(0,0,cx-gap,h),ctx.fillRect(cx+gap,0,w-cx-gap,h)):(ctx.fillRect(0,0,w,cy-gap),ctx.fillRect(0,cy+gap,w,h-cy-gap));ctx.strokeStyle=o.primary;ctx.lineWidth=4;horizontal?(ctx.strokeRect(cx-24,cy-70,48,140)):(ctx.strokeRect(cx-70,cy-24,140,48));ctx.strokeStyle=o.secondary;ctx.lineWidth=6;glow(ctx,o.secondary);ctx.beginPath();horizontal?(ctx.moveTo(cx-gap,cy-80),ctx.lineTo(cx-gap,cy+80),ctx.moveTo(cx+gap,cy-80),ctx.lineTo(cx+gap,cy+80)):(ctx.moveTo(cx-80,cy-gap),ctx.lineTo(cx+80,cy-gap),ctx.moveTo(cx-80,cy+gap),ctx.lineTo(cx+80,cy+gap));ctx.stroke();resetGlow(ctx);}
  },
  {
    id:"counterOrbit",title:"ÇİFT YÖRÜNGE",mission:"İki ışık üst işarette buluştuğunda dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+15,r=Math.min(w,h)*.21,a1=-Math.PI/2-Math.PI*1.4*(1-p),a2=-Math.PI/2+Math.PI*1.4*(1-p);dashedGuide(ctx,cx,cy,r);circle(ctx,cx,cy-r,12,o.primary,false,3);glow(ctx,o.secondary);circle(ctx,cx+Math.cos(a1)*r,cy+Math.sin(a1)*r,10,o.secondary,true);resetGlow(ctx);glow(ctx,o.primary);diamond(ctx,cx+Math.cos(a2)*r,cy+Math.sin(a2)*r,10,o.primary);resetGlow(ctx);}
  },
  {
    id:"cometTrail",title:"KUYRUKLU IŞIK",mission:"Kuyruklu ışık hedef çizgisine ulaştığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),vertical=v%2===1,target=vertical?h*.7:w*.76,x=vertical?w/2:w*.1+(target-w*.1)*p,y=vertical?h*.14+(target-h*.14)*p:h/2+15;ctx.strokeStyle=o.primary;ctx.lineWidth=4;ctx.beginPath();vertical?(ctx.moveTo(w*.36,target),ctx.lineTo(w*.64,target)):(ctx.moveTo(target,y-55),ctx.lineTo(target,y+55));ctx.stroke();for(let i=5;i>0;i--){ctx.globalAlpha=.08*i;circle(ctx,vertical?x:(x-i*15),vertical?(y-i*15):y,6+i,o.secondary,true);}resetGlow(ctx);glow(ctx,o.secondary);circle(ctx,x,y,13,o.secondary,true);resetGlow(ctx);}
  },
  {
    id:"notchSlider",title:"ÇENTİK NOKTASI",mission:"Kayan düğme parlak çentiğe geldiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+15,r=Math.min(w,h)*.22,a=-Math.PI*.8+Math.PI*.3*p;ctx.strokeStyle="rgba(255,255,255,.14)";ctx.lineWidth=12;ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI*.8,-Math.PI*.5);ctx.stroke();const tx=cx+Math.cos(-Math.PI*.5)*r,ty=cy+Math.sin(-Math.PI*.5)*r;diamond(ctx,tx,ty,13,o.primary);glow(ctx,o.secondary);circle(ctx,cx+Math.cos(a)*r,cy+Math.sin(a)*r,12,o.secondary,true);resetGlow(ctx);}
  },
  {
    id:"triangleFit",title:"ÜÇGEN HİZASI",mission:"Hareketli üçgen hedef üçgenle eşleştiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+20,target=72,size=target+(1-p)*125;function tri(sz,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();for(let i=0;i<3;i++){const a=-Math.PI/2+i*TAU/3,x=cx+Math.cos(a)*sz,y=cy+Math.sin(a)*sz;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();}tri(target,"rgba(255,255,255,.18)",2);glow(ctx,o.secondary);tri(size,o.secondary,5);resetGlow(ctx);circle(ctx,cx,cy,4,o.primary,true);}
  },
  {
    id:"diagonalCross",title:"ÇAPRAZ KESİŞİM",mission:"İki çapraz çizgi merkezde kesiştiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+10,d=Math.min(w,h)*.34*(1-p);ctx.lineWidth=7;ctx.lineCap="round";glow(ctx,o.secondary);ctx.strokeStyle=o.secondary;ctx.beginPath();ctx.moveTo(cx-d-70,cy-d-70);ctx.lineTo(cx-d,cy-d);ctx.stroke();resetGlow(ctx);glow(ctx,o.primary);ctx.strokeStyle=o.primary;ctx.beginPath();ctx.moveTo(cx+d,cy-d);ctx.lineTo(cx+d+70,cy-d-70);ctx.stroke();resetGlow(ctx);circle(ctx,cx,cy,7,"rgba(255,255,255,.3)",false,2);}
  },
  {
    id:"oppositeOrbit",title:"KARŞIT NOKTALAR",mission:"İki parça karşılıklı işaretlere oturduğunda dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+12,r=Math.min(w,h)*.22,offset=(1-p)*Math.PI*.8,a=-Math.PI/2-offset,b=Math.PI/2-offset;dashedGuide(ctx,cx,cy,r);diamond(ctx,cx,cy-r,11,o.primary);diamond(ctx,cx,cy+r,11,o.primary);glow(ctx,o.secondary);circle(ctx,cx+Math.cos(a)*r,cy+Math.sin(a)*r,10,o.secondary,true);circle(ctx,cx+Math.cos(b)*r,cy+Math.sin(b)*r,10,o.secondary,true);resetGlow(ctx);}
  },
  {
    id:"narrowPulse",title:"DARALAN NABIZ",mission:"Nabız hedef halkaya daraldığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+12,target=50,r=target+(1-p)*Math.min(w,h)*.26;dashedGuide(ctx,cx,cy,target,o.primary);ctx.globalAlpha=.2+.8*p;glow(ctx,o.secondary);circle(ctx,cx,cy,r,o.secondary,false,7);resetGlow(ctx);circle(ctx,cx,cy,9,"#fff",true);}
  },
  {
    id:"ricochet",title:"SEKME SONU",mission:"Seken parçacık son hedefe ulaştığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const pts=[[w*.12,h*.28],[w*.78,h*.28],[w*.24,h*.5],[w*.74,h*.7]],q=p*3,i=Math.min(2,Math.floor(q)),t=Math.min(1,q-i),a=pts[i],b=pts[i+1],x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;ctx.strokeStyle="rgba(255,255,255,.11)";ctx.setLineDash([5,8]);ctx.beginPath();pts.forEach((pt,j)=>j?ctx.lineTo(...pt):ctx.moveTo(...pt));ctx.stroke();resetGlow(ctx);dashedGuide(ctx,pts[3][0],pts[3][1],23,o.primary);glow(ctx,o.secondary);circle(ctx,x,y,12,o.secondary,true);resetGlow(ctx);}
  },
  {
    id:"zipper",title:"IŞIK FERMUARI",mission:"Işık parçaları merkezde tamamen kapandığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+10,count=6;for(let i=0;i<count;i++){const y=cy-(count-1)*18/2+i*18,d=w*.34*(1-p),offset=i%2?8:-8;ctx.strokeStyle=i%2?o.primary:o.secondary;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx-d-35,y+offset);ctx.lineTo(cx-d,y);ctx.moveTo(cx+d,y);ctx.lineTo(cx+d+35,y-offset);ctx.stroke();}circle(ctx,cx,cy,6,"rgba(255,255,255,.4)",true);}
  },
  {
    id:"radar",title:"RADAR İŞARETİ",mission:"Tarama çizgisi parlak sektöre geldiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const v=variantOf(o,4),cx=w/2,cy=h/2+15,r=Math.min(w,h)*.24,start=-Math.PI*.95,target=-Math.PI*.2,a=start+(target-start)*p;circle(ctx,cx,cy,r,"rgba(255,255,255,.13)",false,2);ctx.strokeStyle=o.primary;ctx.lineWidth=7;ctx.beginPath();ctx.arc(cx,cy,r,target-.08,target+.08);ctx.stroke();ctx.strokeStyle=o.secondary;ctx.lineWidth=4;glow(ctx,o.secondary);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();resetGlow(ctx);}
  },
  {
    id:"crossBars",title:"ARTI HİZASI",mission:"Dönen çubuklar artı işaretine dönüştüğünde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+12,length=120,angle=(1-p)*Math.PI*.42;ctx.strokeStyle="rgba(255,255,255,.16)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx-length/2,cy);ctx.lineTo(cx+length/2,cy);ctx.moveTo(cx,cy-length/2);ctx.lineTo(cx,cy+length/2);ctx.stroke();ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.strokeStyle=o.secondary;ctx.lineWidth=7;glow(ctx,o.secondary);ctx.beginPath();ctx.moveTo(-length/2,0);ctx.lineTo(length/2,0);ctx.moveTo(0,-length/2);ctx.lineTo(0,length/2);ctx.stroke();ctx.restore();resetGlow(ctx);}
  },
  {
    id:"droplets",title:"DAMLA BULUŞMASI",mission:"İki damla ortadaki halkada birleştiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+12,d=h*.3*(1-p);dashedGuide(ctx,cx,cy,24,o.primary);glow(ctx,o.secondary);circle(ctx,cx,cy-d,13,o.secondary,true);resetGlow(ctx);glow(ctx,o.primary);diamond(ctx,cx,cy+d,13,o.primary);resetGlow(ctx);}
  },
  {
    id:"magnet",title:"MANYETİK ÇEKİM",mission:"İki parça mıknatısın merkezinde birleştiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+15,d=w*.34*(1-p),curve=Math.sin(p*Math.PI)*45;ctx.strokeStyle="rgba(255,255,255,.1)";ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(w*.12,cy);ctx.quadraticCurveTo(cx,cy-70,cx,cy);ctx.moveTo(w*.88,cy);ctx.quadraticCurveTo(cx,cy+70,cx,cy);ctx.stroke();resetGlow(ctx);ctx.strokeStyle=o.primary;ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx,cy,34,0,Math.PI);ctx.stroke();diamond(ctx,cx-d,cy-curve,12,o.secondary);diamond(ctx,cx+d,cy+curve,12,o.primary);}
  },
  {
    id:"kaleido",title:"DESEN KİLİDİ",mission:"Dönen desen sabit çizgilerle eşleştiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+12,r=85,offset=(1-p)*Math.PI/5;ctx.lineCap="round";for(let i=0;i<6;i++){const guide=i*TAU/6;ctx.strokeStyle="rgba(255,255,255,.13)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx+Math.cos(guide)*25,cy+Math.sin(guide)*25);ctx.lineTo(cx+Math.cos(guide)*r,cy+Math.sin(guide)*r);ctx.stroke();const a=guide+offset;ctx.strokeStyle=i%2?o.primary:o.secondary;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*25,cy+Math.sin(a)*25);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();}}
  },
  {
    id:"waveCrest",title:"DALGA TEPESİ",mission:"Dalganın tepesi merkez işaretine geldiğinde dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+15,amp=55,x=w*.1+(cx-w*.1)*p,y=cy-amp;ctx.strokeStyle="rgba(255,255,255,.16)";ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=70;i++){const px=w*.08+i*w*.84/70,py=cy-Math.cos((px-x)/55)*amp;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();ctx.strokeStyle=o.primary;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx-25,cy-amp);ctx.lineTo(cx+25,cy-amp);ctx.stroke();glow(ctx,o.secondary);circle(ctx,x,y,11,o.secondary,true);resetGlow(ctx);}
  },
  {
    id:"domino",title:"SON TAŞ",mission:"Işık sırası son taşa ulaştığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const count=7,cx=w/2,cy=h/2+15,active=Math.min(count-1,Math.floor(p*count));for(let i=0;i<count;i++){const x=cx-(count-1)*35/2+i*35,y=cy+(i%2?10:-10);ctx.fillStyle=i<=active?(i===count-1?o.primary:o.secondary):"rgba(255,255,255,.1)";ctx.fillRect(x-11,y-28,22,56);ctx.fillStyle="rgba(255,255,255,.55)";ctx.font="800 8px system-ui";ctx.textAlign="center";ctx.fillText(String(i+1),x,y+3);}}
  },
  {
    id:"hourglass",title:"KUM SAATİ",mission:"Üst hazne tamamen boşaldığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+10,size=85;ctx.strokeStyle="rgba(255,255,255,.24)";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx-size,cy-size);ctx.lineTo(cx+size,cy-size);ctx.lineTo(cx-size,cy+size);ctx.lineTo(cx+size,cy+size);ctx.closePath();ctx.stroke();const topH=(1-p)*60,bottomH=p*60;ctx.fillStyle=o.secondary;ctx.beginPath();ctx.moveTo(cx-size*.7,cy-size+18);ctx.lineTo(cx+size*.7,cy-size+18);ctx.lineTo(cx,cy-size+18+topH);ctx.closePath();ctx.fill();ctx.fillStyle=o.primary;ctx.beginPath();ctx.moveTo(cx-size*.7,cy+size-18);ctx.lineTo(cx+size*.7,cy+size-18);ctx.lineTo(cx,cy+size-18-bottomH);ctx.closePath();ctx.fill();}
  },
  {
    id:"quadrants",title:"DÖRTLÜ BİRLEŞİM",mission:"Dört parça merkez halkayı tamamladığında dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+12,d=Math.min(w,h)*.25*(1-p);for(let i=0;i<4;i++){const a=i*Math.PI/2,x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;ctx.strokeStyle=i%2?o.primary:o.secondary;ctx.lineWidth=7;ctx.beginPath();ctx.arc(x,y,28,a,a+Math.PI/2);ctx.stroke();}dashedGuide(ctx,cx,cy,28,"rgba(255,255,255,.18)");}
  },
  {
    id:"lensFocus",title:"NETLİK ANI",mission:"İki mercek tek ve net bir halka olduğunda dokun.",minRound:1,variants:4,
    draw(ctx,w,h,p,now,o){const cx=w/2,cy=h/2+12,d=w*.25*(1-p);ctx.globalAlpha=.55;glow(ctx,o.secondary,28*(1-p)+5);circle(ctx,cx-d,cy,42,o.secondary,false,7);resetGlow(ctx);ctx.globalAlpha=.55;glow(ctx,o.primary,28*(1-p)+5);circle(ctx,cx+d,cy,42,o.primary,false,7);resetGlow(ctx);if(p>.88){ctx.globalAlpha=(p-.88)/.12;circle(ctx,cx,cy,42,"#fff",false,3);resetGlow(ctx);}}
  }
];

function drawParticles(ctx, particles, delta) {
  particles.forEach(p=>{p.life-=delta;p.x+=p.vx*delta/16;p.y+=p.vy*delta/16;p.vy+=.025*delta/16;ctx.globalAlpha=Math.max(0,p.life/p.maxLife);ctx.fillStyle=p.color;circle(ctx,p.x,p.y,p.size,p.color,true);});ctx.globalAlpha=1;return particles.filter(p=>p.life>0);
}
function makeParticles(x,y,colors,reducedMotion) {
  const count=reducedMotion?8:28;return Array.from({length:count},(_,i)=>{const angle=i/count*TAU+Math.random()*.25,speed=2+Math.random()*4,life=500+Math.random()*300;return{x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size:1.5+Math.random()*2.5,life,maxLife:life,color:colors[i%colors.length]};});
}
window.TamRounds={roundTypes,drawParticles,makeParticles,helpers:{pendulumAngle}};
})();