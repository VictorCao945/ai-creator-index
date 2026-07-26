# AI Creator Index｜AI 创作者档案库

从创作者的公开内容出发，找到他们提过的产品、播客、文章、开源项目和原始来源。

V0.1 收录 **小盖**。档案不是“起底”，而是一份可被纠正、可继续溯源的内容情报底稿。

更新订阅：点击仓库右上角 **Watch**，或订阅
[`releases.atom`](https://github.com/VictorCao945/ai-creator-index/releases.atom)。

## V0.1

- [小盖档案](generated/creators/xiaogai.md)
- [机器可读索引](generated/index.json)
- [版本清单](generated/manifest.json)
- [公开查询 Skill](skills/explore-ai-creators/SKILL.md)
- [小红书 #001 发布素材](xhs-output/001-xiaogai/)

数据快照：**2026-07-26**。本次遍历范围、热度口径和证据规则均记录在档案中。

## 证据规则

- **A**：原节目、官方页面、原仓库、官方活动记录，或主张直接来自原始笔记。
- **B**：事件本身可核实，但具体观点来自转述或二手报道。
- **C**：只确认到笔记或附件，尚未找到公开、稳定的原始出处。

证据等级表示来源链完整度，不表示观点一定正确。

## 查询 Skill

安装：

```bash
npx skills add https://github.com/VictorCao945/ai-creator-index --skill explore-ai-creators
```

可查询：

- 某位创作者提过哪些产品、播客、文章或项目；
- 只返回 A 级来源；
- 最近 90 天或全历史高热内容；
- 原始链接、证据等级、验证状态和最后核验日期。

Skill 只读，不登录、不抓取、不发布，也不模仿创作者风格。使用时会检查 GitHub 版本清单并校验 SHA256；网络不可用时明确回退到安装时快照。

## 数据维护

唯一可编辑内容数据源是 [`data/index.yaml`](data/index.yaml)。请勿直接修改 `generated/`、`docs/data/` 或 Skill 快照。

```bash
npm install
npm run validate
npm run build:all
npm test
```

生成链路：

```text
data/index.yaml
  ├─ generated/index.json + manifest.json
  ├─ generated/creators/*.md
  ├─ docs/ GitHub Pages
  ├─ Skill installation snapshot
  └─ 小红书 SVG / PNG / 来源清单
```

## 参与

- [推荐下一位创作者](../../issues/new?template=creator-nomination.yml)
- [信息纠错](../../issues/new?template=creator-correction.yml)
- [报告失效链接](../../issues/new?template=broken-link.yml)
- [博主本人补充](../../issues/new?template=creator-self-submission.yml)

博主本人提交与编辑核验分开记录，不自动设置未经验证的“本人认证”。

## 许可与边界

- 代码：MIT，见 [LICENSE](LICENSE)。
- 原创结构化整理与摘要：CC BY 4.0，见 [LICENSE-DATA.md](LICENSE-DATA.md)。
- 外部文章、播客、视频、图片和商标版权归原作者或权利人。
- 仓库不保存 Cookie、鉴权参数、完整视频、完整转写或批量原图。
