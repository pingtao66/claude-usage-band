import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])
const context = atom({ plugin: 'usage-band', key: 'context' } as const, null as number | null)

// 對話內容量門檻：25% 以下正常、25–50% 黃燈、50% 以上紅燈
const CTX_YELLOW = 25
const CTX_RED = 50

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
    if (u.context.percent !== undefined) await update($, context, () => u.context.percent ?? null)
    return r
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') && e.rateLimits.length > 0) {
      await update($, limits, () => pick(e.rateLimits))
    }
    if (e.changed.includes('context') && e.context.percent !== undefined) {
      await update($, context, () => e.context.percent ?? null)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const all = (await read($, limits)) ?? []
    const five = all.find(l => l.kind === 'five_hour')
    const week = all.find(l => l.kind === 'seven_day')

    if (!five && !week) {
      return (
        <Box>
          <Text dimColor>用量：送出第一則訊息後顯示</Text>
        </Box>
      )
    }

    // 一項一行：名稱欄固定寬、百分比欄固定寬且靠右（個位、十位上下對齊），
    // 中間是判斷（有顏色），右邊細節放不下就截掉，不換行
    const row = (
      key: string,
      name: string,
      pct: number,
      status: string,
      color: string | undefined,
      detail: string,
    ) => (
      <Box key={key} flexDirection="row">
        <Box width={6} flexShrink={0}>
          <Text bold wrap="truncate-end">{name}</Text>
        </Box>
        <Box width={4} flexShrink={0} justifyContent="flex-end">
          <Text bold wrap="truncate-end">{`${pct}%`}</Text>
        </Box>
        <Box width={2} flexShrink={0} />
        <Box flexShrink={0}>
          <Text bold color={color} wrap="truncate-end">{status}</Text>
        </Box>
        <Box flexShrink={1} minWidth={0}>
          <Text dimColor wrap="truncate-end">{detail ? `　${detail}` : ''}</Text>
        </Box>
      </Box>
    )

    const rows = []

    if (five) {
      const reset = five.resetsAt ? Date.parse(five.resetsAt) : NaN
      const hasReset = !isNaN(reset) && reset > now
      const used = !isNaN(reset) && reset <= now ? 0 : five.percentUsed
      const color = used >= 90 ? 'error' : used >= 70 ? 'warning' : undefined
      rows.push(row('f', '5小時', used, hasReset ? `${left(reset - now)}後重置` : '', color, ''))
    }

    if (week) {
      const reset = week.resetsAt ? Date.parse(week.resetsAt) : NaN
      const hasReset = !isNaN(reset) && reset > now
      const used = !isNaN(reset) && reset <= now ? 0 : week.percentUsed
      if (hasReset) {
        const elapsed = Math.min(100, Math.max(0, Math.round((1 - (reset - now) / WEEK) * 100)))
        const gap = used - elapsed
        const label = gap < -10 ? '偏慢，可以多用' : gap > 10 ? '偏快，省著用' : '剛好'
        const color = gap < -10 ? 'warning' : gap > 10 ? 'error' : 'success'
        rows.push(row('w', '每週', used, label, color, `時間已過 ${elapsed}%｜${at(reset)} 重置，剩 ${left(reset - now)}`))
      } else {
        rows.push(row('w', '每週', used, '', undefined, ''))
      }
    }

    const ctx = await read($, context)
    if (ctx !== null) {
      const label = ctx >= CTX_RED ? '現在就收尾、換新對話' : ctx >= CTX_YELLOW ? '這件做完就換' : '正常'
      const color = ctx >= CTX_RED ? 'error' : ctx >= CTX_YELLOW ? 'warning' : 'success'
      rows.push(row('c', '對話', ctx, label, color, '這個對話的內容量'))
    }

    return <Box flexDirection="column">{rows}</Box>
  })
}
