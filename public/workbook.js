async function readSalesWorkbook(file, Parser = DOMParser) {
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
    const doc=new Parser().parseFromString(source,'application/xml');
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

if (typeof module !== 'undefined') module.exports = readSalesWorkbook;
