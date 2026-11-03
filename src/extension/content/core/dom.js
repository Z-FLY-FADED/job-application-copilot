const text = el => (el?.textContent||'').replace(/\s+/g,' ').trim().slice(0,160);
const norm = value => String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const settle=()=>new Promise(resolve=>setTimeout(resolve,120));
function radios(el){return [...el.getRootNode().querySelectorAll('input[type=radio]')].filter(e=>e.name===el.name&&e.form===el.form);}
function radioState(el){const group=radios(el),selected=group.find(e=>e.checked);return selected?JSON.stringify([group.indexOf(selected),selected.value]):'';}
const valueOf=el=>el.type==='radio'?radioState(el):el.value;
function labelText(el) {
  if(!el)return '';
  const copy=el.cloneNode(true);copy.querySelectorAll('input,textarea,select,button,script,style').forEach(node=>node.remove());return text(copy);
}
function eligible(el) {
  if(!el.isConnected || el.matches(':disabled') || el.readOnly || el.closest('[inert]') || !el.getClientRects().length) return false;
  if(el.ownerDocument.defaultView.getComputedStyle(el).visibility!=='visible') return false;
  if(el.tagName==='INPUT' && !['text','email','tel','url','number','date','month','datetime-local','radio'].includes(el.type)) return false;
  if(el.type==='radio'&&!el.name)return false;
  return el.tagName==='INPUT' || el.tagName==='TEXTAREA' || (el.tagName==='SELECT' && !el.multiple);
}
function semanticLabels(el) {
  const root=el.getRootNode();
  const labelledBy=node=>(node?.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>text(root.getElementById?.(id))).filter(Boolean).join(' ');
  const labelled=labelledBy(el);
  const explicit=[...(el.labels||[])].map(labelText);
  const belongs=candidate=>{if(!candidate)return null;if(candidate.tagName==='LABEL'&&candidate.htmlFor&&candidate.htmlFor!==el.id)return null;if(candidate.querySelector('input,textarea,select')&&!candidate.contains(el))return null;return candidate;};
  const fallback=belongs(el.parentElement?.querySelector(':scope > label, :scope > .label, :scope > .form-label'));
  const group=el.closest('.ant-form-item,.el-form-item,.ivu-form-item,.form-group,.form-item');
  const frameworkLabel=belongs(group?.querySelector('.ant-form-item-label,.el-form-item__label,.ivu-form-item-label,.form-item-label,label'));
  const radioGroup=el.type==='radio'?el.closest('[role=radiogroup],fieldset'):null;
  const radioLabel=labelledBy(radioGroup)||radioGroup?.getAttribute('aria-label')||labelText(radioGroup?.querySelector(':scope > legend'));
  return [...new Set([radioLabel,...(el.type==='radio'?[]:explicit),labelled,el.getAttribute('aria-label'),labelText(fallback),labelText(frameworkLabel)].filter(Boolean).map(x=>x.trim().slice(0,160)))];
}
function labels(el){return [...new Set([...semanticLabels(el),el.placeholder,el.name,el.id,el.autocomplete].filter(Boolean).map(x=>x.trim().slice(0,160)))];}
function section(el) {
  let parent=el.parentElement;
  for(let i=0; parent && i<7; i++,parent=parent.parentElement) {
    const heading=parent.querySelector(':scope > legend, :scope > h2, :scope > h3, :scope > h4, :scope > .section-title');
    const title=text(heading)||parent.getAttribute('aria-label')||'';
    if(title && !(el.type==='radio'&&parent.matches('fieldset,[role=radiogroup]'))) {
      const count=title.match(/(?:第\s*)?([1-9]\d*)\s*(?:段|条|项|份|[.、：:]|$)/);
      return {context:title,recordIndex:count?Number(count[1])-1:null};
    }
  }
  return {context:'',recordIndex:null};
}
function identity(el){return JSON.stringify([el.tagName,el.type,el.id,el.name,labels(el),section(el),...(el.type==='radio'?[radios(el).map(e=>[e.value,[...(e.labels||[])].map(labelText),e.disabled])]:[])]);}
function assign(el,value) {
  const win=el.ownerDocument.defaultView;
  const proto=el.tagName==='SELECT'?win.HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?win.HTMLTextAreaElement.prototype:win.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
  el.dispatchEvent(new win.Event('input',{bubbles:true,composed:true}));
  el.dispatchEvent(new win.Event('change',{bubbles:true,composed:true}));
  el.dispatchEvent(new win.FocusEvent('blur',{bubbles:false}));
}

export { text, norm, settle, radios, radioState, valueOf, labelText, eligible, semanticLabels, labels, section, identity, assign };
