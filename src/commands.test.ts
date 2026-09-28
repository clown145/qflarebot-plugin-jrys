/**
 * 两条命令：海报交给 t2i 服务渲染（没有或失败时降级图文），记录存 D1 供 /jrys_last 回看
 */
import { runCommand } from '@qqbot/sdk/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import plugin from './index.js'
import { initSchema } from './store.js'
import { createTestDB, type TestDB } from './testing.js'

let db: TestDB

beforeEach(async () => {
  db = await createTestDB()
  await initSchema(db)
})

/** 发一条命令；services 就是注入的 t2i 服务替身，不传即没装 t2i */
const say = (command: 'jrys' | 'jrys_last', services: Record<string, unknown> = {}, userId = 'u123', options: { noDb?: boolean } = {}) =>
  runCommand(plugin, command, '', {
    session: { userId, content: `/${command}` },
    ctx: { services, ...(options.noDb ? {} : { db }) },
  })

describe('/jrys 出图', () => {
  it('t2i 有 renderUrl：回图片地址，QQ 自己去拉；按 1080×1920 渲染', async () => {
    const renderUrl = vi.fn(async () => ({ url: 'https://t2i.test/text2img/abc.jpg' }))
    const session = await say('jrys', { t2i: { renderUrl } })
    expect(session.replies).toEqual([{ image: { url: 'https://t2i.test/text2img/abc.jpg' } }])
    expect(renderUrl).toHaveBeenCalledWith(expect.stringContaining('1920'), expect.objectContaining({ width: 1080, height: 1920, fullPage: true }))
  })

  it('老版本 t2i 只有 renderBase64：照样出图', async () => {
    const session = await say('jrys', { t2i: { renderBase64: async () => ({ base64: 'QUJD' }) } })
    expect(session.replies).toEqual([{ image: { base64: 'QUJD' } }])
  })

  it('没装 t2i（或被停用）：降级成图文卡片', async () => {
    const session = await say('jrys')
    expect(session.replies[0]).toMatchObject({ text: expect.stringContaining('【今日运势 · ') })
  })

  it('渲染失败：降级成图文卡片；关了降级就提示失败', async () => {
    const t2i = { renderUrl: async () => Promise.reject(new Error('Connect timeout')) }
    expect((await say('jrys', { t2i })).replies[0]).toMatchObject({ text: expect.stringContaining('【今日运势 · ') })

    const session = await runCommand(plugin, 'jrys', '', {
      ctx: { services: { t2i }, db, config: { ...plugin.defaultConfig!, fallback_to_text: false } },
    })
    expect(session.replies[0]).toContain('运势海报生成失败')
  })
})

describe('/jrys_last 与记录', () => {
  it('没抽过：提示先抽', async () => {
    expect((await say('jrys_last')).replies[0]).toContain('你还没有生成过今日运势哦')
  })

  it('抽一次写一行 D1，/jrys_last 读回来；再抽覆盖同一行', async () => {
    await say('jrys')
    expect(db.rowsWritten).toBe(1)
    const session = await say('jrys_last')
    expect(session.replies[0]).toMatchObject({ text: expect.stringContaining('【上次运势回顾】') })

    await say('jrys')
    expect(db.rowsWritten).toBe(2)
    expect(await db.all('SELECT user_id FROM {last}')).toEqual([{ user_id: 'u123' }])
  })

  it('超过 7 天的当没有（行不删，删除也算写入）', async () => {
    await say('jrys')
    await db.run('UPDATE {last} SET ts = ts - ?', 8 * 86_400_000)
    expect((await say('jrys_last')).replies[0]).toContain('你还没有生成过今日运势哦')
  })

  it('没绑 D1：照样抽签，只是记不下来', async () => {
    const session = await say('jrys', {}, 'u9', { noDb: true })
    expect(session.replies[0]).toMatchObject({ text: expect.stringContaining('【今日运势 · ') })
    expect((await say('jrys_last', {}, 'u9', { noDb: true })).replies[0]).toContain('读取历史记录失败')
  })

  it('每个人一行，互不影响', async () => {
    await say('jrys', {}, 'a')
    expect((await say('jrys_last', {}, 'b')).replies[0]).toContain('你还没有生成过今日运势哦')
    expect((await say('jrys_last', {}, 'a')).replies[0]).toMatchObject({ text: expect.stringContaining('【上次运势回顾】') })
  })
})
