import { norm, radios, eligible, labelText } from './dom.js';

function formattedDate(el,value){
  const formats=['YYYY-MM-DD','YYYY/MM/DD','YYYY.MM.DD','YYYYMMDD','DD/MM/YYYY','MM/DD/YYYY','DD-MM-YYYY','MM-DD-YYYY','YYYY年MM月DD日','YYYY-MM','YYYY/MM','YYYY.MM','MM/YYYY','YYYYMM','YYYY年MM月','YYYY'];
  let wanted=el.type==='date'?'YYYY-MM-DD':el.type==='month'?'YYYY-MM':'';
  if(!wanted&&el.type==='text'){const hint=(el.getAttribute('data-date-format')||el.placeholder||'').toUpperCase();const hits=formats.filter(f=>hint.includes(f));const specific=hits.filter(f=>!hits.some(g=>g!==f&&g.includes(f)));if(specific.length>1)throw new Error('日期格式有歧义，请在网页中确认');wanted=specific[0]||'';}
  if(!wanted)return value;
  const match=String(value).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);if(!match)throw new Error('日期资料需要明确的YYYY、YYYY-MM或YYYY-MM-DD');
  const [,y,m,d]=match,year=Number(y),month=Number(m),day=Number(d),leap=year%4===0&&(year%100!==0||year%400===0);
  if(m&&(month<1||month>12)||d&&(day<1||day>[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1]))throw new Error('日期不存在');
  if(wanted.includes('MM')&&!m||wanted.includes('DD')&&!d)throw new Error('日期资料精度不足，不补造月或日');
  return wanted.replace('YYYY',y).replace('MM',m||'').replace('DD',d||'');
}
function radioChoice(el,value){
  const alternatives={男:['male','m'],女:['female','f'],是:['yes','y','true'],否:['no','n','false']}[value]||[];
  const wanted=[value,...alternatives].map(norm),group=radios(el).filter(eligible);
  const hits=group.filter(e=>wanted.includes(norm(e.value))||[...(e.labels||[])].some(l=>wanted.includes(norm(labelText(l)))));
  if(hits.length!==1)throw new Error('单选项没有唯一匹配，请在网页中选择');return hits[0];
}
function adapted(el,value) {
  if(el.type==='radio')return radioChoice(el,value);
  if(el.tagName==='SELECT') {
    const equivalence={男:['male','m','男'],女:['female','f','女'],本科:['本科','学士','bachelor','bachelorsdegree'],硕士:['硕士','研究生','master','mastersdegree'],博士:['博士','phd','doctorate']};
    const wanted=norm(value), aliases=equivalence[value]||[wanted];
    const opts=[...el.options].filter(o=>!o.disabled && !o.parentElement?.disabled && o.value!=='');
    const direct=opts.filter(o=>norm(o.label)===wanted||norm(o.value)===wanted);
    const hits=direct.length?direct:opts.filter(o=>aliases.some(a=>norm(a)===norm(o.label)||norm(a)===norm(o.value)));
    if(hits.length!==1) throw new Error('下拉选项没有唯一匹配，请在网页中选择');
    return hits[0].value;
  }
  value=formattedDate(el,value);
  if(el.type==='datetime-local'&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value))throw new Error('需要明确日期和时间，不补造时刻');
  if(el.type==='number' && !/^-?\d+(\.\d+)?$/.test(value)) throw new Error('此字段需要纯数字');
  if(el.maxLength>0 && value.length>el.maxLength) throw new Error('内容超过字段长度限制');
  if(el.minLength>0 && value.length<el.minLength) throw new Error('内容少于字段最小长度');
  const probe=el.cloneNode(true);probe.value=value;
  if(!probe.checkValidity()||['date','month','datetime-local','number','email'].includes(el.type)&&probe.value!==value)throw new Error('资料不符合网页的格式、范围或步长要求');
  return value;
}

export { formattedDate, radioChoice, adapted };
