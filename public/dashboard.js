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
async function readSalesWorkbook(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const u16 = n => view.getUint16(n,true), u32 = n => view.getUint32(n,true);
  const decoder = new TextDecoder(), entries = new Map();
  let end = bytes.length-22;
  while (end >= Math.max(0,bytes.length-65557) && u32(end)!==0x06054b50) end--;
  if(end<0 || u32(end)!==0x06054b50) throw Error('Choose a valid .xlsx workbook.');
  let offset=u32(end+16);
  for(let i=0;i<u16(end+10);i++){
    if(u32(offset)!==0x02014b50) throw Error('Incomplete workbook download.');
    const length=u16(offset+28), name=decoder.decode(bytes.subarray(offset+46,offset+46+length));
    entries.set(name,{method:u16(offset+10),compressed:u32(offset+20),local:u32(offset+42)});
    offset+=46+length+u16(offset+30)+u16(offset+32);
  }
  const nodes=(node,tag)=>Array.from(node.getElementsByTagNameNS('*',tag));
  async function xml(name){
    const entry=entries.get(name); if(!entry) throw Error('Missing workbook part: '+name);
    const start=entry.local+30+u16(entry.local+26)+u16(entry.local+28);
    const blob=new Blob([bytes.subarray(start,start+entry.compressed)]);
    const source=entry.method===0?await blob.text():await new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    const doc=new DOMParser().parseFromString(source,'application/xml');
    if(nodes(doc,'parsererror').length) throw Error('Invalid worksheet XML.');
    return doc;
  }
  const strings=entries.has('xl/sharedStrings.xml')?nodes(await xml('xl/sharedStrings.xml'),'si').map(si=>nodes(si,'t').map(n=>n.textContent).join('')):[];
  const links=new Map(nodes(await xml('xl/_rels/workbook.xml.rels'),'Relationship').map(n=>[n.getAttribute('Id'),new URL(n.getAttribute('Target'),'https://workbook.invalid/xl/workbook.xml').pathname.slice(1)]));
  const workbook=await xml('xl/workbook.xml'),sheets=nodes(workbook,'sheet');
  const epoch=nodes(workbook,'workbookPr')[0]?.getAttribute('date1904');
  const date1904=epoch==='true'||epoch==='1';
  const names=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const normalize=v=>String(v??'').trim().replace(/\s+/g,' ').toUpperCase();
  const aliases={PRADDEP:'PRADEEP',BHARTAH:'BHARATH',AKSHYA:'AKSHAY',WEKRAFTR:'WEKRAFT',VIGHNESH:'VIGNESH',VIGANESH:'VIGNESH'};
  const person=v=>{let n=normalize(v);n=aliases[n]||n;return n?n[0]+n.slice(1).toLowerCase():'Unassigned'};
  function rows(doc){
    return nodes(doc,'row').map(row=>{
      const values=[];
      for(const cell of nodes(row,'c')){
        const ref=cell.getAttribute('r').match(/^[A-Z]+/)[0];let col=0;for(const c of ref) col=col*26+c.charCodeAt(0)-64;
        const type=cell.getAttribute('t'),v=nodes(cell,'v')[0]?.textContent;
        if(type==='inlineStr')values[col-1]=nodes(cell,'t').map(n=>n.textContent).join('');
        else if(v!=null) values[col-1]=type==='s'?strings[Number(v)]:v;
      }
      return values;
    });
  }
  function dateParts(value){
    const t=String(value??'').trim();if(/^\d+(\.\d+)?$/.test(t)){
      const d=new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+Math.floor(Number(t))*86400000);
      return [d.getUTCDate(),d.getUTCMonth()+1,d.getUTCFullYear()];
    }
    const m=t.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,5})$/);if(m)return [+m[1],+m[2],+m[3]<100?2000+(+m[3]):+m[3]];
    throw Error('Unrecognized date: '+t);
  }
  const pad=n=>String(n).padStart(2,'0');
  function amount(v){
    if(v==null||String(v).trim()==='')return null;
    const n=Number(String(v).replace(/[₹,\s]/g,''));if(!Number.isFinite(n))throw Error('Invalid invoice amount: '+v);
    return Math.round((n+Number.EPSILON)*100);
  }
  const group=new Map(),seen=new Set();let first='',last='',total=0,count=0,missing=0,duplicates=0,dispatch=null;
  for(const sheet of sheets){
    const name=sheet.getAttribute('name').trim(), match=name.match(/^([a-z]+)\s*[-_ ]\s*(20\d{2})$/i);
    const month=match?names.indexOf(match[1].slice(0,3).toLowerCase())+1:0;
    const isDispatch=/^DAILY\s+DISPATCH/i.test(name);if(!month&&!isDispatch)continue;
    const record=rows(await xml(links.get(sheet.getAttribute('r:id'))));
    if(isDispatch){
      const list=[];let stated=null;
      for(const r of record){
        if(normalize(r[3])==='TOTAL'&&list.length){stated=[Number(r[4]),amount(r[5])];break}
        if(!r[2]||!/^\d+$/.test(r[1]||'')||!r[3])continue;
        const [d,m,y]=dateParts(r[2]);list.push([y+'-'+pad(m)+'-'+pad(d),person(r[3]),Number(r[4]),amount(r[5])]);
      }
      if(stated&&list.every(r=>r[0]===list[0][0]&&Number.isInteger(r[2])&&r[3]!==null)&&list.reduce((a,r)=>a+r[2],0)===stated[0]&&list.reduce((a,r)=>a+r[3],0)===stated[1])dispatch={day:list[0][0],list,stated};
      continue;
    }
    const header=record.findIndex(r=>normalize(r[1])==='DATE'&&normalize(r[5])==='INVOICE VALUE');
    if(header<0)throw Error('Invoice header missing in '+name);
    const seller=record[header].findIndex(x=>/^SALES?\s*PERSON$/.test(normalize(x)));
    const period=match[2]+'-'+pad(month);
    for(const original of record.slice(header+1)){
      const blocks=[original];if(period==='2025-05'&&original[18])blocks.push(original.slice(14));
      for(const r of blocks){
        if(!normalize(r[4])&&!(normalize(r[2])&&r[5]!=null))continue;
        const [day]=dateParts(r[1]);if(day<1||day>new Date(+match[2],month,0).getDate())throw Error('Invalid invoice day in '+name);
        const date=period+'-'+pad(day),paise=amount(r[5]),rawSeller=seller<0?'':normalize(r[seller]);
        let product=normalize(r[3]);product=({MODULE:'Module',MODULES:'Module',INVERTER:'Inverter'})[product]||product||'Unspecified';
        const sig=JSON.stringify([date,normalize(r[2]),product,normalize(r[4]),paise,rawSeller,r[6],r[7],r[8]]);
        if(seen.has(sig)){duplicates++;continue}seen.add(sig);
        const p=person(rawSeller),key=JSON.stringify([date,p,product]);
        if(!group.has(key))group.set(key,[period,p,product,0,0,0,date]);const row=group.get(key);
        row[3]+=paise??0;row[4]++;row[5]+=Number(paise===null);
        total+=paise??0;count++;missing+=Number(paise===null);
        if(!first||date<first)first=date;if(date>last)last=date;
      }
    }
  }
  const result=[...group.values()];
  if(!result.length||result.reduce((a,r)=>a+r[3],0)!==total||result.reduce((a,r)=>a+r[4],0)!==count||result.reduce((a,r)=>a+r[5],0)!==missing)throw Error('The invoice rows did not reconcile.');
  return {result,first,last,dispatch,duplicates,filename:file.name};
}

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
