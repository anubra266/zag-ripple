import type { Bindable, BindableParams } from "@zag-js/core"
import { isFunction } from "@zag-js/utils"
import { track, get, set, effect, untrack } from "ripple"

export function createBindable<T>(props: () => BindableParams<T>): Bindable<T> {
  const initial = props().value ?? props().defaultValue

  const eq = props().isEqual ?? Object.is

  // Create a tracked signal for internal state
  const valueSignal = track(initial as T)

  // Derived: is this value controlled externally?
  const controlledSignal = track(() => props().value != undefined)

  const valueRef = { current: untrack(() => get(valueSignal)) }
  const prevValue: Record<"current", T | undefined> = { current: undefined }

  // Sync the ref with the current value
  effect(() => {
    const v = get(controlledSignal) ? props().value : get(valueSignal)
    prevValue.current = v as T
    valueRef.current = v as T
  })

  const setFn = (v: T | ((prev: T) => T)) => {
    const prev = prevValue.current
    const next = isFunction(v) ? v(valueRef.current as T) : v

    if (props().debug) {
      console.log(`[bindable > ${props().debug}] setValue`, { next, prev })
    }

    if (!get(controlledSignal)) set(valueSignal, next)

    // Synchronously update refs so re-entrant calls (e.g. focus/blur
    // events triggered by .focus() inside an action) see the correct
    // previous value. The async effect also syncs these, but it is
    // batched and won't flush between re-entrant send() calls.
    valueRef.current = next
    prevValue.current = next

    if (!eq(next, prev)) {
      props().onChange?.(next, prev)
    }
  }

  function getValue(): T {
    if (get(controlledSignal)) {
      return props().value as T
    }
    return get(valueSignal)
  }

  return {
    initial,
    ref: valueRef,
    get: getValue,
    set: setFn,
    invoke(nextValue: T, prevValue: T) {
      props().onChange?.(nextValue, prevValue)
    },
    hash(value: T) {
      return props().hash?.(value) ?? String(value)
    },
  }
}

createBindable.cleanup = (fn: VoidFunction) => {
  // Create an effect that only runs cleanup on unmount
  effect(() => () => fn())
}

createBindable.ref = <T>(defaultValue: T) => {
  let value = defaultValue
  return {
    get: () => value,
    set: (next: T) => {
      value = next
    },
  }
}
