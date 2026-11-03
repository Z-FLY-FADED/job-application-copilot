import {basics,groups,emptyProfile,cleanProfile,loadProfile,mergeSections} from '../shared/schema.js';
const $=id=>document.getElementById(id);let profile=emptyProfile(),dirty=false;
const status=(s,error=false)=>{$('status').textContent=s;$('status').classList.toggle('error',error);};
const changed=()=>{dirty=true;status('有未保存的修改');};
function inputField([key,label,type='text'],value,onChange) {
  const wrap=document.createElement('label');wrap.className='input-field'+(type==='textarea'?' wide':'');
  const caption=document.createElement('span');caption.textContent=label;
  const input=document.createElement(type==='textarea'?'textarea':'input');
  if(type!=='textarea')input.type=type;input.value=value||'';input.maxLength=12000;
  input.addEventListener('input',()=>{onChange(input.value);changed();});wrap.append(caption,input);return wrap;
}
function render() {
  $('basic-fields').replaceChildren();
  basics.forEach(def=>$('basic-fields').append(inputField(def,profile.basic[def[0]],value=>profile.basic[def[0]]=value)));
  $('groups').replaceChildren();
  for(const group of groups) {
    const section=document.createElement('section');section.id=group.key;section.className='card section';
    const head=document.createElement('div');head.className='section-head';
    const h=document.createElement('h2');h.textContent=group.title;const note=document.createElement('p');note.className='muted section-note';note.textContent=group.key==='awards'?'保存奖项名称、时间与等次。时间可填 YYYY、YYYY-MM 或 YYYY-MM-DD，保留证书实际精度；填写网页时可选单条记录或全部奖项汇总。':'按常用顺序添加，填写网页时可为每个字段选择对应的经历；尚未结束的经历保留结束时间为空，并填写状态。';head.append(h,note);section.append(head);
    profile[group.key].forEach((record,i)=>{
      const block=document.createElement('div');block.className='record';
      const top=document.createElement('div');top.className='row between';const title=document.createElement('h3');title.textContent=`${group.title} ${i+1}`;
      const remove=document.createElement('button');remove.textContent='删除';remove.className='danger';remove.onclick=()=>{if(confirm(`删除第 ${i+1} 段${group.title}？`)){profile[group.key].splice(i,1);render();changed();}};top.append(title,remove);
      const grid=document.createElement('div');grid.className='form-grid';group.fields.forEach(def=>grid.append(inputField(def,record[def[0]],value=>record[def[0]]=value)));block.append(top,grid);section.append(block);
    });
    const add=document.createElement('button');add.textContent=`＋ 添加${group.title}`;add.disabled=profile[group.key].length>=(group.limit||20);add.onclick=()=>{profile[group.key].push({});render();changed();};section.append(add);$('groups').append(section);
  }
  $('custom-list').replaceChildren();
  profile.custom.forEach((item,i)=>{
    const row=document.createElement('div');row.className='custom-row';
    const label=inputField(['label','字段标题'],item.label,value=>item.label=value);
    const value=inputField(['value','填写内容','textarea'],item.value,value=>item.value=value);
    const remove=document.createElement('button');remove.textContent='删除';remove.onclick=()=>{if(confirm('删除此自定义内容？')){profile.custom.splice(i,1);render();changed();}};
    row.append(label,value,remove);$('custom-list').append(row);
  });
  $('add-custom').disabled=profile.custom.length>=50;
}
async function action(fn){try{await fn();}catch(e){status(e.message||'操作失败，请重试',true);}}
$('add-custom').onclick=()=>{profile.custom.push({label:'',value:''});render();changed();};
$('save').onclick=()=>action(async()=>{profile=cleanProfile(profile);await chrome.storage.local.set({profile});dirty=false;status('已保存 · 返回招聘网页，点击插件即可填写');});
$('export').onclick=()=>action(async()=>{
  const blob=new Blob([JSON.stringify({format:'jobfill-profile',version:1,profile:cleanProfile(profile)},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`求职资料-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status('已导出当前编辑内容（明文 JSON）');
});
$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=()=>action(async()=>{
  const file=$('import-file').files[0];$('import-file').value='';if(!file)return;if(file.size>2000000)throw new Error('备份文件过大（最多 2 MB）');
  let data;try{data=JSON.parse(await file.text());}catch{throw new Error('无法读取 JSON 备份文件');}
  if(data.version!==1||!['jobfill-profile','jobfill-sections'].includes(data.format))throw new Error('请选择求职快填备份或增量资料包');
  if(data.format==='jobfill-sections') {
    const next=mergeSections(profile,data.sections);
    if(!confirm('将资料包合并到编辑区？已有经历和奖项会保留，相同记录只补齐空字段；资料包中的非空基本信息会更新。点击保存后生效。'))return;
    profile=next;render();changed();status('已合并资料包，重复记录已跳过；请检查后保存');return;
  }
  const next=cleanProfile(data.profile);
  if(!confirm('用此备份替换编辑中的资料？点击保存后才会写入本机。'))return;
  profile=next;render();changed();status('已导入到编辑区，请检查后保存');
});
$('clear-mappings').onclick=()=>action(async()=>{if(confirm('清空所有网站的字段对应关系？个人资料会保留。')){await chrome.storage.local.remove('mappings');status('已清空字段匹配记忆');}});
$('clear').onclick=()=>action(async()=>{if(confirm('删除全部本机求职资料与字段匹配记忆？此操作无法恢复，建议先导出备份。')){await chrome.storage.local.remove(['profile','mappings']);profile=emptyProfile();render();dirty=false;status('已删除全部本机资料');}});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
document.querySelector('main').inert=true;
action(async()=>{profile=await loadProfile();render();document.querySelector('main').inert=false;$('save').disabled=false;status('资料保存在此浏览器，修改后请点击保存');});
