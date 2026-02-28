import { isEqual } from "@zag-js/utils"
import { effect } from "ripple"
import { access } from "./utils"

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
