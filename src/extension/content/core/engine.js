import { VERSION } from '../../shared/config.js';
import { eligible, radios, labels, section, valueOf, identity, semanticLabels, labelText, assign, settle } from './dom.js';
import { adapted } from './controls.js';

export function createEngine() {
  let nodes = new Map(), last = [], lastUrl = '', serial = 0, scanId = '', scanUrl = '',scanRoots=[];
  function scan() {
    nodes=new Map();scanRoots=[];scanId=`${Date.now()}-${++serial}`;scanUrl=location.href;const seenRadios=new Set();
    const fields=[];let blockedFrames=0, truncated=false;
    function walk(root,path,depth=0) {
      scanRoots.push(root);
      if(depth>8 || fields.length>=300) {truncated=true;return;}
      for(const el of root.querySelectorAll('input,textarea,select')) {
        if(fields.length>=300) {truncated=true;break;}
        if(!eligible(el)) continue;
        if(el.type==='radio'){const first=radios(el)[0];if(seenRadios.has(first))continue;seenRadios.add(first);}
        const labelList=labels(el), info=section(el), id=String(fields.length);
        const signature=JSON.stringify([path,el.tagName,el.type,el.id,el.name,labelList,info.context]);
        const occurrence=fields.filter(f=>f.baseSignature===signature).length;
        const key=`${signature}#${occurrence}`;
        nodes.set(id,{el,key,original:valueOf(el),identity:identity(el)});
        fields.push({id,key,baseSignature:signature,labels:labelList,semanticLabels:semanticLabels(el),autocomplete:el.autocomplete||'',label:labelList[0]||`未命名字段 ${fields.length+1}`,...info,type:el.type||el.tagName.toLowerCase(),filled:!!valueOf(el),options:el.tagName==='SELECT'?[...el.options].filter(o=>!o.disabled).map(o=>({value:o.value,label:o.label})).slice(0,150):el.type==='radio'?radios(el).filter(eligible).map(e=>({value:e.value,label:[...(e.labels||[])].map(labelText).join(' ')})):[]});
      }
      let i=0;
      for(const el of root.querySelectorAll('*')) {
        if(el.shadowRoot) walk(el.shadowRoot,`${path}/shadow${i}`,depth+1);
        if(el.tagName==='IFRAME') {
          try {if(el.contentDocument && el.getClientRects().length) walk(el.contentDocument,`${path}/frame${i}`,depth+1);else blockedFrames++;} catch {blockedFrames++;}
        }
        i++;
      }
    }
    walk(document,'main');
    const safeFields=fields.map(({baseSignature,...f})=>f);
    return {scanId,url:scanUrl,scope:location.origin+location.pathname,fields:safeFields,blockedFrames,truncated,canUndo:last.length>0};
  }
  async function fill(request) {
    if(request.scanId!==scanId || location.href!==scanUrl) throw new Error('页面已变化，请重新识别');
    let filled=0; const skipped=[],changes=[];
    for(const item of request.items.slice(0,300)) {
      const found=nodes.get(item.id);
      if(!found || found.key!==item.key) {skipped.push('字段已变化');continue;}
      const {el,original}=found, label=labels(el)[0]||'字段';
      try {
        if(!eligible(el)) throw new Error('字段当前不可填写');
        if(found.identity!==identity(el)) throw new Error('字段含义已变化，请重新识别');
        if(valueOf(el)!==original) throw new Error('预览后内容发生变化，请重新识别');
        if(!request.overwrite && valueOf(el).trim()) throw new Error('保留已有内容');
        if(typeof item.value!=='string'||!item.value.trim()) continue;
        const value=adapted(el,item.value),before=valueOf(el),wanted=el.type==='radio'?JSON.stringify([radios(el).indexOf(value),value.value]):value;
        if(wanted===before) continue;
        if(el.type==='radio')value.click();else assign(el,value);
        await settle();
        if(valueOf(el)!==before)changes.push({el,before,after:valueOf(el),identity:found.identity});
        if(valueOf(el)!==wanted) throw new Error('网页未接受此值，请手动检查');
        filled++;
      } catch(error) {skipped.push(`${label}：${error.message}`);}
    }
    if(changes.length) {last=changes;lastUrl=location.href;}
    const known=new Set([...nodes.values()].map(n=>n.el));const newFields=scanRoots.flatMap(root=>[...root.querySelectorAll('input,textarea,select')]).filter(el=>eligible(el)&&!known.has(el)&&(el.type!=='radio'||!radios(el).some(e=>known.has(e)))).length;
    return {filled,skipped,canUndo:last.length>0,newFields};
  }
  async function undo() {
    let restored=0,skipped=0;
    for(const item of last) {
      const el=item.el;
      if(location.href===lastUrl && el.isConnected && valueOf(el)===item.after && eligible(el) && item.identity===identity(el)) {
        if(el.type==='radio'){const group=radios(el);if(item.before){const chosen=group[JSON.parse(item.before)[0]];if(!chosen||!eligible(chosen)){skipped++;continue;}chosen.click();}else{group.forEach(e=>{e.checked=false;});el.dispatchEvent(new el.ownerDocument.defaultView.Event('change',{bubbles:true}));}}else assign(el,item.before);
        await settle();if(valueOf(el)===item.before)restored++;else skipped++;
      } else skipped++;
    }
    last=[];return {restored,skipped};
  }
  return { scan, fill, undo, engineVersion: VERSION };
}
