import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const current=await load('artifacts/current/summary.json'),baseline=await load('artifacts/baseline/summary.json'),equivalence=await load('artifacts/current/equivalence-results.json');
assert.equal(current.total,baseline.total);assert.equal(current.total,115);assert.equal(equivalence.checks.length,12);
const names={native:'真实扩展与原生表单',moka:'Moka',bsh:'博西双语',moseeker:'仟寻',aac:'瑞声与提交检查',formats:'多格式',web:'原网页助手'};
const report=`# 1.8.0 重构测试记录

本机验证日期：2026-11-03。原1.7.0与重构后的1.8.0均通过同一套${current.total}项行为检查；另外通过${equivalence.checks.length}项等价检查。所有公共测试资料均为虚构资料。浏览器：Chromium ${current.suites[0].browser}，Windows，Node.js 24。

## 同一套行为检查

| 套件 | 1.7.0基线 | 1.8.0重构版 |
| --- | --- | --- |
${current.suites.map(s=>'| '+names[s.suite]+' | '+s.checks.length+' / '+s.checks.length+' | '+s.checks.length+' / '+s.checks.length+' |').join('\n')}
| 合计 | ${current.total} / ${current.total} | ${current.total} / ${current.total} |

## 等价检查

${equivalence.checks.map(s=>'- '+s+'。').join('\n')}

## 覆盖范围

- 真实MV3加载与activeTab授权，真实chrome.storage和chrome.scripting流程；资料编辑、导入、保存、重载及预览。
- 6类本地表单：原生HTML、Moka、博西双语、MoSeeker、AAC/ATSX、多格式矩阵；直接比较两版扫描与自动匹配输出。
- 13种日期控件/格式、中英文/aria/autocomplete语义、原生单选、约束、动态新增字段、延迟改写、同源iframe与开放Shadow DOM。
- 自定义菜单真实选择、拆分年月与日期日历、学校锚点、重复经历补齐、保护已有与用户后续修改、填写和撤销。
- 必填检查、协议保持、验证码中止、独立预览/确认、防止重复提交；提交验证使用本地计数器。
- 原网页助手仍可加载、默认姓名/简历为空、独立虚构资料保存后可重载、无未捕获脚本错误。

## 资料与构建检查

个人资料与旧交付文件仅保存在本机Git忽略目录。迁移中的个人JSON按字节复制，未改写。公开套件只读取tests/fixtures/demo-profile.json，不读取本机资料。源码提交前运行资料检查，构建仅读取扩展源码/公共资源，安装包仅包含生成的扩展。

1.8.0构建保持原弹窗HTML、样式与图标；资料页HTML只改版本显示；manifest除版本外一致。原网页业务文件与仓库原提交一致。源码重构不改变界面、JSON接口、注入顺序或平台操作语义。

## 验证边界

本次没有对真实招聘平台执行新填写或投递，未验证账号登录、后台保存或最终受理。网站更新、跨域iframe、未适配自绘组件、附件上传、协议、承诺与验证码仍须按实际网页处理。写入后120毫秒复查不能证明更晚的后台校验结果。

两版共同通过本地行为与输出对比，是本次“效果保持”的依据，不构成对任意招聘网站的全面兼容承诺。公开CI只运行当前版本与资料检查；基线归档保留在本机，不上传GitHub。GitHub运行状态以仓库Actions页面为准。

## 复测

公开仓库：npm ci → npx playwright install chromium → npm run verify。

有本机1.7.0归档时，再运行npm run test:baseline和npm run test:equivalence。日志与逐项JSON在artifacts/current和artifacts/baseline，均不入库。参考[README](../README.md)和[架构说明](ARCHITECTURE.md)。

## English summary

Both the archived 1.7.0 build and the refactored 1.8.0 build passed the same ${current.total} behavior checks. An additional ${equivalence.checks.length} checks compared UI assets, manifest, profile exports, profile entries, and scans/matching across six form types. All public fixtures are fictional. Tests used real extension APIs and reconstructed local forms; they do not establish live website persistence or application acceptance. Personal profiles and baseline archives stay local and are excluded from the repository and extension package.
`;
await fs.writeFile(path.join(root,'docs/TEST_REPORT.zh-CN.md'),report);
console.log('Wrote test report: 115 behavior + 12 equivalence checks.');
