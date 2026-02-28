import { isFunction, isPlainObject } from "@zag-js/utils"
import { get, type Tracked } from "ripple"

export function access<T>(v: T | (() => T)): T {
    const gv = isFunction(v) ? v() : v
    return get(gv as Tracked<T>)
    
}

/**
 * Unwrap tracked values and strip undefined — replaces `compact(access(v))`.
 * Ripple Tracked objects are plain `{}` literals with circular block refs,
 * so the generic `compact` from @zag-js/utils recurses infinitely into them.
 * This function unwraps at the top level AND per-property level.
 */
export function compact(obj: any): any {
    if (!isPlainObject(obj) || obj === undefined) return obj
    const keys = Reflect.ownKeys(obj).filter((key) => typeof key === "string")
    const result: any = {}
    for (const key of keys) {
      // Unwrap individual tracked prop values
      let v = get(obj[key])
      if (v === undefined) continue
      result[key] = compact(v)
    }
    return result
  }