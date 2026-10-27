(()=>{
const CAT={video:'Vídeo',audio:'Audio',imagen:'Imágenes',documento:'Documentos',archivo:'Comprimidos e imágenes de disco',codigo:'Código',sistema:'Sistema y apps (@)',otros:'Otros'};
const CATS=Object.keys(CAT);
const $=id=>document.getElementById(id);
const map=$('map');
let HIDEFREE=false, DATA=null, view='disk', trees={}, zoom=null, hl=null, idx={};

const GiB=1024**3;
function fmt(b){if(b==null)return'—';const u=['B','KB','MB','GB','TB','PB'];let i=0;let v=b;while(v>=1024&&i<u.length-1){v/=1024;i++}return v.toLocaleString('es-ES',{maximumFractionDigits:v<10&&i>2?2:v<100?1:0})+' '+u[i]}
function pct(a,b){return b?(a/b*100).toLocaleString('es-ES',{maximumFractionDigits:a/b<.1?1:0})+' %':'—'}

/* ---------- datos de ejemplo ---------- */
function sample(){
  let seed=7;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const G=g=>Math.round(g*GiB);
  const movies=['Terminator (1984)','Terminator Genesis (2015)','American Hustle (2013)','2001 Una odisea en el espacio','Nadie 2 (2025)','La captura (2026)','La bestia en la jungla (2026)','Nada (Intet) (2022)','El lado dulce de la traición (2023)','Estan vivos (1988)','Blade Runner (1982)','Alien (1979)','Aliens (1986)','Dune (2021)','Dune Parte dos (2024)','Interstellar (2014)','Arrival (2016)','Sicario (2015)','Prisoners (2013)','El club de la lucha (1999)','Heat (1995)','Zodiac (2007)','Mad Max Fury Road (2015)','Drive (2011)','Her (2013)','La La Land (2016)','Whiplash (2014)','Oldboy (2003)','Parásitos (2019)','Akira (1988)'];
  const mv=(list,lo,hi)=>list.map(n=>({n:n,s:0,k:[{n:n.replace(/[ ()]+/g,'.')+'1080p.mkv',s:G(lo+r()*(hi-lo)),c:'video',f:1},{n:'Ficheros pequeños',s:G(.0004),c:'otros',b:3}]}));
  const series=(n,eps,gb)=>({n:n,s:0,k:Array.from({length:Math.ceil(eps/8)},(_,i)=>({n:'Season 0'+(i+1),s:0,k:Array.from({length:Math.min(8,eps-i*8)},(_,j)=>({n:n.split(' ')[0]+' S0'+(i+1)+'E0'+(j+1)+'.mkv',s:G(gb*(0.7+r()*.6)),c:'video',f:1}))}))});
  const sys=(n,g)=>({n:n,s:G(g),c:'sistema',y:1});
  const vol=(id,raid,parts,total,kids)=>({id,mount:'/'+id,fs:'ext4',raid,parts,total:G(total),used:0,tree:{n:id,s:0,k:kids}});
  const vols=[
    vol('volume1','raid1',[{disk:'sata1',part:'sata1p5',size:G(3720)},{disk:'sata2',part:'sata2p5',size:G(3720)}],3710,[
      {n:'photo',s:0,k:['2008','2011','2015','2019','2022','2024','2025','2026'].map(y=>({n:y,s:0,k:[{n:'Ficheros pequeños',s:G(20+r()*90),c:'imagen',b:4000},{n:'Ficheros pequeños',s:G(3+r()*20),c:'video',b:120}]}))},
      {n:'homes',s:0,k:[{n:'abraham',s:0,k:[{n:'Documentos',s:G(14),c:'documento'},{n:'Drive',s:G(48),c:'otros'},{n:'Backups móvil',s:G(62),c:'archivo'},{n:'Música',s:G(95),c:'audio'}]},{n:'invitado',s:G(2),c:'otros'}]},
      {n:'music',s:0,k:[{n:'FLAC',s:G(410),c:'audio'},{n:'MP3',s:G(64),c:'audio'}]},
      {n:'Git',s:G(6),c:'codigo'},{n:'gitProjects',s:G(11),c:'codigo'},{n:'web_packages',s:G(9),c:'codigo'},{n:'scripts',s:G(.4),c:'codigo'},
      {n:'docker',s:G(38),c:'archivo'},{n:'Copias Hyper Backup',s:G(560),c:'archivo'},{n:'video personal',s:0,k:[{n:'Ficheros pequeños',s:G(.004),c:'video',b:12},{n:'Vacaciones 2019.mp4',s:G(4.2),c:'video',f:1},{n:'Boda primos.mp4',s:G(7.8),c:'video',f:1}]},
      sys('@appstore',22),sys('@docker',54),sys('@database',6),sys('@synologydrive',31),sys('#recycle',140)]),
    vol('volume2','raid1',[{disk:'sata3',part:'sata3p3',size:G(1850)}],1840,[
      {n:'surveillance',s:0,k:['Entrada','Salón','Garaje'].map((c,i)=>({n:c,s:G([620,410,520][i]),c:'video'}))},sys('@surveillance',4)]),
    vol('volume3','raid1',[{disk:'sata4',part:'sata4p5',size:G(2780)}],2770,[
      {n:'Peliculas',s:0,k:mv(movies.slice(0,18),4,14)},
      {n:'Peliculas 2015',s:0,k:mv(movies.slice(18),1.5,6)},
      {n:'Peliculas 2016',s:G(520),c:'video'},{n:'Peliculas 2017',s:G(430),c:'video'},{n:'Peliculas 4K',s:G(610),c:'video'},
      {n:'Series',s:0,k:[series('Silo T1',10,2.4),series('Ted Lasso T1',10,1.6),series('The Last of Us',9,3.1),series('Stranger Things',8,5.2),series('Alien Earth',8,2.9)]},
      {n:'ISOs',s:G(46),c:'archivo'},sys('@eaDir',3)]),
  ];
  const sum=n=>{if(n.k){n.s=n.k.reduce((a,k)=>a+sum(k),0)}return n.s};
  vols.forEach(v=>{v.used=Math.min(v.total,Math.round(sum(v.tree)*1.003));v.files=Math.round(v.used/GiB*90);v.errors=0});
  return {tool:'nasmap',sample:true,host:'DiskStation · DS1517+',generated:'2026-10-26T12:00:00',
    disks:[
      {id:'sata1',model:'WDC WD40EFZX (Red Plus)',serial:'WD-WX12D71A0XPL',size:G(3726)},
      {id:'sata2',model:'WDC WD40EFZX (Red Plus)',serial:'WD-WX12D71A3KQ9',size:G(3726)},
      {id:'sata3',model:'WDC WD20PURZ (Purple)',serial:'WD-WX81A30H2F2T',size:G(1863)},
      {id:'sata4',model:'WDC WD30EZRX (Green)',serial:'WD-WMC1T2116569',size:G(2794)},
      {id:'sata5',model:'WDC WD30EFRX (Red)',serial:'WD-WCC4N0YSDJDX',size:G(2794)}],
    volumes:vols};
}

/* ---------- preparación de árboles ---------- */
function prep(n,key,parent,f){
  const o={name:n.n,real:n.s,v:n.s*f,c:n.c||'otros',key,p:parent,sys:!!n.y,file:!!n.f,bucket:n.b,other:!!n.o,err:!!n.e};
  if(n.k&&n.k.length){
    const seen={};
    o.k=n.k.map(k=>{let kk=key+'/'+k.n;if(k.b!=null)kk+='#'+(k.c||'');seen[kk]=(seen[kk]||0)+1;if(seen[kk]>1)kk+='~'+seen[kk];return prep(k,kk,o,f)});
    const kidSum=o.k.reduce((a,k)=>a+k.real,0);
    if(n.s-kidSum>Math.max(n.s*.02,1)) o.k.push({name:'Sin desglosar',real:n.s-kidSum,v:(n.s-kidSum)*f,c:o.c,key:key+'/~rest',p:o});
  }
  o.cats={};
  if(o.k) o.k.forEach(k=>{for(const c in k.cats)o.cats[c]=(o.cats[c]||0)+k.cats[c]});
  else if(o.kind==null) o.cats[o.c]=o.real;
  return o;
}
function special(name,real,f,key,kind,parent){return {name,real,v:real*f,key,kind,p:parent,cats:{}}}
function volLabel(v){
  const n=(v.parts||[]).length; const r=v.raid||'';
  if(!r) return n?'':'carpeta';
  if(r==='raid1') return n>1?'espejo en '+n+' discos (RAID 1 / SHR)':'básico (1 disco)';
  if(r==='raid0') return 'RAID 0 repartido en '+n+' discos';
  if(/raid5/.test(r)&&/raid1/.test(r)) return 'SHR mixto en '+n+' discos';
  if(r==='raid5') return 'RAID 5 / SHR en '+n+' discos';
  if(r==='raid6') return 'RAID 6 / SHR-2 en '+n+' discos';
  return r+' en '+n+' discos';
}
function volumeNode(v,f,keyPre,parent,opts){
  const key=keyPre+'v:'+v.id;
  const node={name:v.id,real:v.total,v:v.total*f,key,kind:'vol',p:parent,vol:v,cats:{},sub:volLabel(v)};
  const t=prep(v.tree,key+'/r',node,f);
  const content=t.k?t.k:[t];
  content.forEach(c=>c.p=node);
  const sumC=content.reduce((a,c)=>a+c.real,0);
  node.k=[...content];
  if(v.used-sumC>v.total*.01) node.k.push(special('Usado sin contabilizar',v.used-sumC,f,key+'/~unk','unalloc',node));
  const free=v.total-Math.max(v.used,sumC);
  if(free>0&&!HIDEFREE) node.k.push(special('Libre',free,f,key+'/~free','free',node));
  for(const c of content) for(const k in c.cats) node.cats[k]=(node.cats[k]||0)+c.cats[k];
  if(opts) Object.assign(node,opts);
  return node;
}
function build(){
  const d=DATA; trees={};
  const vroot={name:d.host||'NAS',key:'root',kind:'root',k:[],cats:{}};
  d.volumes.forEach(v=>vroot.k.push(volumeNode(v,1,'',vroot)));
  vroot.real=vroot.v=vroot.k.reduce((a,k)=>a+k.v,0);
  trees.vol=vroot;
  const droot={name:d.host||'NAS',key:'root',kind:'root',k:[],cats:{}};
  const firstDisk={};
  d.volumes.forEach(v=>{if(v.parts&&v.parts.length)firstDisk[v.id]=v.parts[0].disk});
  (d.disks||[]).forEach(dk=>{
    const dn={name:dk.id,real:dk.size,v:dk.size,key:'d:'+dk.id,kind:'disk',p:droot,disk:dk,k:[],cats:{}};
    let usedParts=0;
    d.volumes.forEach(v=>{
      const parts=(v.parts||[]).filter(p=>p.disk===dk.id); if(!parts.length) return;
      const ps=parts.reduce((a,p)=>a+p.size,0); usedParts+=ps;
      const f=Math.min(1,ps/v.total)*(ps>v.total?1:1);
      const pre=firstDisk[v.id]===dk.id?'':'d:'+dk.id+':';
      const n=(v.parts||[]).length;
      const vn=volumeNode(v,f,pre,dn,{onDisk:ps,shared:n});
      vn.v=ps; if(ps>v.total) vn.k.push(special('Paridad / reserva',ps-v.total,1,vn.key+'/~par','unalloc',vn));
      dn.k.push(vn);
      for(const c in vn.cats) dn.cats[c]=(dn.cats[c]||0)+vn.cats[c]*f;
    });
    const rest=dk.size-usedParts;
    if(rest>dk.size*.002) dn.k.push(special(dn.k.length?'Sistema DSM, swap y sin asignar':'Disco sin asignar a ningún volumen',rest,1,dn.key+'/~rest','unalloc',dn));
    droot.k.push(dn);
  });
  droot.real=droot.v=droot.k.reduce((a,k)=>a+k.v,0);
  trees.disk=droot;
  idx={};
  const walk=(n,t)=>{(idx[t]||(idx[t]={}))[n.key]=n;(n.k||[]).forEach(k=>walk(k,t))};
  walk(vroot,'vol');walk(droot,'disk');
}

/* ---------- treemap squarified ---------- */
function worst(row,len){let s=0,mx=0,mn=Infinity;for(const n of row){s+=n.a;if(n.a>mx)mx=n.a;if(n.a<mn)mn=n.a}return Math.max(len*len*mx/(s*s),(s*s)/(len*len*mn))}
function layRow(row,r,out){const s=row.reduce((a,n)=>a+n.a,0);
  if(r.w>=r.h){const cw=s/r.h;let y=r.y;for(const n of row){const h=n.a/cw;out.push({n:n.n,x:r.x,y,w:cw,h});y+=h}return{x:r.x+cw,y:r.y,w:r.w-cw,h:r.h}}
  const rh=s/r.w;let x=r.x;for(const n of row){const w=n.a/rh;out.push({n:n.n,x,y:r.y,w,h:rh});x+=w}return{x:r.x,y:r.y+rh,w:r.w,h:r.h-rh}}
function squarify(nodes,rect){
  const items=nodes.filter(n=>n.v>0).sort((a,b)=>b.v-a.v).map(n=>({n,a:0}));
  const tot=items.reduce((a,i)=>a+i.n.v,0); const out=[]; if(!tot||rect.w<=0||rect.h<=0) return out;
  const sc=rect.w*rect.h/tot; items.forEach(i=>i.a=i.n.v*sc);
  let r={...rect},row=[],i=0;
  while(i<items.length){const len=Math.min(r.w,r.h);const it=items[i];
    if(!row.length||worst([...row,it],len)<=worst(row,len)){row.push(it);i++}else{r=layRow(row,r,out);row=[]}}
  if(row.length) layRow(row,r,out);
  return out;
}
function place(node,rect,depth,out){
  if(depth>0) out.push({n:node,...rect,depth});
  if(!node.k||depth>=7) return;
  const big=rect.w>70&&rect.h>40;
  if(depth>0&&!big) return;
  const hdr=depth===0?0:(node.kind==='disk'?22:18), pad=depth===0?0:3;
  const inner={x:rect.x+pad,y:rect.y+hdr+pad,w:rect.w-pad*2,h:rect.h-hdr-pad*2};
  if(inner.w<8||inner.h<8) return;
  for(const c of squarify(node.k,inner)){ if(c.w*c.h<10) continue; place(c.n,c,depth+1,out) }
}
function domCat(n){let b=null,m=-1;for(const c in n.cats)if(n.cats[c]>m){m=n.cats[c];b=c}return b||n.c||'otros'}

/* ---------- render ---------- */
const els=new Map();
function render(){
  const tree=trees[view]; if(!tree) return;
  const W=map.clientWidth, H=map.clientHeight;
  const root=zoom||tree;
  const out=[]; place(root,{x:0,y:0,w:W,h:H},0,out);
  const used=new Set();
  out.forEach((it,i)=>{
    const n=it.n; used.add(n.key);
    let el=els.get(n.key), fresh=false;
    if(!el){el=document.createElement('div');el.dataset.key=n.key;fresh=true;els.set(n.key,el)}
    const drawnKids=out.some(o=>o.n.p===n&&o.depth===it.depth+1);
    const isGrp=!!(n.k&&drawnKids);
    let cls='cell '+(isGrp?'grp':'leaf');
    if(n.kind==='disk') cls+=' disk'; if(n.kind==='vol'&&isGrp) cls+=' vol';
    if(n.kind==='free') cls+=' free'; if(n.kind==='unalloc') cls+=' unalloc';
    const cat=domCat(n);
    if(hl&&!isGrp&&!n.kind) { if(!(n.cats[hl]>n.real*.5)) cls+=' dim' } else if(hl&&!isGrp&&n.kind) cls+=' dim';
    el.className=cls+(fresh?' out':'');
    el.style.background=(!isGrp&&!n.kind)?'var(--c-'+cat+')':'';
    el.style.zIndex=it.depth;
    Object.assign(el.style,{left:it.x+'px',top:it.y+'px',width:Math.max(0,it.w)+'px',height:Math.max(0,it.h)+'px'});
    const lbl=label(n);
    if(isGrp){ const sig='g|'+lbl; if(el._sig!==sig){el.innerHTML='<div class="h"></div>';const h=el.firstChild;h.textContent=lbl;const em=document.createElement('em');em.textContent=fmt(n.real)+(n.sub?' · '+n.sub:'');h.appendChild(em);el._sig=sig} }
    else { const show=it.w>46&&it.h>22; const sig='l|'+lbl+'|'+show+'|'+(it.h>38); if(el._sig!==sig){el.innerHTML='';if(show){const t=document.createElement('div');t.className='t';t.textContent=lbl;if(it.h>38){const s=document.createElement('s');s.textContent=fmt(n.real);t.appendChild(s)}el.appendChild(t)}el._sig=sig} }
    el._n=n;
    if(fresh){map.appendChild(el);requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('out')))}
    else if(el.parentNode!==map) map.appendChild(el);
  });
  for(const [k,el] of els){ if(!used.has(k)){ els.delete(k); el.classList.add('out'); setTimeout(()=>el.remove(),380) } }
  crumbs();
}
function label(n){
  if(n.kind==='disk'){const d=n.disk;return slot(d)+' · '+(d.model||d.id)}
  if(n.kind==='vol') return n.name;
  if(n.bucket!=null) return n.name+' ('+n.bucket+')';
  return n.name;
}
function slot(d){const m=/sata(\d+)/.exec(d.id);return m?'Bahía '+m[1]:d.id}
function pathOf(n){const a=[];let x=n;while(x&&x.kind!=='root'){a.unshift(x);x=x.p}return a}
function textPath(n){const p=pathOf(n);return p.map(x=>x.kind==='disk'?slot(x.disk):x.name).join(' / ')}
function crumbs(){
  const c=$('crumbs'); c.innerHTML='';
  const root=trees[view]; const chain=[root,...(zoom?pathOf(zoom):[])];
  chain.forEach((n,i)=>{ if(i){const s=document.createElement('span');s.textContent='›';c.appendChild(s)}
    const b=document.createElement('button');b.textContent=n.kind==='root'?(view==='disk'?'Todos los discos':'Todos los volúmenes'):(n.kind==='disk'?slot(n.disk):n.name);
    b.onclick=()=>{zoom=n.kind==='root'?null:n;render()};c.appendChild(b)});
}
function info(n){
  const box=$('info'); box.innerHTML='';
  const nm=document.createElement('div');nm.className='nm';nm.textContent=label(n);
  const p=document.createElement('span');p.className='pth';p.textContent=textPath(n);nm.appendChild(p);box.appendChild(nm);
  const dl=document.createElement('dl');
  const add=(k,v)=>{const w=document.createElement('div');const t=document.createElement('dt');t.textContent=k;const d=document.createElement('dd');d.textContent=v;w.append(t,d);dl.appendChild(w)};
  add('Tamaño',fmt(n.real));
  if(n.p&&n.p.kind!=='root') add('Del contenedor',pct(n.real,n.p.real));
  if(n.kind==='disk'){add('Serie',n.disk.serial||'—');add('Volúmenes',n.k.filter(k=>k.kind==='vol').map(k=>k.name).join(', ')||'ninguno')}
  else if(n.kind==='vol'){add('Ocupado',fmt(n.vol.used)+' ('+pct(n.vol.used,n.vol.total)+')');add('Tipo',n.sub||'—');add('Discos',(n.vol.parts||[]).map(p=>slot({id:p.disk})).join(', ')||'—');if(n.vol.errors)add('Ficheros ilegibles',n.vol.errors)}
  else if(!n.kind){add('Tipo',CAT[domCat(n)]||'Otros');const vol=pathOf(n).find(x=>x.kind==='vol');if(vol){const ds=(vol.vol.parts||[]).map(p=>slot({id:p.disk}));if(ds.length)add(ds.length>1&&vol.vol.raid==='raid1'?'Copias en':'Está en',ds.join(', '))}}
  box.appendChild(dl);
}
map.addEventListener('mousemove',e=>{const el=e.target.closest('.cell');if(el&&el._n&&el._n!==map._last){map._last=el._n;info(el._n)}});
map.addEventListener('click',e=>{
  const el=e.target.closest('.cell'); if(!el||!el._n) return; let n=el._n; info(n);
  if(!n.k) n=n.p; if(!n||n.kind==='root'||n===zoom) return;
  zoom=n; render();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&zoom){zoom=zoom.p&&zoom.p.kind!=='root'?zoom.p:null;render()}});

