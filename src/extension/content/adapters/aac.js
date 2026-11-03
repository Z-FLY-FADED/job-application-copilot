(() => {
 if(!globalThis.__jobFill||globalThis.__jobFill.aacVersion==='1.6.0')return;
 const fallback=globalThis.__jobFill,S='[class*="createFormSection__"]';
 const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
 const visible=e=>!!e?.isConnected&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
 const delay=n=>new Promise(r=>setTimeout(r,n));
 async function until(fn){const end=Date.now()+3000;while(Date.now()<end){const r=fn();if(r)return r;await delay(40);}throw new Error('网页未确认结果，请核对后重新识别');}
 const supported=()=>!!document.querySelector(`${S} .atsx-form-item`)&&!!document.querySelector('.createFormSection-left');
 const title=p=>p?.querySelector('.createFormSection-left')?.textContent.trim()||'';
 const label=r=>{const l=r.querySelector('.atsx-form-item-label label');return (l?.querySelector('.customResumeForm-fieldName')||l)?.textContent.trim().replace(/\*$/,'')||'';};
 function anchor(record){
  for(const [suffix,field] of [['.school','school'],['.company','company'],['.name','name'],['.title','name']]){
   const el=[...record.querySelectorAll('input[id]')].find(e=>e.id.endsWith(suffix));
   if(el?.value)return {field,value:el.value};
  }return null;
 }
 function describe(el,kind,part){
  const row=el.closest('.atsx-form-item'),panel=row?.closest(S);if(!row||!panel)return null;
  const record=el.closest('.resumeEditForm-item'),index=record?[...panel.querySelectorAll('.resumeEditForm-item')].indexOf(record):null;
  return {row,panel,context:title(panel),label:kind==='range'?(part?'结束时间':'开始时间'):label(row),kind,part,recordIndex:index,recordAnchor:record?anchor(record):null};
 }
 function read(f){
  const {el,d}=f;
  if(d.kind==='range'){const s=el.textContent.replace(/\s/g,'');return /^\d{4}-\d{2}$/.test(s)?s:s==='至今'?'至今':'';}
  if(d.kind==='select')return el.querySelector('.atsx-select-selection-selected-value')?.textContent.trim()||el.querySelector('input')?.value||'';
  return el.value||'';
 }
 const identity=f=>{const p=f.el.closest(S),r=f.el.closest('.resumeEditForm-item'),index=r?[...p.querySelectorAll('.resumeEditForm-item')].indexOf(r):null;return JSON.stringify([title(p),index,f.d.label,f.d.kind,f.d.part,f.el.id||f.el.getAttribute('data-cy')]);};
 const valid=f=>visible(f.el)&&!f.el.disabled&&!f.el.closest('[inert]');
 const emit=(el,s)=>{const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(el,s);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
 let nodes=new Map(),token='',url='',history=[],historyUrl='';
 function scan(){
  if(!supported())return fallback.scan();nodes=new Map();token=crypto.randomUUID();url=location.href;const fields=[];let truncated=false;
  function add(el,kind,part){if(!visible(el)||el.disabled||fields.length>=300){if(fields.length>=300)truncated=true;return;}const d=describe(el,kind,part);if(!d?.label)return;const f={el,d};f.key=identity(f);f.original=read(f);const id='a'+fields.length;nodes.set(id,f);fields.push({id,key:f.key,label:d.label,labels:[d.label],context:d.context,recordIndex:d.recordIndex,recordAnchor:d.recordAnchor,kind,type:kind,filled:!!f.original,options:[]});}
  for(const row of document.querySelectorAll(`${S} .atsx-form-item`)){
   const period=row.querySelector('.atsx-date-picker-period-month');
   if(period){[...period.querySelectorAll('.atsx-date-picker-period-month-label')].forEach((el,i)=>add(el,'range',i));continue;}
   const combo=row.querySelector('[role=combobox]');if(combo){if(!combo.closest('.atsx-select')?.classList.contains('atsx-select-selection--multiple')&&!combo.classList.contains('atsx-select-selection--multiple'))add(combo,'select');continue;}
   for(const el of row.querySelectorAll('input,textarea'))if(['text','email','tel','textarea','number'].includes(el.type)&&!el.readOnly&&!el.closest('.atsx-select,.atsx-upload,.ud__upload'))add(el,el.closest('.atsx-date-picker')?'month':'text');
  }
  return {scanId:token,url,scope:location.origin+location.pathname,fields,truncated,blockedFrames:0,canUndo:history.length>0,canPrepare:true,adapter:'AAC / ATSX'};
 }
 function target(f,s){
  if(f.d.kind==='range'||f.d.kind==='month'){if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(s)||Number(s.slice(5,7))<1||Number(s.slice(5,7))>12)throw new Error('需要明确年月，不补造月份');return s.slice(0,7);}
  if(f.d.kind==='select'&&f.d.label==='学历'&&/硕士研究生|硕士.*在读/.test(s))return '硕士';
  if(f.d.kind==='select'&&f.d.label==='培养模式'&&s==='全国普通高等院校全日制')return '全日制';
  if(f.d.kind==='select'&&f.d.label==='英语水平'&&/四级|CET.?4/i.test(s))return 'CET4';return s;
 }
 async function close(f){f.d.row.querySelector('.atsx-form-item-label')?.click();await delay(60);}
 async function write(f,s){
  if(f.d.kind==='select'){
   await close(f);f.el.click();
   try{const menu=await until(()=>{const el=document.getElementById(f.el.getAttribute('aria-controls'));return visible(el)?el:null;});
    const find=()=>[...menu.querySelectorAll('[role=option]')].filter(e=>visible(e)&&norm(e.textContent)===norm(s)&&!e.matches('[aria-disabled=true],.atsx-select-dropdown-menu-item-disabled'));
    let options=find();if(!options.length){const input=f.el.querySelector('input');if(input)emit(input,s);options=await until(()=>{const a=find();return a.length?a:null;});}
    if(options.length!==1)throw new Error('选项缺失或重名，请手动确认');options[0].click();await until(()=>norm(read(f))===norm(s));
   }finally{const input=f.el.querySelector('input');if(input&&read(f)!==s&&input.value===s)emit(input,'');await close(f);}
  }else if(f.d.kind==='range'){
   await close(f);f.el.click();
   try{const panel=await until(()=>{const es=[...document.querySelectorAll('.atsx-date-picker-period-month-panel')].filter(visible);return es.length===1?es[0]:null;});
    for(const value of [s.slice(0,4),s.slice(5)]){const hits=[...panel.querySelectorAll('.atsx-date-picker-period-month-panel-list-item')].filter(e=>visible(e)&&e.textContent.trim()===value&&!/disabled/.test(e.className));if(hits.length!==1)throw new Error('年份或月份不能唯一选择');hits[0].click();await delay(60);}
    await until(()=>read(f)===s);
   }finally{await close(f);}
  }else{
   if(f.el.maxLength>0&&s.length>f.el.maxLength)throw new Error('超出长度限制');emit(f.el,s);
   if(f.d.kind==='month'){f.el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));f.el.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',code:'Enter',bubbles:true}));}
   f.el.blur();await close(f);await until(()=>norm(read(f))===norm(s));
  }
 }
 async function fill(request){
  if(!supported())return fallback.fill(request);if(request.scanId!==token||location.href!==url)throw new Error('页面已变化，请重新识别');const skipped=[],changes=[];let filled=0;
  for(const item of request.items.slice(0,300)){const f=nodes.get(item.id);try{
   if(!f||item.key!==f.key||!valid(f)||identity(f)!==f.key)throw new Error('字段已变化');if(typeof item.value!=='string'||!item.value.trim())continue;
   if(read(f)!==f.original)throw new Error('预览后用户已修改');if(!request.overwrite&&f.original)throw new Error('保留已有内容');const wanted=target(f,item.value);if(read(f)===wanted)continue;await write(f,wanted);filled++;
  }catch(e){skipped.push(`${f?.d.label||'字段'}：${e.message}`);}finally{if(f&&read(f)!==f.original)changes.push({f,before:f.original,after:read(f)});}}
  if(changes.length){history=changes;historyUrl=location.href;}return {filled,skipped,canUndo:history.length>0};
 }
 async function undo(){if(!supported())return fallback.undo();let restored=0,skipped=0;for(const c of [...history].reverse())try{
  if(location.href!==historyUrl||!valid(c.f)||identity(c.f)!==c.f.key||read(c.f)!==c.after)throw new Error('已变化');
  if(!c.before&&['range','select'].includes(c.f.d.kind))throw new Error('此控件需手动清空');await write(c.f,c.before);restored++;
 }catch{skipped++;}history=[];return {restored,skipped};}
 async function prepare(counts){if(!supported())return fallback.prepare(counts);let added=0;
  for(const [key,name] of Object.entries({education:'教育经历',experience:'实习经历',projects:'项目经历',awards:'获奖'})){
   const matches=[...document.querySelectorAll(S)].filter(p=>title(p)===name);if(matches.length!==1)continue;const p=matches[0],size=()=>p.querySelectorAll('.resumeEditForm-item').length,desired=Math.min(key==='awards'?80:20,Math.max(0,Number(counts[key])||0));
   while(size()<desired){const before=size(),buttons=[...p.querySelectorAll('button,a,span,div')].filter(e=>visible(e)&&e.children.length===0&&e.textContent.trim()==='添加');if(buttons.length!==1)throw new Error(name+'添加入口不唯一');buttons[0].click();await until(()=>size()===before+1);added++;}
  }return {added};}
 globalThis.__jobFill={...fallback,scan,fill,undo,prepare,aacVersion:'1.6.0'};
})();
