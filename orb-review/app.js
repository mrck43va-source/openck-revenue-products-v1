const K='orb-v1';
function load(){try{const v=JSON.parse(localStorage.getItem(K)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
let R=load();
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
date.value=new Date().toISOString().slice(0,10);
function now(){let x=[...document.querySelectorAll('.c')];return x.length?Math.round(100*x.filter(v=>v.checked).length/x.length):0}
document.querySelectorAll('.c').forEach(x=>x.onchange=()=>score.textContent=now()+'%');
function saveReview(){R.unshift({date:date.value,score:now(),lesson:lesson.value.trim().slice(0,2000)});R=R.slice(0,1000);localStorage.setItem(K,JSON.stringify(R));render()}
function render(){score.textContent=now()+'%';count.textContent=R.length;let s=R.slice(0,7);avg.textContent=(s.length?s.reduce((a,x)=>a+(+x.score||0),0)/s.length:0).toFixed(1)+'%';rows.innerHTML=R.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+Number(x.score||0).toFixed(0)+'%</td><td>'+esc(x.lesson)+'</td></tr>').join('')}
render();