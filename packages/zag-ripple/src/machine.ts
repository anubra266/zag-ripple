import type {
  ActionsOrFn,
  GuardFn,
  Machine,
  MachineSchema,
  Service,
  ChooseFn,
  ComputedFn,
  EffectsOrFn,
  BindableContext,
  Params,
} from "@zag-js/core"
import {
  createScope,
  findTransition,
  getExitEnterStates,
  hasTag,
  INIT_STATE,
  MachineStatus,
  matchesState,
  resolveStateValue,
} from "@zag-js/core"
import { isFunction, isString, toArray, warn, ensure } from "@zag-js/utils"
import { track, get, untrack, effect } from "ripple"
import { createBindable } from "./bindable"
import { isTracked } from "./is-tracked"
import { createRefs } from "./refs"
import { createTrack } from "./track"

function access<T>(value: any): T {
  if (isTracked(value)) return get(value) as T
  if (isFunction(value)) return value()
  return value as T
}

/**
 * Unwrap tracked values and strip undefined — replaces `compact(access(v))`.
 * Ripple Tracked objects are plain `{}` literals with circular block refs,
 * so the generic `compact` from @zag-js/utils recurses infinitely into them.
 * This function unwraps at the top level AND per-property level.
 */
function compactProps(raw: any): any {
  const obj = access<any>(raw)
  if (obj == null || typeof obj !== "object") return obj
  const result: any = {}
  for (const key of Object.keys(obj)) {
    let v = obj[key]
    if (v === undefined) continue
    // Unwrap individual tracked prop values
    if (isTracked(v)) v = get(v)
    result[key] = v
  }
  return result
}

