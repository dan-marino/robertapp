---
title: React useState Stale After router.refresh() in Next.js App Router
date: 2026-04-20
category: docs/solutions/ui-bugs
module: LineupGrid / web UI
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - UI displays old data after a server-side mutation and router.refresh() call
  - Client component appears to receive new props but still renders stale state
  - Feature toggle changes server data correctly but client view doesn't update
root_cause: async_timing
resolution_type: code_fix
severity: high
tags: [react, nextjs, usestate, stale-state, router-refresh, key-prop, app-router]
---

# React useState Stale After router.refresh() in Next.js App Router

## Problem

In the Next.js App Router, a client component that initializes local state from props (`useState(props.value)`) will not re-initialize that state when the parent server component re-renders via `router.refresh()`. The component receives new props but keeps its old `useState` value, causing the UI to display stale data.

## Symptoms

- User triggers a server mutation (e.g., PATCH to change a game's `lineupMode`)
- `router.refresh()` re-renders the server component with updated data
- The client component's `useState`-managed display does not update — it shows the old state
- In this case: girls remained bunched at the end of the batting order after switching to unified mode, because `LineupGrid` had initialized `players` from the old split-order `lineup.lineup` and never reset it

## What Didn't Work

- Calling `router.refresh()` alone — the server component re-renders with correct data, but `useState` does not reinitialize from the new props
- Relying on React to detect the prop change and reset state — React intentionally preserves state across re-renders unless the component is unmounted and remounted

## Solution

Add a `key` prop to the client component tied to the value that should trigger a full reset:

```tsx
// Before (stale state persists across mode changes):
<LineupGrid lineup={lineup} />

// After (remounts on mode change, reinitializing useState):
<LineupGrid key={lineup.lineupMode} lineup={lineup} />
```

When `key` changes, React fully unmounts and remounts the component. This causes `useState` to reinitialize from the new prop value on the next mount.

The client component itself was:

```tsx
export default function LineupGrid({ lineup }: Props) {
  // This useState only initializes ONCE on mount — it doesn't re-run
  // when lineup.lineup changes due to router.refresh()
  const [players, setPlayers] = useState(lineup.lineup);
  ...
}
```

## Why This Works

`useState(initialValue)` only uses `initialValue` on the **first render** of a component instance. Subsequent re-renders ignore the argument and return the current state value. This is by design — React preserves state across re-renders within the same component instance.

The `key` prop forces a different component instance to be mounted when the key changes. A new instance runs `useState(initialValue)` fresh, so the new `lineup.lineup` prop value is picked up correctly.

This is a standard React pattern — any time you need a client component to fully reset its state in response to an external change, changing its `key` is the correct mechanism.

## Prevention

- When a client component initializes `useState` from a prop and needs to fully reset when that prop changes at a different "dimension" (e.g., mode, entity ID, tab), use `key` tied to the reset trigger rather than trying to sync state in a `useEffect`.
- The pattern applies broadly: paginated tables resetting on filter change, forms resetting on entity switch, visualizations resetting on dataset change.
- If the `key` domain matches an existing discriminant in the data (like `lineupMode`), prefer that over a synthetic counter.
- Avoid the `useEffect(() => { setState(props.value) }, [props.value])` anti-pattern — it causes a second render and can produce flash/flicker; the `key` approach remounts cleanly.

```tsx
// Anti-pattern: double-render sync
useEffect(() => {
  setPlayers(lineup.lineup);
}, [lineup.lineup]);

// Correct: key-based remount
<LineupGrid key={lineup.lineupMode} lineup={lineup} />
```

## Related Issues

- Introduced while implementing the unified batting lineup mode — `LineupGrid` displayed split-order players even after the server had returned interleaved unified data
- Affects any Next.js App Router client component that (a) owns mutable derived state initialized from props, and (b) needs to reset when a parent server re-render brings qualitatively different data
