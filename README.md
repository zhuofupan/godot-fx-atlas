# Godot FX Atlas

可搜索、可筛选并可按价格排序的 2D 技能与卡牌特效参考库。当前收录 1200+ 个已核对的公开资源链接，并提供带许可、来源收据、文件哈希和用途索引的资产贴图库。

在线访问：[zhuofupan.github.io/godot-fx-atlas](https://zhuofupan.github.io/godot-fx-atlas/)

## 功能

- 按战斗机制、视觉标签、卡牌表现、来源、场景与价格检索真实特效资源。
- 展开每条资源的核对证据、许可信息和 Godot 实现参考。
- 将 ShaderV 的 93 个 Godot 4.x VisualShader 节点拆成独立搜索条目，并直达锁定提交中的源码定义。
- 在资产贴图库中按效果原型、贴图族和合成层级筛选成熟位图。
- 下载透明底或黑底 PNG，并导出带来源收据和 SHA-256 的选材清单。
- 通过仓库内 Skill 帮助 AI 串联参考检索、实现规划、贴图选择与项目接入。

项目现在有两层互补内容：

- 首页保留原有的特效搜索与实现思路：用于检索真实插件、Shader、素材包和视觉方案，并读取每项的用途与 Godot 实现方向。
- [`materials.html`](./materials.html) 是可直接分发的资产贴图库，用于筛选、预览、下载贴图并导出选材清单。

仓库原有首页以已发布的静态 bundle 保存；`reference-sources/` 保存经过许可证审计的外部节点清单，构建脚本以可重复、可回滚的生成区块把新增条目注入主搜索库。`src/`、`scripts/` 与测试同时维护资产贴图库、页尾来源和相关数据合同。

## 主要目录

```text
materials/                  已审计贴图、来源锁与生成索引
reference-sources/          锁定版本的公开插件节点清单
skills/godot-fx-atlas/      面向 AI 的检索和选材 Skill
src/                        可维护的贴图库、来源补充与索引生成源码
assets/                     GitHub Pages 直接加载的构建产物
scripts/                    素材导入、本地服务与构建脚本
tests/                      索引、许可、哈希、页尾来源与 Skill 合同测试
docs/                       创作工作流和贴图库维护说明
```

## 本地运行

```bash
npm install
npm run dev
npm run build
npm test
```

## 数据原则

- 主链接必须通过 HTTP 状态与页面标题核对。
- Godot Shader 只接收 `canvas_item`；外部素材需有 2D Effects 或 2D Art 依据。
- 战斗机制只根据资源标题或原站标签精确匹配，不以弱关键词凑数。
- 通用卡牌、UI 与视觉反馈资源允许不绑定具体机制。
- Itch.io 固定价格取自同一资源列表页；其他资源站条目按免费资源记录，采用前仍需查看原页许可和当前价格。
- 只有 `distribution_policy: direct_use` 且经过安全清洗的位图可以进入 `materials/library/`。
- 外部插件的脚本、二进制、工程文件和 Shader 不会混入资产贴图库；公开源码可在其许可证允许的范围内被索引、验证和复用。
- 文件级索引记录 SHA-256；完整素材包留在 Atlas，游戏项目只复制实际选择的子集。

公开审计结果位于 `audit-report.json`、`semantic-audit.json`、`mechanism-index.json` 与 `final-link-audit.json`。多元素合集只作为通用合集收录，单一元素分类优先链接到对应的独立子包页面。

资产贴图库的数据合同与新来源导入流程见 [资产贴图库维护说明](./docs/material-library.md)。

仓库内的 [`skills/godot-fx-atlas`](./skills/godot-fx-atlas/SKILL.md) 可让 AI 串联原站检索、实现思路提取、贴图选择、来源收据和 Godot 接入计划；它不会把某个消费项目的私有信息写回公开 Atlas。

## 鸣谢

感谢 [Godot Shaders](https://godotshaders.com/)、[Godot Asset Library](https://godotengine.org/asset-library/asset)、[Itch.io](https://itch.io/game-assets/tag-2d/tag-effects)、[OpenGameArt](https://opengameart.org/content/2danimationeffect)、[CodeFronts](https://codefronts.com/)、[Game-icons.net](https://game-icons.net/)、[IconsDB](https://www.iconsdb.com/) 与 [ShaderV](https://github.com/arkology/ShaderV) 及其中的原作者和维护者为参考索引提供公开资料；感谢 [Kenney](https://kenney.nl/assets/particle-pack) 以 CC0 发布首批资产贴图。

Atlas 的收录和鸣谢不改变任何原作品的版权、许可、价格或使用条件，采用前仍应核对对应原页。

## 创作与实现

从检索参考到离线生图、序列帧 + Shader/程序层、透明素材门禁和专用 Gallery 验收，统一遵循 [2D 技能特效创作工作流](./docs/vfx-authoring-workflow.md)。Atlas 只保存跨项目通用方法，不保存任何消费项目的角色、编号、策划文本、私有素材或接入状态。
