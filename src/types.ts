/**
 * 今日运势插件配置项
 */
export interface JrysConfig {
  /** 是否启用每日固定运势（同一用户在当天多次触发签文结果固定） */
  fixed_daily_fortune: boolean
  /** 是否连同背景图也一同固定（默认关闭：每次触发随机抽取新背景壁纸） */
  fixed_daily_background: boolean
  /** 是否启用节假日高爆率 */
  holiday_rates_enabled: boolean
  /** 节假日日期列表 (MM-DD 格式) */
  holidays: string[]
  /** 平常运势爆率权重 */
  normal_rates: {
    good: number
    normal: number
    bad: number
  }
  /** 节假日运势爆率权重 */
  holiday_rates: {
    good: number
    normal: number
    bad: number
  }
  /** 是否在 T2I 服务故障时降级为精美图文回复（保证机器人不中断） */
  fallback_to_text: boolean
}

/**
 * 运势词条数据结构（来自 jrys.json）
 */
export interface FortuneItem {
  fortuneSummary: string
  luckyStar: string
  signText: string
  unsignText: string
  luckValue: number
}

export type FortuneData = Record<string, FortuneItem[]>

/**
 * 计算出的运势结果
 */
export interface FortuneResult {
  item: FortuneItem
  categoryKey: string
  backgroundUrl: string
  backgroundCategory: string
  date: {
    year: string
    month: string
    day: string
    dateStr: string // 2026-09-20
    displayDate: string // 2026/09/20
    monthDay: string // 09-20
  }
  userId: string
  userName: string
  userAvatarUrl: string
  isHoliday: boolean
}

/**
 * 用户最近一次抽取记录（保存在 D1 中，见 store.ts）
 */
export interface LastFortuneRecord {
  userId: string
  userName: string
  fortuneSummary: string
  luckyStar: string
  signText: string
  unsignText: string
  backgroundUrl: string
  backgroundCategory: string
  displayDate: string
  timestamp: number
}
