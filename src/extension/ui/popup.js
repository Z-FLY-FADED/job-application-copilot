import { CONTENT_SCRIPTS } from '../shared/config.js';
import {loadProfile,entries,suggest} from '../shared/schema.js';
const $=id=>document.getElementById(id);
let tabId, snapshot, all=[], mappings=[], busy=false,submission=null;
const message=(value,error=false)=>{$('status').textContent=value;$('status').classList.toggle('error',error);};
function buttons() {
  $('scan').disabled=busy; $('fill').disabled=busy||!snapshot||!document.querySelector('#fields select[data-id] option:checked[value]:not([value=""])');
  $('undo').disabled=busy||!snapshot?.canUndo;
  $('forget').disabled=busy||!snapshot;
  $('prepare').disabled=busy||!snapshot?.canPrepare;
  $('check-submit').disabled=busy;
  $('submit-current').disabled=busy||!submission?.ready;
}
async function run(action) {if(busy)return;busy=true;buttons();try{await action();}catch(e){message(friendly(e),true);}finally{busy=false;buttons();}}
function friendly(e) {const text=String(e.message||e);return /Cannot access|Cannot read|Missing host|extensions gallery|chrome:\/\/|edge:\/\/|Frame with ID|No tab with id/i.test(text)?'无法访问此页面。请切换到招聘网站的申请表，再点击插件；本地文件需在扩展详情开启“允许访问文件网址”。':text;}
async function engine(method,payload) {
  const results=await chrome.scripting.executeScript({target:{tabId},func:async(name,arg)=>{try{if(!globalThis.__jobFill)throw new Error('页面已刷新，请重新识别');return {ok:true,value:await globalThis.__jobFill[name](arg)};}catch(e){return {ok:false,message:e.message};}},args:[method,payload??null]});
  if(!results[0]?.result) throw new Error('页面没有返回结果，请重新识别');
  if(!results[0].result.ok)throw new Error(results[0].result.message);
  return results[0].result.value;
}
function render(saved) {
  document.body.classList.add('has-scan');
  $('fields').replaceChildren();
  const guesses=snapshot.fields.map(field=>suggest(field,all));
  // Repeated unnumbered sections are ambiguous. Ask the user to choose the correct record.
  const duplicates=new Set(guesses.filter((key,i)=>key&&snapshot.fields[i].recordIndex==null&&!key.startsWith('basic.')&&!key.startsWith('aggregate.')&&guesses.findIndex((other,j)=>other===key&&snapshot.fields[j].recordIndex==null)!==i));
  snapshot.fields.forEach((field,i)=>{
    const card=document.createElement('div');card.className='field';
    const title=document.createElement('strong');title.textContent=field.label;
    const note=document.createElement('div');note.className='muted';note.textContent=[field.context,field.filled?'已有内容 · 默认保留':'空白字段',field.type==='select-one'?'原生下拉框':field.kind==='custom-select'?'自定义下拉':field.kind==='split-date'?'拆分年月':field.kind==='ongoing'?'至今状态':''].filter(Boolean).join(' · ');
    const select=document.createElement('select');select.dataset.id=field.id;select.setAttribute('aria-label',`${field.label} 对应的资料`);
    select.add(new Option('— 不填写 / 手动选择对应资料 —',''));
    for(const entry of all.filter(e=>e.value.trim())) select.add(new Option(entry.label,entry.key));
    const remembered=saved?.find(([key])=>key===field.key);
    select.value=remembered?remembered[1]:(duplicates.has(guesses[i])?'':guesses[i]);
    const preview=document.createElement('div');preview.className='preview';
    const update=()=>{preview.textContent=all.find(e=>e.key===select.value)?.value||'未匹配，可从上方选择资料';buttons();};
    select.addEventListener('change',update);update();card.append(title,note,select,preview);$('fields').append(card);
  });
  $('scan-summary').textContent=`识别到 ${snapshot.fields.length} 个可填写字段，请核对对应资料`;
}
async function scan() {
  snapshot=null;submission=null; $('fields').replaceChildren();$('scan-summary').textContent='';
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});tabId=tab?.id;
  if(!tabId)throw new Error('没有找到当前网页');
  all=entries(await loadProfile());
  $('profile-info').textContent=`已保存 ${all.filter(e=>e.value.trim()).length} 项资料`;
  await chrome.scripting.executeScript({target:{tabId},files:CONTENT_SCRIPTS});
  snapshot=await engine('scan');
  $('site').textContent=new URL(snapshot.url).hostname||'本地测试页面';
  mappings=(await chrome.storage.local.get('mappings')).mappings||[];
  render(mappings.find(m=>m.scope===snapshot.scope)?.pairs);
  const warnings=[];
  if(snapshot.adapter==='Moka')warnings.push('已识别 Moka：支持真实选项选择、拆分年月和多段经历。可先“补齐经历表格”；联动产生新字段后再次识别。');
  if(!all.some(e=>e.value.trim())) warnings.push('请先点击“编辑资料”保存你的求职信息。');
  if(!snapshot.fields.length) warnings.push('没有发现可填写字段。请展开申请表后重试；自定义下拉框暂需手动选择。');
  if(snapshot.blockedFrames)warnings.push(`有 ${snapshot.blockedFrames} 个内嵌页面无法访问或尚未就绪，可将表单单独打开后重试。`);
  if(snapshot.truncated)warnings.push('页面字段较多，本次最多预览 300 项。');
  message(warnings.join('\n')||'已准备好。确认下方对应关系后，点击“填入”。');
}
$('edit').onclick=()=>chrome.runtime.openOptionsPage();
$('scan').onclick=()=>run(scan);
$('check-submit').onclick=()=>run(async()=>{
  submission=null;await scan();submission=await engine('checkSubmission');
  $('submit-current').textContent=submission.action;
  message(submission.ready?`${submission.platform}：已检查当前必填项和协议状态。请核对网页后点击“${submission.action}”。`:`仍需在网页处理：\n${submission.issues.slice(0,8).join('\n')}`,!submission.ready);
});
$('submit-current').onclick=()=>run(async()=>{
  if(!submission?.ready)return;const current=submission;submission=null;
  const result=await engine('submit',{token:current.token});message(result.message);
});
$('prepare').onclick=()=>run(async()=>{const profile=await loadProfile();const counts=Object.fromEntries(['education','experience','projects','awards','campusRoles'].map(k=>[k,profile[k]?.length||0]));const result=await engine('prepare',counts);await scan();message(`已添加 ${result.added} 段表格，请核对匹配后填写。联动字段出现后可再次识别。`);});
$('fill').onclick=()=>run(async()=>{
  submission=null;
  if(!snapshot)return;
  const pairs=[...document.querySelectorAll('#fields select')].map(select=>[snapshot.fields.find(f=>f.id===select.dataset.id),select.value]);
  const items=pairs.filter(([,key])=>key).map(([field,key])=>({id:field.id,key:field.key,value:all.find(e=>e.key===key)?.value||''}));
  message('正在选择网页控件并核对结果，请保持页面打开…');
  const result=await engine('fill',{scanId:snapshot.scanId,overwrite:$('overwrite').checked,items});
  snapshot.canUndo=result.canUndo;
  let storageError='';
  if($('remember').checked) {
    try {
      const updated=mappings.filter(m=>m.scope!==snapshot.scope);
      updated.push({scope:snapshot.scope,pairs:pairs.map(([field,key])=>[field.key,key])});
      await chrome.storage.local.set({mappings:updated.slice(-50)});mappings=updated.slice(-50);
    }catch{storageError='\n字段对应关系未保存成功。';}
  }
  const fresh=await engine('scan');snapshot=fresh;
  const chosen=pairs.map(([f,key])=>[f.key,key]);render(chosen);
  message(`已填入 ${result.filled} 项。请在网页中检查结果。${result.newFields?'\n网页新增或重建了表单控件，预览已更新，请继续核对。':''}${result.skipped.length?'\n未填入 '+result.skipped.length+' 项：\n'+result.skipped.slice(0,8).join('\n'):''}${storageError}`);
});
$('undo').onclick=()=>run(async()=>{
  const result=await engine('undo');await scan();
  message(`已恢复 ${result.restored} 项。${result.skipped?`另有 ${result.skipped} 项已变化或控件不支持清空，请在网页手动检查。`:''}`);
});
$('forget').onclick=()=>run(async()=>{
  mappings=mappings.filter(m=>m.scope!==snapshot.scope);await chrome.storage.local.set({mappings});render();message('已清除此页面的记忆，可重新选择对应资料。');
});
run(async()=>{all=entries(await loadProfile());$('profile-info').textContent=`已保存 ${all.filter(e=>e.value.trim()).length} 项资料`;
  if(!all.some(e=>e.value.trim()))message('首次使用：请先点击“编辑资料”，填写并保存你的简历资料。');
});
