# 资产贴图库维护说明

Godot FX Atlas 将外部资源分成两条互不混淆的通道：

- **参考案例库**：保存原站链接、机制标签与视觉参考。这里的条目不等于允许复制、再分发或直接接入。
- **资产贴图库**：只保存许可允许再分发、来源被锁定、并经过安全清洗的位图。每个文件都有用途标签、尺寸、哈希和来源收据。

这使 Atlas 可以吸收成熟资源的价值，但不会把许可不明素材或付费资源直接复制进仓库。许可允许的公开插件代码与 Shader 可以进入参考索引和实现方案；消费项目的任何私有信息都不得写入公开 Atlas。

## 数据结构

```text
materials/
├── sources.lock.json          # 来源、版本、许可、归档与清洗收据
├── material-taxonomy.json     # 贴图族到效果原型/图层角色的人工映射
├── catalog.json               # 由导入脚本生成的文件级索引
├── licenses/                  # 随来源保存的许可原文
└── library/<source_id>/
    ├── transparent/           # 生产优先版本
    └── black/                 # 黑底预览或特定混合模式候选
```

`catalog.json` 不手工维护。贴图用途来自 `material-taxonomy.json`，文件尺寸、透明性、字节数和 SHA-256 来自导入时的实际文件。

## 来源策略

每个来源必须明确标记一种 `distribution_policy`：

- `direct_use`：许可与审计证据允许仓库保存、展示和下载素材文件。
- `reference_only`：只保留原站链接与元数据，不复制文件。
- `blocked`：许可、安全性或来源无法确认，不进入 Atlas。

即使来源允许直接使用，`materials/library/` 也只导入清洗后的位图。脚本、二进制、编辑器插件、Shader 和项目文件不会跟随素材包误入贴图库；其中许可合格且有实现价值的公开代码，可以另行逐项收录到参考与实现索引。原始压缩包与隔离缓存保存在仓库之外。

当前直接分发来源包括 Kenney Particle Pack、Kenney Smoke Particles，以及 RPicster 仓库中人工选取的 256px Alpha/灰度 VFX 贴图。来源页统计和锁定归档不一致时，以实际归档清单、归档哈希和 `archive_asset_count` 为准，不为凑官网旧数字而丢弃合格文件。

## 导入新素材源

1. 在维护流程中核对原站、许可、版本和下载归档 SHA-256。
2. 在隔离目录下载、解包并清洗；拒绝可执行内容、软链接和路径逃逸。
3. 将收据写入 `materials/sources.lock.json`，把可复用贴图族补入 `materials/material-taxonomy.json`。
4. 从清洗目录运行导入器：

```bash
node scripts/import-material-source.mjs --source-id <source_id> --input <sanitized_directory>
```

5. 运行 `npm run build` 与 `npm test`。测试会复算仓库中每个分发文件的 SHA-256。

导入脚本只接受 `.png`、`.webp`、`.jpg` 和 `.jpeg`，并拒绝符号链接。许可仍不清楚时，不要通过扩展允许列表绕过来源门禁。

## 在项目中使用

网页的“导出选材清单”会生成带来源收据和文件哈希的 JSON。建议先按效果原型筛选，再挑选少量贴图作为 `shape`（主体形状）或 `finish`（修饰收尾）层：

1. 优先使用透明底版本作为灰度遮罩或粒子纹理。
2. 在 Godot 中通过颜色曲线、材质、粒子运动和时序重建项目风格。
3. 不让通用贴图独自承担技能身份；图标语法、阵营、角色和元素语言仍由产品资产定义。
4. 把选材清单与实际复制文件一同留存，便于升级、替换和许可复核。

完整素材包适合留在 Atlas 中作为候选库；实际游戏项目只复制被选中的生产子集，避免导入时间、显存和资源浏览噪声随素材库规模增长。