/* ---------- vistas ---------- */
function setView(v){
  if(v===view) return; const old=zoom; view=v;
  $('v-disk').setAttribute('aria-pressed',v==='disk');$('v-vol').setAttribute('aria-pressed',v==='vol');
  if(old){ let x=old; zoom=null; while(x&&x.kind!=='root'){ const m=idx[v][x.key]; if(m&&m.kind!=='root'){zoom=m;break} x=x.p } }
  render();
}
$('hidefree').onchange=e=>{HIDEFREE=e.target.checked;const k=zoom&&zoom.key;build();zoom=k&&idx[view][k]||null;side();render()};
$('v-disk').onclick=()=>setView('disk'); $('v-vol').onclick=()=>setView('vol');

/* ---------- chasis, leyenda, tabla ---------- */
function volColors(){const pal=['var(--accent)','#5b8def','#3fb68b','#c86bd1','#d9b13b','#e06b5b'];const m={};DATA.volumes.forEach((v,i)=>m[v.id]=pal[i%pal.length]);return m}
function side(){
  const vc=volColors();
  const ch=$('chassis'); ch.innerHTML='';
  const dn=trees.disk.k;
  if(!dn.length){ch.hidden=true}else{ch.hidden=false}
  dn.forEach(d=>{
    const b=document.createElement('button');b.className='bay';
    const vols=d.k.filter(k=>k.kind==='vol');
    b.innerHTML='<div class="row"><span class="led'+(vols.length?'':' off')+'"></span><span></span></div><b></b><span class="cap"></span><div class="meter"></div>';
    b.querySelector('.row span:last-child').textContent=slot(d.disk);
    b.querySelector('b').textContent=d.disk.model||d.disk.id;
    b.querySelector('.cap').textContent=fmt(d.disk.size)+(vols.length?' · '+vols.map(v=>v.name).join(', '):' · libre');
    const m=b.querySelector('.meter');
    vols.forEach(v=>{const i=document.createElement('i');i.style.width=(v.v/d.v*100)+'%';i.style.background=vc[v.name];m.appendChild(i)});
    b.onclick=()=>{ if(view!=='disk'){view='disk';$('v-disk').setAttribute('aria-pressed',true);$('v-vol').setAttribute('aria-pressed',false)} zoom=d; render(); info(d) };
    ch.appendChild(b);
  });
  // leyenda
  const lg=$('legend'); lg.innerHTML='';
  const tot={}; trees.vol.k.forEach(v=>{for(const c in v.cats)tot[c]=(tot[c]||0)+v.cats[c]});
  CATS.filter(c=>tot[c]).sort((a,b)=>tot[b]-tot[a]).forEach(c=>{
    const b=document.createElement('button');b.className='chip';b.setAttribute('aria-pressed',hl===c);
    b.innerHTML='<i></i><span></span><em></em>';b.querySelector('i').style.background='var(--c-'+c+')';
    b.querySelector('span').textContent=CAT[c];b.querySelector('em').textContent=fmt(tot[c]);
    b.onclick=()=>{hl=hl===c?null:c;side();render()};lg.appendChild(b)});
  const f=document.createElement('span');f.className='chip';f.style.cursor='default';f.innerHTML='<i style="background:repeating-linear-gradient(135deg,var(--hatch) 0 2px,transparent 2px 5px);border:1px dashed var(--hatch)"></i><span>Libre</span>';lg.appendChild(f);
  const u=document.createElement('span');u.className='chip';u.style.cursor='default';u.innerHTML='<i style="background:repeating-linear-gradient(45deg,var(--unalloc) 0 2px,transparent 2px 5px);border:1px dashed var(--unalloc)"></i><span>Sistema / sin asignar</span>';lg.appendChild(u);
  // tabla
  const t=$('disks'); t.innerHTML='<thead><tr><th>Disco</th><th>Contenido</th><th style="text-align:right">Tamaño</th></tr></thead>';
  const tb=document.createElement('tbody');
  dn.forEach(d=>{
    const tr=document.createElement('tr');
    const a=document.createElement('td');a.textContent=slot(d.disk)+' · '+(d.disk.model||d.disk.id);
    const s=document.createElement('span');s.className='sub';s.textContent=d.disk.serial||d.disk.id;a.appendChild(s);
    const b=document.createElement('td');
    const vols=d.k.filter(k=>k.kind==='vol');
    if(!vols.length){const p=document.createElement('span');p.className='pill';p.textContent='Sin usar';b.appendChild(p)}
    vols.forEach(v=>{const line=document.createElement('div');
      const top=v.k.filter(k=>!k.kind).sort((x,y)=>y.real-x.real).slice(0,3).map(k=>k.name).join(', ');
      line.innerHTML='<b></b> <span class="pill"></span><span class="sub"></span>';
      line.querySelector('b').textContent=v.name;line.querySelector('.pill').textContent=v.vol.raid==='raid1'&&v.shared>1?'espejo':(v.shared>1?'repartido':'solo aquí');
      line.querySelector('.sub').textContent=fmt(v.vol.used)+' usado · '+top;
      if(v.vol.errors){const e=document.createElement('span');e.className='pill warn';e.textContent=v.vol.errors+' ilegibles';line.appendChild(e)}
      b.appendChild(line)});
    const bar=document.createElement('div');bar.className='bar';
    d.k.forEach(k=>{const i=document.createElement('i');i.style.width=(k.v/d.v*100)+'%';i.style.background=k.kind==='vol'?vc[k.name]:'var(--unalloc)';i.title=k.name;bar.appendChild(i)});
    b.appendChild(bar);
    const c=document.createElement('td');c.className='n';c.textContent=fmt(d.disk.size);
    tr.append(a,b,c);tb.appendChild(tr)});
  if(!dn.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="3">Este JSON no incluye discos (se generó con --path).</td>';tb.appendChild(tr)}
  t.appendChild(tb);
}

/* ---------- carga ---------- */
function load(d){
  if(!d||!Array.isArray(d.volumes)) throw new Error('El fichero no parece salir de nasmap.py (no tiene “volumes”).');
  DATA=d; els.forEach(el=>el.remove()); els.clear(); zoom=null; hl=null; build();
  if(!trees.disk.k.length&&view==='disk'){view='vol';$('v-disk').setAttribute('aria-pressed',false);$('v-vol').setAttribute('aria-pressed',true)}
  $('v-disk').disabled=!trees.disk.k.length;
  $('sample').hidden=!d.sample;
  const dt=d.generated?new Date(d.generated):null;
  $('host').textContent=(d.host||'NAS')+(dt&&!isNaN(dt)?' · analizado el '+dt.toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}):'')+' · '+d.volumes.length+' volúmenes, '+(d.disks||[]).length+' discos';
  $('err').textContent='';
  side(); render();
}
function readFile(f){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);load(d);cacheSave(d)}catch(e){$('err').textContent='No he podido leer '+f.name+': '+e.message}};r.readAsText(f)}
$('file').onchange=e=>{if(e.target.files[0])readFile(e.target.files[0]);e.target.value=''};
let dz=null;
map.addEventListener('dragover',e=>{e.preventDefault();if(!dz){dz=document.createElement('div');dz.className='drop';dz.textContent='Suelta nasmap.json';map.appendChild(dz)}});
map.addEventListener('dragleave',e=>{if(dz&&!map.contains(e.relatedTarget)){dz.remove();dz=null}});
map.addEventListener('drop',e=>{e.preventDefault();if(dz){dz.remove();dz=null}const f=e.dataTransfer.files[0];if(f)readFile(f)});