/*
* UseMachine hook for Ripple JS
* @param machine - The machine to use
* @param userProps - The user props to use
* @returns The service
*/
export function useMachine<T extends MachineSchema>(
  machine: Machine<T>,
  userProps: Partial<T["props"]> = {},
): Service<T> {
  const scope = track(() => {
    const { id, ids, getRootNode } = access<any>(userProps)
    return createScope({ id, ids, getRootNode })
  })

  const debug = (...args: any[]) => {
    if (machine.debug) console.log(...args)
  }

  const props: any = track(
    () =>
      machine.props?.({
        props: compactProps(userProps),
        scope: get(scope),
      }) ?? access(userProps),
  )

  const prop: any = createProp(() => get(props))

  const context: any = machine.context?.({
    prop,
    bindable: createBindable,
    get scope() {
      return get(scope)
    },
    flush,
    getContext() {
      return ctx as any
    },
    getComputed() {
      return computed as any
    },
    getRefs() {
      return refs as any
    },
    getEvent() {
      return getEvent()
    },
  })

  const ctx: BindableContext<T> = {
    get(key) {
      return context?.[key].get()
    },
    set(key, value) {
      context?.[key].set(value)
    },
    initial(key) {
      return context?.[key].initial
    },
    hash(key) {
      const current = context?.[key].get()
      return context?.[key].hash(current)
    },
  }

  const effects = { current: new Map<string, VoidFunction>() }
  const transitionRef: { current: any } = { current: null }

  const previousEventRef: { current: any } = { current: null }
  const eventRef: { current: any } = { current: { type: "" } }

  const getEvent = (): any => ({
    ...eventRef.current,
    current() {
      return eventRef.current
    },
    previous() {
      return previousEventRef.current
    },
  })

  const getState = () => ({
    ...state,
    matches(...values: T["state"][]) {
      const current = state.get()
      return values.some((value) => matchesState(current as string, value as string))
    },
    hasTag(tag: T["tag"]) {
      const current = state.get()
      return hasTag(machine, current, tag)
    },
  })

  const refs = createRefs(machine.refs?.({ prop, context: ctx }) ?? {})

  const getParams = (): Params<T> => ({
    state: getState(),
    context: ctx,
    event: getEvent(),
    prop,
    send,
    action,
    guard,
    track: createTrack,
    refs,
    computed,
    flush,
    get scope() {
      return get(scope)
    },
    choose,
  })

  const action = (keys: ActionsOrFn<T> | undefined) => {
    const strs = isFunction(keys) ? keys(getParams()) : keys
    if (!strs) return
    const fns = strs.map((s) => {
      const fn = machine.implementations?.actions?.[s]
      if (!fn) warn(`[zag-js] No implementation found for action "${JSON.stringify(s)}"`)
      return fn
    })
    for (const fn of fns) {
      fn?.(getParams())
    }
  }

  const guard = (str: T["guard"] | GuardFn<T>) => {
    if (isFunction(str)) return str(getParams())
    return machine.implementations?.guards?.[str](getParams())
  }

  const effectFn = (keys: EffectsOrFn<T> | undefined) => {
    const strs = isFunction(keys) ? keys(getParams()) : keys
    if (!strs) return
    const fns = strs.map((s) => {
      const fn = machine.implementations?.effects?.[s]
      if (!fn) warn(`[zag-js] No implementation found for effect "${JSON.stringify(s)}"`)
      return fn
    })
    const cleanups: VoidFunction[] = []
    for (const fn of fns) {
      const cleanup = fn?.(getParams())
      if (cleanup) cleanups.push(cleanup)
    }
    return () => cleanups.forEach((fn) => fn?.())
  }

  const choose: ChooseFn<T> = (transitions) => {
    return toArray(transitions).find((t) => {
      let result = !t.guard
      if (isString(t.guard)) result = !!guard(t.guard)
      else if (isFunction(t.guard)) result = t.guard(getParams())
      return result
    })
  }

  const computed: ComputedFn<T> = (key) => {
    ensure(machine.computed, () => `[zag-js] No computed object found on machine`)
    const fn = machine.computed[key]
    return fn({
      context: ctx,
      event: eventRef.current,
      prop,
      refs,
      scope: get(scope),
      computed: computed,
    })
  }

  const state = createBindable(() => ({
    defaultValue: resolveStateValue(machine, machine.initialState({ prop })),
    onChange(nextState, prevState) {
      const { exiting, entering } = getExitEnterStates(machine, prevState, nextState, transitionRef.current?.reenter)

      exiting.forEach((item) => {
        const exitEffects = effects.current.get(item.path)
        exitEffects?.()
        effects.current.delete(item.path)
      })

      exiting.forEach((item) => {
        action(item.state?.exit)
      })

      action(transitionRef.current?.actions)

      entering.forEach((item) => {
        const cleanup = effectFn(item.state?.effects)
        if (cleanup) effects.current.set(item.path, cleanup)
      })

      if (prevState === INIT_STATE) {
        action(machine.entry)
        const cleanup = effectFn(machine.effects)
        if (cleanup) effects.current.set(INIT_STATE, cleanup)
      }

      entering.forEach((item) => {
        action(item.state?.entry)
      })
    },
  }))

  let status = MachineStatus.NotStarted

  // Mount: initialize the machine
  effect(() => {
    return untrack(() => {
      const started = status === MachineStatus.Started
      status = MachineStatus.Started
      debug(started ? "rehydrating..." : "initializing...")
      state.invoke(state.initial!, INIT_STATE)

      // Cleanup: teardown the machine
      return () => {
        debug("unmounting...")
        status = MachineStatus.Stopped

        const fns = effects.current
        fns.forEach((fn) => fn?.())
        effects.current = new Map()
        transitionRef.current = null

        action(machine.exit)
      }
    })
  })

  const send = (event: any) => {
    if (status !== MachineStatus.Started) return

    previousEventRef.current = eventRef.current
    eventRef.current = event

    let currentState = untrack(() => state.get())

    const { transitions, source } = findTransition(machine, currentState, event.type as string)
    const transition = choose(transitions)
    if (!transition) return

    // save current transition
    transitionRef.current = transition
    const target = resolveStateValue(machine, transition.target ?? currentState, source)

    debug("transition", event.type, transition.target || currentState, `(${transition.actions})`)

    const changed = target !== currentState
    if (changed) {
      // state change is high priority
      state.set(target)
    } else if (transition.reenter) {
      // reenter will re-invoke the current state
      state.invoke(currentState, currentState)
    } else {
      // call transition actions
      action(transition.actions)
    }
  }

  machine.watch?.(getParams())

  return {
    get state() {
      return getState()
    },
    send,
    context: ctx,
    prop,
    get scope() {
      return get(scope)
    },
    refs,
    computed,
    get event() {
      return getEvent()
    },
    getStatus: () => status,
  } as Service<T>
}

function flush(fn: VoidFunction) {
  fn()
}

function createProp<T>(value: () => T) {
  return function get<K extends keyof T>(key: K): T[K] {
    return value()[key]
  }
}
