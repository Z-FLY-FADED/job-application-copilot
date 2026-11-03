# 求职快填 · Job Application Copilot

[English](README.en.md) · [验证流程](https://github.com/Z-FLY-FADED/job-application-copilot/actions/workflows/verify.yml) · [架构](docs/ARCHITECTURE.md) · [测试记录](docs/TEST_REPORT.zh-CN.md)

使用保存在本机的资料，识别招聘申请表中的字段，预览对应关系，再填写个人信息、教育、实习、项目、奖项与在校职务。支持撤销、已有内容保护，以及已适配平台的独立提交检查。

本仓库同时保留原有「职投台」网页助手，用于岗位整理、简历画像、投递队列和记录导出。网页助手与浏览器插件分别保存资料，不会自动互相导入。界面保持中文。

## 1.8.0：保持行为的模块化重构

- 将DOM扫描、控件填写、资料结构、语义匹配、平台适配和界面拆为独立模块。
- 使用esbuild在本机构建MV3扩展，保持原有界面、JSON格式、权限与使用顺序。
- 保留Moka、博西双语、MoSeeker和AAC/ATSX控件适配，以及原生输入框、单选组、日期格式、同源iframe和开放Shadow DOM支持。
- 加入可复现测试、GitHub Actions和资料检查。公共示例与测试全部使用虚构资料。

## 构建与安装插件

需要Node.js 22或更新版本、npm；开发测试还需要Playwright Chromium。

```sh
git clone https://github.com/Z-FLY-FADED/job-application-copilot.git
cd job-application-copilot
npm ci
npm run build
```

1. 在Edge打开 `edge://extensions`，或在Chrome打开 `chrome://extensions`。
2. 开启开发人员模式，加载已解压扩展，选择 **`dist/extension`**。
3. 点击插件的「编辑资料」，自行填写或导入本机JSON备份，再保存。
4. 在招聘申请表按「识别当前页面 → 核对匹配 → 填入」操作。
5. 页面新增了经历或联动字段时，继续核对新预览并填写；提交前检查实际网页。

更新已有安装时，先导出资料备份，再将新构建内容覆盖到**原加载目录**，在扩展管理页刷新。改变加载目录可能创建新的扩展身份，需要导入本机备份；请通过覆盖刷新更新。插件未上架浏览器商店。

```sh
npm run package
```

生成 `releases/jobfill-extension-1.8.0.zip` 和SHA-256文件。压缩包只含可安装扩展，不包含个人资料、浏览器状态或开发依赖。成功的GitHub Actions运行也提供 `jobfill-extension` 构建产物。

## 原网页助手

双击 `启动投递助手.bat`，或用浏览器打开根目录 `index.html`。原网页与业务脚本保持不变；功能和使用方法见[原网页说明](docs/WEB_ASSISTANT.zh-CN.md)。

## 测试

```sh
npm ci
npx playwright install chromium
npm run verify
```

`verify`会构建扩展、运行7组行为检查，再检查待入库文件。115项行为检查覆盖真实MV3加载、activeTab、chrome.storage、chrome.scripting、通用与平台表单控件，以及原网页助手。它们在独立浏览器和本机HTTP表单运行，不使用个人浏览器配置。

本次本机还对比1.7.0与1.8.0：两版均通过同一套115项行为检查，另有12项等价检查。详见[测试记录](docs/TEST_REPORT.zh-CN.md)。这不代表所有招聘系统已通过实站验收；后台保存、登录、验证码与最终受理状态仍须在实际网页核实。

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 构建 `dist/extension` |
| `npm test` | 构建并运行完整行为测试 |
| `npm run test:web` | 只测原网页助手 |
| `npm run check:privacy` | 检查待入库文件中的私人目录、证件号码和凭证特征 |
| `npm run package` | 构建并打包扩展 |
| `npm run test:baseline` | 有本机1.7.0归档时，运行同一套行为测试 |
| `npm run test:equivalence` | 两版测试后，比较扫描、匹配、界面与资料接口 |

测试产物在Git忽略的 `artifacts/`。可设置 `JOBFILL_BROWSER` 指向测试版Chromium，或用 `JOBFILL_EXTENSION_DIR` 指向其他构建目录。本机基线归档不随仓库提供，因此基线命令不是公开CI的必需步骤。

## 目录

```text
src/extension/
  content/core/          DOM、控件、填写/撤销状态
  content/adapters/      Moka、MoSeeker、AAC/ATSX
  content/submission.js  独立提交检查与防重
  shared/               资料、匹配、文本规则和注入配置
  ui/                   弹窗与资料页逻辑
public/extension/        manifest、HTML、样式与图标
scripts/                 构建、测试、打包与资料检查
tests/fixtures/          虚构资料与本地表单
docs/                    架构、参考与验证记录
dist/extension/          可加载构建；Git忽略
local-private/           本机个人资料与历史归档；Git忽略
artifacts/               测试产物；Git忽略
releases/                打包产物；Git忽略
index.html, app.js, …    保留的原网页助手
```

## 资料与行为边界

- 权限仍是`activeTab`、`scripting`、`storage`；扩展页CSP禁止网络连接。插件自身不调用AI、云端接口或同步服务。填写后，招聘网站会收到所填信息。
- 插件资料使用`chrome.storage.local`；网页助手使用`localStorage`。导出文件未另行加密，需自行保管。
- 个人JSON、简历、历史截图、日志、浏览器状态和归档保存在忽略目录，不进入提交或构建产物。
- 不猜测缺少的日期、时刻或歧义选项；协议/承诺、验证码和附件仍需在网页处理。
- 「检查提交条件」与「提交」是独立动作。仅适用于已适配入口，填写后不会自动提交；最终结果以网页为准。

参考项目见[GitHub阅读记录](docs/REFERENCES.zh-CN.md)。构建与测试方式参考[esbuild官方API](https://esbuild.github.io/api/)和[Playwright扩展测试文档](https://playwright.dev/docs/chrome-extensions)。原有使用范围说明见保留的网页指南，未另加开源许可证。