/* ---------- ver el script ---------- */
fetch('nasmap.py').then(r=>{if(!r.ok)throw 0;return r.text()}).then(text=>{
  $('pycode').textContent=text;
  $('copy').onclick=async()=>{
    try{await navigator.clipboard.writeText(text);$('copy').textContent='Copiado'}
    catch(e){const s=getSelection(),rg=document.createRange();rg.selectNodeContents($('pycode'));s.removeAllRanges();s.addRange(rg);$('copy').textContent='Selecciona y copia (Ctrl+C)'}
    setTimeout(()=>$('copy').textContent='Copiar script',2500);
  };
}).catch(()=>{$('pycode').textContent='No se ha podido cargar nasmap.py aquí. Descárgalo con el botón de arriba.';$('copy').hidden=true});

/* ---------- actualización automática ---------- */
const LS_URL='nasmap_url', LS_INT='nasmap_interval', LS_CACHE='nasmap_cache';
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function lsDel(k){try{localStorage.removeItem(k)}catch(e){}}
function cacheSave(d){ if(d&&!d.sample) lsSet(LS_CACHE, JSON.stringify(d)) }
function cacheLoad(){ const s=lsGet(LS_CACHE); if(!s) return null; try{return JSON.parse(s)}catch(e){return null} }
function setStatus(s,cls){ const el=$('autostatus'); if(!el) return; el.textContent=s; el.className=cls||'' }

