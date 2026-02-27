import { effect, untrack } from "ripple"

export function onMount(fn: () => void | (() => void)) {
  effect(() => {
    return untrack(() => {
      const cleanup = fn()
      if (typeof cleanup === "function") return cleanup
    })
  })
}
