'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import SpendingTrend from '@/components/spending-trend';
import {ArrowDownToLine,Upload,SlidersHorizontal,Search,Check,ChevronDown,ChevronLeft,ChevronRight,Wallet,X} from 'lucide-react';
import {parseCSV,guessMapping,importSources,currentRange,navigatePeriodRange,defaults,filterTransactions,totals,trendScope,periodMetrics,consolidate,exportCSV,type Mapping,type Settings,type ImportSource,type TimePreset} from '@/lib/transactions';
const types:string[]=[];
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const colors=['#547b68','#be9562','#7f8da7','#a77e87','#909762','#6b9fa0','#9d8caf','#b38064'];
const color=(s:string)=>colors[[...s].reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),0)%colors.length];
const demo=`Transaction Date,Description,Amount,Category,Type
2026-09-30,WHOLE FOODS 1045,-82.64,Groceries,Purchase
2026-09-29,TST *CAFE MOGADOR,-48.50,Dining,Purchase
2026-09-28,MTA PAYGO,-2.90,Transport,Purchase
2026-09-27,UNIQLO 1234,-89.90,Shopping,Purchase
2026-09-26,NETFLIX,-17.99,Subscriptions,Purchase
2026-09-25,TRADER JOES 567,-64.23,Groceries,Purchase
2026-09-24,SQ *CAFE MOGADOR,-32.00,Dining,Purchase
2026-09-23,MTA PAYGO,-2.90,Transport,Purchase
2026-09-22,SPOTIFY,-11.99,Subscriptions,Purchase
2026-09-21,UNIQLO STORE 5678,24.90,Shopping,Refund
2026-09-20,WHOLE FOODS STORE 5678,-92.18,Groceries,Purchase
2026-09-19,BOOK CULTURE,-36.00,Shopping,Purchase
2026-09-18,MTA PAYGO,-2.90,Transport,Purchase
2026-09-17,CAFE MOGADOR,-54.80,Dining,Purchase
2026-09-16,TRADER JOES 567,-48.32,Groceries,Purchase
2026-09-15,RENT,-1450.00,Housing,Purchase
2026-09-14,CON EDISON,-67.42,Utilities,Purchase
2026-09-13,INTERNET,-50.00,Utilities,Purchase
2026-09-12,TRANSFER TO SAVINGS,-500.00,Transfer,Transfer
2026-09-11,PAYCHECK,2400.00,Income,Income`;

