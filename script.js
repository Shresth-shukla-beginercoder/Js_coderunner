const $=s=>document.querySelector(s),code=$('#code'),hl=$('#hl'),ln=$('#ln'),out=$('#out'),why=$('#why'),stat=$('#stat');
const save=(k,v)=>{try{localStorage[k]=v}catch{}},load=k=>{try{return localStorage[k]}catch{}};

/* ---------- Syntax highlighting: split code into tokens, wrap each in a coloured span ---------- */
const KW=new Set('const let var function return if else for while do switch case break continue new class extends try catch finally throw async await of in typeof instanceof this null undefined true false default yield delete void'.split(' '));
const BI=new Set('console Math JSON Object Array Number String Boolean Promise Date Map Set document window'.split(' '));
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
// groups: 1 comment, 2 string, 3 number, 4 name before "(", 5 other name, 6 operator
const TOK=/(\/\/.*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+\.?\d*\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|([=+\-*/%<>!&|?:]+)/g;
const hi=s=>{let r='',i=0,m;TOK.lastIndex=0;while(m=TOK.exec(s)){const t=m[0],c=m[1]?'com':m[2]?'str':m[3]?'num':m[4]||m[5]?(KW.has(t)?'kw':BI.has(t)?'bi':m[4]?'fn':''):'op';r+=esc(s.slice(i,m.index))+(c?`<span class="${c}">${esc(t)}</span>`:esc(t));i=TOK.lastIndex}return r+esc(s.slice(i))};

// The coloured <pre> sits under a transparent <textarea>; keep text, line numbers and scroll in sync
const sync=()=>{hl.innerHTML=hi(code.value)+'\n ';ln.textContent=code.value.split('\n').map((_,i)=>i+1).join('\n')+'\n '};
code.oninput=()=>{sync();save('cf',code.value)};
code.onscroll=()=>{hl.scrollTop=ln.scrollTop=code.scrollTop;hl.scrollLeft=code.scrollLeft};
code.onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();document.execCommand('insertText',false,'  ')}else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();run()}};

/* ---------- Output panel ---------- */
const fmt=v=>typeof v==='string'?v:v instanceof Error?`${v.name}: ${v.message}`:typeof v==='function'?'ƒ '+v.name:v&&typeof v==='object'?(()=>{try{return JSON.stringify(v,null,2)}catch{return String(v)}})():String(v);
const log=(t,...a)=>{const d=document.createElement('div');d.className='l '+t;d.textContent=a.map(fmt).join(' ');out.append(d);out.scrollTop=out.scrollHeight};

/* ---------- prompt(): a modal that returns a Promise, so the code waits for your answer ---------- */
const ask=(q='',d='')=>new Promise(res=>{const m=$('#pm'),i=$('#pi'),done=v=>{m.classList.remove('on');res(v)};$('#pq').textContent=q;i.value=d;m.classList.add('on');i.focus();
  $('#po').onclick=()=>done(i.value);$('#pc').onclick=()=>done(null);i.onkeydown=e=>{if(e.key==='Enter')done(i.value);if(e.key==='Escape')done(null)}});

