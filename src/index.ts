import { definePlugin } from '@qqbot/sdk'
import { calculateFortune } from './fortune.js'
import { renderPoster } from './render.js'
import { initSchema, loadLast, saveLast } from './store.js'
import { renderFortunePosterHtml } from './template.js'
import type { JrysConfig, LastFortuneRecord } from './types.js'

export default definePlugin<JrysConfig>({
  name: 'jrys',
  // 没用到契约 2 的 ctx.db.batch()，写 1 让 0.4 以前的机器人也能装（不写就是构建时 SDK 的版本）
  apiVersion: 1,
  displayName: '今日运势',
  description: '今日运势海报生成插件，基于 AstrBot T2I 渲染 1080x1920 精美大图，支持每日固定运势与节假日高爆率',
  permissions: ['db'],
  // 海报交给内置 t2i 插件渲染（服务地址、超时在 t2i 的配置里）；t2i 没装、停用或渲染失败时按「渲染异常时降级图文」处理，
  // 所以是可选依赖。老版本机器人把 optional 当成必需，t2i 是内置的，不受影响
  depends: { t2i: 'optional' },

  configSchema: {
    type: 'object',
    properties: {
      fixed_daily_fortune: {
        type: 'boolean',
        title: '每日固定运势',
        description: '开启后，同一用户每天多次抽取运势签文保持固定不变',
        default: true,
      },
      fixed_daily_background: {
        type: 'boolean',
        title: '固定每日背景图',
        description: '默认关闭：每次抽取运势随机换新背景壁纸；开启后背景图随每日运势一同固定',
        default: false,
      },
      holiday_rates_enabled: {
        type: 'boolean',
        title: '启用节假日高爆率',
        description: '在特定节假日自动提升大吉概率',
        default: true,
      },
      holidays: {
        type: 'array',
        title: '节假日列表 (MM-DD 格式)',
        items: { type: 'string' },
        default: ['01-01', '02-14', '05-01', '10-01', '12-25'],
      },
      normal_rates: {
        type: 'object',
        title: '日常运势爆率权重',
        properties: {
          good: { type: 'integer', title: '大吉权重 (>70分)', default: 40 },
          normal: { type: 'integer', title: '中吉权重 (56~70分)', default: 40 },
          bad: { type: 'integer', title: '凶运权重 (<56分)', default: 20 },
        },
        default: { good: 40, normal: 40, bad: 20 },
      },
      holiday_rates: {
        type: 'object',
        title: '节假日运势爆率权重',
        properties: {
          good: { type: 'integer', title: '大吉权重 (>70分)', default: 85 },
          normal: { type: 'integer', title: '中吉权重 (56~70分)', default: 15 },
          bad: { type: 'integer', title: '凶运权重 (<56分)', default: 0 },
        },
        default: { good: 85, normal: 15, bad: 0 },
      },
      fallback_to_text: {
        type: 'boolean',
        title: '渲染异常时降级图文',
        description: '当 T2I 服务发生超时或网络故障时，以简易图文卡片兜底，保证服务可用性',
        default: true,
      },
    },
  },

  defaultConfig: {
    fixed_daily_fortune: true,
    fixed_daily_background: false,
    holiday_rates_enabled: true,
    holidays: ['01-01', '02-14', '05-01', '10-01', '12-25'],
    normal_rates: { good: 40, normal: 40, bad: 20 },
    holiday_rates: { good: 85, normal: 15, bad: 0 },
    fallback_to_text: true,
  },

  hooks: {
    // 放 onBoot 不放 onInstall：从 KV 版本升级上来的已经跑过 onInstall，不会再跑；建表语句本来就可以重复执行。
    // 没绑 D1 时只记日志，抽签照常，只是 /jrys_last 没有记录
    async onBoot(ctx) {
      await initSchema(ctx.db).catch((err: unknown) =>
        ctx.logger.warn('建表失败，/jrys_last 将没有记录', { error: err instanceof Error ? err.message : String(err) }),
      )
    },
  },

  commands: {
    jrys: {
      bare: true,
      aliases: ['今日运势', '运势'],
      description: '抽取今日运势海报：/jrys 或直接发 运势',
      async handler({ session, ctx }) {
        const userId = session.userId || 'anonymous'
        const userName = session.userName || '群友'
        const userAvatarUrl = session.avatarUrl || ''

        // 1. 计算抽取运势与背景壁纸
        const fortune = calculateFortune(userId, userName, userAvatarUrl, ctx.config)

        // 2. 记下这次的结果，供 /jrys_last 回看（保留 7 天，见 store.ts）
        const record: LastFortuneRecord = {
          userId,
          userName,
          fortuneSummary: fortune.item.fortuneSummary,
          luckyStar: fortune.item.luckyStar,
          signText: fortune.item.signText,
          unsignText: fortune.item.unsignText,
          backgroundUrl: fortune.backgroundUrl,
          backgroundCategory: fortune.backgroundCategory,
          displayDate: fortune.date.displayDate,
          timestamp: Date.now(),
        }
        // 记不下来（没绑 D1、D1 故障）不影响这次抽签
        await saveLast(ctx.db, record).catch((err: unknown) =>
          ctx.logger.warn('运势记录写入失败', { error: err instanceof Error ? err.message : String(err), user: userId }),
        )

        // 3. 组装 1080x1920 海报 HTML 模板（1:1 还原原版 painter.py 布局）
        const html = renderFortunePosterHtml(fortune)

        // 4. 交给内置 t2i 插件渲染成图片
        try {
          return { image: await renderPoster(ctx, html) }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err)
          ctx.logger.error('T2I 渲染运势海报失败', { error: errMsg, user: userId })

          // 若开启了降级容灾，以图文回复
          if (ctx.config.fallback_to_text) {
            return {
              text:
                `【今日运势 · ${fortune.item.fortuneSummary}】\n` +
                `星级：${fortune.item.luckyStar}\n` +
                `签诗：“${fortune.item.signText}”\n` +
                `解文：${fortune.item.unsignText}\n\n` +
                `（T2I 节点冷启动或稍有延迟，已切换为简易签卡，背景原图见 /jrys_last）`,
              image: fortune.backgroundUrl ? { url: fortune.backgroundUrl } : undefined,
            }
          }

          return `运势海报生成失败，请稍后再试～ (${errMsg})`
        }
      },
    },

    jrys_last: {
      bare: true,
      aliases: ['上次运势', '原图'],
      description: '查看上次抽取的运势原图与记录',
      async handler({ session, ctx }) {
        const userId = session.userId || 'anonymous'
        let record: LastFortuneRecord | null
        try {
          record = await loadLast(ctx.db, userId)
        } catch {
          return '读取历史记录失败，请重新发送 /jrys 抽取！'
        }

        if (!record) {
          return '你还没有生成过今日运势哦，先发送 /jrys 抽取一张吧！'
        }

        const msg =
          `【上次运势回顾】\n` +
          `日期：${record.displayDate}\n` +
          `运势：${record.fortuneSummary} (${record.luckyStar})\n` +
          `签文：“${record.signText}”\n` +
          `背景分类：${record.backgroundCategory}`

        if (record.backgroundUrl) {
          return {
            text: msg,
            image: { url: record.backgroundUrl },
          }
        }
        return msg
      },
    },
  },
})
