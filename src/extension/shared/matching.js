import { normalize, primaryLabel } from './text.js';

const aliases = {
  name:['姓名','真实姓名','中文姓名','name','fullname','yourname'], englishName:['英文名','英文姓名','英文名（无请写拼音，请勿带符号）','englishname'],
  phone:['手机','手机号','手机号码','联系电话','联系手机','phone','mobile','tel','telephone','phonenumber'],
  email:['邮箱','电子邮箱','电子邮件','email','emailaddress'], gender:['性别','gender','sex'], birthDate:['出生日期','出生日期(年龄)','生日','出生年月','dateofbirth','birthdate','birthdateage','birthday','bday'],
  city:['现居城市','现居住地','现居地','当前城市','居住城市','currentcity'], address:['详细地址','联系地址','通讯地址','目前住址','address','streetaddress','presentaddress'],
  hometown:['籍贯','hometown'],politicalStatus:['政治面貌'],degree:['最高学历','学历','educationlevel','highestdegree','degree'],
  nationality:['国籍','国家/地区','nationality','countryregion','countryofcitizenship'],hukou:['户籍','户籍所在地','户籍地址','户口所在地','registeredpermanentaddress'],idNumber:['身份证号码','身份证号','证件号码','证件号','idnumber'],
  school:['毕业院校','毕业学校','学校','学校名','学校名称','院校名称','school','university','schoolname'],major:['专业','所学专业','专业名称','major','fieldofstudy'],
  graduationDate:['毕业时间','毕业日期','graduationdate'], jobTitle:['意向岗位','应聘职位','申请职位','期望职位','desiredposition','positionapplied'],
  desiredCity:['期望工作城市','意向城市','期望城市','desiredcity'], salary:['期望薪资','期望月薪','期望月薪（税前）','薪资期望','期望薪酬','expectedsalary','salary'],annualSalary:['期望年薪','expectedannualsalary'],ambassadorCode:['校园大使推荐码(没有可填无）'],
  availability:['到岗时间','可到岗时间','availability'],yearsExperience:['工作年限','工作年数','yearsofexperience'],website:['个人网站','作品集','个人主页','website','portfolio','url'],
  github:['github','github地址'],skills:['专业技能','技能特长','技能','其它技能','其他技能','skills','otherskills'],summary:['自我评价','自我介绍','个人简介','summary','aboutme'],coverLetter:['求职信','申请理由','应聘理由','coverletter'],
  company:['公司名称','工作单位','公司','单位名称','company','companyname','employer'],title:['职位名称','职位','担任职位','职务','工作职位','jobtitle'],
  startDate:['开始时间','开始日期','起始时间','入职时间','入学时间','startdate'], endDate:['结束时间','结束日期','离职时间','enddate'],
  description:['工作内容','工作描述','工作职责','实习内容','工作业绩','岗位职责','description','responsibilities'],
  projectName:['项目名称','projectname'],role:['担任角色','项目角色','项目中职责','role'],projectDescription:['项目描述','项目内容','项目成果','项目职责','projectdescription'],details:['在校经历','教育补充'],
  college:['学院名称','学院'],gpa:['成绩(GPA)','GPA','平均绩点'],ranking:['专业排名'],overseas:['是否为中国境外留学经历'],
  acceptCityAdjustment:['是否可接受工作城市调剂','是否接受城市调剂'],internshipAvailable:['是否可实习'],studyMode:['学习形式','学习方式','培养方式','培养模式','全日制/非全日制','fullparttime','studytype','modeofstudy'],jobSource:['最初从何处了解到该校招职位信息','职位信息来源'],language:['最高通过以下哪种语言等级考试（优选小语种）'],languageLevel:['英语等级','英语水平'],languageScore:['英语等级成绩'],
  awardName:['奖项名称','获奖名称','荣誉名称','奖励名称','awardname','honorname'],awardDate:['获奖时间','获奖日期','颁奖时间','颁发时间','awarddate'],
  grade:['奖项等次','获奖等次','获奖等级','奖励等级','awardgrade'],level:['奖项级别','获奖级别','奖励级别','荣誉级别','awardlevel'],issuer:['颁发单位','颁奖单位','发证单位','授予单位','issuer'],awardDescription:['奖项说明','奖项描述','获奖说明','获奖描述','awarddescription'],ongoing:['至今'],
  awardsSummary:['获奖情况','获奖经历','奖励情况','荣誉奖励','荣誉奖项','所获荣誉','荣誉及奖励','荣誉与奖励','awards','honors'],status:['就读状态','在职状态','在读状态','毕业状态'],
  campusRoleName:['在校职务名称','在校职务','校内职务','校园职务','学生职务'],campusRoleDescription:['在校职务描述','任职描述','职务描述','在校工作描述']
};
export function suggest(field, all) {
  const raw = (field.labels||[]).map(primaryLabel).map(normalize).filter(Boolean);
  const autocomplete={name:'name',email:'email',tel:'phone','tel-national':'phone','bday':'birthDate','address-level2':'city','street-address':'address','address-line1':'address',organization:'company','organization-title':'title',url:'website'};
  const token=String(field.autocomplete||'').trim().split(/\s+/).pop();
  // Standards tokens are a fallback for unnamed fields, never a reason to override an explicit label.
  if(!field.semanticLabels?.length&&autocomplete[token])raw.push(normalize((aliases[autocomplete[token]]||[])[0]));
  const entire=normalize([field.context,...(field.labels||[])].join(' '));
  if(raw.some(s=>/^(?:学位|academicdegree|firstname|lastname|middlename|givenname|surname)$/.test(s)))return '';
  if(/紧急联系|推荐人|证明人|家庭成员|家庭背景|亲属|亲密关系|犯罪|竞业|背景调查|referee|referencecheck|emergencycontact|familybackground|relative|closerelationship|convict|crime|competitionagreement|noncompete/.test(entire))return '';
  const explicitId=raw.some(s=>aliases.idNumber.map(normalize).includes(s))&&all.some(e=>e.key==='basic.idNumber'&&e.value.trim());
  if(raw.some(s=>/验证码|密码|护照|captcha|verificationcode|password|passport/.test(s)))return '';
  if(raw.some(s=>/身份证|身份号码/.test(s))&&!explicitId)return '';
  const context = normalize(field.context);
  if(/高中经历|证书|资质认证|培训经历|certificate|qualification|training/.test(context))return '';
  if(/紧急联系|推荐人|证明人|家庭成员|父亲|母亲|配偶|referee|reference|emergency/.test(context))return '';
  const isCampus=/在校职务|校园任职|学生干部|campusrole|studentleadership/.test(context),isAward=/获奖|奖项|荣誉|奖励|award|honor/.test(context), isProject = !isAward&&!isCampus&&/项目|project/.test(context), isEdu = !isAward&&!isCampus&&!isProject&&/教育|学历经历|education/.test(context),isJob = !isAward&&!isCampus&&!isProject&&!isEdu&&/工作经历|实习经历|工作经验|employment|experience|实习经验/.test(context);
  let candidates = [];
  for(const entry of all) {
    if(!entry.value.trim()) continue;
    let [group,index,key] = entry.key.split('.');
    if(group==='basic'||group==='aggregate') key=index;
    if(group==='projects' && key==='name') key='projectName';
    if(group==='projects' && key==='description') key='projectDescription';
    if(group==='awards' && key==='name') key='awardName';
    if(group==='awards' && key==='date') key='awardDate';
    if(group==='awards' && key==='description') key='awardDescription';
    if(group==='campusRoles' && key==='name')key='campusRoleName';
    if(group==='campusRoles' && key==='description')key='campusRoleDescription';
    const names = group==='custom' ? [entry.label] : (aliases[key]||[]);
    let score = 0;
    for(const name of names) for(const label of raw) {
      const n = normalize(name);
      if(label===n) score=Math.max(score,100);
      else if(n.length>=3 && label.endsWith(n) && label.length<=n.length+5) score=Math.max(score,75);
    }
    if((field.semanticLabels||[]).some(s=>names.some(n=>normalize(primaryLabel(s))===normalize(n))))score=score?score+20:0;
    if(!score) continue;
    if(group!=='aggregate' && (isCampus && group!=='campusRoles' || isProject && group!=='projects' || isJob && group!=='experience' || isEdu && group!=='education' || isAward && group!=='awards' && group!=='custom')) continue;
    if(!isProject&&!isJob&&!isEdu&&!isAward&&!isCampus && !['basic','custom','aggregate'].includes(group)) continue;
    // Repeated records require an explicit section number; never replicate the first entry across all rows.
    if(['education','experience','projects','awards','campusRoles'].includes(group)) {
      let wanted = field.recordIndex;
      if(field.recordAnchor?.value){
        const anchor=field.recordAnchor;
        const hits=all.filter(e=>e.key.startsWith(group+'.')&&e.key.endsWith('.'+anchor.field)&&normalize(e.value)===normalize(anchor.value));
        if(hits.length!==1)continue;
        wanted=Number(hits[0].key.split('.')[1]);
      }
      if(wanted!==null && wanted!==undefined) {if(Number(index)!==wanted) continue;}
      else if(Number(index)!==0) continue;
    }
    candidates.push({key:entry.key,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates.length && (!candidates[1] || candidates[0].score>candidates[1].score) ? candidates[0].key : '';
}
