'use client';
import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {ChevronDown} from 'lucide-react';
import {spendingTrend,monthRange,trendAxisRange,trendDragRange,type Transaction,type TrendUnit} from '@/lib/transactions';
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(cents/100);
const dateLabel=(date:string)=>new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
export default function SpendingTrend({rows,from,to,unit}:{rows:Transaction[];from:string;to:string;unit:TrendUnit}){
 const [active,setActive]=useState<number|null>(null),[rangeFrom,setRangeFrom]=useState(''),[rangeTo,setRangeTo]=useState(''),[selection,setSelection]=useState<[number,number]|null>(null);
 const drag=useRef<{pointer:number;index:number;x:number;clientX:number}|null>(null);
 useEffect(()=>{setRangeFrom('');setRangeTo('');setActive(null);drag.current=null;setSelection(null);},[from,to,unit]);
 const asOf=monthRange('this',new Date(),Intl.DateTimeFormat().resolvedOptions().timeZone).to;
 const allData=useMemo(()=>spendingTrend(rows,from,to,unit,asOf),[rows,from,to,unit,asOf]);
 const availableFrom=allData[0]?.from||'',availableTo=allData.at(-1)?.to||'';
 const range=trendAxisRange(availableFrom,availableTo,rangeFrom,rangeTo);
 // Zoom changes which whole buckets are visible, never their financial totals.
 const data=useMemo(()=>range.error?[]:allData.filter(b=>b.to>=range.from&&b.from<=range.to),[allData,range.error,range.from,range.to]);
 const index=active===null?data.length-1:Math.min(active,data.length-1),point=data[index];
 const low=Math.min(0,...data.map(d=>d.cents)),high=Math.max(0,...data.map(d=>d.cents));
 const span=high-low||100,max=high+span*.12,min=low-span*.08;
 const x=(i:number)=>data.length===1?425:64+i/(data.length-1)*714;
 const y=(n:number)=>174-(n-min)/(max-min)*154;
 const path=data.map((p,i)=>`${i?'L':'M'} ${x(i)} ${y(p.cents)}`).join(' ');
 const labelIndexes=[...new Set([0,Math.floor((data.length-1)/2),data.length-1])].filter(i=>i>=0);
 const label=(date:string)=>new Date(date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',...(unit==='month'?{year:'numeric'}:{day:'numeric'}),timeZone:'UTC'});
 const coords=(event:ReactPointerEvent<SVGSVGElement>)=>{const rect=event.currentTarget.getBoundingClientRect();return {x:(event.clientX-rect.left)/rect.width*800,y:(event.clientY-rect.top)/rect.height*220};};
 const nearest=(px:number)=>data.length===1?0:Math.max(0,Math.min(data.length-1,Math.round((px-64)/714*(data.length-1))));
 function finishDrag(event:ReactPointerEvent<SVGSVGElement>){const start=drag.current;if(!start||start.pointer!==event.pointerId)return;const end=coords(event);if(Math.abs(event.clientX-start.clientX)>=6){const dates=trendDragRange(data,start.index,nearest(end.x));if(dates){setRangeFrom(dates.from);setRangeTo(dates.to);setActive(null);}}drag.current=null;setSelection(null);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
 return <details className="trend-panel"><summary><span>Spending trend</span><ChevronDown size={15}/></summary><div className="trend-content">
 <div className="trend-toolbar"><div className="trend-range-controls"><span className="trend-unit-label" title="Current-period presets include earlier periods for comparison. Category, type, and search filters still apply.">{unit==='month'?'Monthly':unit==='week'?'Weekly':'Daily'}</span><label>From<input aria-label="Graph start date" title="Selects whole buckets overlapping this date range." type="date" min={availableFrom} max={availableTo} value={rangeFrom||availableFrom} onChange={e=>{setRangeFrom(e.target.value);setActive(null);}}/></label><label>To<input aria-label="Graph end date" title="Selects whole buckets overlapping this date range." type="date" min={availableFrom} max={availableTo} value={rangeTo||availableTo} onChange={e=>{setRangeTo(e.target.value);setActive(null);}}/></label><button className="text-button" disabled={!rangeFrom&&!rangeTo} onClick={()=>{setRangeFrom('');setRangeTo('');setActive(null);}}>Reset range</button></div>{point&&<output className="trend-value"><span>{money(point.cents)}</span><small>{dateLabel(point.from)}{point.from!==point.to?` – ${dateLabel(point.to)}`:''}{point.partial?' · Partial':''}</small></output>}</div>
 {range.error&&allData.length>0&&<p role="alert" className="trend-range-error">{range.error}</p>}
 {data.length?<><div className="trend-scroll"><svg className="trend-svg" viewBox="0 0 800 220" role="img" tabIndex={0} aria-label={`Net spending trend, ${unit} buckets. Drag horizontally to zoom. Use date fields to set the graph range, or left and right arrow keys to inspect values. Current value: ${point?money(point.cents):''}.`}
 onKeyDown={event=>{if(event.key==='Escape'){drag.current=null;setSelection(null);}if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setActive(Math.max(0,Math.min(data.length-1,index+(event.key==='ArrowRight'?1:-1))));}}}
 onPointerDown={event=>{const p=coords(event);if(!event.isPrimary||event.button!==0||p.x<64||p.x>778||p.y<17||p.y>176)return;event.currentTarget.focus();drag.current={pointer:event.pointerId,index:nearest(p.x),x:p.x,clientX:event.clientX};setSelection([p.x,p.x]);event.currentTarget.setPointerCapture(event.pointerId);}}
 onPointerUp={finishDrag} onPointerCancel={()=>{drag.current=null;setSelection(null);}} onLostPointerCapture={()=>{drag.current=null;setSelection(null);}}
 onPointerLeave={()=>{if(!drag.current)setActive(null);}}
 onPointerMove={event=>{const px=Math.max(64,Math.min(778,coords(event).x));setActive(nearest(px));if(drag.current?.pointer===event.pointerId)setSelection([drag.current.x,px]);}}>
 <title>Net spending over time</title><desc>Purchases minus refunds, using category, type, and search filters. Current-period presets include earlier periods for comparison. Drag horizontally to zoom into whole buckets. Empty buckets are zero. Partial buckets are included without extrapolation.</desc>
 {[high,(high+low)/2,low].filter((n,i,a)=>a.indexOf(n)===i).map(n=><g key={n}><line x1="64" x2="778" y1={y(n)} y2={y(n)} stroke="#e5e7df" strokeDasharray={n===0?undefined:'3 5'}/><text x="54" y={y(n)+4} textAnchor="end" className="trend-axis">{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n/100)}</text></g>)}
 <path d={path} fill="none" stroke="#547b68" strokeWidth="2" strokeLinejoin="round"/>
 {data.map((p,i)=><circle key={p.start} cx={x(i)} cy={y(p.cents)} r={data.length<65?3:1.5} fill={p.partial?'#fafaf7':'#547b68'} stroke="#547b68" strokeWidth="1.5"><title>{dateLabel(p.from)} – {dateLabel(p.to)}: {money(p.cents)}{p.partial?' (partial bucket)':''}</title></circle>)}
 {point&&<g><line x1={x(index)} x2={x(index)} y1="17" y2="176" stroke="#b7c5af" strokeDasharray="3 4"/><circle cx={x(index)} cy={y(point.cents)} r="4" fill="#335f48" stroke="#fafaf7" strokeWidth="2"/></g>}
 {selection&&<rect x={Math.min(...selection)} y="17" width={Math.abs(selection[1]-selection[0])} height="159" fill="#547b6826" stroke="#547b68" pointerEvents="none"/>}
 {labelIndexes.map(i=><text key={i} x={x(i)} y="203" textAnchor={i===0?'start':i===data.length-1?'end':'middle'} className="trend-axis">{label(data[i].from)}</text>)}
 </svg></div><p className="trend-interaction-hint">Drag horizontally to zoom</p></>:!range.error||!allData.length?<p className="no-results">Select a valid date range to view the trend.</p>:null}
 </div></details>;
}