async function fetchAuto(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

function idbOpen(){return new Promise((res,rej)=>{try{const req=indexedDB.open('nasmap-fs',1);req.onupgradeneeded=()=>req.result.createObjectStore('kv');req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)}catch(e){rej(e)}})}
function idbGet(k){return idbOpen().then(db=>new Promise((res,rej)=>{const t=db.transaction('kv','readonly').objectStore('kv').get(k);t.onsuccess=()=>res(t.result||null);t.onerror=()=>rej(t.error)})).catch(()=>null)}
function idbSet(k,v){return idbOpen().then(db=>new Promise((res,rej)=>{const t=db.transaction('kv','readwrite').objectStore('kv').put(v,k);t.onsuccess=()=>res();t.onerror=()=>rej(t.error)})).catch(()=>{})}

let fsHandle=null;
async function fsTryLoad(interactive){
  if(!('showOpenFilePicker' in window)) return false;
  try{
    if(!fsHandle) fsHandle=await idbGet('handle');
    if(!fsHandle) return false;
    let perm=await fsHandle.queryPermission({mode:'read'});
    if(perm!=='granted'){
      if(!interactive){ $('fsreconnect').hidden=false; setStatus('Fichero local vinculado: pulsa «Reconectar fichero» para releerlo (lo pide el navegador por seguridad).'); return false }
      perm=await fsHandle.requestPermission({mode:'read'});
      if(perm!=='granted') return false;
    }
    $('fsreconnect').hidden=true;
    const file=await fsHandle.getFile();
    const d=JSON.parse(await file.text());
    load(d); cacheSave(d);
    setStatus('Leído del fichero local vinculado: '+file.name+'.','ok');
    return true;
  }catch(e){ return false }
}
async function fsPick(){
  try{
    const [h]=await window.showOpenFilePicker({types:[{description:'nasmap.json',accept:{'application/json':['.json']}}]});
    fsHandle=h; await idbSet('handle',h);
    await fsTryLoad(true);
  }catch(e){ /* el usuario canceló el selector */ }
}
if('showOpenFilePicker' in window){ $('fspick').onclick=fsPick; $('fsreconnect').onclick=()=>fsTryLoad(true) }
else { $('fsrow').hidden=true }

