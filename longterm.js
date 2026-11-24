/* Long-term history charts for the Chart tab. Lazy-loaded when the section opens. */
(function(){
  const COL = {s:'#14532d', n:'#1d4ed8', m:'#6b7280', r:'#9a3412'};
  const LABELS = {
    s:'School-area sensor',
    n:'Earlier nearby outdoor sensors',
    m:"Other sensors' median",
    r:'Regulatory monitor, San Jose'
  };
  const LT = {
    idx:null, rows:[], byYear:{}, ready:false,
    range:'5Y', custom:null, year:null,
    on:{s:true,n:true,m:true,r:true},
    loading:null
  };

  function base(){
    const p=location.pathname || '/';
    const dir=p.endsWith('/')?p:p.replace(/[^/]+$/,'');
    return dir + 'longterm/';
  }
  function parseDay(s){
    const [y,m,d]=s.split('-').map(Number);
    return Date.UTC(y,m-1,d)/1000;
  }
  function fmtDay(s){
    if(!s) return '';
    const [y,m,d]=s.split('-');
    const months='Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
    return months[+m-1]+' '+(+d)+', '+y;
  }
  function todayISO(){
    try{
      return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    }catch(e){
      const t=new Date();
      return t.toISOString().slice(0,10);
    }
  }
  function addDays(iso, n){
    const t=parseDay(iso)+n*86400;
    const d=new Date(t*1000);
    const y=d.getUTCFullYear(), m=d.getUTCMonth()+1, day=d.getUTCDate();
    return y+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  }
  function rangeBounds(){
    const end=(LT.idx && LT.idx.end) || todayISO();
    const start0=(LT.idx && LT.idx.start) || '2020-01-01';
    if(LT.custom && LT.custom[0] && LT.custom[1]) return LT.custom;
    const r=LT.range;
    if(r==='All') return [start0,end];
    if(r==='YTD') return [end.slice(0,4)+'-01-01', end];
    if(r==='1M') return [addDays(end,-30), end];
    if(r==='6M') return [addDays(end,-182), end];
    if(r==='1Y') return [addDays(end,-365), end];
    if(r==='5Y') return [addDays(end,-365*5), end];
    return [start0,end];
  }
  function inRange(rows, a, b){
    return rows.filter(r=>r.d>=a && r.d<=b);
  }
  function rolling(rows, key, win){
    const out=new Array(rows.length).fill(null);
    const acc=[];
    for(let i=0;i<rows.length;i++){
      const t=parseDay(rows[i].d);
      acc.push({t, v:rows[i][key]});
      const cut=t-win*86400;
      while(acc.length && acc[0].t<cut) acc.shift();
      const vs=acc.map(x=>x.v).filter(v=>v!=null);
      if(vs.length>=8) out[i]=vs.reduce((s,v)=>s+v,0)/vs.length;
    }
    return out;
  }
  function smoke(day){
    const list=(LT.idx && LT.idx.wildfire)||[];
    for(const w of list){ if(day>=w.start && day<=w.end) return w.label; }
    return null;
  }

  function load(){
    if(LT.ready) return Promise.resolve();
    if(LT.loading) return LT.loading;
    const b=base();
    LT.loading=fetch(b+'index.json?t='+Date.now()).then(r=>{
      if(!r.ok) throw new Error('index '+r.status);
      return r.json();
    }).then(idx=>{
      LT.idx=idx;
      const years=idx.years||[];
      LT.year=years.length?years[years.length-1]:null;
      return Promise.all(years.map(y=>fetch(b+'y'+y+'.json').then(r=>r.json()).then(doc=>{
        LT.byYear[y]=doc;
      })));
    }).then(()=>{
      const rows=[];
      (LT.idx.years||[]).forEach(y=>{
        const doc=LT.byYear[y]; if(!doc) return;
        (doc.rows||[]).forEach(a=>{
          rows.push({d:a[0], s:a[1], n:a[2], m:a[3], r:a[4], w:a[5], f:a[6], t:a[7]});
        });
      });
      LT.rows=rows;
      LT.ready=true;
      fillChrome();
      drawAll();
      drawYear();
      fillTrend();
    }).catch(err=>{
      LT.loading=null;
      const lead=document.getElementById('lt-lead');
      if(lead) lead.textContent='Long-term history could not be loaded right now. Please try opening this section again.';
      throw err;
    });
    return LT.loading;
  }

  function fillChrome(){
    const idx=LT.idx; if(!idx) return;
    const lead=document.getElementById('lt-lead');
    if(lead){
      const bits=(idx.sources||[]).map(s=>{
        const a=s.first_daily||s.start, z=s.end||idx.end;
        return (s.label||s.id)+' ('+(a||'?')+' to '+(z||'now')+')';
      });
      lead.textContent='Daily EPA-corrected AQI from 2020 through '+idx.end+'. School-area sensor from Oct 2026; earlier nearby outdoor sensors from Apr 2020; other-sensors median; San Jose regulatory monitor through 2024. Gaps are “no data,” not zeros. Not a claim that the facility caused a reading.';
    }
    const ser=document.getElementById('lt-series');
    if(ser && !ser.childElementCount){
      [['s',LABELS.s],['n',LABELS.n],['m',LABELS.m],['r',LABELS.r]].forEach(([k,lab])=>{
        const b=document.createElement('button');
        b.type='button'; b.dataset.k=k; b.textContent=lab;
        b.classList.toggle('on', !!LT.on[k]);
        b.setAttribute('aria-pressed', LT.on[k]?'true':'false');
        b.addEventListener('click',()=>{
          LT.on[k]=!LT.on[k];
          b.classList.toggle('on', LT.on[k]);
          b.setAttribute('aria-pressed', LT.on[k]?'true':'false');
          drawAll(); drawYear();
        });
        ser.appendChild(b);
      });
    }
    const yrs=document.getElementById('lt-years');
    if(yrs && !yrs.childElementCount){
      (idx.years||[]).forEach(y=>{
        const b=document.createElement('button');
        b.type='button'; b.dataset.y=String(y); b.textContent=String(y);
        if(y===LT.year) b.classList.add('on');
        b.addEventListener('click',()=>{
          LT.year=+y;
          yrs.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x.dataset.y===String(y)));
          drawYear();
        });
        yrs.appendChild(b);
      });
    }
  }

  function fillTrend(){
    const box=document.getElementById('lt-trend-body');
    if(!box || !LT.idx) return;
    const idx=LT.idx, tr=idx.trends||{};
    const takes=idx.takeaways||[];
    const ul=document.createElement('ul');
    takes.forEach(t=>{const li=document.createElement('li'); li.textContent=t; ul.appendChild(li);});
    const yoy=tr.yoy_near_facility_ex_smoke||{};
    const med=tr.yoy_median_ex_smoke||{};
    const reg=tr.yoy_regulatory_ex_smoke||{};
    const years=Object.keys(yoy).sort();
    let table='';
    if(years.length){
      table='<table class="lt-yoy"><thead><tr><th>Year</th><th>Near-facility mean*</th><th>Other-sensors median*</th><th>Regulatory*</th></tr></thead><tbody>'+
        years.map(y=>{
          const cell=v=>v==null?'no data':Number(v).toFixed(1);
          return `<tr><td>${y}</td><td>${cell(yoy[y])}</td><td>${cell(med[y])}</td><td>${cell(reg[y])}</td></tr>`;
        }).join('')+'</tbody></table>'+
        '<p class="lt-note">*Yearly mean of daily AQI, with August–October 2020 wildfire-smoke days excluded from the trend figures above. Theil-Sen slope on monthly means for the near-facility series: '+(
          (tr.theil_sen_near_facility && tr.theil_sen_near_facility.aqi_per_year!=null)
            ? (tr.theil_sen_near_facility.aqi_per_year>0?'+':'')+tr.theil_sen_near_facility.aqi_per_year+' AQI per year'
            : 'n/a'
        )+'. Correlation only — not a cause.</p>';
    }
    box.innerHTML='';
    if(table) box.insertAdjacentHTML('beforeend', table);
    box.appendChild(ul);
  }

  function sizeOf(el){
    const w=el.clientWidth||el.getBoundingClientRect().width||0;
    const h=el.clientHeight||el.getBoundingClientRect().height||0;
    return {w:Math.max(0,Math.round(w)), h:Math.max(0,Math.round(h))};
  }

  function pathFrom(xs, ys){
    let d='', pen=false;
    for(let i=0;i<xs.length;i++){
      const y=ys[i];
      if(y==null || y!==y){pen=false; continue;}
      d += (pen?'L':'M')+xs[i].toFixed(1)+','+y.toFixed(1);
      pen=true;
    }
    return d;
  }

  function niceMax(v){
    if(!(v>0)) return 50;
    const p=Math.pow(10, Math.floor(Math.log10(v)));
    const n=Math.ceil(v/p);
    return (n<=2?2:n<=5?5:10)*p;
  }

  function drawFrame(svg, rows, opts){
    const wrap=svg.parentElement;
    const {w,h}=sizeOf(wrap);
    if(w<40||h<40){
      // hidden or not laid out yet
      return null;
    }
    const pl=28, pr=8, pt=10, pb=22;
    const iw=Math.max(10,w-pl-pr), ih=Math.max(10,h-pt-pb);
    let ymax=50;
    const keys=['s','n','m','r'].filter(k=>LT.on[k]);
    rows.forEach(r=>{
      keys.forEach(k=>{ if(r[k]!=null && r[k]>ymax) ymax=r[k]; });
    });
    ymax=Math.max(50, niceMax(ymax));
    const t0=rows.length?parseDay(rows[0].d):0;
    const t1=rows.length?parseDay(rows[rows.length-1].d):1;
    const span=Math.max(1,t1-t0);
    const X=t=>pl+(parseDay(t)-t0)/span*iw;
    const Y=v=>pt+ih-(v/ymax)*ih;
    let smokeRects='';
    const bands=(LT.idx&&LT.idx.wildfire)||[];
    bands.forEach(b=>{
      if(b.end<rows[0].d || b.start>rows[rows.length-1].d) return;
      const x1=X(b.start<rows[0].d?rows[0].d:b.start);
      const x2=X(b.end>rows[rows.length-1].d?rows[rows.length-1].d:b.end);
      smokeRects+=`<rect x="${Math.min(x1,x2).toFixed(1)}" y="${pt}" width="${Math.max(1,Math.abs(x2-x1)).toFixed(1)}" height="${ih}" fill="#fde68a" fill-opacity="0.45"></rect>`;
    });
    // y grid
    let grid='';
    const step=ymax<=100?25:50;
    for(let v=0;v<=ymax;v+=step){
      const y=Y(v);
      grid+=`<line x1="${pl}" x2="${w-pr}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>`;
      grid+=`<text x="${pl-4}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="10" fill="#6b7280" font-family="system-ui,sans-serif">${v}</text>`;
    }
    // x labels: ~4–6 ticks
    let xlab='';
    const nTick=Math.min(6, rows.length);
    if(rows.length){
      for(let i=0;i<nTick;i++){
        const r=rows[Math.round(i*(rows.length-1)/Math.max(1,nTick-1))];
        const [y,m]=r.d.split('-');
        const label=(opts&&opts.yearMode)?(r.d.slice(5)):(m+'/'+y.slice(2));
        xlab+=`<text x="${X(r.d).toFixed(1)}" y="${h-6}" text-anchor="middle" font-size="10" fill="#6b7280" font-family="system-ui,sans-serif">${label}</text>`;
      }
    }
    let series='';
    keys.forEach(k=>{
      const ys=rows.map(r=>r[k]==null?null:Y(r[k]));
      const xs=rows.map(r=>X(r.d));
      series+=`<path d="${pathFrom(xs,ys)}" fill="none" stroke="${COL[k]}" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"></path>`;
      if(opts&&opts.rolling){
        const roll=rolling(rows,k,30);
        const rys=roll.map(v=>v==null?null:Y(v));
        series+=`<path d="${pathFrom(xs,rys)}" fill="none" stroke="${COL[k]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></path>`;
      }
      if(opts&&opts.monthly){
        const buckets={};
        rows.forEach(r=>{
          if(r[k]==null) return;
          const ym=r.d.slice(0,7);
          (buckets[ym]=buckets[ym]||[]).push({d:r.d,v:r[k]});
        });
        Object.keys(buckets).forEach(ym=>{
          const pts=buckets[ym];
          const mid=pts[Math.floor(pts.length/2)].d;
          const avg=pts.reduce((s,p)=>s+p.v,0)/pts.length;
          series+=`<circle cx="${X(mid).toFixed(1)}" cy="${Y(avg).toFixed(1)}" r="3.2" fill="${COL[k]}" stroke="#fff" stroke-width="1"></circle>`;
        });
      }
    });
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    svg.setAttribute('width',w);
    svg.setAttribute('height',h);
    svg.innerHTML=`${smokeRects}${grid}${series}${xlab}`;
    return {w,h,pl,pr,pt,pb,iw,ih,X,Y,ymax,t0,t1,rows};
  }

  function bindTip(wrap, tip, layout){
    if(!layout || !layout.rows.length) return;
    const {X,rows,pl,iw,w}=layout;
    const atX=x=>{
      const t0=parseDay(rows[0].d), t1=parseDay(rows[rows.length-1].d);
      const span=Math.max(1,t1-t0);
      const t=t0+Math.max(0,Math.min(1,(x-pl)/iw))*span;
      let best=0, bd=1e15;
      for(let i=0;i<rows.length;i++){
        const d=Math.abs(parseDay(rows[i].d)-t);
        if(d<bd){bd=d;best=i;}
      }
      return best;
    };
    const show=i=>{
      const r=rows[i]; if(!r) return;
      const sm=smoke(r.d);
      const lines=[`<b>${fmtDay(r.d)}</b>`];
      [['s',LABELS.s],['n',LABELS.n],['m',LABELS.m],['r',LABELS.r]].forEach(([k,lab])=>{
        if(!LT.on[k]) return;
        lines.push(`${lab}: ${r[k]==null?'no data':r[k]}`);
      });
      if(r.w!=null) lines.push(`Wind ${r.w} mph`+(r.t===1?', mostly from the facility direction':''));
      if(sm) lines.push(sm);
      tip.innerHTML=lines.join('<br>');
      tip.style.display='block';
      tip.hidden=false;
      const x=X(r.d);
      const tw=tip.offsetWidth||160, th=tip.offsetHeight||60;
      let left=x+10, top=8;
      if(left+tw>w-4) left=x-tw-10;
      if(left<2) left=2;
      tip.style.left=left+'px';
      tip.style.top=top+'px';
    };
    const hide=()=>{ tip.hidden=true; tip.style.display='none'; };
    let down=null, dragging=false;
    const pos=ev=>{
      const box=wrap.getBoundingClientRect();
      return ev.clientX-box.left;
    };
    wrap.onpointerdown=ev=>{
      if(ev.pointerType==='mouse' && ev.button!==0) return;
      down={x:pos(ev), id:ev.pointerId};
      dragging=false;
      try{ wrap.setPointerCapture(ev.pointerId); }catch(e){}
      show(atX(down.x));
    };
    wrap.onpointermove=ev=>{
      const x=pos(ev);
      if(down){
        if(Math.abs(x-down.x)>8) dragging=true;
        if(dragging && wrap.id==='lt-all'){
          // live preview of brush via tip only; apply on up
          show(atX(x));
          return;
        }
      }
      show(atX(x));
    };
    wrap.onpointerup=ev=>{
      if(!down) return;
      const x=pos(ev);
      if(dragging && wrap.id==='lt-all' && Math.abs(x-down.x)>12){
        const i0=atX(down.x), i1=atX(x);
        const a=rows[Math.min(i0,i1)].d, b=rows[Math.max(i0,i1)].d;
        if(a!==b){
          LT.custom=[a,b];
          document.querySelectorAll('#lt-ranges button').forEach(b=>b.classList.remove('on'));
          drawAll();
        }
      }
      down=null; dragging=false;
    };
    wrap.onpointerleave=()=>{ if(!down) hide(); };
    wrap.onpointercancel=()=>{ down=null; dragging=false; };
  }

  function drawAll(){
    const svg=document.getElementById('lt-all-svg');
    const tip=document.getElementById('lt-all-tip');
    const wrap=document.getElementById('lt-all');
    if(!svg||!wrap||!LT.ready) return;
    const [a,b]=rangeBounds();
    const rows=inRange(LT.rows,a,b);
    const note=document.getElementById('lt-all-note');
    if(!rows.length){
      svg.innerHTML='';
      if(tip){tip.hidden=true; tip.style.display='none';}
      if(note) note.textContent='No data in this date range.';
      return;
    }
    if(note) note.textContent=`${fmtDay(a)} – ${fmtDay(b)}. Thin lines are daily values; thicker lines are a 30-day rolling average. Yellow bands mark wildfire-smoke periods. Drag across the chart to zoom; use the range buttons to reset.`;
    const layout=drawFrame(svg, rows, {rolling:true});
    if(layout) bindTip(wrap, tip, layout);
  }

  function yearStatsHtml(year){
    const st=(LT.idx.stats||{})[String(year)]||{};
    const cell=(label,k)=>{
      const b=st[k]||{};
      if(!b.n) return `<div><b>${label}</b>no data</div>`;
      const spikes=k==='school'?st.spikes:null;
      const sp= (k==='school')
        ? (st.spikes==null? ' · spikes: no 10-minute data' : ` · suspicious spikes: ${st.spikes}`)
        : '';
      return `<div><b>${label}</b>Mean ${b.mean} · ${b.days_over_50} days over 50 · ${b.days_over_100} days over 100${sp}</div>`;
    };
    // spikes once, on a fifth box
    const sp = st.spikes==null
      ? `<div><b>Suspicious spikes</b>no 10-minute data this year</div>`
      : `<div><b>Suspicious spikes</b>${st.spikes} official episode${st.spikes===1?'':'s'} (10-minute record only)</div>`;
    return cell('School-area sensor','school')+cell('Earlier nearby sensors','near')+cell("Other sensors' median",'median')+cell('Regulatory monitor','reg')+sp;
  }

  function drawYear(){
    const svg=document.getElementById('lt-year-svg');
    const tip=document.getElementById('lt-year-tip');
    const wrap=document.getElementById('lt-year');
    const stats=document.getElementById('lt-ystats');
    if(!svg||!wrap||!LT.ready) return;
    const y=LT.year;
    if(stats) stats.innerHTML=yearStatsHtml(y);
    const rows=LT.rows.filter(r=>r.d.slice(0,4)===String(y));
    const any=rows.some(r=>['s','n','m','r'].some(k=>LT.on[k] && r[k]!=null));
    if(!any){
      svg.innerHTML=`<text x="50%" y="50%" text-anchor="middle" fill="#6b7280" font-size="13" font-family="system-ui,sans-serif">no data</text>`;
      if(tip){tip.hidden=true; tip.style.display='none';}
      return;
    }
    const layout=drawFrame(svg, rows, {yearMode:true, monthly:true});
    if(layout) bindTip(wrap, tip, layout);
  }

  function bind(){
    const wrap=document.getElementById('lt-wrap');
    if(!wrap || wrap._ltBound) return;
    wrap._ltBound=true;
    wrap.addEventListener('toggle',()=>{
      if(wrap.open){
        load().then(()=>{
          // layout may be 0-width until opened; draw after two frames
          requestAnimationFrame(()=>requestAnimationFrame(()=>{ drawAll(); drawYear(); }));
        });
      }
    });
    document.getElementById('lt-ranges')?.addEventListener('click',e=>{
      const b=e.target.closest('button[data-r]'); if(!b) return;
      LT.range=b.dataset.r; LT.custom=null;
      document.querySelectorAll('#lt-ranges button').forEach(x=>x.classList.toggle('on', x===b));
      if(LT.ready) drawAll();
    });
    addEventListener('resize',()=>{
      if(wrap.open && LT.ready){ drawAll(); drawYear(); }
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
