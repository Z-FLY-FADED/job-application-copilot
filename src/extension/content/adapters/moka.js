(() => {
  if(!globalThis.__jobFill || globalThis.__jobFill.mokaVersion==='1.4.0')return;
  const fallback=globalThis.__jobFill;
  const SEL={block:'[class^="apply-block-"]',row:'[class^="apply-field-"]',record:'[class^="apply-fields-"][class*="multi-"]',title:'[class^="title-"]',heading:'[class^="blockTitle-"]',select:'[class*="sd-Select-container-"]',option:'[class*="sd-Menu-content-item-"]'};
  const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
  const primary=s=>{s=String(s||'').trim();return /\p{Script=Han}/u.test(s)?s.replace(/\s*\/\s*[A-Za-z][\s\S]*$/u,'').trim():s;};
  const optionKey=s=>{const n=normalize(primary(s));return ({male:'男',female:'女',china:'中国',master:'硕士',mastersdegree:'硕士',bachelor:'本科',bachelorsdegree:'本科',doctor:'博士',phd:'博士',fulltime:'全日制',parttime:'非全日制',yes:'是',no:'否'})[n]||n;};
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const visible=el=>!!el?.isConnected&&el.getClientRects().length>0&&getComputedStyle(el).visibility==='visible';
  const title=el=>primary(el?.querySelector(SEL.title)?.textContent);
  const heading=block=>{const clone=block.querySelector(SEL.heading)?.cloneNode(true);clone?.querySelectorAll('button').forEach(e=>e.remove());return primary(clone?.textContent).replace(/(?:添加|Add)$/i,'').trim();};
  const supported=()=>!!document.querySelector(`${SEL.block} ${SEL.row}`)&&!!document.querySelector(SEL.select);
  const isSelect=el=>!!el.closest(SEL.select);
  const isCalendar=el=>el.readOnly&&/day_info/.test(el.closest(SEL.row)?.className||'');
  const value=el=>el.type==='checkbox'?String(el.checked):isSelect(el)?(el.closest('label')?.textContent.trim()||''):isCalendar(el)?el.value.match(/^\d{4}-\d{2}(?:-\d{2})?/)?.[0]||'':el.value;
  const emit=(el,text)=>{const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
  let nodes=new Map(),token='',url='',history=[],historyUrl='';
  function describe(el){
    const row=el.closest(SEL.row),block=el.closest(SEL.block);if(!row||!block)return null;
    const base=title(row),context=heading(block),record=el.closest(SEL.record),records=[...block.querySelectorAll(`:scope > ${SEL.record}`)];
    const recordIndex=record?records.indexOf(record):null;
    if(el.type==='checkbox'){
      if(!/教育|实习|项目|在校职务|工作经历|education|work experience|employment|project/i.test(context)||!['至今','Present','Current','Ongoing'].includes(primary(el.closest('label')?.textContent))||!/起止时间|就读时间|period|duration/i.test(base))return null;
      return {labels:['至今'],label:'至今',context,recordIndex,kind:'ongoing',row,base};
    }
    // Dialling-code and document-type selectors are not the phone number or government identifier.
    if(isSelect(el)&&row.querySelector('input:not([type="checkbox"]):not([readonly])')&&/证件号码|身份证|手机|ID number|Mobile|Phone/i.test(base)&&[...row.querySelectorAll('input')].some(i=>!isSelect(i)))return null;
    const inputs=[...row.querySelectorAll('input[type="text"]')],position=inputs.indexOf(el);
    const date=/date_info/.test(row.className)&&position>=0&&(inputs.length===2||inputs.length===4);
    const logical=date&&inputs.length===4?(position<2?'开始时间':'结束时间'):base;
    const datePart=date?(position%2===0?'year':'month'):null;
    return {labels:[logical,...(!date&&el.placeholder?[el.placeholder]:[])],label:logical+(datePart?(datePart==='year'?' · 年':' · 月'):''),context,recordIndex,kind:date?'split-date':isSelect(el)?'custom-select':isCalendar(el)?'calendar':'text',datePart,position:date?position:null,row,base};
  }
  function identity(el){const d=describe(el);return d?JSON.stringify([d.context,d.recordIndex,d.base,d.kind,d.position,el.tagName,el.type]):'';}
  function valid(el){return visible(el)&&!el.disabled&&!el.closest('[inert]')&&(!el.readOnly||isSelect(el)||isCalendar(el));}
  function scan(){
    if(!supported())return fallback.scan();nodes=new Map();token=crypto.randomUUID();url=location.href;
    const fields=[];let truncated=false;
    for(const el of document.querySelectorAll(`${SEL.block} input,${SEL.block} textarea`)){
      if(!valid(el)||!['text','email','tel','url','number','textarea','checkbox'].includes(el.type))continue;
      const d=describe(el);if(!d)continue;if(fields.length>=300){truncated=true;break;}
      const id='m'+fields.length,key=JSON.stringify([d.context,d.recordIndex,d.base,d.kind,d.position]);
      const original=value(el),dateOccupied=d.kind==='split-date'&&[...d.row.querySelectorAll('input[type="text"]')].some(e=>value(e).trim());
      nodes.set(id,{el,key,original,identity:identity(el),d});
      fields.push({id,key,labels:d.labels,label:d.label,context:d.context,recordIndex:d.recordIndex,kind:d.kind,datePart:d.datePart,type:d.kind==='text'?el.type:d.kind,filled:dateOccupied||!!original&&original!=='false',options:[]});
    }
    return {scanId:token,url,scope:location.origin+location.pathname+location.hash.split('?')[0],fields,truncated,blockedFrames:0,canUndo:history.length>0,adapter:'Moka',canPrepare:true};
  }
  async function until(fn,ms=2500){const start=Date.now();while(Date.now()-start<ms){const result=fn();if(result)return result;await delay(50);}throw new Error('网页未确认选择结果，请重新识别或手动选择');}
  function exactOption(el,text){
    const dropdown=el.closest('[class*="sd-Dropdown-container-"]');
    const local=dropdown?[...dropdown.querySelectorAll(SEL.option)].filter(visible):[];
    // Moka mounts menus inside each dropdown. Never consume a different field's open menu.
    const options=dropdown?local:[...document.querySelectorAll(SEL.option)].filter(visible);
    const mainText=e=>{const clone=e.cloneNode(true);clone.querySelectorAll('[class*="sd-Menu-sub-title-"],[class*="option-sub-title-"]').forEach(e=>e.remove());return clone.textContent;};
    const hits=options.filter(e=>optionKey(mainText(e))===optionKey(text)&&!e.closest('[aria-disabled="true"],[disabled],[class*="disabled"],[class*="Disabled"]'));
    if(hits.length>1)throw new Error('存在多个相同选项，请手动选择');return hits[0];
  }
  function targetFor(found,input){
    const {d}=found;
    if(d.kind==='ongoing'){if(!['true','false'].includes(input))throw new Error('至今状态无法确认');return input;}
    if(d.kind==='calendar'){
      if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(input))throw new Error('日历需要明确年月或年月日');
      const [y,m,day]=input.split('-').map(Number);if(m<1||m>12||day!==undefined&&(day<1||day>new Date(y,m,0).getDate()))throw new Error('日期无效');
      return /出生日期|Birth Date|Date of Birth/i.test(d.base)&&!/年月日|year-month-day/i.test(found.el.placeholder)?input.slice(0,7):input;
    }
    if(d.kind==='split-date'){
      const match=input.match(/^(\d{4})(?:-(\d{2}))?(?:-\d{2})?$/);if(!match||!match[2])throw new Error('年月控件需要明确月份，不自动补造');
      return d.datePart==='year'?match[1]:String(Number(match[2]));
    }
    if(d.kind==='custom-select'&&/学历|^Degree$|Education level/i.test(d.base)&&/硕士.*在读|硕士研究生/.test(input))return '硕士';
    if(d.kind==='custom-select'&&/全日制\/非全日制|Full\/Part Time/i.test(d.base)&&input==='全国普通高等院校全日制')return '全日制';
    if(d.kind==='custom-select'&&/级别/.test(d.base))return ({校级:'院校级',院级:'院校级',全国总决赛:'国家级',江苏赛区:'省区级'})[input]||input;
    if(d.kind==='custom-select'&&d.base==='专业排名'){
      const rank=input.match(/^前(\d+(?:\.\d+)?)%$/);if(rank){const interval=[5,10,20,30,50].find(n=>n>=Number(rank[1]));if(interval)return `前${interval}%`;}
    }
    return input;
  }
  async function choose(el,wanted){
    if(optionKey(value(el))===optionKey(wanted))return;
    el.focus();
    const dropdown=el.closest('[class*="sd-Dropdown-container-"]');
    if(!dropdown||![...dropdown.querySelectorAll(SEL.option)].some(visible))(el.closest(SEL.select)||el).click();
    try{
      // Filtering avoids the site's long scrolling menus selecting a different visible item.
      if(!exactOption(el,wanted)&&!el.readOnly)emit(el,wanted);
      const option=await until(()=>exactOption(el,wanted));option.click();
      await until(()=>optionKey(value(el))===optionKey(wanted));
    }finally{
      if(el.value)emit(el,'');
      // A multi-select can remain open. Click its own heading, never another control.
      el.closest(SEL.row)?.querySelector(SEL.title)?.click();await delay(100);
    }
  }
  async function calendar(el,wanted){
    const row=el.closest(SEL.row),dropdown=el.closest('[class*="sd-Dropdown-container-"]');
    if(!dropdown)throw new Error('未知日历结构');
    const find=s=>[...dropdown.querySelectorAll(s)].find(visible);
    const items=()=>[...dropdown.querySelectorAll('[class*="sd-basic-year-item-"]')].filter(e=>visible(e)&&!e.closest('[class*="disabled"],[class*="Disabled"]'));
    const [year,month,day]=wanted.split('-').map(Number);
    el.click();
    try{
      await until(()=>find('[class*="sd-panal-menu-wrapper-"]'));
      const fullDate=!!find('table');
      if(fullDate&&!day)throw new Error('此日历需要完整年月日，不补造日期');
      const header=find('[class*="sd-basic-selector-year-"]');if(!header)throw new Error('未知日历年份控件');header.click();
      let selected=false;
      for(let i=0;i<30;i++){
        const match=items().filter(e=>e.textContent.trim()===String(year));
        if(match.length===1){match[0].click();selected=true;break;}
        const range=(find('[class*="sd-basic-selector-year-"]')?.textContent||'').match(/(\d{4})\s*-\s*(\d{4})/);
        if(!range)throw new Error('未知日历年份范围');
        const before=range[0],direction=year<Number(range[1])?'icondoubleLeft':'icondoubleRight';
        const arrow=find(`[class*="sd-Icon-${direction}-"]`);if(!arrow)throw new Error('日历无法切换年份');arrow.click();
        await until(()=>find('[class*="sd-basic-selector-year-"]')?.textContent.trim()!==before);
      }
      if(!selected)throw new Error('年份超出自动选择范围');
      const months=await until(()=>{const list=items();return list.length===12&&!list.some(e=>/^\d{4}$/.test(e.textContent.trim()))?list:null;});
      months[month-1].click();
      if(fullDate){
        await until(()=>find('table'));
        const dates=[...dropdown.querySelectorAll('[class*="sd-basic-date-item-"]')].filter(e=>visible(e)&&e.textContent.trim()===String(day)&&!e.closest('[class*="fade"],[class*="disabled"],[class*="Disabled"]'));
        if(dates.length!==1)throw new Error('日期不存在或不可选');dates[0].click();
      }
      await until(()=>value(el)===wanted);
    }finally{row.querySelector(SEL.title)?.click();}
  }
  async function write(found,wanted){
    const {el,d}=found;
    if(d.kind==='ongoing'){if(String(el.checked)!==wanted)el.click();}
    else if(d.kind==='custom-select'||d.kind==='split-date')await choose(el,wanted);
    else if(d.kind==='calendar')await calendar(el,wanted);
    else {if(el.maxLength>0&&wanted.length>el.maxLength)throw new Error('内容超过字段长度限制');emit(el,wanted);el.dispatchEvent(new FocusEvent('blur'));}
    await until(()=>isSelect(el)?optionKey(value(el))===optionKey(wanted):normalize(value(el))===normalize(wanted));
  }
  async function fill(request){
    if(!supported())return fallback.fill(request);
    if(request.scanId!==token||location.href!==url)throw new Error('页面已变化，请重新识别');
    const skipped=[],tasks=[],changes=[];let filled=0;
    // All checks happen before changing any date parts. A coupled year widget may reset both months.
    const dates=new Map();
    for(const item of request.items.slice(0,300)){
      const f=nodes.get(item.id);
      try{
        if(!f||f.key!==item.key||!valid(f.el)||identity(f.el)!==f.identity)throw new Error('字段已变化，请重新识别');
        if(typeof item.value!=='string'||!item.value.trim())continue;
        if(isSelect(f.el)&&f.el.value.trim())throw new Error('搜索框仍在编辑，请先结束选择再识别');
        if(value(f.el)!==f.original)throw new Error('预览后内容发生变化，请重新识别');
        if(f.d.kind==='split-date'){
          if(!dates.has(f.d.row))dates.set(f.d.row,{all:[...nodes.values()].filter(n=>n.d.row===f.d.row&&n.d.kind==='split-date'),tasks:[]});
          dates.get(f.d.row).tasks.push({f,wanted:targetFor(f,item.value)});
        }else{
          if(!request.overwrite&&f.original&&f.original!=='false')throw new Error('保留已有内容');
          tasks.push({f,wanted:targetFor(f,item.value)});
        }
      }catch(e){skipped.push(`${f?.d.label||'字段'}：${e.message}`);if(f?.d.kind==='split-date'){if(!dates.has(f.d.row))dates.set(f.d.row,{all:[],tasks:[],error:e.message});else dates.get(f.d.row).error=e.message;}}
    }
    for(const [row,group] of dates){
      if(group.error)continue;
      if(group.all.some(f=>!valid(f.el)||value(f.el)!==f.original)||!request.overwrite&&group.all.some(f=>f.original.trim())){skipped.push(`${title(row)}：保留已有日期或页面已变化`);continue;}
      // Require paired year/month values so a year-only certificate cannot silently become January.
      const positions=group.tasks.map(t=>t.f.d.position);
      if(positions.some(p=>!positions.includes(p%2===0?p+1:p-1))){skipped.push(`${title(row)}：请选择成对的年和月`);continue;}
      tasks.push(...group.tasks.sort((a,b)=>(a.f.d.datePart==='year'?0:1)-(b.f.d.datePart==='year'?0:1)));
    }
    // Put all year selectors before all month selectors, including ranges.
    tasks.sort((a,b)=>((a.f.d.kind==='split-date'?(a.f.d.datePart==='year'?0:2):1))-((b.f.d.kind==='split-date'?(b.f.d.datePart==='year'?0:2):1)));
    for(const task of tasks){
      const {f,wanted}=task;
      try{
        if(location.href!==url||!valid(f.el)||identity(f.el)!==f.identity)throw new Error('页面已变化，请重新识别');
        const before=f.original;if(value(f.el)===wanted&&before===wanted)continue;
        await write(f,wanted);changes.push({f,before,after:value(f.el)});filled++;
      }catch(e){if(value(f.el)!==f.original)changes.push({f,before:f.original,after:value(f.el)});skipped.push(`${f.d.label}：${e.message}`);}
    }
    for(const {f,wanted} of tasks)if(f.d.kind==='split-date'&&normalize(value(f.el))!==normalize(wanted))skipped.push(`${f.d.label}：日期被网页联动修改，请检查`);
    if(changes.length){history=changes;historyUrl=location.href;}
    return {filled,skipped,canUndo:history.length>0};
  }
  async function undo(){
    if(!supported())return fallback.undo();let restored=0,skipped=0;
    for(const change of history){const {f,before,after}=change;
      try{
        if(location.href!==historyUrl||!valid(f.el)||identity(f.el)!==f.identity||value(f.el)!==after)throw new Error('字段已变化');
        if(!before&&(isSelect(f.el)||isCalendar(f.el))){
          const clear=f.el.closest('label')?.querySelector('[aria-label="清空"],[aria-label="Clear"],[class*="clear-icon"],[class*="clearIcon"]');
          if(!clear)throw new Error('此自定义控件没有清空按钮');clear.click();await until(()=>!value(f.el));
        }else await write(f,before);
        restored++;
      }catch{skipped++;}
    }
    history=[];return {restored,skipped};
  }
  async function prepare(counts){
    if(!supported())throw new Error('此页面不支持自动添加记录');let added=0;
    const names={education:['教育背景','Education','Education background'],experience:['实习经历','工作经历','Work experience','Employment history'],projects:['项目经验','项目经历','Project experience','Projects'],awards:['获奖经历','Awards','Honors'],campusRoles:['在校职务','Campus roles','Student leadership']};
    for(const [key,aliases] of Object.entries(names)){
      const matches=[...document.querySelectorAll(SEL.block)].filter(b=>aliases.some(n=>normalize(heading(b))===normalize(n)));if(matches.length!==1)continue;
      const block=matches[0],name=heading(block);
      const desired=Math.min(key==='awards'?80:20,Math.max(0,Number(counts[key])||0));
      const records=()=>block.querySelectorAll(`:scope > ${SEL.record}`).length;
      while(records()<desired){const count=records();const button=[...block.querySelector(SEL.heading).querySelectorAll('button')].find(b=>/添加|\bAdd\b/i.test(b.textContent));
        if(!button||button.disabled)throw new Error(`${name}无法继续添加`);button.click();await until(()=>records()>count);added++;}
    }
    return {added};
  }
  globalThis.__jobFill={...fallback,scan,fill,undo,prepare,mokaVersion:'1.4.0'};
})();
