export type Snapshot = { phase: number; goal: string; stop: string | null }

declare module 'claude-code' {
  interface PluginState {
    'ssi-cockpit': { tick: number; lastPhase: number }
  }
}
