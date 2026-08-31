# Godot FX Atlas

可搜索、可筛选并可按价格排序的 2D 技能与卡牌特效参考库。当前收录 1100+ 个已核对的公开资源链接，并新增带许可、来源收据、文件哈希和用途索引的生产贴图库。

项目现在有两层互补内容：

- 首页保留原有的特效搜索与实现思路：用于检索真实插件、Shader、素材包和视觉方案，并读取每项的用途与 Godot 实现方向。
- [`materials.html`](./materials.html) 是可直接分发的生产贴图库，用于筛选、预览、下载贴图并导出选材清单。

仓库原有首页以已发布的静态 bundle 保存；`src/`、`scripts/` 与测试目前维护新增的生产贴图库，不会反向修改旧 bundle。

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
- 外部插件的脚本、二进制、工程文件和 Shader 不会随贴图一起存入生产库。
- 文件级索引记录 SHA-256；完整素材包留在 Atlas，游戏项目只复制实际选择的子集。

公开审计结果位于 `audit-report.json`、`semantic-audit.json`、`mechanism-index.json` 与 `final-link-audit.json`。多元素合集只作为通用合集收录，单一元素分类优先链接到对应的独立子包页面。

生产贴图库的数据合同与新来源导入流程见 [生产贴图库维护说明](./docs/material-library.md)。

仓库内的 [`skills/godot-fx-atlas`](./skills/godot-fx-atlas/SKILL.md) 可让 AI 串联原站检索、实现思路提取、贴图选择、来源收据和 Godot 接入计划；它不会把某个消费项目的私有信息写回公开 Atlas。

## 创作与实现

从检索参考到离线生图、序列帧 + Shader/程序层、透明素材门禁和专用 Gallery 验收，统一遵循 [2D 技能特效创作工作流](./docs/vfx-authoring-workflow.md)。Atlas 只保存跨项目通用方法，不保存任何消费项目的角色、编号、策划文本、私有素材或接入状态。
