import { expect, test } from 'claude-code/testing'

const band = (bodyColumns: number) =>
  ({
    plugin: 'usage-band',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isCollapsed: false,
      isWorking: false,
      maxRows: 10,
      bodyColumns,
      scroll: { offset: 0, bodyRows: 10 },
      view: {},
    },
  }) as const

const DAY = 24 * 3600_000
const NOW = Date.parse('2026-11-18T08:45:00Z')

test('三行各自一行，窄寬與寬螢幕、各介面都畫得出來', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  const now = NOW
  const stored: Record<string, unknown> = {
    limits: [
      { kind: 'seven_day', percentUsed: 25, resetsAt: new Date(now + 3.3 * DAY).toISOString() },
      { kind: 'five_hour', percentUsed: 41, resetsAt: new Date(now + 1.3 * 3600_000).toISOString() },
    ],
    context: 20,
  }
  on('state.get', (_, e) => ({ value: { value: stored[(e as { key: string }).key] ?? null, version: 1 } }))

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    for (const cols of [30, 120]) {
      const ui = await $.ui.mount({ ...band(cols), surface })
      expect((await ui.find({ type: 'Text', text: /每週 25%/ }))?.text).toBe('每週 25%')
      expect((await ui.find({ type: 'Text', text: /偏慢/ }))?.text).toBe('偏慢，可以多用')
      expect((await ui.find({ type: 'Text', text: /5小時 41%/ }))?.text).toBe('5小時 41%')
      expect((await ui.find({ type: 'Text', text: /對話 20%/ }))?.text).toBe('對話 20%')
      expect((await ui.find({ type: 'Text', text: /^正常$/ }))?.text).toBe('正常')
      await ui.unmount()
    }
  }
})

test('還沒有數字時顯示提示', async ($, on) => {
  on('clock.now', () => ({ value: NOW }))
  on('state.get', () => ({ value: { value: null, version: 1 } }))
  const ui = await $.ui.mount({ ...band(80), surface: 'desktop' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('用量：送出第一則訊息後顯示')
  await ui.unmount()
})
