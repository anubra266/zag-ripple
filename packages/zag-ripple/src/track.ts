import { isEqual, isFunction } from "@zag-js/utils"
import { effect, get } from "ripple"
import { isTracked } from "./is-tracked"

function access<T>(v: T | (() => T)): T {
  if (isFunction(v)) return v()
  if (isTracked(v)) return get(v as any) as T
  return v
}

export const createTrack = (deps: any[], fn: VoidFunction) => {
  let prevDeps: any[] = []
  let isFirstRun = true
  effect(() => {
    if (isFirstRun) {
      prevDeps = deps.map((d) => access(d))
      isFirstRun = false
      return
    }
    let changed = false
    for (let i = 0; i < deps.length; i++) {
      if (!isEqual(prevDeps[i], access(deps[i]))) {
        changed = true
        break
      }
    }
    if (changed) {
      prevDeps = deps.map((d) => access(d))
      fn()
    }
  })
}