$('autosave').onclick=async()=>{
  const u=$('autourl').value.trim();
  lsSet(LS_INT,$('autoint').value||'0');
  if(!u){ lsDel(LS_URL); setStatus('Desactivado: ya no se comprobará ninguna URL.'); return }
  if(!/^https:\/\//i.test(u)){ setStatus('Tiene que empezar por https:// (si no, el navegador la bloquea al venir de una página https).','bad'); return }
  lsSet(LS_URL,u);
  setStatus('Comprobando…');
  try{ const d=await fetchAuto(u); load(d); cacheSave(d); setStatus('Funciona. Se ha guardado y se comprobará sola a partir de ahora.','ok') }
  catch(e){ setStatus('Guardado, pero no he podido leerla ahora mismo: '+e.message+' (revisa HTTPS, el proxy inverso y el token).','bad') }
};

async function autoBoot(){
  const url=lsGet(LS_URL);
  if($('autourl')) $('autourl').value=url||'';
  if($('autoint')) $('autoint').value=lsGet(LS_INT)||'0';
  const cached=cacheLoad();
  if(cached) load(cached);
  let ok=false;
  if(url){
    try{ const d=await fetchAuto(url); load(d); cacheSave(d); setStatus('Actualizado automáticamente desde tu NAS ahora mismo.','ok'); ok=true }
    catch(e){ setStatus(cached?'No se pudo contactar con tu NAS ahora; mostrando la última copia guardada.':'No se pudo contactar con tu NAS ahora.','bad') }
  }
  if(!ok) ok = (await fsTryLoad(false)) || ok;
  if(!ok && !cached) load(sample());
  const mins=parseInt(lsGet(LS_INT)||'0',10);
  if(url&&mins>0){
    setInterval(async()=>{
      try{ const d=await fetchAuto(url); if(!DATA||d.generated!==DATA.generated){ load(d); cacheSave(d); setStatus('Actualizado automáticamente ('+new Date().toLocaleTimeString('es-ES')+').','ok') } }
      catch(e){}
    }, mins*60000);
  }
}

let rt=0; new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(render,80)}).observe(map);
autoBoot();
})();
