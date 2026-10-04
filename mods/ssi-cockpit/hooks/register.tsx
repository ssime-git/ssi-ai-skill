import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Snapshot } from '../types'

const PANE = 'ssi-map'
const NAMES = ['Analyze', 'Confirm', 'Reproduce', 'Plan', 'Implement', 'Review', 'Visual', 'Land']
const ETA = [3, 4, 8, 5, 15, 8, 6, 10]

const tick = atom({ plugin: 'ssi-cockpit', key: 'tick' } as const, 0)
const lastPhase = atom({ plugin: 'ssi-cockpit', key: 'lastPhase' } as const, 0)
const lastStop = atom({ plugin: 'ssi-cockpit', key: 'lastStop' } as const, '')

async function load($: any): Promise<Snapshot | null> {
  try {
    const state = JSON.parse((await $.fs.read('.ssi/state.json')) as string)
    const open = state.stop && !state.stop.answer
    // `done` and `action` are what the engine actually answered last: phase 9 alone is not completion.
    return { phase: Number(state.phase ?? 1), goal: String(state.goal ?? ''), stop: open ? String(state.stop.because) : null, done: state.last?.done === true, action: state.last?.action ? String(state.last.action) : null }
  } catch {
    return null
  }
}

const bar = (phase: number) => '▓'.repeat(Math.min(phase, 8)) + '░'.repeat(8 - Math.min(phase, 8))

async function refresh($: any) {
  await update($, tick, n => n + 1)
  const snap = await load($)
  if (!snap) {
    $.ui.status(undefined)
    return
  }
  const p = Math.min(snap.phase, 8)
  $.ui.status(snap.stop ? 'ssi: stopped' : snap.done ? 'ssi: done' : snap.phase > 8 ? `ssi: finishing (${snap.action ?? '…'})` : `ssi ${p}/8 ${NAMES[p - 1]}`)
  const before = await read($, lastPhase)
  const stopBefore = await read($, lastStop)
  const stopNow = snap.stop ?? ''
  if (stopNow !== stopBefore) {
    await update($, lastStop, () => stopNow)
    if (stopNow) $.ui.toast('I stopped and need you.')
  }
  if (before !== snap.phase) {
    await update($, lastPhase, () => snap.phase)
    if (before !== 0 && !stopNow) {
      $.ui.toast(snap.done ? '✓ Done. The PR is ready for you.' : snap.phase > 8 ? `One last step: ${snap.action ?? 'finish the delivery'}` : snap.phase < before ? `↩ Back to ${NAMES[p - 1]}: something needs a fix.` : `✓ Phase done. Now: ${NAMES[p - 1]}`)
    }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ssi-map', description: 'Show the ssi phase map' })
    await refresh($)
    return next(e)
  })

  on('command.run', { command: 'ssi-map' }, async $ => {
    await $.ui.open({ id: PANE, title: 'SSI map' })
    return { text: 'SSI map opened.' }
  })

  on('turn.complete', async ($, e, next) => {
    await refresh($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await read($, tick)
    const snap = await load($)
    if (!snap || e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const p = Math.min(snap.phase, 8)
    const where = snap.done ? `${bar(8)} 8/8 Done` : snap.phase > 8 ? `${bar(8)} 8/8 Finishing: ${snap.action ?? '…'}` : `${bar(p)} ${p}/8 ${NAMES[p - 1]}`
    return (
      <Box>
        <Text>{where}</Text>
        {snap.stop ? <Text bold> · I stopped: {snap.stop}</Text> : snap.phase <= 8 ? <Text dimColor> · ~{ETA[p - 1]} min</Text> : null}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await read($, tick)
    const snap = await load($)
    const { Box, Text } = $.ui.resolve(e)
    if (!snap) return <Text dimColor>No ssi run here yet. Ask for a fix or a feature with /ssi.</Text>
    return (
      <Box flexDirection="column">
        <Text bold>{snap.goal}</Text>
        {NAMES.map((name, i) => {
          const mark = snap.phase > i + 1 ? '✓' : snap.phase === i + 1 ? '▶' : '·'
          return <Text dimColor={snap.phase < i + 1}>{mark} {i + 1}. {name}{snap.phase === i + 1 ? `  ~${ETA[i]} min` : ''}</Text>
        })}
        {snap.stop ? <Text bold>I stopped: {snap.stop}</Text> : null}
        <Text dimColor>Back edges: review, visual or CI failing returns to 5. Implement.</Text>
      </Box>
    )
  })
}
