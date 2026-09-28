import type { ScopedDB } from '@qqbot/sdk'
import type { LastFortuneRecord } from './types.js'

/**
 * 每人最近一次抽取的记录，供 /jrys_last 回看。
 *
 * 以前存 KV（`last:<用户>`，7 天过期），每抽一次写一次——免费版整个机器人一天只能写 1,000 次 KV，
 * 抽的人一多，别的插件和框架自己的 KV 写入也跟着失败。挪到 D1：每人一行，主键就是表本身（WITHOUT ROWID），
 * UPSERT 每次只算 1 行写入。过期不删行（删除也算写入），读的时候超过 7 天就当没有，和原来的 KV 一样
 */
const TTL_MS = 7 * 86_400_000

export async function initSchema(db: ScopedDB): Promise<void> {
  await db.exec('CREATE TABLE IF NOT EXISTS {last} (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, ts INTEGER NOT NULL) WITHOUT ROWID')
}

export async function saveLast(db: ScopedDB, record: LastFortuneRecord): Promise<void> {
  await db.run(
    'INSERT INTO {last} (user_id, data, ts) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, ts = excluded.ts',
    record.userId,
    JSON.stringify(record),
    record.timestamp,
  )
}

/** 没有、超过 7 天或存坏了都返回 null */
export async function loadLast(db: ScopedDB, userId: string, now = Date.now()): Promise<LastFortuneRecord | null> {
  const row = await db.first<{ data: string; ts: number }>('SELECT data, ts FROM {last} WHERE user_id = ?', userId)
  if (!row || now - row.ts > TTL_MS) return null
  try {
    return JSON.parse(row.data) as LastFortuneRecord
  } catch {
    return null
  }
}
