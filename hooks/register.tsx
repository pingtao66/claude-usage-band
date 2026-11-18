import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])

const HOUR = 3600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const TZ = 8 * HOUR // 台灣時間 UTC+8
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

const pick = (rl: readonly Limit[]): Limit[] =>
  rl.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt }))

// 剩餘時間：「3天8小時」「2小時32分」
function left(ms: number): string {
  if (ms <= 0) return '即將'
  const d = Math.floor(ms / DAY)
  const h = Math.floor((ms % DAY) / HOUR)
  const m = Math.floor((ms % HOUR) / 60_000)
  if (d > 0) return `${d}天${h}小時`
  if (h > 0) return `${h}小時${m}分`
  return `${m}分`
}

// 重置時刻（台灣時間）：「週六 00:00」
function at(resetMs: number): string {
  const t = new Date(resetMs + TZ)
  const hh = String(t.getUTCHours()).padStart(2, '0')
  const mm = String(t.getUTCMinutes()).padStart(2, '0')
  return `週${WEEKDAY[t.getUTCDay()]} ${hh}:${mm}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const u = await $.session.usage()
    if (u.rateLimits.length > 0) await update($, limits, () => pick(u.rateLimits))
    return r
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') && e.rateLimits.length > 0) {
      await update($, limits, () => pick(e.rateLimits))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const all = await read($, limits)
    const five = all.find(l => l.kind === 'five_hour')
    const week = all.find(l => l.kind === 'seven_day')

    if (!five && !week) {
      return (
        <Box>
          <Text dimColor>用量：送出第一則訊息後顯示</Text>
        </Box>
      )
    }

    let weekRow = null
    if (week) {
      const reset = week.resetsAt ? Date.parse(week.resetsAt) : NaN
      const hasReset = !isNaN(reset) && reset > now
      const used = !isNaN(reset) && reset <= now ? 0 : week.percentUsed
      if (hasReset) {
        const elapsed = Math.min(100, Math.max(0, Math.round((1 - (reset - now) / WEEK) * 100)))
        const gap = used - elapsed
        const label = gap < -10 ? '偏慢，可以多用' : gap > 10 ? '偏快，省著用' : '剛好'
        const color = gap < -10 ? 'warning' : gap > 10 ? 'error' : 'success'
        weekRow = (
          <Text>
            每週 <Text bold>{used}%</Text>
            <Text dimColor>（時間已過 {elapsed}%）</Text> <Text color={color}>{label}</Text>
            <Text dimColor>｜{at(reset)} 重置，剩 {left(reset - now)}</Text>
          </Text>
        )
      } else {
        weekRow = (
          <Text>
            每週 <Text bold>{used}%</Text>
          </Text>
        )
      }
    }

    let fiveRow = null
    if (five) {
      const reset = five.resetsAt ? Date.parse(five.resetsAt) : NaN
      const hasReset = !isNaN(reset) && reset > now
      const used = !isNaN(reset) && reset <= now ? 0 : five.percentUsed
      fiveRow = (
        <Text dimColor>
          {'　　'}5 小時 {used}%{hasReset ? `，${left(reset - now)}後重置` : ''}
        </Text>
      )
    }

    return (
      <Box>
        {weekRow}
        {fiveRow}
      </Box>
    )
  })
}
