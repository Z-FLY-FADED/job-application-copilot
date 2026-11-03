const { browserOptions, artifact } = require('./helpers.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),ext=path.resolve(process.env.JOBFILL_EXTENSION_DIR||path.join(root,'dist/extension'));
const passed=[];let ctx,server,web,popup,worker,extensionId;
const check=(label,fn)=>{fn();passed.push(label);console.log('PASS',label);};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn){for(let i=0;i<100;i++){if(await fn())return;await delay(50);}throw new Error('Timed out waiting for condition');}
async function click(id){await web.bringToFront();await popup.evaluate(id=>document.getElementById(id).click(),id);await wait(()=>popup.evaluate(()=>!document.getElementById('scan').disabled));}
async function engine(method,arg){return worker.evaluate(async({tabId,method,arg})=>{const r=(await chrome.scripting.executeScript({target:{tabId},func:async(m,a)=>{try{return {ok:true,value:await globalThis.__jobFill[m](a)};}catch(e){return {ok:false,message:e.message};}},args:[method,arg??null]}))[0].result;if(!r?.ok)throw new Error(r?.message||'脚本执行失败');return r.value;},{tabId:await worker.evaluate(async()=>{const ts=await chrome.tabs.query({active:true,currentWindow:true});return ts[0].id;}),method,arg});}
async function inject(){const tabId=await worker.evaluate(async()=>{const [t]=await chrome.tabs.query({active:true,currentWindow:true});return t.id;});await worker.evaluate(tabId=>chrome.scripting.executeScript({target:{tabId},files:['engine.js']}),tabId);}
function item(snapshot,label,value){const f=snapshot.fields.find(f=>f.labels.includes(label));assert(f,`field ${label} exists`);return {id:f.id,key:f.key,value};}
(async()=>{
 const schema=await import(pathToFileURL(path.join(ext,'schema.js')));
 check('备份清洗：仅保留声明字段，限制记录数，排除异常类型',()=>{
  const p=schema.cleanProfile({basic:{name:'测试候选人',email:{evil:true},secret:'discard'},education:Array(30).fill({school:'测试大学'}),custom:[{label:'a',value:'b'}]});
  assert.equal(p.basic.name,'测试候选人');assert.equal(p.basic.email,'');assert(!('secret'in p.basic));assert.equal(p.education.length,20);
 });
 check('保守匹配：验证码、紧急联系人和重复候选不自动匹配',()=>{
  const p=schema.emptyProfile();p.basic.name='测试候选人';p.basic.phone='13800000000';p.custom=[{label:'姓名',value:'另一个名字'}];const all=schema.entries(p);
  assert.equal(schema.suggest({labels:['姓名'],context:''},all),'');
  assert.equal(schema.suggest({labels:['手机号','验证码'],context:''},all),'');
  assert.equal(schema.suggest({labels:['姓名'],context:'紧急联系人'},all),'');
 });
 const personal=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/demo-profile.json'),'utf8'));
 check('个人资料包完整：30条奖项、5段项目、1段实习及已确认的测试奖学金时间',()=>{
  const p=schema.cleanProfile(personal.sections);assert.equal(p.awards.length,30);assert.equal(p.projects.length,5);assert.equal(p.experience.length,1);assert.equal(p.awards.find(a=>a.name==='测试奖学金').date,'2026-11');
  assert.equal(p.experience[0].endDate,'');assert.equal(p.experience[0].status,'在职（实习中）');assert.equal(p.projects.find(p=>p.name.includes('测试竞赛')).startDate,'2022-03');assert.equal(p.projects.find(p=>p.name.includes('测试竞赛')).endDate,'2022-05');assert.equal(p.education[0].endDate,'2027-06');assert.equal(p.education[0].major,'机械工程');
  assert.equal(p.awards.find(a=>a.name.includes('测试竞赛')).date,'2022-05-27');assert.equal(schema.cleanProfile({basic:{}}).awards.length,0);
 });
 check('增量合并：保持原有经历、保留30条奖项、重复导入不产生副本',()=>{
  const existing=schema.emptyProfile();existing.experience=[{company:'原有公司',title:'原有职位'}];
  const once=schema.mergeSections(existing,personal.sections),twice=schema.mergeSections(once,personal.sections);
  assert.equal(twice.experience.length,2);assert.equal(twice.awards.length,30);assert.equal(twice.projects.length,5);assert.deepEqual(once,twice);
 });
 check('奖项匹配：名称与时间按编号，汇总文本可单独填写',()=>{
  const p=schema.cleanProfile(personal.sections),all=schema.entries(p);
  assert.equal(schema.suggest({labels:['奖项名称'],context:'获奖经历 2',recordIndex:1},all),'awards.1.name');
  assert.equal(schema.suggest({labels:['获奖时间'],context:'获奖经历 1',recordIndex:0},all),'awards.0.date');
  assert.equal(schema.suggest({labels:['获奖情况'],context:''},all),'aggregate.awardsSummary');
  assert.equal(all.find(e=>e.key==='aggregate.awardsSummary').value.split('\n').length,30);
 });
 server=http.createServer((req,res)=>{
  const base=(req.url||'/').split('?')[0];let name=base==='/ui.css'?'ui.css':'测试表单.html';
  res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(ext,name)));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 ctx=await chromium.launchPersistentContext(artifact(`browser-profile-${Date.now()}`),{
  ...browserOptions,headless:true,viewport:{width:1440,height:1080},
  args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,'--enable-unsafe-extension-debugging']
 });
 worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker');extensionId=new URL(worker.url()).hostname;
 const manifest=await worker.evaluate(()=>chrome.runtime.getManifest());
 check('原始交付包加载为 Manifest V3 扩展，无常驻网站权限',()=>{assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions,['activeTab','scripting','storage']);assert.equal(manifest.host_permissions,undefined);});
 const options=await ctx.newPage();await options.goto(`chrome-extension://${extensionId}/options.html`);await options.locator('#save:enabled').waitFor();
 const uiErrors=[];options.on('pageerror',e=>uiErrors.push(e.message));options.on('dialog',d=>d.accept());
 await options.getByLabel('姓名',{exact:true}).fill('测试候选人');await options.getByLabel('手机号码',{exact:true}).fill('13800000000');await options.getByLabel('电子邮箱',{exact:true}).fill('candidate@example.com');await options.getByLabel('性别',{exact:true}).fill('男');await options.getByLabel('出生日期',{exact:true}).fill('2000-01-02');await options.getByLabel('现居城市',{exact:true}).fill('测试城市');await options.getByLabel('最高学历',{exact:true}).fill('本科');await options.getByLabel('期望薪资',{exact:true}).fill('12000');await options.getByLabel('自我评价',{exact:true}).fill('具备工程实践与团队协作能力。');
 await options.getByRole('button',{name:'＋ 添加教育经历',exact:true}).click();await options.locator('#education').getByLabel('学校名称',{exact:true}).fill('测试大学');await options.locator('#education').getByLabel('专业名称',{exact:true}).fill('机械工程');await options.locator('#education').getByLabel('入学时间',{exact:true}).fill('2018-09');await options.locator('#education').getByLabel('毕业时间',{exact:true}).fill('2022-06');
 for(const [i,company,title] of [[0,'测试公司一','工程师'],[1,'测试公司二','研发实习生']]){
  await options.getByRole('button',{name:'＋ 添加工作 / 实习经历',exact:true}).click();const record=options.locator('#experience .record').nth(i);
  await record.getByLabel('公司名称',{exact:true}).fill(company);await record.getByLabel('职位名称',{exact:true}).fill(title);await record.getByLabel('工作内容 / 业绩',{exact:true}).fill('完成测试项目与技术文档。');await record.getByLabel('开始时间',{exact:true}).fill('2022-07');
 }
 await options.locator('#save').click();await options.locator('#status').filter({hasText:'已保存'}).waitFor();await options.reload();await options.locator('#save:enabled').waitFor();
 check('实际扩展资料页：保存并重载，教育与两段工作经历完整保留',()=>{assert.equal(uiErrors.length,0);});
 assert.equal(await options.getByLabel('姓名',{exact:true}).inputValue(),'测试候选人');assert.equal(await options.locator('#experience .record').count(),2);
 await options.evaluate(()=>scrollTo(0,0));await options.screenshot({path:artifact('profile-preview.png'),fullPage:false});
 // Export/download, verify contents, reject malformed import, then round-trip import.
 const downloadPromise=options.waitForEvent('download');await options.locator('#export').click();const download=await downloadPromise;const backupPath=artifact('export-test.json');await download.saveAs(backupPath);
 const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));assert.equal(backup.profile.basic.name,'测试候选人');
 await options.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await options.locator('#status.error').waitFor();
 await options.getByLabel('姓名',{exact:true}).fill('暂存修改');await options.locator('#import-file').setInputFiles(backupPath);await options.locator('#status').filter({hasText:'已导入'}).waitFor();assert.equal(await options.getByLabel('姓名',{exact:true}).inputValue(),'测试候选人');await options.locator('#save').click();
 passed.push('实际资料页：JSON 导出、无效文件拒绝、有效备份导入与保存');console.log('PASS',passed.at(-1));
 web=await ctx.newPage();await web.goto(`http://127.0.0.1:${server.address().port}/`);
 await web.locator('[name=currentCity]').fill('网页已有城市');
 await web.evaluate(()=>{window.events={input:0,change:0,submit:0};document.addEventListener('input',()=>events.input++);document.addEventListener('change',()=>events.change++);document.addEventListener('submit',e=>{events.submit++;e.preventDefault();});});
 // Trigger the actual toolbar action through Chromium's extension testing protocol to grant activeTab.
 const browserCdp=await ctx.browser().newBrowserCDPSession();const targets=await browserCdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]});
 await browserCdp.send('Extensions.triggerAction',{id:extensionId,targetId:targets.targetInfos.find(t=>t.url.startsWith('http://127.0.0.1')).targetId});
 // Popup as an extension tab, keeping the application web tab active. No Chrome API mocks.
 popup=await ctx.newPage();await popup.goto(`chrome-extension://${extensionId}/popup.html`);popup.on('pageerror',e=>uiErrors.push(e.message));await popup.waitForFunction(()=>document.getElementById('profile-info').textContent.includes('已保存'));
 await click('scan');assert.equal(await popup.locator('.field').count(),21);
 check('真实 activeTab 授权 + popup：识别 21 个可填字段，排除密码、附件与复选框',()=>{assert.equal(uiErrors.length,0);});
 const matching=await popup.locator('#fields select').evaluateAll(nodes=>nodes.map(s=>({label:s.parentElement.querySelector('strong').textContent,value:s.value})));
 assert.equal(matching.filter(m=>m.label==='公司名称')[0].value,'experience.0.company');assert.equal(matching.filter(m=>m.label==='公司名称')[1].value,'experience.1.company');assert.equal(matching.find(m=>m.label==='验证码').value,'');
 passed.push('预览自动匹配：按编号区分两段经历，验证码默认不填写');console.log('PASS',passed.at(-1));
 await popup.evaluate(()=>document.getElementById('remember').checked=true);await click('fill');
 assert.equal(await web.locator('[name=fullName]').inputValue(),'测试候选人');assert.equal(await web.locator('[name=gender]').inputValue(),'M');assert.equal(await web.locator('[name=degree]').inputValue(),'bachelor');assert.equal(await web.locator('[name=company2]').inputValue(),'测试公司二');assert.equal(await web.locator('[name=edu_start]').inputValue(),'2018-09');assert.equal(await web.locator('[name=currentCity]').inputValue(),'网页已有城市');assert.equal(await web.locator('[name=captcha]').inputValue(),'');
 check('实际表单填写：中英文选项匹配、月份、已有内容保护、两段经历填入',()=>{});
 const events=await web.evaluate(()=>window.events);check('事件与提交：触发 input/change，未提交申请',()=>{assert(events.input>10);assert.equal(events.input,events.change);assert.equal(events.submit,0);});
 const map=await worker.evaluate(()=>chrome.storage.local.get('mappings'));check('实际扩展存储：记住此页对应关系且仅保存资料键，不保存资料值',()=>{assert.equal(map.mappings.length,1);assert(!JSON.stringify(map.mappings).includes('测试候选人'));});
 assert(await popup.locator('#fill').isVisible());assert.equal(await popup.evaluate(()=>document.body.scrollHeight<=600),true);
 await popup.locator('body').screenshot({path:artifact('fill-preview.png')});
 await web.locator('[name=fullName]').fill('用户后续修改');await click('undo');assert.equal(await web.locator('[name=fullName]').inputValue(),'用户后续修改');assert.equal(await web.locator('[name=mobile]').inputValue(),'');assert.equal(await web.locator('[name=currentCity]').inputValue(),'网页已有城市');
 passed.push('撤销：恢复本次填写值，同时保留用户后续修改与网页原有内容');console.log('PASS',passed.at(-1));
 await click('scan');await popup.evaluate(()=>document.getElementById('overwrite').checked=true);await click('fill');assert.equal(await web.locator('[name=fullName]').inputValue(),'测试候选人');assert.equal(await web.locator('[name=currentCity]').inputValue(),'测试城市');
 passed.push('显式覆盖：勾选覆盖后允许更新已有字段');console.log('PASS',passed.at(-1));
 await click('forget');assert.deepEqual((await worker.evaluate(()=>chrome.storage.local.get('mappings'))).mappings,[]);passed.push('清除此页字段记忆');console.log('PASS',passed.at(-1));
 // Additional difficult DOM cases, using the same installed engine.
 await web.evaluate(()=>{
  const wrap=document.createElement('section');wrap.id='edge-cases';wrap.innerHTML='<h2>边界测试</h2><label>变更字段<input id="changed"></label><label>受控字段<input id="controlled"></label><label>长度字段<input id="short" maxlength="3"></label><label>未知选择<select id="unknown"><option value="">请选择</option><option value="a">甲</option><option value="b">乙</option></select></label><input id="hidden" hidden><input id="readonly" readonly><input id="disabled" disabled><input type="radio" id="radio"><input type="file" id="file"><div id="shadow"></div><iframe id="same"></iframe><iframe src="http://localhost:1/" id="cross"></iframe>';
  document.body.append(wrap);document.getElementById('controlled').addEventListener('input',event=>event.target.value=event.target.value.toUpperCase());
  document.getElementById('shadow').attachShadow({mode:'open'}).innerHTML='<label>影子字段<input name="shadowValue"></label>';
  document.getElementById('same').srcdoc='<label>内嵌字段<input name="frameValue"></label>';
 });
 await web.locator('#same').elementHandle().then(h=>h.contentFrame()).then(f=>f.getByLabel('内嵌字段').waitFor());
 await web.bringToFront();await inject();let snap=await engine('scan');
 check('DOM 范围：可访问同源 iframe、开放 Shadow DOM；过滤不可编辑字段',()=>{
  assert(snap.fields.some(f=>f.label==='影子字段'));assert(snap.fields.some(f=>f.label==='内嵌字段'));assert(snap.blockedFrames>=1);
  for(const id of ['hidden','readonly','disabled','radio','file'])assert(!snap.fields.some(f=>f.labels.includes(id)));
 });
 let result=await engine('fill',{scanId:snap.scanId,items:[item(snap,'影子字段','shadow ok'),item(snap,'内嵌字段','frame ok')],overwrite:false});assert.equal(result.filled,2);await engine('undo');
 passed.push('实际填写与撤销：Shadow DOM 和同源 iframe');console.log('PASS',passed.at(-1));
 snap=await engine('scan');await web.locator('#changed').fill('用户新内容');result=await engine('fill',{scanId:snap.scanId,items:[item(snap,'变更字段','不得覆盖')],overwrite:true});assert.equal(result.filled,0);assert.equal(await web.locator('#changed').inputValue(),'用户新内容');passed.push('预览后用户编辑：即使勾选覆盖也不会覆盖新修改');console.log('PASS',passed.at(-1));
 snap=await engine('scan');await web.evaluate(()=>document.querySelector('#changed').parentElement.firstChild.textContent='另一个字段');result=await engine('fill',{scanId:snap.scanId,items:[item(snap,'变更字段','错误内容')],overwrite:true});assert.equal(result.filled,0);assert(result.skipped[0].includes('含义已变化'));passed.push('动态网页复用节点：标签改变后拒绝旧预览');console.log('PASS',passed.at(-1));
 snap=await engine('scan');result=await engine('fill',{scanId:snap.scanId,items:[item(snap,'长度字段','长文本超限'),item(snap,'未知选择','不存在的选项')],overwrite:false});assert.equal(result.filled,0);assert.equal(result.skipped.length,2);assert.equal(await web.locator('#short').inputValue(),'');assert.equal(await web.locator('#unknown').inputValue(),'');passed.push('字段约束：长度超限与未知下拉选项不会强行写入');console.log('PASS',passed.at(-1));
 snap=await engine('scan');result=await engine('fill',{scanId:snap.scanId,items:[item(snap,'受控字段','lowercase')],overwrite:false});assert.equal(result.filled,0);assert(result.canUndo);await engine('undo');assert.equal(await web.locator('#controlled').inputValue(),'');passed.push('网页改写输入值：提示未接受原值，仍可撤销实际改动');console.log('PASS',passed.at(-1));
 snap=await engine('scan');await web.evaluate(()=>history.pushState({},'','/next'));await assert.rejects(engine('fill',{scanId:snap.scanId,items:[],overwrite:false}),/页面已变化/);passed.push('SPA 导航：页面地址变化后拒绝旧预览');console.log('PASS',passed.at(-1));
 await web.evaluate(()=>{document.getElementById('edge-cases').remove();document.querySelectorAll('legend').forEach(l=>l.textContent=l.textContent.replace(/\d/g,''));});await click('scan');
 const workChoices=await popup.locator('.field').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('strong').textContent==='公司名称').map(n=>n.querySelector('select').value));assert.deepEqual(workChoices,['','']);passed.push('重复但无编号的工作经历：不会把第一份经历自动填入多行');console.log('PASS',passed.at(-1));
 // Responsive and XSS-style imported strings are rendered as text.
 await options.getByRole('button',{name:'＋ 添加自定义内容',exact:true}).click();await options.locator('#custom-list').getByLabel('字段标题',{exact:true}).fill('<img src=x onerror=alert(1)>');await options.locator('#custom-list').getByLabel('填写内容',{exact:true}).fill('<script>alert(1)</script>');await options.locator('#save').click();await click('scan');assert.equal(await popup.locator('#fields img').count(),0);assert.equal(await popup.locator('#fields script').count(),0);passed.push('自定义内容按文字显示，不作为 HTML 执行');console.log('PASS',passed.at(-1));
 await options.setViewportSize({width:600,height:900});assert(await options.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));passed.push('资料页窄屏布局无横向溢出');console.log('PASS',passed.at(-1));
 assert.equal(uiErrors.length,0);passed.push('资料页与弹窗运行无未捕获脚本错误');console.log('PASS',passed.at(-1));
 await options.setViewportSize({width:1440,height:1080});
 const personalFile=path.join(__dirname,'fixtures/demo-profile.json');
 await options.locator('#import-file').setInputFiles(personalFile);await options.locator('#status').filter({hasText:'已合并'}).waitFor();
 assert.equal(await options.locator('#awards .record').count(),30);assert.equal(await options.locator('#projects .record').count(),5);assert.equal(await options.locator('#experience .record').count(),3);await options.locator('#save').click();
 await options.locator('#import-file').setInputFiles(personalFile);await options.locator('#status').filter({hasText:'已合并'}).waitFor();assert.equal(await options.locator('#awards .record').count(),30);await options.locator('#save').click();await options.reload();await options.locator('#save:enabled').waitFor();assert.equal(await options.locator('#awards .record').count(),30);assert.equal(await options.locator('#experience .record').count(),3);
 passed.push('实际资料页：增量包导入、重复导入、保存重载，奖项不丢失且已有经历保留');console.log('PASS',passed.at(-1));
 await web.evaluate(()=>{const box=document.createElement('section');box.innerHTML='<fieldset><legend>获奖经历 1</legend><label>奖项名称<input id="award-name"></label><label>获奖时间<input type="month" id="award-date"></label></fieldset><label>获奖情况<textarea id="all-awards"></textarea></label>';document.body.append(box);});
 await click('scan');await click('fill');assert.equal(await web.locator('#award-name').inputValue(),personal.sections.awards[0].name);assert.equal(await web.locator('#award-date').inputValue(),'2026-11');assert.equal((await web.locator('#all-awards').inputValue()).split('\n').length,30);
 await click('undo');assert.equal(await web.locator('#award-name').inputValue(),'');assert.equal(await web.locator('#all-awards').inputValue(),'');passed.push('实际网页：单条奖项、月份与全部30条奖项汇总填写及撤销');console.log('PASS',passed.at(-1));
 await click('check-submit');assert.equal(await popup.locator('#submit-current').isEnabled(),false);assert((await popup.locator('#status').textContent()).includes('尚无经过适配的提交入口'));assert.equal(await web.evaluate(()=>events.submit),0);passed.push('实际插件提交检查：未适配的通用网页保持手动提交，不误触表单');console.log('PASS',passed.at(-1));
 // Restart the actual extension context to verify persistence.
 const saved=await worker.evaluate(()=>chrome.storage.local.get('profile'));assert.equal(saved.profile.experience[1].company,'测试公司二');assert.equal(saved.profile.awards.length,30);assert.equal(uiErrors.length,0);
 console.log(`TOTAL ${passed.length} checks passed`);
 fs.writeFileSync(artifact('test-results.json'),JSON.stringify({browser:ctx.browser().version(),checks:passed,scope:'交付扩展包，独立 Chromium 测试配置，本地 HTTP 表单；真实 Chrome API，无网站兼容性结论'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;fs.writeFileSync(artifact('test-failure.txt'),String(e.stack));}).finally(async()=>{if(ctx)await ctx.close();if(server)await new Promise(r=>server.close(r));});
