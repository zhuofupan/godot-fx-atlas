# Godot FX Atlas

可搜索、可筛选并可按价格排序的 2D 技能与卡牌特效参考库。当前收录 1200+ 个已核对的公开资源链接，并提供带许可、来源收据、文件哈希和用途索引的资产贴图库。

在线访问：[zhuofupan.github.io/godot-fx-atlas](https://zhuofupan.github.io/godot-fx-atlas/)

## 功能

- 按战斗机制、视觉标签、卡牌表现、来源、场景与价格检索真实特效资源。
- 展开每条资源的核对证据、许可信息和 Godot 实现参考。
- 将 ShaderV 的 93 个 Godot 4.x VisualShader 节点拆成独立搜索条目，并直达锁定提交中的源码定义。
- 在资产贴图库中按效果原型、贴图族和合成层级筛选 12 个已审计来源的 715 项素材。
- 下载透明、黑底、反相、分辨率、粗细线、彩色/灰度或序列帧版本，并导出带来源收据和 SHA-256 的选材清单。
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

显式联网刷新来源页远程预览 URL：

```bash
npm run refresh:previews
```

该命令只更新 `reference-previews.json` 中的 HTTPS 图片链接，不下载图片；普通构建和网站检索不会自动访问来源页。

## 数据原则

- 主链接必须通过 HTTP 状态与页面标题核对。
- Godot Shader 只接收 `canvas_item`；外部素材需有 2D Effects 或 2D Art 依据。
- 战斗机制只根据资源标题或原站标签精确匹配，不以弱关键词凑数。
- 通用卡牌、UI 与视觉反馈资源允许不绑定具体机制。
- Itch.io 固定价格取自同一资源列表页；其他资源站条目按免费资源记录，采用前仍需查看原页许可和当前价格。
- 只有 `distribution_policy: direct_use` 且经过安全清洗的位图可以进入 `materials/library/`。
- 资产贴图库只接收清洗后的位图；公开插件代码和 Shader 可以在许可允许时进入参考索引与实现方案，但不会被误装成贴图资产。
- 公开 Atlas 不接收任何消费项目的私有信息、策划内容、角色数据、私有素材或接入状态。
- 展示卡预览只保存来源页公开元数据提供的远程图片 URL，不下载、不缓存、不重新分发原图；当前已经渲染的卡片会自动进入低并发渐进加载队列，不必滚动到卡片附近，也不会在刷新时同时发起全部请求。来源页无图或远程图片失效时，改用 ShaderV、Godot Shaders、Godot Asset Library 等对应来源站点的远程品牌图，不再回退到抽象效果图标。
- 文件级索引记录 SHA-256；完整素材包留在 Atlas，游戏项目只复制实际选择的子集。

公开审计结果位于 `audit-report.json`、`semantic-audit.json`、`mechanism-index.json` 与 `final-link-audit.json`。多元素合集只作为通用合集收录，单一元素分类优先链接到对应的独立子包页面。

资产贴图库的数据合同与新来源导入流程见 [资产贴图库维护说明](./docs/material-library.md)。

仓库内的 [`skills/godot-fx-atlas`](./skills/godot-fx-atlas/SKILL.md) 可让 AI 串联原站检索、实现思路提取、贴图选择、来源收据和 Godot 接入计划；它不会把某个消费项目的私有信息写回公开 Atlas。

## 技能视觉导演与制作流程

Atlas 不只是贴图下载页，也可以作为 AI 制作 Godot 2D/伪 3D 技能特效时的参考检索层。推荐流程如下：

1. **理解策划与工程约束**：读取消费项目自己的协作规则、策划文档、技能/单位定义、事件合同、资源规范和 `project.godot`，先确认玩法语义、Godot 版本、渲染后端、逻辑分辨率与性能边界。
2. **核对视觉身份**：通过稳定的内容 ID 找到技能图标、卡面、角色图、既有特效和真实战斗截图并实际查看；不根据文件名或外观猜测技能归属。
3. **在真实场景中导演表现**：结合施法者、目标、路径、落点、范围、镜头、遮挡、UI 和同屏并发量，设计 `意图预告 → 主动作 → 结算/命中峰值 → 持续状态 → 收尾/回收` 的节拍，并明确哪些反馈属于世界空间、屏幕空间或界面层。
4. **检索并匹配 Atlas**：按机制、轮廓、运动、时序、材质和收尾方式检索最接近的实现方案，再查找可直接使用或仅供参照的资产；保存效果 ID、素材 ID、许可、来源收据、锁定版本与文件哈希。
5. **决定资产策略**：优先级为 `项目既有资产 → Atlas 可直接使用资产 → 原创生图 → Shader / 粒子 / Tween / 程序绘制`。只复制实际选中的素材子集，不把整个资产库塞进消费项目。
6. **按缺口调用生图工具**：只有在导演方案已经确定、且确实缺少关键轮廓、遮罩或序列帧时才生成新图。短动画优先生成 4–8 帧或独立关键帧，再确定性打包；随后检查真实 Alpha、网格、帧序、边缘和枢轴。生图不是每个效果的固定步骤。
7. **特征化制作**：分别处理 `形状、运动、时序、材质/光感、生命周期`。先建立低频主轮廓和主运动，再叠加高频细节；根据需要组合序列帧、CanvasItem Shader、粒子、Tween、`Line2D`、`Polygon2D` 和程序绘制，而不是照搬某个演示效果。
8. **接入并验收**：表现层只消费已提交事件或只读 ViewModel，不重新计算玩法结果。检查导入参数、Alpha、帧序、取消/中断、对象池、循环、复杂背景辨识度、关闭 Glow 时的可读性和真实显示尺寸；headless 检查之后仍需进行 GPU 实机预览和人工视觉验收。

如果任务只要求方案或选材，流程可以在对应阶段停止；如果要求可交付特效，则应继续完成项目接入、真实场景验证与结果记录。更细的制作、序列帧和验收门禁见 [2D 技能特效创作工作流](./docs/vfx-authoring-workflow.md)，AI 检索接口见 [`skills/godot-fx-atlas`](./skills/godot-fx-atlas/SKILL.md)。

Atlas 只保存跨项目通用的方法、公开来源与审计信息，不保存任何消费项目的角色、编号、策划文本、私有素材或接入状态。

## 鸣谢

感谢 [Godot Shaders](https://godotshaders.com/)、[Godot Asset Library](https://godotengine.org/asset-library/asset)、[Itch.io](https://itch.io/game-assets/tag-2d/tag-effects)、[OpenGameArt](https://opengameart.org/content/2danimationeffect)、[CodeFronts](https://codefronts.com/)、[Game-icons.net](https://game-icons.net/)、[IconsDB](https://www.iconsdb.com/) 与 [ShaderV](https://github.com/arkology/ShaderV) 及其中的原作者和维护者为参考索引和展示卡远程预览提供公开资料；感谢 [Kenney](https://kenney.nl/)、[RPicster](https://github.com/RPicster/Godot-particle-and-vfx-textures) 与 OpenGameArt 作者 [para](https://opengameart.org/users/para) 以 CC0 发布可直接分发的特效贴图与序列帧。

Atlas 的收录、远程预览和鸣谢不改变任何原作品的版权、许可、价格或使用条件，采用前仍应核对对应原页。