export default function Page(){
 const [sources,setSources]=useState<ImportSource[]>([]),[selectedSource,setSelectedSource]=useState(''),[dedupe,setDedupe]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[isDemo,setIsDemo]=useState(false),[preset,setPreset]=useState<TimePreset>('all'),[periodOffset,setPeriodOffset]=useState(0);
 useEffect(()=>{
 const root=document.documentElement;
 const pointer=()=>{root.dataset.focusInput='pointer';};
 const keyboard=(event:KeyboardEvent)=>{if(!event.metaKey&&!event.ctrlKey&&!event.altKey)root.dataset.focusInput='keyboard';};
 root.dataset.focusInput='keyboard';
 document.addEventListener('pointerdown',pointer,true);document.addEventListener('keydown',keyboard,true);
 return ()=>{document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('keydown',keyboard,true);delete root.dataset.focusInput;};
 },[]);
 const raw=sources.find(s=>s.id===selectedSource)||sources[0]||null;
 const mapping=raw?.mapping||{date:'',description:'',amount:'',category:'',type:''},settings=raw?.settings||defaults;
 function updateSource(change:Partial<ImportSource>){if(raw)setSources(current=>current.map(s=>s.id===raw.id?{...s,...change}:s));}
 function setMapping(mapping:Mapping){updateSource({mapping});}
 function setSettings(settings:Settings){updateSource({settings});}
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[categories,setCategories]=useState<string[]>([]),[search,setSearch]=useState(''),[grouped,setGrouped]=useState(false),[sort,setSort]=useState<'date'|'merchant'|'category'|'amount'|'count'>('date'),[ascending,setAscending]=useState(false),[limit,setLimit]=useState(50);
 const file=useRef<HTMLInputElement>(null);
 function reset(){setPeriodOffset(0);setPreset('all');setFrom('');setTo('');setCategories([]);setSearch('');setLimit(50);}
 function load(text:string,name:string,sample=false){try{const data=parseCSV(text),id=crypto.randomUUID();setSources([{...data,id,name,mapping:guessMapping(data.headers),settings:{...defaults},account:''}]);setSelectedSource(id);setIsDemo(sample);setError('');setDedupe(true);reset();}catch(e){setError(e instanceof Error?e.message:'Could not read this CSV.');}}
 async function addFiles(files:File[]){if(!files.length)return;setBusy(true);setError('');try{
 if(files.some(f=>f.size>20*1024*1024))throw Error('Each CSV must be smaller than 20 MB.');
 const totalBytes=files.reduce((sum,f)=>sum+f.size,0);if(totalBytes>50*1024*1024)throw Error('Please upload less than 50 MB at a time.');
 const added=await Promise.all(files.map(async f=>{try{const data=parseCSV(await f.text());return {...data,id:crypto.randomUUID(),name:f.name,mapping:guessMapping(data.headers),settings:{...defaults},account:''};}catch(e){throw Error(`${f.name}: ${e instanceof Error?e.message:'Could not read file.'}`);}}));
 setSources(current=>isDemo?added:[...current,...added]);setSelectedSource(added[0].id);if(isDemo||!sources.length)reset();setIsDemo(false);
 }catch(e){setError(`${e instanceof Error?e.message:'Could not read these files.'} No files were added.`);}finally{setBusy(false);}}
 function selectPeriod(value:TimePreset){setPeriodOffset(0);setPreset(value);setLimit(50);if(value==='all'){setFrom('');setTo('');}else if(value!=='custom'){const dates=currentRange(value,new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone);setFrom(dates.from);setTo(dates.to);}}
 const canNavigate=preset==='month'||preset==='week'||preset==='day';
 const periodName=preset==='month'?'month':preset==='week'?'week':'day';
 function navigatePeriod(offset:number){if(preset!=='month'&&preset!=='week'&&preset!=='day')return;const next=Math.min(0,offset);const dates=navigatePeriodRange(preset,next,new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone);setPeriodOffset(next);setFrom(dates.from);setTo(dates.to);setLimit(50);}
 const imported=useMemo(()=>{try{return {result:sources.length?importSources(sources,dedupe):null,error:''};}catch(e){return {result:null,error:e instanceof Error?e.message:'Import failed.'};}},[sources,dedupe]);
 const transactions=imported.result?.transactions||[];
 const filtered=useMemo(()=>filterTransactions(transactions,{from,to,categories,types,search}),[transactions,from,to,categories,types,search]);
 const metrics=totals(filtered);
 const referenceRange=preset==='month'||preset==='week'||preset==='day'?navigatePeriodRange(preset,periodOffset-1,new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone):undefined;
 const period=periodMetrics(transactions,{from,to,categories,types,search},imported.result?.coverage||null,referenceRange,canNavigate);
 const trend=trendScope(preset,from,to,imported.result?.coverage||null);
 const trendRows=filterTransactions(transactions,{from:trend.from,to:trend.to,categories,types,search});
 const formatDate=(date:string)=>new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
 const monthName=period.from?new Date(period.from+'T00:00:00Z').toLocaleDateString('en-US',{month:'long',timeZone:'UTC'}):'';
 const overviewTitle=preset==='month'?'Monthly overview':preset==='week'?'Weekly overview':preset==='day'?'Daily overview':'Spending overview';
 const overviewPeriod=preset==='all'?'All dates':!period.from||!period.to?'Custom range':preset==='month'?new Date(period.from+'T00:00:00Z').toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'}):period.from===period.to?formatDate(period.from):`${formatDate(period.from)} – ${formatDate(period.to)}`;
 const selectedEnd=period.to?new Date(period.to+'T00:00:00Z'):null;
 const endDay=selectedEnd?.getUTCDate()||0;
 const endSuffix=endDay%100>=11&&endDay%100<=13?'th':endDay%10===1?'st':endDay%10===2?'nd':endDay%10===3?'rd':'th';
 const partialMonth=preset==='month'&&selectedEnd&&endDay<new Date(Date.UTC(selectedEnd.getUTCFullYear(),selectedEnd.getUTCMonth()+1,0)).getUTCDate();
 const monthCutoff=partialMonth?` (through the ${endDay}${endSuffix})`:'';
 const spendingLabel=preset==='month'&&monthName?`${monthName} spending${monthCutoff}`:preset==='week'?(periodOffset===0?'Week-to-date spending':'Week spending'):preset==='day'?(periodOffset===0?"Today's spending":'Day spending'):'Net spending';
 const comparisonLabel=preset==='week'?'vs. this time last week':preset==='month'?'vs. this time last month':preset==='day'?'vs. yesterday':period.days?`vs. prior ${period.days} ${period.days===1?'day':'days'}`:'vs. previous period';
 const dailyHint=period.days?`${period.from} – ${period.to}: ${period.days} calendar days, including days without purchases. Based on imported transactions; missing statement dates may understate the rate.`:'No valid date range.';
 const comparisonDates=period.previousFrom&&period.previousTo?`${period.from} – ${period.to} versus ${period.previousFrom} – ${period.previousTo}. `:'';
 const comparisonHint=period.previousCents===null?comparisonDates+period.comparisonUnavailable:comparisonDates+`Previous net spending: ${money(period.previousCents)}; change: ${money(period.deltaCents!)}. Same category and search filters apply.${preset==='day'?' Daily totals; time-of-day matching is unavailable.':''} Coverage is inferred from valid CSV dates.`;
 const base=filterTransactions(transactions,{from,to,categories:[],types,search});
 const categoryTotals=[...base.reduce((m,t)=>m.set(t.category,(m.get(t.category)||0)+t.cents),new Map<string,number>())].sort((a,b)=>b[1]-a[1]);
 const max=Math.max(1,...categoryTotals.map(([,n])=>Math.abs(n)));
 const ledger=useMemo(()=>{const rows=grouped?consolidate(filtered).map(g=>({...g,description:g.descriptions.join(' · '),kind:'',type:'',account:'',source:''})):filtered.map(t=>({...t,count:1,descriptions:[t.description]}));return rows.sort((a,b)=>{let v=sort==='amount'?a.cents-b.cents:sort==='count'?a.count-b.count:String(a[sort]).localeCompare(String(b[sort]));return ascending?v:-v;});},[filtered,grouped,sort,ascending]);
 function sortBy(s:typeof sort){if(sort===s)setAscending(!ascending);else{setSort(s);setAscending(s==='merchant'||s==='category');}}
 function download(){const csv=exportCSV(['Date','Merchant','Description','Category','Type','Kind','Account','Source file','Count','Net spending (USD)'],ledger.map(t=>[t.date,t.merchant,t.description,t.category,t.type,t.kind,t.account||'',t.source||'',t.count,(t.cents/100).toFixed(2)]));const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='spending.csv';a.click();URL.revokeObjectURL(url);}
 return <main className={raw?'dashboard':'landing'}><header><a className="brand" href="/"><span className="mark"><Wallet size={18}/></span>spending<span className="brand-light">studio</span></a></header>
 <section className="intro"><div><h1>A little clarity.<br/><span>For every dollar.</span></h1></div><div className="intro-action"><button className="primary" disabled={busy} onClick={()=>file.current?.click()}><Upload size={16}/>{busy?'Importing…':raw?'Add CSVs':'Import transactions'}</button>{!raw&&<button className="text-button" disabled={busy} onClick={()=>load(demo,'Sample transactions.csv',true)}>Explore sample data →</button>}</div></section>
 <input ref={file} type="file" accept=".csv,text/csv" multiple hidden onChange={async e=>{const files=Array.from(e.target.files||[]);e.target.value='';await addFiles(files);}}/>
 {(error||imported.error)&&<div role="alert" className="notice">{error||imported.error}</div>}
 {!raw?null:<>
 <div className="source"><span><span className="status-dot"/>{isDemo?'SAMPLE DATA':`${sources.length} ${sources.length===1?'FILE':'FILES'}`}</span><button className="text-button" disabled={busy} onClick={()=>{setSources([]);setSelectedSource('');setIsDemo(false);reset();setError('');}}>Clear data <X size={13}/></button></div>
 <div className="file-list">{sources.map(source=><span className="file-chip" key={source.id} title={source.account||'Shared account'}>{source.name}<button aria-label={`Remove ${source.name}`} disabled={busy} onClick={()=>{setSources(current=>current.filter(s=>s.id!==source.id));if(sources.length===1){reset();setError('');setIsDemo(false);}}}><X size={12}/></button></span>)}</div>
 <details className="settings"><summary><SlidersHorizontal size={14}/>Import settings<ChevronDown size={14}/></summary><div className="import-controls"><label className="check-label"><input type="checkbox" checked={dedupe} onChange={e=>setDedupe(e.target.checked)}/>Remove overlapping transactions</label><span className="hint">Exact matches across files; repeated charges within a file are kept.</span></div><div className="settings-grid"><label>Configure file<select value={raw.id} onChange={e=>setSelectedSource(e.target.value)}>{sources.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select></label><label>Account label<input placeholder="Shared account" value={raw.account} onChange={e=>updateSource({account:e.target.value})} title="Use the same label for overlapping exports from one account, and different labels for separate accounts."/></label>{(Object.keys(mapping) as (keyof Mapping)[]).map(key=><label key={key}>{key} column {['date','description','amount'].includes(key)&&'*'}<select value={mapping[key]} onChange={e=>{setMapping({...mapping,[key]:e.target.value});reset();}}><option value="">{['category','type'].includes(key)?'Not provided':'Choose a column'}</option>{raw.headers.map(h=><option key={h}>{h}</option>)}</select></label>)}<label>Purchase amounts<select value={settings.sign} onChange={e=>setSettings({...settings,sign:e.target.value as Settings['sign']})}><option value="negative">Negative (−)</option><option value="positive">Positive (+)</option></select></label><label>Date format<select value={settings.dayFirst?'day':'month'} onChange={e=>setSettings({...settings,dayFirst:e.target.value==='day'})}><option value="month">MM/DD/YYYY</option><option value="day">DD/MM/YYYY</option></select></label><label>Refund types / categories<input value={settings.refundWords} onChange={e=>setSettings({...settings,refundWords:e.target.value})}/></label><label>Excluded types / categories<input value={settings.excludeWords} onChange={e=>setSettings({...settings,excludeWords:e.target.value})}/></label><label className="check-label"><input type="checkbox" checked={settings.oppositeRefunds} onChange={e=>setSettings({...settings,oppositeRefunds:e.target.checked})}/>Treat all opposite-sign amounts as refunds</label></div><p className="hint">Comma-separated rules match words in Type or Category. Explicit refunds reduce spending; exclusions take priority. ISO dates are also supported. Amounts use USD decimal notation. Give separate accounts different labels to keep their matching charges separate.</p></details>

 <section className="filterbar"><div className="period-control"><select className="period-select" aria-label="Timeframe" value={preset} onChange={e=>selectPeriod(e.target.value as typeof preset)}><option value="all">All dates</option><option value="month">{periodOffset===0?'This month':'Monthly'}</option><option value="week">{periodOffset===0?'This week':'Weekly'}</option><option value="day">{periodOffset===0?'Today':'Daily'}</option><option value="custom">Custom range</option></select><ChevronDown size={14} aria-hidden="true"/></div>{canNavigate&&<div className="period-navigation"><button className="period-arrow" aria-label={`Previous ${periodName}`} title={`Previous ${periodName}, same elapsed span`} onClick={()=>navigatePeriod(periodOffset-1)}><ChevronLeft size={16}/></button><button className="period-arrow" aria-label={`Next ${periodName}`} title={`Next ${periodName}, same elapsed span`} disabled={periodOffset===0} onClick={()=>navigatePeriod(periodOffset+1)}><ChevronRight size={16}/></button>{periodOffset<0&&<button className="text-button" onClick={()=>navigatePeriod(0)}>{preset==='day'?'Jump to today':`Jump to current ${periodName}`}</button>}</div>}<div className="date-range"><label>From<input aria-label="From date" type="date" value={from} onChange={e=>{setFrom(e.target.value);setPeriodOffset(0);setPreset('custom');setLimit(50);}}/></label><span>—</span><label>To<input aria-label="To date" type="date" value={to} onChange={e=>{setTo(e.target.value);setPeriodOffset(0);setPreset('custom');setLimit(50);}}/></label></div><div className="search"><Search size={15}/><input aria-label="Search merchants or descriptions" placeholder="Search transactions" value={search} onChange={e=>{setSearch(e.target.value);setLimit(50);}}/></div></section>
 {from&&to&&from>to&&<p role="alert" className="warning">The start date is after the end date.</p>}
 <div className="overview-heading"><h2>{overviewTitle}</h2><span title={period.from&&period.to?`${formatDate(period.from)} – ${formatDate(period.to)}`:undefined}>{overviewPeriod}</span></div>
 <section className="metrics" aria-label={overviewTitle}><div><span title="Purchases less refunds">{spendingLabel}</span><strong>{money(metrics.cents)}</strong></div><div title={dailyHint}><span>Spending per day</span><strong>{period.dailyCents===null?'—':money(period.dailyCents)}</strong></div><div title={comparisonHint}><span>{comparisonLabel}</span><strong className={period.deltaCents===null?'unavailable':period.deltaCents>0?'increase':period.deltaCents<0?'decrease':''}>{period.deltaCents===null?'—':period.percent!==null?`${period.percent>0?'+':''}${period.percent.toFixed(1)}%`:`${period.deltaCents>0?'+':''}${money(period.deltaCents)}`}</strong>{period.previousCents===null&&<small className="comparison-unavailable">{period.comparisonUnavailable}</small>}</div></section>
 <SpendingTrend key={preset} rows={trendRows} from={trend.from} to={trend.to} unit={trend.unit}/>
 <section className="breakdown"><div className="section-head"><div><h2>Where it went</h2></div><div className="category-actions"><span className="subtle">{categories.length?`${categories.length} selected`: `${categoryTotals.length} categories`}</span>{categories.length>0&&<button className="text-button" onClick={()=>{setCategories([]);setLimit(50);}}>Clear selection</button>}</div></div><div className="bars">{categoryTotals.length?categoryTotals.map(([cat,n])=><button key={cat} className={`bar-row ${categories.includes(cat)?'selected':categories.length?'dim':''}`} aria-pressed={categories.includes(cat)} onClick={()=>{setCategories(categories.includes(cat)?categories.filter(x=>x!==cat):[...categories,cat]);setLimit(50);}}><span className="bar-label"><i style={{background:color(cat)}}/>{cat}</span><span className="bar-track"><span style={{width:`${Math.max(0.7,Math.abs(n)/max*100)}%`,background:color(cat)}}/></span><span className="bar-value">{money(n)}{categories.includes(cat)&&<Check size={16} strokeWidth={3}/>}</span></button>):<p className="no-results">No transactions match these filters.</p>}</div></section>
 <section className="ledger"><div className="section-head"><div><h2>Transactions <span className="count">{ledger.length}</span></h2></div><div className="ledger-actions"><label className="check-label"><input type="checkbox" checked={grouped} onChange={e=>{setGrouped(e.target.checked);setLimit(50);}}/>Consolidate merchants</label><button className="export" disabled={!ledger.length} onClick={download}><ArrowDownToLine size={14}/>Export CSV</button></div></div><div className="table-wrap"><table><thead><tr>{(['date','merchant','category',...(grouped?['count']:[]),'amount'] as typeof sort[]).map(s=><th key={s} className={s==='amount'?'numeric':''}><button onClick={()=>sortBy(s)}>{s==='date'&&grouped?'Latest date':s}{sort===s&&(ascending?' ↑':' ↓')}</button></th>)}</tr></thead><tbody>{ledger.slice(0,limit).map((t,i)=><tr key={i}><td className="date">{new Date(t.date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}</td><td><span className="merchant" title={[t.account,t.source].filter(Boolean).join(' · ')}>{t.merchant}</span><small className="description" title={t.description}>{t.description}{t.kind==='refund'?' · Refund':''}</small></td><td><span className="category-pill" style={{background:`${color(t.category)}26`,borderColor:`${color(t.category)}66`,borderLeftColor:color(t.category)}}><i style={{background:color(t.category)}}/>{t.category}</span></td>{grouped&&<td>{t.count}</td>}<td className={`numeric amount ${t.cents<0?'refund':''}`}>{money(t.cents)}</td></tr>)}</tbody></table>{!ledger.length&&<p className="no-results">No transactions in this selection. Adjust your filters or import settings.</p>}</div><div className="table-footer"><span>Showing {Math.min(limit,ledger.length)} of {ledger.length}</span>{limit<ledger.length&&<button className="text-button" onClick={()=>setLimit(limit+100)}>Show more ↓</button>}</div></section></>}
 </main>
}
