const K='payout-ready-v1';
function load(){try{const v=JSON.parse(localStorage.getItem(K)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
let A=load();
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function vals(){let p=+profit.value||0,q=+required.value||0,l=+largest.value||0,m=+maxpct.value||0,dr=+daysReq.value||0,dd=+daysDone.value||0,r=Math.max(0,q-p),pc=p>0?l/p*100:0,d=Math.max(0,dr-dd),b=[];if(p<q)b.push('Profit threshold');if(p>0&&pc>m)b.push('Largest-day consistency');if(d>0)b.push('Qualifying days');return{label:(label.value||'Account').trim().slice(0,100),profit:p,ratio:pc,remaining:r,days:d,blocker:b.join(' + ')||'None',ready:!b.length}}
function calculate(){let x=vals();status.textContent=x.ready?'READY - entered rules satisfied':'NOT READY';status.className=x.ready?'good':'bad';remaining.textContent='$'+x.remaining.toFixed(2);ratio.textContent=x.ratio.toFixed(2)+'%';days.textContent=x.days;blocker.textContent=x.blocker}
function saveAccount(){let x=vals();A.unshift(x);A=A.slice(0,500);localStorage.setItem(K,JSON.stringify(A));render();calculate()}
function render(){saved.innerHTML=A.map(x=>'<tr><td>'+esc(x.label)+'</td><td class="'+(x.ready?'good':'bad')+'">'+(x.ready?'READY':'NOT READY')+'</td><td>$'+Number(x.profit||0).toFixed(2)+'</td><td>'+Number(x.ratio||0).toFixed(2)+'%</td><td>'+esc(x.blocker)+'</td></tr>').join('')}
calculate();render();