import { normalize } from './text.js';

export const basics = [
  ['name','姓名'], ['englishName','英文名'], ['phone','手机号码','tel'], ['email','电子邮箱','email'],
  ['gender','性别'], ['birthDate','出生日期','date'], ['city','现居城市'], ['address','详细地址'],
  ['hometown','籍贯'], ['politicalStatus','政治面貌'], ['nationality','国籍'], ['hukou','户籍所在地'], ['idNumber','身份证号码'], ['degree','最高学历'], ['graduationDate','毕业时间','month'],
  ['school','毕业院校'], ['major','专业'], ['jobTitle','意向岗位'], ['desiredCity','期望工作城市'],
  ['salary','期望薪资'], ['annualSalary','期望年薪'], ['ambassadorCode','校园大使推荐码'], ['availability','到岗时间'], ['yearsExperience','工作年限'],
  ['website','个人网站 / 作品集','url'], ['github','GitHub','url'], ['skills','专业技能','textarea'],
  ['summary','自我评价','textarea'], ['coverLetter','求职信 / 申请理由','textarea'],
  ['acceptCityAdjustment','是否接受城市调剂'],['internshipAvailable','是否可实习'],['studyMode','学习形式'],['jobSource','职位信息来源'],['language','语言考试类别'],['languageLevel','语言考试等级'],['languageScore','语言考试成绩']
];
export const groups = [
  {key:'education', title:'教育经历', fields:[['school','学校名称'],['major','专业名称'],['degree','学历'],['startDate','入学时间','month'],['endDate','毕业时间','month'],['status','就读状态'],['studyMode','学习形式'],['college','学院名称'],['gpa','成绩(GPA)'],['ranking','专业排名'],['overseas','是否为中国境外留学经历'],['details','教育补充 / 在校经历','textarea']]},
  {key:'experience', title:'工作 / 实习经历', fields:[['company','公司名称'],['title','职位名称'],['startDate','开始时间','month'],['endDate','结束时间','month'],['status','在职状态'],['description','工作内容 / 业绩','textarea']]},
  {key:'projects', title:'项目经历', fields:[['name','项目名称'],['role','担任角色'],['startDate','开始时间','month'],['endDate','结束时间','month'],['description','项目描述 / 成果','textarea']]},
  {key:'awards', title:'获奖经历', limit:80, fields:[['name','奖项名称'],['date','获奖时间'],['grade','奖项等次'],['level','奖项级别'],['issuer','颁发单位'],['description','奖项说明','textarea']]},
  {key:'campusRoles',title:'在校职务',fields:[['name','在校职务名称'],['startDate','开始时间'],['endDate','结束时间'],['description','在校职务描述','textarea']]}
];
export const emptyProfile = () => ({basic:{},education:[],experience:[],projects:[],awards:[],campusRoles:[],custom:[]});
export function cleanProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('资料格式不正确');
  const out = emptyProfile();
  const copy = (source, fields) => Object.fromEntries(fields.map(([key]) => [key, typeof source?.[key] === 'string' ? source[key].slice(0,12000) : '']));
  out.basic = copy(input.basic, basics);
  for (const group of groups) out[group.key] = (Array.isArray(input[group.key]) ? input[group.key] : []).slice(0,group.limit||20).map(item => copy(item,group.fields));
  out.custom = (Array.isArray(input.custom) ? input.custom : []).slice(0,50).map(item => ({label:typeof item?.label==='string'?item.label.slice(0,80):'',value:typeof item?.value==='string'?item.value.slice(0,12000):''}));
  return out;
}
export function entries(profile) {
  const result = basics.map(([key,label]) => ({key:`basic.${key}`,label,value:profile.basic[key]||''}));
  for (const group of groups) (profile[group.key]||[]).forEach((item,index) => {group.fields.forEach(([key,label]) => result.push({key:`${group.key}.${index}.${key}`,label:`${group.title} ${index+1} · ${label}`,value:item[key]||''}));if(group.key==='experience'&&/在职|实习中|至今/.test(item.status||'')&&!item.endDate)result.push({key:`experience.${index}.ongoing`,label:`工作 / 实习经历 ${index+1} · 至今`,value:'true'});if(group.key==='campusRoles'&&item.endDate)result.push({key:`campusRoles.${index}.ongoing`,label:`在校职务 ${index+1} · 至今（否）`,value:'false'});});
  if(profile.awards?.length) result.push({key:'aggregate.awardsSummary',label:'全部获奖经历（时间＋名称＋等次）',value:profile.awards.map(a=>[a.date,a.name,a.grade].filter(Boolean).join(' · ')).join('\n')});
  profile.custom.forEach((item,index) => {if(item.label) result.push({key:`custom.${index}`,label:item.label,value:item.value});});
  return result;
}
export async function loadProfile() {
  const data = await chrome.storage.local.get('profile');
  return data.profile ? cleanProfile(data.profile) : emptyProfile();
}
export function mergeSections(current,sections) {
  if(!sections||typeof sections!=='object'||Array.isArray(sections))throw new Error('增量资料包格式不正确');
  const next=cleanProfile(current),incoming=cleanProfile(sections);
  for(const [key,value] of Object.entries(incoming.basic))if(value.trim())next.basic[key]=value;
  for(const group of groups) {
    const identity=item=>JSON.stringify((group.key==='awards'?['name','date','grade']:group.key==='experience'?['company','title','startDate']:group.key==='education'?['school','major','startDate']:['name','startDate']).map(key=>normalize(item[key])));
    const existing=new Map(next[group.key].map(item=>[identity(item),item]));
    for(const item of incoming[group.key]) {
      if(!Object.values(item).some(v=>v.trim()))continue;
      const key=identity(item);if(existing.has(key)){const current=existing.get(key);for(const [field,value] of Object.entries(item))if(value.trim()&&!current[field]?.trim())current[field]=value;continue;}
      if(next[group.key].length>=(group.limit||20))throw new Error(`${group.title}超过保存上限，请先整理已有记录`);
      next[group.key].push(item);existing.set(key,item);
    }
  }
  const existing=new Set(next.custom.map(item=>normalize(item.label)));
  for(const item of incoming.custom){if(!item.label.trim()||existing.has(normalize(item.label)))continue;if(next.custom.length>=50)throw new Error('自定义内容超过保存上限');next.custom.push(item);existing.add(normalize(item.label));}
  return next;
}
