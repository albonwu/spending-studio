export type Mapping = {date:string;description:string;amount:string;category:string;type:string};
export type Settings = {sign:'negative'|'positive';dayFirst:boolean;oppositeRefunds:boolean;refundWords:string;excludeWords:string};
export type Transaction = {id:number;date:string;description:string;merchant:string;category:string;type:string;kind:'purchase'|'refund';cents:number;rawCents:number;account?:string;source?:string};
export const defaults:Settings={sign:'negative',dayFirst:false,oppositeRefunds:false,refundWords:'refund,return,reversal',excludeWords:'payment,transfer,income,salary,payroll,deposit'};
export function parseCSV(text:string){
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||field==='')quoted=!quoted;else throw Error('Unexpected quote in CSV.');}else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(field);field='';if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()))rows.push(row);row=[];}}else field+=c;}
 if(quoted)throw Error('The CSV has an unclosed quoted field.');row.push(field);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2)throw Error('Upload a CSV with headers and at least one transaction.');
 const headers=rows.shift()!.map(v=>v.trim());if(new Set(headers).size!==headers.length||headers.some(v=>!v))throw Error('CSV headers must be unique and nonempty.');
 return {headers,rows};
}
export function guessMapping(headers:string[]):Mapping{const find=(names:string[])=>headers.find(h=>names.includes(h.toLowerCase()))||'';return {date:find(['transaction date','date','posting date','posted date']),description:find(['description','merchant','name','memo']),amount:find(['amount','transaction amount']),category:find(['category']),type:find(['type','transaction type'])};}
export function parseAmount(value:string):number|null{let v=value.trim();const paren=/^\(.*\)$/.test(v);if(paren)v=v.slice(1,-1);v=v.replace(/[$,\s]/g,'');if(!/^[+-]?\d+(\.\d{1,2})?$/.test(v))return null;const n=Math.round(Number(v)*100)*(paren?-1:1);return Number.isSafeInteger(n)?n:null;}
export function parseDate(value:string,dayFirst=false):string|null{let y:number,m:number,d:number;const iso=/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(value.trim());const local=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(value.trim());if(iso){[,y,m,d]=iso.map(Number);}else if(local){y=Number(local[3]);m=Number(local[dayFirst?2:1]);d=Number(local[dayFirst?1:2]);}else return null;const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;return `${y.toString().padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
export function merchantName(description:string){return description.toUpperCase().replace(/^(?:SQ\s*\*|TST\s*\*|PAYPAL\s*\*)\s*/,'').replace(/\b(?:STORE|LOCATION)\s*#?\d+\b/g,'').replace(/\s+#?\d{3,}\b/g,'').replace(/\s+/g,' ').trim()||'Unknown merchant';}
function matches(value:string,words:string){return words.split(',').map(w=>w.trim().toLowerCase()).filter(Boolean).some(w=>new RegExp('(?:^|[^a-z])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z])','i').test(value));}
export function normalize(headers:string[],rows:string[][],map:Mapping,settings:Settings):{transactions:Transaction[];invalid:number;excluded:number;coverage:Coverage|null}{
 if(!map.date||!map.amount||!map.description)throw Error('Map a date, description, and amount column in Import settings.');
 const required=[map.date,map.description,map.amount];if(new Set(required).size!==3)throw Error('Date, description, and amount must use different columns.');
 const out:Transaction[]=[];let invalid=0,excluded=0;let coverageFrom:string|null=null,coverageTo:string|null=null;
 rows.forEach((row,id)=>{const get=(key:keyof Mapping)=>row[headers.indexOf(map[key])]?.trim()||'';const rawCents=parseAmount(get('amount')),date=parseDate(get('date'),settings.dayFirst);if(row.length!==headers.length||rawCents===null||!date){invalid++;return;}
 if(!coverageFrom||date<coverageFrom)coverageFrom=date;if(!coverageTo||date>coverageTo)coverageTo=date;
 const description=get('description')||'No description',category=get('category')||'Uncategorized',type=get('type')||'Unknown type';
 // Classification uses structured type/category; descriptions never imply a transfer.
 const classification=`${type} ${category}`;if(matches(classification,settings.excludeWords)||rawCents===0){excluded++;return;}
 const opposite=settings.sign==='negative'?rawCents>0:rawCents<0;const refund=matches(classification,settings.refundWords)||(settings.oppositeRefunds&&opposite);
 if(opposite&&!refund){excluded++;return;}out.push({id,date,description,merchant:merchantName(description),category,type,kind:refund?'refund':'purchase',cents:Math.abs(rawCents)*(refund?-1:1),rawCents});
 });return {transactions:out,invalid,excluded,coverage:coverageFrom&&coverageTo?{from:coverageFrom,to:coverageTo}:null};
}
export type Filters={from:string;to:string;categories:string[];types:string[];search:string};
export function filterTransactions(rows:Transaction[],f:Filters){return rows.filter(t=>(!f.from||t.date>=f.from)&&(!f.to||t.date<=f.to)&&(!f.categories.length||f.categories.includes(t.category))&&(!f.types.length||f.types.includes(t.type))&&(!f.search||`${t.merchant} ${t.description}`.toLowerCase().includes(f.search.toLowerCase())));}
export function totals(rows:Transaction[]){const cents=rows.reduce((s,t)=>s+t.cents,0);return {cents,count:rows.length,average:rows.length?cents/rows.length:0};}
export function consolidate(rows:Transaction[]){const groups=new Map<string,{date:string;merchant:string;category:string;cents:number;count:number;descriptions:string[]}>();for(const t of rows){const key=JSON.stringify([t.merchant,t.category]);const g=groups.get(key)||{date:t.date,merchant:t.merchant,category:t.category,cents:0,count:0,descriptions:[]};g.cents+=t.cents;g.count++;if(t.date>g.date)g.date=t.date;if(!g.descriptions.includes(t.description))g.descriptions.push(t.description);groups.set(key,g);}return [...groups.values()];}
export function exportCSV(headers:string[],rows:(string|number)[][]){const escape=(v:string|number)=>{let s=String(v);if(typeof v==='string'&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return [headers,...rows].map(row=>row.map(escape).join(',')).join('\r\n');}

export type Coverage={from:string;to:string};
const dayNumber=(date:string)=>Date.parse(date+'T00:00:00Z')/86400000;
const dateFromDay=(day:number)=>new Date(day*86400000).toISOString().slice(0,10);
export function periodMetrics(rows:Transaction[],filters:Filters,coverage:Coverage|null,previousRange?:Coverage,allowPartialCurrent=false){
 const empty={from:'',to:'',days:0,dailyCents:null as number|null,previousFrom:'',previousTo:'',previousCents:null as number|null,deltaCents:null as number|null,percent:null as number|null,comparisonUnavailable:'No valid transaction dates.'};
 if(!coverage)return empty;
 const from=filters.from||coverage.from,to=filters.to||coverage.to;
 const first=dayNumber(from),last=dayNumber(to),days=last-first+1;
 if(!Number.isFinite(days)||days<1)return {...empty,from,to};
 const previousFrom=previousRange?.from||dateFromDay(first-days),previousTo=previousRange?.to||dateFromDay(first-1);
 const currentCovered=from>=coverage.from&&to<=coverage.to;
 const cents=totals(filterTransactions(rows,{...filters,from,to})).cents;
 const currentAvailable=currentCovered||(allowPartialCurrent&&from<=coverage.to&&to>=coverage.from);
 const previousAvailable=previousFrom>=coverage.from&&previousTo<=coverage.to;
 const comparable=currentAvailable&&previousAvailable;
 const comparisonUnavailable=!currentAvailable?'No imported data for this period.':!previousAvailable?'Import earlier transactions to compare.':'';
 const previousCents=comparable?totals(filterTransactions(rows,{...filters,from:previousFrom,to:previousTo})).cents:null;
 const deltaCents=previousCents===null?null:cents-previousCents;
 return {from,to,days,dailyCents:cents/days,comparisonUnavailable,previousFrom,previousTo,previousCents,deltaCents,percent:previousCents!==null&&previousCents>0?(cents-previousCents)/previousCents*100:null};
}

export type ImportSource={id:string;name:string;headers:string[];rows:string[][];mapping:Mapping;settings:Settings;account:string};
// Retain the maximum multiplicity found in one file, rather than collapsing
// same-day identical legitimate purchases into a single transaction.
export function deduplicateFiles(files:Transaction[][]){
 const counts=new Map<string,number>();const transactions:Transaction[]=[];let duplicates=0;
 for(const file of files){const local=new Map<string,number>();for(const t of file){const key=JSON.stringify([t.account||'',t.date,t.description.trim().replace(/\s+/g,' ').toUpperCase(),t.rawCents,t.kind,t.type.trim().toUpperCase()]);const count=(local.get(key)||0)+1;local.set(key,count);if(count>(counts.get(key)||0))transactions.push({...t,id:transactions.length});else duplicates++;}for(const [key,count] of local)counts.set(key,Math.max(count,counts.get(key)||0));}
 return {transactions,duplicates};
}
export function importSources(sources:ImportSource[],dedupe=true){
 let invalid=0,excluded=0;let coverage:Coverage|null=null;
 const files=sources.map(source=>{let result:ReturnType<typeof normalize>;try{result=normalize(source.headers,source.rows,source.mapping,source.settings);}catch(e){throw Error(`${source.name}: ${e instanceof Error?e.message:'Import failed.'}`);}
 invalid+=result.invalid;excluded+=result.excluded;if(result.coverage){coverage=coverage?{from:coverage.from<result.coverage.from?coverage.from:result.coverage.from,to:coverage.to>result.coverage.to?coverage.to:result.coverage.to}:result.coverage;}
 return result.transactions.map(t=>({...t,account:source.account.trim(),source:source.name}));});
 const result=dedupe?deduplicateFiles(files):{transactions:files.flat().map((t,id)=>({...t,id})),duplicates:0};
 return {...result,invalid,excluded,coverage};
}
export function monthRange(preset:'this'|'last',now=new Date(),timeZone='America/New_York'){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now);
 const get=(type:string)=>Number(parts.find(p=>p.type===type)!.value);
 const year=get('year'),month=get('month'),day=get('day');
 if(preset==='this')return {from:dateFromDay(Date.UTC(year,month-1,1)/86400000),to:dateFromDay(Date.UTC(year,month-1,day)/86400000)};
 return {from:dateFromDay(Date.UTC(year,month-2,1)/86400000),to:dateFromDay(Date.UTC(year,month-1,0)/86400000)};
}

export type TrendUnit='day'|'week'|'month';
export type TrendBucket={start:string;end:string;from:string;to:string;cents:number;partial:boolean};
export function spendingTrend(rows:Transaction[],from:string,to:string,unit:TrendUnit,asOf?:string):TrendBucket[]{
 if(asOf&&to>asOf)to=asOf;
 const first=dayNumber(from),last=dayNumber(to);
 if(!Number.isFinite(first)||!Number.isFinite(last)||first>last)return [];
 const bucketStart=(date:string)=>{const d=new Date(date+'T00:00:00Z');if(unit==='month')d.setUTCDate(1);if(unit==='week')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
 const next=(date:string)=>{const d=new Date(date+'T00:00:00Z');if(unit==='month')d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCDate(d.getUTCDate()+(unit==='week'?7:1));return d.toISOString().slice(0,10);};
 const sums=new Map<string,number>();for(const row of rows){if(row.date<from||row.date>to)continue;const start=bucketStart(row.date);sums.set(start,(sums.get(start)||0)+row.cents);}
 const buckets:TrendBucket[]=[];
 for(let start=bucketStart(from);start<=to;){const following=next(start),end=dateFromDay(dayNumber(following)-1);buckets.push({start,end,from:start<from?from:start,to:end>to?to:end,cents:sums.get(start)||0,partial:start<from||end>to||!!(asOf&&start<=asOf&&end>=asOf)});start=following;}
 return buckets;
}

export function currentRange(unit:'month'|'week'|'day',now=new Date(),timeZone='America/New_York'){
 const month=monthRange('this',now,timeZone),today=month.to;
 if(unit==='month')return month;
 if(unit==='day')return {from:today,to:today};
 const weekday=new Date(today+'T00:00:00Z').getUTCDay();
 return {from:dateFromDay(dayNumber(today)-(weekday+6)%7),to:today};
}

export type TimePreset='all'|'month'|'week'|'day'|'custom';
export function trendScope(preset:TimePreset,from:string,to:string,coverage:Coverage|null):{from:string;to:string;unit:TrendUnit}{
 const unit:TrendUnit=preset==='week'?'week':preset==='day'||preset==='custom'?'day':'month';
 if(!coverage)return {from:'',to:'',unit};
 const historical=preset==='month'||preset==='week'||preset==='day';
 return {from:historical?coverage.from:from||coverage.from,to:to||coverage.to,unit};
}

export function trendAxisRange(from:string,to:string,requestedFrom='',requestedTo=''){
 const start=requestedFrom||from,end=requestedTo||to;
 if(!parseDate(start)||!parseDate(end)||!from||!to)return {from:start,to:end,error:'No valid dates available.'};
 if(start>end)return {from:start,to:end,error:'Start date must be on or before end date.'};
 if(end<from||start>to)return {from:start,to:end,error:'Choose dates within the available graph range.'};
 return {from:start<from?from:start,to:end>to?to:end,error:''};
}
export function trendDragRange(buckets:TrendBucket[],startIndex:number,endIndex:number){
 if(!buckets.length)return null;
 const first=Math.max(0,Math.min(buckets.length-1,Math.min(startIndex,endIndex)));
 const last=Math.max(0,Math.min(buckets.length-1,Math.max(startIndex,endIndex)));
 return {from:buckets[first].from,to:buckets[last].to};
}

export function previousWeekRange(from:string,to:string):Coverage|undefined{
 if(!parseDate(from)||!parseDate(to)||from>to)return undefined;
 return {from:dateFromDay(dayNumber(from)-7),to:dateFromDay(dayNumber(to)-7)};
}

export function comparablePeriodRange(preset:TimePreset,from:string,to:string):Coverage|undefined{
 if(!parseDate(from)||!parseDate(to)||from>to)return undefined;
 if(preset==='week')return previousWeekRange(from,to);
 if(preset==='day')return {from:dateFromDay(dayNumber(from)-1),to:dateFromDay(dayNumber(to)-1)};
 if(preset!=='month')return undefined;
 const shift=(date:string)=>{const d=new Date(date+'T00:00:00Z'),year=d.getUTCFullYear(),month=d.getUTCMonth();const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();return dateFromDay(Date.UTC(year,month-1,Math.min(d.getUTCDate(),lastDay))/86400000);};
 return {from:shift(from),to:shift(to)};
}

// Anchor offsets to the original current-period dates to avoid day drift after
// short months (March 31 -> February 28 -> January 31).
export function navigatePeriodRange(unit:'month'|'week'|'day',offset:number,now=new Date(),timeZone='America/New_York'):Coverage{
 const base=currentRange(unit,now,timeZone);
 const amount=Math.min(0,Math.trunc(offset));
 const shift=(date:string)=>{if(unit!=='month')return dateFromDay(dayNumber(date)+amount*(unit==='week'?7:1));const d=new Date(date+'T00:00:00Z'),year=d.getUTCFullYear(),month=d.getUTCMonth()+amount;const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();return dateFromDay(Date.UTC(year,month,Math.min(d.getUTCDate(),last))/86400000);};
 return {from:shift(base.from),to:shift(base.to)};
}
