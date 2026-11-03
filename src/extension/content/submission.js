(() => {
 if(!globalThis.__jobFill||globalThis.__jobFill.submissionVersion==='1.6.0')return;
 const fallback=globalThis.__jobFill;
 const visible=e=>!!e?.isConnected&&e.getClientRects().length>0&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
 const text=e=>(e?.innerText||e?.textContent||'').replace(/\s+/g,' ').trim();
 let checked=null,lastAttempt=null;
 const fingerprint=()=>JSON.stringify([...document.querySelectorAll('input,textarea,select,[role=combobox],.atsx-date-picker-period-month-label')].filter(e=>visible(e)&&e.type!=='hidden').map(e=>[e.id,e.type,e.type==='checkbox'||e.type==='radio'?e.checked:e.value??text(e)]));
 function target(){
  let platform='',labels=[];
  if(document.querySelector('[class^="apply-block-"] [class^="apply-field-"]')){platform='Moka';labels=['确认提交','Confirm submit','预览并提交','Preview and submit'];}
  else if(document.querySelector('.ResumePanel .VeFormItem')){platform='仟寻';labels=['提交申请'];}
  else if(document.querySelector('.atsx-form-item')&&document.querySelector('.createFormSection-left')){platform='瑞声 / ATSX';labels=['提交简历'];}
  if(!platform)return {platform:'',error:'此系统尚无经过适配的提交入口，请在网页手动提交'};
  for(const name of labels){const candidates=[...document.querySelectorAll('button,input[type=submit]')].filter(e=>{const s=text(e)||e.value,main=/\p{Script=Han}/u.test(s)?s.split(/\s+\/\s+/)[0]:s;return visible(e)&&main.toLowerCase()===name.toLowerCase();});if(candidates.length>1)return {platform,error:'存在多个同名提交入口，请在网页确认'};if(candidates.length===1)return {platform,button:candidates[0],name,phase:/确认提交|Confirm submit/.test(name)?'confirm':/预览|Preview/.test(name)?'preview':'direct'};}
  return {platform,error:'当前未发现可用提交入口，请检查是否已投递或需要切换页面'};
 }
 function label(row){return text(row.querySelector('.customResumeForm-fieldName,.atsx-form-item-label label,.VeFormItem-label,[class^="title-"]')).replace(/\*$/,'').trim()||'必填项';}
 function content(el){
  if(el.type==='checkbox'||el.type==='radio')return el.checked;
  if(el.getAttribute('role')==='combobox')return !!text(el.querySelector('.atsx-select-selection-selected-value,.atsx-select-selection__choice__content'))||!!el.querySelector('input')?.value;
  if(el.closest('[class*="sd-Select-container-"]'))return !!text(el.closest('label')).replace(/[\ue000-\uf8ff]/g,'').trim();
  return !!el.value?.trim();
 }
 function missing(row){
  const periods=[...row.querySelectorAll('.atsx-date-picker-period-month-label')];if(periods.length)return periods.some(e=>!/^\d{4}-\d{2}$|^至今$/.test(text(e).replace(/\s/g,'')));
  const combos=[...row.querySelectorAll('[role=combobox]')].filter(visible);if(combos.length)return combos.some(e=>!content(e));
  let controls=[...row.querySelectorAll('input,textarea,select')].filter(e=>visible(e)&&e.type!=='hidden'&&e.type!=='file'&&!e.disabled);
  if(controls.some(e=>!['checkbox','radio'].includes(e.type)))controls=controls.filter(e=>!['checkbox','radio'].includes(e.type));
  const files=[...row.querySelectorAll('input[type=file]')];if(files.length){if(files.some(e=>e.files?.length))return false;return ![...row.querySelectorAll('button,a,.el-upload-list__item,.atsx-upload-list-item')].some(e=>visible(e)&&(/\.(pdf|docx?|pptx?|jpg|png|jpeg)\b/i.test(text(e))||e.matches('.el-upload-list__item,.atsx-upload-list-item')));}
  return controls.length?controls.some(e=>!content(e)):false;
 }
 function issues(){const out=[];
  const rows=[...document.querySelectorAll('.atsx-form-item,.VeFormItem,[class^="apply-field-"]')].filter(visible);
  for(const row of rows){
   const required=row.classList.contains('VeFormItem--required')||!!row.querySelector('.atsx-form-item-required,[class^="title-"] [class*="required"]');
   if(required&&missing(row))out.push('请补齐：'+label(row));
  }
  for(const el of document.querySelectorAll('input[required],textarea[required],select[required]'))if(visible(el)&&!el.disabled&&!el.checkValidity())out.push('请检查：'+(el.getAttribute('aria-label')||el.name||'必填内容'));
  for(const box of document.querySelectorAll('input[type=checkbox]'))if(visible(box)&&!box.checked){const scope=box.closest('label')||box.parentElement;let s=text(scope);if(s.length<5)s=text(scope.parentElement);if(/我已阅读|隐私|本人承诺|I DECLARE|privacy|同意.*协议/i.test(s))out.push('请在网页核对并确认：'+s.slice(0,70));}
  for(const el of document.querySelectorAll('.atsx-form-explain,.el-form-item__error,.VeFormItem-error'))if(visible(el)&&text(el))out.push('网页校验：'+text(el).slice(0,100));
  for(const el of document.querySelectorAll('[role=combobox][aria-expanded=true]'))if(visible(el))out.push('请先完成下拉选择并关闭菜单');
  if([...document.querySelectorAll('iframe[src*="captcha"],iframe[src*="recaptcha"],.yidun_popup')].some(visible)||/请完成安全验证|向右拖动滑块填充拼图/.test(document.body.innerText))out.push('请先在网页完成安全验证');
  return [...new Set(out)];
 }
 function checkSubmission(){
  const t=target(),problems=t.error?[t.error]:issues();const fp=fingerprint();
  if(t.button?.disabled||t.button?.getAttribute('aria-disabled')==='true')problems.push('提交按钮当前不可用，请等待网页校验');
  if(lastAttempt&&lastAttempt.url===location.href&&lastAttempt.button===t.button&&lastAttempt.fp===fp)problems.push('本次已触发提交，请先在网页核实结果，避免重复投递');
  checked={token:crypto.randomUUID(),url:location.href,fp,...t};
  return {token:checked.token,platform:t.platform,url:location.href,phase:t.phase,ready:!problems.length,issues:problems,action:t.phase==='preview'?'打开提交预览':t.phase==='confirm'?'确认提交当前申请':'提交当前申请'};
 }
 function submit(request){
  if(!checked||request?.token!==checked.token||location.href!==checked.url)throw new Error('提交检查已失效，请重新检查');
  const {button,fp}=checked,t=target();if(fingerprint()!==fp||t.button!==button||!visible(button))throw new Error('网页内容或提交步骤已变化，请重新检查');
  const current=checkSubmission();if(!current.ready)throw new Error(current.issues.join('\n'));
  lastAttempt={url:location.href,button,fp};checked=null;button.click();return {triggered:true,phase:t.phase,message:t.phase==='preview'?'已打开预览，请核对后再次检查并确认提交':'已触发提交，请在网页核实结果；如出现验证码，请先完成验证'};
 }
 globalThis.__jobFill={...fallback,checkSubmission,submit,submissionVersion:'1.6.0'};
})();
