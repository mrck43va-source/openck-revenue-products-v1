const K='journal-v1';
function load(){try{const v=JSON.parse(localStorage.getItem(K)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
let T=load();
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
date.value=new Date().toISOString().slice(0,10);
function addTrade(){T.unshift({date:date.value,instrument:instrument.value.trim().slice(0,30),session:session.value,setup:setup.value.trim().slice(0,200),pnl:+pnl.value||0,r:+r.value||0,adherence:Math.max(0,Math.min(100,+adherence.value||0)),notes:notes.value.trim().slice(0,2000)});T=T.slice(0,1000);localStorage.setItem(K,JSON.stringify(T));render()}
function render(){rows.innerHTML=T.map(t=>'<tr><td>'+esc(t.date)+'</td><td>'+esc(t.instrument)+'</td><td>'+esc(t.setup)+'</td><td>$'+Number(t.pnl||0).toFixed(2)+'</td><td>'+Number(t.r||0).toFixed(2)+'</td><td>'+Number(t.adherence||0).toFixed(0)+'%</td></tr>').join('');count.textContent=T.length;net.textContent='$'+T.reduce((s,t)=>s+(+t.pnl||0),0).toFixed(2);winrate.textContent=(T.length?100*T.filter(t=>(+t.pnl||0)>0).length/T.length:0).toFixed(1)+'%';avgR.textContent=(T.length?T.reduce((s,t)=>s+(+t.r||0),0)/T.length:0).toFixed(2);avgA.textContent=(T.length?T.reduce((s,t)=>s+(+t.adherence||0),0)/T.length:0).toFixed(1)+'%'}
render();