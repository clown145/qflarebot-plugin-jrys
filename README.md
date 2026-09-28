# qflarebot-plugin-jrys (今日运势)

适用于 [QFlareBot](https://github.com/QFlareBot/QFlareBot) 的 QQ 官方机器人今日运势海报生成插件。移植自 [astrbot_plugin_jrys](https://github.com/NINIYOYYO/astrbot_plugin_jrys)。

通过调用 **AstrBot T2I (Text-to-Image)** 渲染服务，在无状态、无 C++ 本地绘图引擎的 Cloudflare Workers 边缘计算环境中，直接生成 **1080×1920** 高保真玻璃拟态二次元运势海报！

渲染交给 QFlareBot 内置的 **t2i 插件**：T2I 服务地址与超时在 t2i 插件的配置里填，所有要出图的插件共用这一份。图片存在 T2I 服务上、QQ 直接去拉，不经过 Worker。机器人需要绑定 D1（存 `/jrys_last` 的记录）。

---

## ✨ 核心特性

- 🎨 **1080×1920 高清海报渲染**：基于现代 HTML5 + CSS 毛玻璃拟态打造，通过 AstrBot T2I 渲染生成细腻抗锯齿的 JPEG 大图，支持渐变字符、专属圆形头像与唯美二次元壁纸背景。
- 🔮 **每日固定运势**：默认开启。基于用户 OpenID 与北京时间日期的确定性伪随机数发生器（Mulberry32 PRNG），确保同一用户在同一天内任意多次触发，运势、星级与壁纸完全一致。
- 🎁 **节假日高爆率**：支持自定义节假日（如元旦、春节、国庆等），节日期间自动切换高爆率权重池，提升抽取「大吉」运势的概率。
- 🖼️ **740+ 精选壁纸图库**：完整内置原项目 5 大经典二次元壁纸分类（蔚蓝档案 `ba`、初音未来 `miku`、猫羽雫、白圣女、魔卡少女樱）。
- ⏪ **原图与历史回溯 (`/jrys_last`)**：抽取记录写入 D1（每人一行，保留 7 天），支持随时调出上一次抽取的运势原图与内容。
- 🛡️ **优雅容灾保护**：若 T2I 渲染节点发生网络波动或冷启动超时，或者 t2i 插件被停用，插件自动平滑降级为精美图文回复，绝不造成机器人静默无响应。

---

## 📌 指令列表

| 指令 | 无前缀直接发送 | 说明 |
| :--- | :--- | :--- |
| `/jrys` | `jrys`、`运势`、`今日运势` | 抽取今日运势并生成 1080×1920 海报图片 |
| `/jrys_last` | `原图`、`上次运势` | 查看上一次生成的运势原图与详细签文 |

> 注：本插件命令声明了 `bare: true`，群聊或单聊中直接发送关键词（无需前缀 `/`）即可触发。

---

## ⚙️ 配置说明 (`configSchema`)

可在 QFlareBot 管理面板的「插件配置」中可视化调节：

| 配置项 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `fixed_daily_fortune` | boolean | `true` | 是否锁定每日固定运势 |
| `holiday_rates_enabled`| boolean | `true` | 是否启用节假日高爆率 |
| `holidays` | array | `["01-01", "02-14", "05-01", "10-01", "12-25"]` | 生效高爆率的日期列表 (MM-DD) |
| `normal_rates` | object | `{ good: 40, normal: 40, bad: 20 }` | 平时的大吉、中吉、凶运权重 |
| `holiday_rates` | object | `{ good: 85, normal: 15, bad: 0 }` | 节假日的大吉、中吉、凶运权重 |
| `fallback_to_text` | boolean | `true` | T2I 异常时是否自动降级为图文兜底 |

---

## 📦 本地构建与测试

`@qqbot/sdk` 与 `@qqbot/plugin-cli` 不发 npm：先把 [QFlareBot](https://github.com/QFlareBot/QFlareBot) 克隆到本仓库旁边并构建 plugin-cli（`cd QFlareBot && pnpm install --filter '@qqbot/plugin-cli...' && pnpm --filter '@qqbot/plugin-cli...' build`），`devDependencies` 指向 `file:../QFlareBot/packages/*`。

```bash
npm install      # 安装依赖
npm test         # 运行 vitest 单元测试
npm run typecheck # 运行 TypeScript 类型检查
npm run build    # 打包生成 dist/plugin.js 与 dist/manifest.json
npm run sync     # 同步 dist/manifest.json 到根目录
```

---

## 📄 开源许可

MIT License
