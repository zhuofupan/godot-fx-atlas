# Godot FX Atlas

可搜索、可筛选并可按价格排序的 2D 技能与卡牌特效参考库。当前收录 1100+ 个已核对的公开资源链接，来源包括 Godot Shaders、Godot Asset Library、Itch.io、OpenGameArt 与补充资源站。

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

公开审计结果位于 `public/audit-report.json`、`public/mechanism-index.json` 与 `public/final-link-audit.json`。