/* ---------- Run: compile as an async function, so "await prompt()" can pause it ---------- */
const AF=Object.getPrototypeOf(async()=>{}).constructor;
async function run(){
  out.innerHTML='';stat.className='';stat.textContent='Running...';const src=code.value,t0=performance.now();let err;
  const con={};['log','info','warn','error'].forEach(k=>con[k]=(...a)=>log(k,...a));con.table=con.dir=con.log;
  const pr=async(q,d)=>{const v=await ask(q,d);log('ask',`❓ ${q}  →  ${v}`);return v};
  const nat=(q,d)=>{const v=window.prompt(q,d);log('ask',`❓ ${q}  →  ${v}`);return v};
  try{let f,P=pr;
    // Step 1: turn prompt( into await prompt( . Step 2 (fallback): if that breaks (e.g. prompt inside a normal callback), use the browser's own prompt
    try{f=new AF('console','prompt','alert',src.replace(/\bprompt\s*\(/g,'await prompt('))}catch{f=new AF('console','prompt','alert',src);P=nat}
    await f(con,P,m=>log('info','🔔 '+m))}
  catch(e){err=e;const m=/<anonymous>:(\d+):\d+/.exec(e.stack||'');log('error',`${e.name}: ${e.message}${m?`  (line ${m[1]-2})`:''}`)}
  if(!out.children.length)log('muted','No output. Use console.log() to print a result.');
  stat.className=err?'bad':'ok';stat.textContent=err?'✖ Error':`✔ Finished in ${(performance.now()-t0).toFixed(1)} ms`;explain(err)}
addEventListener('unhandledrejection',e=>log('error','Unhandled: '+fmt(e.reason)));

/* ---------- "How it works": each rule = [pattern, concept tag, explanation] ---------- */
const R=[
[/^\s*\/\/\s*(.*)/,'Comments',m=>`A comment. JavaScript ignores it; it is a note for humans: "${m[1]}".`],
[/(?:const|let|var)\s+(\w+)\s*=\s*(?:Number\(|parseInt\(|parseFloat\()?\s*(?:await\s+)?prompt\(/,'User input',m=>`Shows a prompt dialog and stores the typed answer in "${m[1]}". prompt() returns text, so numbers must be converted.`],
[/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/,'Functions',m=>`Creates an arrow function "${m[1]}". It runs only when you call it.`],
[/function\s+(\w+)\s*\(([^)]*)\)/,'Functions',m=>`Declares function "${m[1]}"${m[2]?` with inputs (${m[2]})`:''}. Its body runs only when you call ${m[1]}().`],
[/class\s+(\w+)/,'Classes',m=>`Defines class "${m[1]}", a blueprint for objects made with new ${m[1]}().`],
[/(const|let|var)\s+(\w+)\s*=/,'Variables',m=>`Declares "${m[2]}" with ${m[1]}${m[1]==='const'?' (cannot be reassigned)':m[1]==='let'?' (can change later)':' (older style, prefer let/const)'} and gives it a value.`],
[/^\s*for\s*\(/,'Loops',()=>'A for loop: start value, condition, step. The block repeats while the condition is true.'],
[/^\s*while\s*\(/,'Loops',()=>'A while loop: repeats the block as long as the condition stays true.'],
[/^\s*(?:\}\s*)?else\s+if|^\s*if\s*\(/,'Conditions',()=>'Checks a condition. The block that follows runs only when it is true.'],
[/^\s*(?:\}\s*)?else\b/,'Conditions',()=>'Runs when none of the earlier conditions were true.'],
[/^\s*switch\s*\(/,'Conditions',()=>'Compares one value against several case labels and runs the matching one.'],
[/\.(map|filter|reduce|forEach|find|some|every)\(/,'Array methods',m=>`Calls .${m[1]}(), which runs a callback on each array item${{map:' and builds a new array of the results',filter:' and keeps only the items that pass the test',reduce:' and combines them into one value',forEach:' (used for side effects like printing)'}[m[1]]||''}.`],
[/console\.(log|info|warn|error)\(/,'Output',m=>`Prints a ${m[1]==='error'?'red error':m[1]==='warn'?'warning':'message'} to the Output panel.`],
[/\balert\(/,'Output',()=>'Shows a message in the Output panel (alert is redirected here).'],
[/\bprompt\(/,'User input',()=>'Asks the user to type a value; the answer comes back as text.'],
[/\b(?:await|async|setTimeout|setInterval)\b|\.then\(/,'Async',()=>'Asynchronous code: it runs later or waits for a Promise, without freezing the page.'],
[/^\s*(?:\}\s*)?try\b|catch\s*\(|\bthrow\b/,'Error handling',()=>'try runs risky code, catch handles any error it throws, throw raises one.'],
[/^\s*return\b/,'Functions',()=>'Sends a value back to the caller and ends the function.']];
const HINT={SyntaxError:'The code is not valid JavaScript. Check for a missing bracket, quote, comma or brace near the last place you edited.',ReferenceError:'A name is used that does not exist. Check the spelling, or declare it with let/const before using it.',TypeError:'A value was used in a way its type does not allow, such as calling something that is not a function or reading a property of undefined.',RangeError:'A number or size is outside the allowed range, for example infinite recursion.'};
function explain(err){
  const rows=[],tags=new Set();
  code.value.split('\n').forEach(l=>{if(/^[\s{}()\];,]*$/.test(l))return;const r=R.find(r=>r[0].test(l));if(r){tags.add(r[1]);rows.push(`<li><code>${esc(l.trim())}</code><span>${r[2](l.match(r[0]))}</span></li>`)}});
  why.innerHTML=(err?`<div class="hint"><b>${esc(err.name)}</b>: ${HINT[err.name]||'The code threw an error while running. Read the message in the Output panel.'}</div>`:'')+
    (rows.length?`<div class="chips">${[...tags].map(t=>`<em>${t}</em>`).join('')}</div><ol>${rows.join('')}</ol><p class="note">JavaScript runs top to bottom, one statement at a time. Functions wait until they are called.</p>`:'<p class="note">Type some code and press Run.</p>')}

/* ---------- Wiring ---------- */
$('#run').onclick=run;
$('#clear').onclick=()=>{code.value='';sync();out.innerHTML='';stat.textContent='';explain()};
$('#theme').onchange=e=>{document.documentElement.dataset.theme=e.target.value;save('cft',e.target.value)};
const th=load('cft');if(th){$('#theme').value=th;document.documentElement.dataset.theme=th}
$('.drawer').onclick=()=>$('#menu').checked=false;
addEventListener('scroll',()=>document.body.classList.toggle('sc',scrollY>30));
document.addEventListener('pointermove',e=>{const c=e.target.closest('.card');if(c){const k=c.getBoundingClientRect();c.style.setProperty('--x',e.clientX-k.left+'px');c.style.setProperty('--y',e.clientY-k.top+'px')}});
document.addEventListener('click',e=>{const b=e.target.closest('.btn');if(!b)return;const r=document.createElement('i'),k=b.getBoundingClientRect();r.className='rip';r.style.cssText=`left:${e.clientX-k.left}px;top:${e.clientY-k.top}px`;b.append(r);setTimeout(()=>r.remove(),600)});
code.value=load('cf')||code.value;sync();explain();