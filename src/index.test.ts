import { describe, expect, it } from 'vitest'
import { calculateFortune } from './fortune.js'
import plugin from './index.js'
import { hashString, mulberry32, weightedChoice } from './prng.js'
import { renderFortunePosterHtml } from './template.js'

// 两条命令（出图、记录）的测试在 commands.test.ts

describe('PRNG & Deterministic Seeding', () => {
  it('hashString 计算字符串散列值', () => {
    const h1 = hashString('user123-2026-09-20')
    const h2 = hashString('user123-2026-09-20')
    const h3 = hashString('user456-2026-09-20')
    expect(h1).toBe(h2)
    expect(h1).not.toBe(h3)
  })

  it('mulberry32 在同一种子下产生确定性随机序列', () => {
    const rng1 = mulberry32(123456)
    const rng2 = mulberry32(123456)
    const seq1 = [rng1(), rng1(), rng1()]
    const seq2 = [rng2(), rng2(), rng2()]
    expect(seq1).toEqual(seq2)
    for (const v of seq1) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('weightedChoice 按权重抽取', () => {
    const items = ['A', 'B']
    const weights = [0, 100]
    const chosen = weightedChoice(items, weights, () => 0.5)
    expect(chosen).toBe('B')
  })
})

describe('Fortune Calculation', () => {
  const config = plugin.defaultConfig!

  it('同一用户在同一天多次抽取签文结果固定', () => {
    const res1 = calculateFortune('user_abc', '测试用户', 'https://avatar.test/1', config, new Date('2026-09-20T10:00:00Z'))
    const res2 = calculateFortune('user_abc', '测试用户', 'https://avatar.test/1', config, new Date('2026-09-20T11:00:00Z'))

    expect(res1.item.fortuneSummary).toBe(res2.item.fortuneSummary)
    expect(res1.item.luckyStar).toBe(res2.item.luckyStar)
    expect(res1.item.signText).toBe(res2.item.signText)
  })

  it('fixed_daily_background=true 时背景图随签文一同固定', () => {
    const customConfig = { ...config, fixed_daily_background: true }
    const res1 = calculateFortune('user_abc', '测试用户', 'https://avatar.test/1', customConfig, new Date('2026-09-20T10:00:00Z'))
    const res2 = calculateFortune('user_abc', '测试用户', 'https://avatar.test/1', customConfig, new Date('2026-09-20T11:00:00Z'))

    expect(res1.backgroundUrl).toBe(res2.backgroundUrl)
  })

  it('节假日自动激活高爆率', () => {
    const newYearDate = new Date('2026-01-01T12:00:00+08:00')
    const res = calculateFortune('user_xyz', '用户', '', config, newYearDate)
    expect(res.isHoliday).toBe(true)
  })
})

describe('HTML Poster Template', () => {
  it('生成 1:1 还原原版 painter.py 的 HTML', () => {
    const fortune = calculateFortune('user_1', '张三', 'https://avatar.test/a.jpg', plugin.defaultConfig!)
    const html = renderFortunePosterHtml(fortune)

    expect(html).toContain('1080')
    expect(html).toContain('1920')
    expect(html).toContain(fortune.item.fortuneSummary)
    expect(html).toContain(fortune.item.luckyStar)
    expect(html).toContain('translucent-layer')
    expect(html).toContain('avatar-img')
    expect(html).toContain('仅供娱乐 | 相信科学 | 请勿迷信')
  })
})
