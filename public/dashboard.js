'use strict';
const data=[], el=id=>document.getElementById(id),nf=new Intl.NumberFormat('en-IN'),rf=new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}),rupees=x=>'₹'+rf.format(x/100),fmt=x=>x>=1e9?'₹'+(x/1e9).toFixed(2)+' Cr':x>=1e7?'₹'+(x/1e7).toFixed(2)+' L':rupees(x),mo=m=>new Date(m+'-01T00:00:00Z').toLocaleDateString('en-IN',{month:'short',year:'numeric',timeZone:'UTC'}),months=[];
const sum=(rs,k=3)=>rs.reduce((a,r)=>a+r[k],0);
function group(rs,k){let g=new Map();rs.forEach(r=>g.set(r[k],(g.get(r[k])||0)+r[3]));return [...g].sort((a,b)=>b[1]-a[1])}
function put(id,str){el(id).textContent=str}
function draw(){const m=el('month').value,p=el('product').value,who=el('person').value;const day=el('day').value;const sel=data.filter(r=>(!day||day===r[6])&&(!m||m===r[0])&&(!p||p===r[2])&&(!who||who===r[1]));
const total=sum(sel),un=sum(sel.filter(r=>r[1]==='Unassigned'));put('total',fmt(total));put('exact',rupees(total));put('count',nf.format(sum(sel,4)));put('missing',nf.format(sum(sel,5))+' missing invoice values');put('unassigned',fmt(un));put('share',(total?100*un/total:0).toFixed(1)+'% of selected sales');put('assigned',rupees(total-un));
const people=group(sel.filter(r=>r[1]!=='Unassigned'),1);el('rank').replaceChildren();people.forEach(([name,value],i)=>{const b=document.createElement('button');b.className='rankrow';b.setAttribute('aria-pressed',name===who);b.innerHTML='<span class="num"></span><span class="name"></span><span class="track"><span class="fill" style="display:block"></span></span><span class="money"></span>';b.children[0].textContent=i+1;b.children[1].textContent=name;b.querySelector('.fill').style.width=(people[0][1]?value/people[0][1]*100:0)+'%';b.children[3].textContent=rupees(value);b.onclick=()=>{el('person').value=who===name?'':name;draw()};el('rank').append(b)});if(!people.length)put('rank','No assigned sales for these filters.');
const scope=(day?dateLabel(day)+' · ':'')+(who||'All salespeople')+' · '+(p||'All products');put('scope',scope+' · ₹ crore');put('mixscope',(who||'All salespeople')+' · '+(day?dateLabel(day):m?mo(m):'All months'));
const axis=day?[day.slice(0,7)]:m?[m]:months,vals=axis.map(z=>sum(sel.filter(r=>r[0]===z))),max=Math.max(...vals,0),left=37,top=14,bottom=137,right=426,xx=i=>left+(right-left)*(i+.5)/axis.length,yy=v=>bottom-(bottom-top)*v/(max||1),bw=Math.min(40,(right-left)/axis.length*.72);
let s='<svg class="chart" viewBox="0 0 443 165" role="img" aria-label="Recorded sales by month">';[0,.5,1].forEach(f=>{s+='<line x1="37" x2="430" y1="'+yy(max*f)+'" y2="'+yy(max*f)+'" stroke="#dae6df"/><text x="32" text-anchor="end" y="'+(yy(max*f)+4)+'">'+(max*f/1e9).toFixed(1)+'</text>'});
axis.forEach((v,i)=>{const h=bottom-yy(vals[i]);s+='<rect x="'+(xx(i)-bw/2)+'" y="'+yy(vals[i])+'" width="'+bw+'" height="'+h+'" rx="2" fill="'+(vals[i]===max?'#195c4b':'#6ab59b')+'"><title>'+mo(v)+' · '+rupees(vals[i])+'</title></rect>';if(axis.length===1||i===0||i===6||i===12||i===18)s+='<text x="'+xx(i)+'" y="157" text-anchor="middle">'+mo(v).replace(' 20',' ’')+'</text>'});el('trend').innerHTML=s+'</svg>';put('peak',max?(axis.length===1?'Selected month':'Highest month')+' · '+mo(axis[vals.indexOf(max)])+' · '+rupees(max):'No recorded sales for these filters.');
el('mix').replaceChildren();group(sel,2).forEach(([name,v])=>{const a=document.createElement('div');a.className='mix';a.innerHTML='<span></span><span class="track"><span class="fill" style="display:block"></span></span><span></span>';a.children[0].textContent=name;a.querySelector('.fill').style.width=(total?100*v/total:0)+'%';a.children[2].textContent=fmt(v);a.title=rupees(v);el('mix').append(a)});if(!sel.length)put('mix','No invoice rows for these filters.');}
const dateLabel=iso=>new Date(iso+'T00:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
let password='',book=null,handle=null,lastStamp='',polling=false;
function setSelect(id,values,all,display=x=>x){
 const s=el(id),old=s.value;s.replaceChildren(new Option(all,''));values.forEach(v=>s.add(new Option(display(v),v)));s.value=values.includes(old)?old:'';
}
function updateDays(){
 const m=el('month').value;
 setSelect('day',[...new Set(data.filter(r=>!m||m===r[0]).map(r=>r[6]))].sort().reverse(),'All days',dateLabel);
}
function show(b){
 const sync=b.cloudSync;
 put('cloudStatus',sync ? 'OneDrive '+(sync.ok?'checked':'refresh failed')+' · '+new Date(sync.at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST' : 'First OneDrive sync pending');
 book=b;data.length=0;b.result.forEach(r=>data.push(r));months.splice(0,months.length,...[...new Set(data.map(r=>r[0]))].sort());
 setSelect('month',months,'All months',mo);updateDays();
 setSelect('person',[...new Set(data.map(r=>r[1]))].sort(),'All salespeople');
 setSelect('product',[...new Set(data.map(r=>r[2]))].sort(),'All products');
 put('coverage','Invoice sales · '+dateLabel(b.first)+' – '+dateLabel(b.last));
 const dispatch=el('dispatchPanel');dispatch.replaceChildren();
 if(b.dispatch){const d=b.dispatch,h=document.createElement('h2');h.textContent='Daily dispatches · '+dateLabel(d.day);dispatch.append(h);
 const t=document.createElement('p');t.textContent=rupees(d.stated[1])+' across '+d.stated[0]+' dispatches · KA, AP and UP';dispatch.append(t);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Salesperson breakdown';details.append(summary);
 d.list.slice().sort((a,b)=>b[3]-a[3]).forEach(r=>{const row=document.createElement('p');row.textContent=r[1]+' · '+r[2]+' dispatches · '+rupees(r[3]);details.append(row)});dispatch.append(details)}
 dispatch.hidden=!b.dispatch;draw();el('dashboard').hidden=false;el('login').hidden=true;
}
async function api(method='GET',b){
 const response=await fetch('/api/report',{method,cache:'no-store',headers:{Authorization:'Bearer '+password,...(b?{'Content-Type':'application/json','X-Publisher-Key':el('publisherKey').value}:{})},body:b?JSON.stringify(b):undefined});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Report unavailable');return result;
}
async function shareFile(file){
 const parsed=await readSalesWorkbook(file);await api('POST',parsed);show(parsed);put('updateStatus','Published through '+dateLabel(parsed.last)+' · '+file.name);
}
el('loginForm').onsubmit=async e=>{e.preventDefault();password=el('teamPassword').value;try{show(await api());el('teamPassword').value='';put('loginStatus','')}catch(e){put('loginStatus',e.message)}};
el('publish').onclick=async()=>{try{
 if(!el('publisherKey').value)throw Error('Enter your publisher key first.');
 if(!window.showOpenFilePicker){el('upload').click();return}
 const [h]=await showOpenFilePicker({types:[{description:'Excel workbook',accept:{'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['.xlsx']}}]});
 const file=await h.getFile();await shareFile(file);handle=h;lastStamp=file.lastModified+'-'+file.size;
 }catch(e){if(e.name!=='AbortError')put('updateStatus',e.message)}};
el('upload').onchange=async e=>{try{if(e.target.files[0])await shareFile(e.target.files[0])}catch(e){put('updateStatus',e.message)}finally{e.target.value=''}};
async function check(){
 if(!book||polling)return;polling=true;try{
 if(handle){const f=await handle.getFile(),stamp=f.lastModified+'-'+f.size;if(stamp!==lastStamp){await shareFile(f);lastStamp=stamp;return}}
 show(await api());put('syncStatus','Last checked '+new Date().toLocaleTimeString('en-IN'));
 }catch(e){put('syncStatus','Refresh failed · '+e.message)}finally{polling=false}
}
el('refresh').onclick=check;setInterval(check,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
el('month').onchange=()=>{el('day').value='';updateDays();draw()};for(const id of ['day','product','person'])el(id).onchange=draw;
el('latest').onclick=()=>{el('month').value=book.last.slice(0,7);updateDays();el('day').value=book.last;draw()};
el('reset').onclick=()=>{for(const k of ['month','day','person','product'])el(k).value='';updateDays();draw()};

async function cloudAction(connect){
 const status=el('updateStatus'),button=el(connect?'connectCloud':'syncCloud');
 button.disabled=true;status.textContent=connect?'Opening Microsoft sign-in…':'Reading the OneDrive workbook…';
 try{
  const response=await fetch(connect?'/api/onedrive':'/api/refresh',{method:'POST',headers:{'X-Publisher-Key':el('publisherKey').value}});
  const result=await response.json();if(!response.ok)throw Error(result.error);
  if(connect){location.assign(result.url);return}
  show(await api());status.textContent=(result.unchanged?'Already current':'Updated')+' through '+dateLabel(result.latest)+'.';
 }catch(e){status.textContent=e.message}finally{button.disabled=false}
}
el('connectCloud').onclick=()=>cloudAction(true);
el('syncCloud').onclick=()=>cloudAction(false);
if(new URLSearchParams(location.search).get('onedrive')==='connected'){
 el('updateStatus').textContent='OneDrive connected. Select Sync OneDrive now to check the first refresh.';
 el('updateStatus').closest('details').open=true;
 history.replaceState(null,'','/');
}
