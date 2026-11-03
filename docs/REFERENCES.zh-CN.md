# 求职快填 1.7.0：GitHub参考与优化说明

此文保留1.7.0增强时的阅读记录。1.8.0将该实现模块化，当前架构与验证结果见[架构](ARCHITECTURE.md)和[测试记录](TEST_REPORT.zh-CN.md)；历史交付文件只保留在本机归档。

检索与阅读日期：2026-11-02。本次通过 GitHub 连接器搜索 `resume autofill browser extension`、`网申 自动填写`、`autofill extension forms`，阅读下列项目的说明与相关源文件。参考其处理思路，在原有插件中自行实现增量改动，没有引入上游运行依赖或整体替换现有引擎。

| 参考项目与源文件 | 已阅读内容 | 本版对应改进 |
| --- | --- | --- |
| [OpenJobAutofill](https://github.com/Br1an67/OpenJobAutofill)，[src/content.js](https://github.com/Br1an67/OpenJobAutofill/blob/main/src/content.js) | 可访问性标签、字段属性、分组控件语义与适配器的组织方式 | 保留现有平台适配器，补强真实标签与aria语义的优先级，修复相邻标签误关联与重复注入状态丢失 |
| [auto-ws](https://github.com/happy-q123/auto-ws)，[content/domParser.js](https://github.com/happy-q123/auto-ws/blob/master/content/domParser.js)、[content/filler.js](https://github.com/happy-q123/auto-ws/blob/master/content/filler.js) | 字段上下文和根据控件提示转换日期的处理 | 按明确格式转换日期；本版继续要求所需日期精度，缺少日或时刻时跳过，不设置默认1日或零点 |
| [profile-autocomplete](https://github.com/OfferHunter/profile-autocomplete)，[src/content/collector.js](https://github.com/OfferHunter/profile-autocomplete/blob/main/src/content/collector.js) | label/for、aria、legend、autocomplete等语义信号与开放Shadow DOM遍历 | 在原有同源iframe、Shadow DOM基础上补充标准autocomplete回退与原生命名单选组识别 |

本次没有运行下载的上游项目或复制整段上游实现；也没有加入它们的AI、服务端或云同步流程。原有原生value setter、input/change事件、同源iframe、开放Shadow DOM能力在1.6.0中已存在，本次未将其计作新增功能。

## 源文件快照标识

以下为 GitHub Contents API 返回的**文件blob SHA**，用于辨认本次实际阅读的内容，不是提交SHA；文件链接随分支更新可能变化。

| 项目 | 文件 | blob SHA |
| --- | --- | --- |
| Br1an67/OpenJobAutofill | README.md | `9ff83a65e581256cdcea408280a2c1deb6bdc632` |
| Br1an67/OpenJobAutofill | src/content.js | `a29142dee071bea6875fd88b8fdbb207797d612b` |
| happy-q123/auto-ws | README.md | `c76ef400d4f25ddb7c391ef59b67ee823a22596a` |
| happy-q123/auto-ws | content/domParser.js | `5afa8c21490856144fc42cf23e1708a405414575` |
| happy-q123/auto-ws | content/filler.js | `e254215b7dd07fd2bae2421722276282f782c8e3` |
| OfferHunter/profile-autocomplete | src/content/collector.js | `25ff6c60d40516802191234006994b614e08173e` |

## 保留的主体

- 继续使用Manifest V3、本机资料、预览匹配、填写、撤销与独立提交检查流程。
- 保留原界面布局、资料编辑方式、JSON资料结构、中文界面及已有平台适配器。
- 权限仍是`activeTab`、`scripting`、`storage`，没有新增常驻网站权限或运行依赖；扩展页继续禁止网络连接。
- 保留已保存内容和预览后用户修改；不增加默认身份、默认日期或自动勾选协议。

## 交付代码改动

| 文件 | 改动 |
| --- | --- |
| engine.js | 标签归属与优先级、原生命名单选组、明确格式日期转换、原生字段约束检查、写入后延迟复查、新字段提示数据 |
| schema.js | 显式语义标签加权，标准autocomplete仅在缺少显式标签时回退 |
| adapters.js | 包装Moka适配器时保留通用引擎版本与其他状态标识，重复注入不丢失状态 |
| popup.js | 继续使用原填入流程，发现新控件后补充结果提示 |
| manifest.json、options.html | 版本1.7.0与支持范围文字；未改变布局和权限 |

## 验证与范围

本版在本机Chromium中运行原生扩展API测试、原有平台控件测试及新增多格式测试，具体项目和结果见“测试报告.md”与“多格式自动填写测试报告.md”。本次未向招聘网站提交申请，不代表所有招聘系统已完成实站验收。没有明确标签、没有唯一匹配或需要附件/验证码等交互时仍需在页面处理。
