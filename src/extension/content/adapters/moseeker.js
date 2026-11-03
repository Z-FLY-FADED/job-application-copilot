(() => {
  if(!globalThis.__jobFill||globalThis.__jobFill.moseekerVersion==='1.5.0')return;
  const fallback=globalThis.__jobFill;
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
  const visible=e=>!!e?.isConnected&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
  const delay=n=>new Promise(r=>setTimeout(r,n));
  async function until(fn){const end=Date.now()+3000;while(Date.now()<end){const r=fn();if(r)return r;await delay(40);}throw new Error('网页未确认结果，请检查后重新识别');}
  const supported=()=>!!document.querySelector('.ResumePanel .VeFormItem')&&!!document.querySelector('.ResumePanel__title');
  const label=r=>{const copy=r?.querySelector(':scope > .VeFormItem__top > .VeFormItem-label')?.cloneNode(true);copy?.querySelectorAll('.VeFormItem__asterisk,.VeFormItem__label-right').forEach(e=>e.remove());return copy?.textContent.trim().replace(/\*$/,'').trim()||'';};
  function rowFor(el){let r=el.closest('.VeFormItem');while(r&&!label(r))r=r.parentElement?.closest('.VeFormItem');return r;}
  const title=p=>p.querySelector('.ResumePanel__title')?.textContent.trim()||'';
  const read=el=>el.type==='checkbox'?String(el.checked):el.value;
  function describe(el){
    const panel=el.closest('.ResumePanel'),row=rowFor(el);if(!panel||!row)return null;
    const base=label(row),context=title(panel),record=el.closest('.Ve-RepeatPanel__block');
    const recordIndex=record?[...panel.querySelectorAll('.Ve-RepeatPanel__block')].indexOf(record):null;
    if(!base||el.closest('.el-popper,.cp-search-bar'))return null;
    if(el.type==='checkbox'){
      if(!/教育|工作|实习|项目|在校职务/.test(context)||!/^至今$/.test(base)||el.closest('label')?.textContent.trim()!=='至今')return null;
      return {kind:'ongoing',label:'至今',context,recordIndex,row,panel};
    }
    if(el.closest('.el-select')&&(/手机|电话|学校名/.test(base)||el.closest('.VeCollegeField')))return null;
    const calendar=el.closest('.el-date-editor--month'),auto=el.closest('.el-autocomplete'),select=el.closest('.el-select');
    const city=el.closest('.el-popover__reference')?.getAttribute('aria-describedby');
    if(el.readOnly&&!select&&!city)return null;
    return {kind:calendar?'month-picker':auto?'autocomplete':select?'custom-select':city?'city-picker':'text',label:base,context,recordIndex,row,panel,city};
  }
  const valid=el=>visible(el)&&!el.disabled&&!el.closest('[inert]')&&['text','email','tel','url','number','textarea','checkbox'].includes(el.type)&&!!describe(el);
  const identity=el=>{const d=describe(el);return d?JSON.stringify([d.context,d.recordIndex,d.label,d.kind,el.id,el.type]):'';};
  const emit=(el,s)=>{const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,s);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
  let nodes=new Map(),token='',url='',history=[],historyUrl='';
  function scan(){
    if(!supported())return fallback.scan();nodes=new Map();token=crypto.randomUUID();url=location.href;const fields=[];let truncated=false;
    for(const el of document.querySelectorAll('.ResumePanel input,.ResumePanel textarea')){
      if(!valid(el))continue;if(fields.length>=300){truncated=true;break;}const d=describe(el),id='q'+fields.length,key=identity(el),original=read(el);
      nodes.set(id,{el,d,key,original});fields.push({id,key,labels:[d.label],label:d.label,context:d.context,recordIndex:d.recordIndex,kind:d.kind,type:d.kind==='text'?el.type:d.kind,filled:!!original&&original!=='false',options:[]});
    }
    return {scanId:token,url,scope:location.origin+location.pathname,fields,truncated,blockedFrames:0,canUndo:history.length>0,canPrepare:true,adapter:'MoSeeker'};
  }
  async function close(found){found.d.row.querySelector('.VeFormItem-label')?.click();await delay(60);}
  async function popup(found,selector){
    await close(found);const previous=new Set([...document.querySelectorAll(selector)].filter(visible));found.el.click();
    return until(()=>{const fresh=[...document.querySelectorAll(selector)].filter(e=>visible(e)&&!previous.has(e));if(fresh.length>1)throw new Error('出现多个菜单，无法确定对应控件');return fresh[0];});
  }
  function target(f,input){
    if(f.d.kind==='ongoing'){if(!['true','false'].includes(input))throw new Error('至今状态不明确');return input;}
    if(f.d.kind==='month-picker'){
      if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(input)||Number(input.slice(5,7))<1||Number(input.slice(5,7))>12)throw new Error('月份控件需要明确年月，不补造月份');
      return input.slice(0,7);
    }
    return f.d.kind==='custom-select'&&f.d.label==='学历'&&/硕士研究生|硕士.*在读/.test(input)?'硕士':input;
  }
  async function select(f,wanted){
    const menu=await popup(f,'.el-select-dropdown');
    try{
      let hits=[...menu.querySelectorAll('.el-select-dropdown__item')].filter(e=>visible(e)&&norm(e.textContent)===norm(wanted)&&!e.classList.contains('is-disabled')&&!e.classList.contains('disabled'));
      if(!hits.length&&!f.el.readOnly){emit(f.el,wanted);hits=await until(()=>{const list=[...menu.querySelectorAll('.el-select-dropdown__item')].filter(e=>visible(e)&&norm(e.textContent)===norm(wanted)&&!e.matches('.is-disabled,.disabled'));return list.length?list:null;});}
      if(hits.length!==1)throw new Error('选项缺失或重名，请手动选择');hits[0].click();await until(()=>norm(read(f.el))===norm(wanted));
    }finally{await close(f);}
  }
  async function autocomplete(f,wanted){
    await close(f);f.el.focus();emit(f.el,wanted);
    try{
      const menu=await until(()=>{
        const id=f.el.getAttribute('aria-controls')||f.el.getAttribute('aria-owns');
        if(id){const list=document.getElementById(id);if(visible(list))return list;}
        const list=[...document.querySelectorAll('.el-autocomplete-suggestion')].filter(visible);if(list.length>1)throw new Error('无法确定搜索建议归属');return list[0];
      });
      const hits=await until(()=>{const hits=[...menu.querySelectorAll('li')].filter(e=>visible(e)&&norm(e.textContent)===norm(wanted));return hits.length?hits:null;});
      if(hits.length!==1)throw new Error('搜索建议重名，请手动选择');hits[0].click();await until(()=>norm(read(f.el))===norm(wanted));
    }catch(e){emit(f.el,f.original);throw new Error('没有唯一的真实搜索建议；保留原值，请手动确认');}
    finally{await close(f);}
  }
  async function month(f,wanted){
    const menu=await popup(f,'.el-picker-panel');
    try{
      const header=[...menu.querySelectorAll('.el-date-picker__header-label')].find(visible);if(!header)throw new Error('未知年月面板');header.click();
      const y=wanted.slice(0,4);let selected=false;
      for(let i=0;i<30;i++){
        const table=await until(()=>[...menu.querySelectorAll('.el-year-table')].find(visible));
        const cells=[...table.querySelectorAll('td')].filter(e=>/^\d{4}$/.test(e.textContent.trim()));
        const match=cells.find(e=>e.textContent.trim()===y);
        if(match){if(match.classList.contains('disabled'))throw new Error('网站禁止选择该年份');match.querySelector('.cell').click();selected=true;break;}
        const years=cells.map(e=>Number(e.textContent.trim())),before=table.textContent,prev=Number(y)<Math.min(...years);
        const button=menu.querySelector(prev?'.el-icon-d-arrow-left':'.el-icon-d-arrow-right');if(!button)throw new Error('年份无法切换');button.click();await until(()=>[...menu.querySelectorAll('.el-year-table')].find(visible)?.textContent!==before);
      }
      if(!selected)throw new Error('年份超出自动选择范围');
      const table=await until(()=>[...menu.querySelectorAll('.el-month-table')].find(visible)),cells=[...table.querySelectorAll('td')],cell=cells[Number(wanted.slice(5))-1];
      if(!cell||cell.classList.contains('disabled'))throw new Error('网站禁止选择该月份');cell.querySelector('.cell').click();await until(()=>read(f.el)===wanted);
    }finally{await close(f);}
  }
  const cityKey=s=>norm(s).replace(/市$/,'');
  async function city(f,wanted){
    const parts=wanted.match(/[^省市区县]+(?:自治区|省|市|区|县)/g);
    if(!parts||parts.length!==2||!parts[0].endsWith('省')||!parts[1].endsWith('市'))throw new Error('城市自动选择需明确省、市，其他格式请手动选择');
    await close(f);f.el.click();
    try{
      const menu=await until(()=>{const p=document.getElementById(f.d.city);return visible(p)?p:null;});
      const provinces=[...menu.querySelectorAll('.el-tree > .el-tree-node')].filter(n=>norm(n.querySelector(':scope > .el-tree-node__content .custom-tree-node')?.textContent)===norm(parts[0]));
      if(provinces.length!==1)throw new Error('省份未唯一匹配');const province=provinces[0];
      if(province.getAttribute('aria-expanded')!=='true')province.querySelector(':scope > .el-tree-node__content .el-tree-node__expand-icon')?.click();
      const hits=await until(()=>{const list=[...province.querySelectorAll('.el-tree-node__children .el-tree-node__content')].filter(e=>visible(e)&&cityKey(e.querySelector('.custom-tree-node')?.textContent)===cityKey(parts[1]));return list.length?list:null;});
      if(hits.length!==1)throw new Error('城市重名，请手动选择');hits[0].querySelector('.custom-tree-node').click();await until(()=>cityKey(read(f.el)).endsWith(cityKey(parts[1])));
    }finally{await close(f);}
  }
  async function write(f,wanted){
    if(f.d.kind==='ongoing'){if(read(f.el)!==wanted)f.el.click();}
    else if(f.d.kind==='custom-select')await select(f,wanted);
    else if(f.d.kind==='autocomplete')await autocomplete(f,wanted);
    else if(f.d.kind==='month-picker')await month(f,wanted);
    else if(f.d.kind==='city-picker')await city(f,wanted);
    else{if(f.el.maxLength>0&&wanted.length>f.el.maxLength)throw new Error('内容超出长度限制');emit(f.el,wanted);f.el.blur();}
    await until(()=>f.d.kind==='city-picker'?cityKey(read(f.el)).endsWith(cityKey(wanted.match(/[^省]+省(.+)/)?.[1]||wanted)):norm(read(f.el))===norm(wanted));
  }
  async function fill(request){
    if(!supported())return fallback.fill(request);if(request.scanId!==token||location.href!==url)throw new Error('页面已变化，请重新识别');
    const skipped=[],changes=[],tasks=[];let filled=0;
    for(const item of request.items.slice(0,300)){
      const f=nodes.get(item.id);try{
        if(!f||f.key!==item.key||!valid(f.el)||identity(f.el)!==f.key)throw new Error('字段含义或位置已变化');
        if(typeof item.value!=='string'||!item.value.trim())continue;
        if(read(f.el)!==f.original)throw new Error('预览后已修改，请重新识别');
        if(!request.overwrite&&f.original&&f.original!=='false')throw new Error('保留已有内容');
        tasks.push({f,wanted:target(f,item.value)});
      }catch(e){skipped.push(`${f?.d.label||'字段'}：${e.message}`);}
    }
    tasks.sort((a,b)=>(a.f.d.kind==='ongoing'?1:0)-(b.f.d.kind==='ongoing'?1:0));
    for(const {f,wanted} of tasks){try{
      if(location.href!==url||!valid(f.el)||identity(f.el)!==f.key||read(f.el)!==f.original)throw new Error('页面已变化，请重新识别');
      if(read(f.el)===wanted)continue;await write(f,wanted);filled++;
    }catch(e){skipped.push(`${f.d.label}：${e.message}`);}
    finally{if(read(f.el)!==f.original)changes.push({f,before:f.original,after:read(f.el)});}}
    if(changes.length){history=changes;historyUrl=location.href;}return {filled,skipped,canUndo:history.length>0};
  }
  async function undo(){
    if(!supported())return fallback.undo();let restored=0,skipped=0;
    for(const {f,before,after} of [...history].reverse())try{
      if(location.href!==historyUrl||!valid(f.el)||identity(f.el)!==f.key||read(f.el)!==after)throw new Error('字段已变化');
      if(!before&&['custom-select','month-picker','city-picker','autocomplete'].includes(f.d.kind)){
        const clear=[...f.d.row.querySelectorAll('.el-icon-circle-close,.el-icon-close')].find(visible);if(!clear)throw new Error('没有清空按钮，请手动恢复');clear.click();await until(()=>!read(f.el));
      }else await write(f,before);restored++;
    }catch{skipped++;}history=[];return {restored,skipped};
  }
  async function prepare(counts){
    if(!supported())return fallback.prepare(counts);let added=0;
    for(const [key,names] of Object.entries({education:['教育经历','教育背景'],experience:['工作经历','实习经历'],projects:['项目经历','项目经验'],awards:['获奖经历'],campusRoles:['在校职务']})){
      const matches=[...document.querySelectorAll('.ResumePanel')].filter(p=>names.includes(title(p)));if(matches.length!==1)continue;const p=matches[0];
      if(p.querySelector('.ResumePanel__header-right input[type=checkbox]:checked'))continue;
      const desired=Math.min(key==='awards'?80:20,Math.max(0,Number(counts[key])||0)),size=()=>p.querySelectorAll('.Ve-RepeatPanel__block').length;
      while(size()<desired){const before=size(),buttons=[...p.querySelectorAll('button')].filter(b=>visible(b)&&/添加一条/.test(b.textContent));if(buttons.length!==1||buttons[0].disabled)throw new Error(`${title(p)}无法继续添加`);buttons[0].click();await until(()=>size()===before+1);added++;}
    }return {added};
  }
  globalThis.__jobFill={...fallback,scan,fill,undo,prepare,moseekerVersion:'1.5.0'};
})();
