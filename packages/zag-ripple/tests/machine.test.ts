import { createGuards, createMachine } from "@zag-js/core"
import type { Machine } from "@zag-js/core"
import { tick } from "ripple"
import { renderMachine } from "./render"

afterEach(() => {
  vi.useRealTimers()
})

describe("basic", () => {
  test("initial state", async () => {
    const machine = createMachine<any>({
      initialState() {
        return "foo"
      },
      states: {
        foo: {
          on: {
            NEXT: { target: "bar" },
          },
        },
        bar: {},
      },
    })

    const { result } = await renderMachine(machine)
    expect(result.state.get()).toBe("foo")
  })

  test("initial entry action", async () => {
    const fooEntry = vi.fn()
    const rootEntry = vi.fn()

    const machine = createMachine<any>({
      initialState() {
        return "foo"
      },
      entry: ["rootEntry"],
      states: {
        foo: {
          entry: ["fooEntry"],
        },
      },
      implementations: {
        actions: {
          fooEntry,
          rootEntry,
        },
      },
    })

    await renderMachine(machine)

    expect(fooEntry).toHaveBeenCalledOnce()
    expect(rootEntry).toHaveBeenCalledOnce()
  })

  test("current state and context", async () => {
    const machine = createMachine<any>({
      initialState() {
        return "test"
      },
      context({ bindable }) {
        return { foo: bindable(() => ({ defaultValue: "bar" })) }
      },
      states: {
        test: {},
      },
    })

    const { result } = await renderMachine(machine)

    expect(result.state.get()).toEqual("test")
    expect(result.context.get("foo")).toEqual("bar")
  })

  test("send event", async () => {
    let done = vi.fn()
    const machine = createMachine<any>({
      initialState() {
        return "test"
      },
      context({ bindable }) {
        return { foo: bindable(() => ({ defaultValue: "bar" })) }
      },
      states: {
        test: {
          on: {
            CHANGE: { target: "success" },
          },
        },
        success: {
          entry: ["done"],
        },
      },
      implementations: {
        actions: {
          done,
        },
      },
    })

    const { send } = await renderMachine(machine)

    await send({ type: "CHANGE" })
    expect(done).toHaveBeenCalledOnce()
  })

  test("state tags", async () => {
    const machine = createMachine<any>({
      initialState() {
        return "green"
      },
      states: {
        green: {
          tags: ["go"],
          on: {
            TIMER: {
              target: "yellow",
            },
          },
        },
        yellow: {
          tags: ["go"],
          on: {
            TIMER: {
              target: "red",
            },
          },
        },
        red: {
          tags: ["stop"],
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    expect(result.state.hasTag("go")).toBeTruthy()

    await send({ type: "TIMER" })
    expect(result.state.get()).toBe("yellow")
    expect(result.state.hasTag("go")).toBeTruthy()

    await send({ type: "TIMER" })
    expect(result.state.get()).toBe("red")
    expect(result.state.hasTag("go")).toBeFalsy()
  })

  test("reenter transition", async () => {
    const entryAction = vi.fn()

    const machine = createMachine<any>({
      initialState() {
        return "active"
      },
      states: {
        active: {
          entry: ["onEntry"],
          on: {
            REENTER: {
              target: "active",
              reenter: true,
            },
          },
        },
      },
      implementations: {
        actions: {
          onEntry: entryAction,
        },
      },
    })

    const { send } = await renderMachine(machine)

    expect(entryAction).toHaveBeenCalledTimes(1)

    await send({ type: "REENTER" })

    // Entry should be called again due to reenter
    expect(entryAction).toHaveBeenCalledTimes(2)
  })

  test("action order", async () => {
    const order = new Set<string>()
    const call = (key: string) => () => order.add(key)
    const machine = createMachine<any>({
      initialState() {
        return "test"
      },
      states: {
        test: {
          exit: ["exit1"],
          on: {
            NEXT: { target: "success", actions: ["nextActions"] },
          },
        },
        success: {
          entry: ["entry2"],
        },
      },
      implementations: {
        actions: {
          nextActions: call("transition"),
          exit1: call("exit1"),
          entry2: call("entry2"),
        },
      },
    })

    const { send } = await renderMachine(machine)

    await send({ type: "NEXT" })
    expect([...order]).toEqual(["exit1", "transition", "entry2"])
  })

  test("computed", async () => {
    const machine = createMachine<any>({
      initialState() {
        return "test"
      },
      states: {
        test: {
          on: {
            UPDATE: {
              actions: ["setValue"],
            },
          },
        },
      },
      context({ bindable }) {
        return { value: bindable(() => ({ defaultValue: "bar" })) }
      },
      computed: {
        length: ({ context }) => context.get("value").length,
      },
      implementations: {
        actions: {
          setValue: ({ context }) => context.set("value", "hello"),
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    expect(result.computed("length")).toEqual(3)

    await send({ type: "UPDATE" })
    expect(result.computed("length")).toEqual(5)
  })

  test("watch", async () => {
    const notify = vi.fn()
    const machine = createMachine<any>({
      initialState() {
        return "test"
      },
      states: {
        test: {
          on: {
            UPDATE: {
              actions: ["setValue"],
            },
          },
        },
      },
      context({ bindable }) {
        return { value: bindable(() => ({ defaultValue: "bar" })) }
      },
      watch({ track, context, action }) {
        track([() => context.get("value")], () => {
          action(["notify"])
        })
      },
      implementations: {
        actions: {
          setValue: ({ context }) => context.set("value", "hello"),
          notify,
        },
      },
    })

    const { send } = await renderMachine(machine)

    // send update twice and expect notify to be called once (since the value is the same)
    await send({ type: "UPDATE" })
    await send({ type: "UPDATE" })
    expect(notify).toHaveBeenCalledOnce()
  })

  test("guard: basic", async () => {
    const machine = createMachine<any>({
      props() {
        return { max: 1 }
      },
      initialState() {
        return "test"
      },

      context({ bindable }) {
        return { count: bindable(() => ({ defaultValue: 0 })) }
      },

      states: {
        test: {
          on: {
            INCREMENT: {
              guard: "isBelowMax",
              actions: ["increment"],
            },
          },
        },
      },

      implementations: {
        guards: {
          isBelowMax: ({ prop, context }) => prop("max") > context.get("count"),
        },
        actions: {
          increment: ({ context }) => context.set("count", context.get("count") + 1),
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    await send({ type: "INCREMENT" })
    expect(result.context.get("count")).toEqual(1)

    await send({ type: "INCREMENT" })
    expect(result.context.get("count")).toEqual(1)
  })

  test("guard: composition", async () => {
    const { and } = createGuards<any>()
    const machine = createMachine<any>({
      props() {
        return { max: 3, min: 1 }
      },
      initialState() {
        return "test"
      },

      context({ bindable }) {
        return { count: bindable(() => ({ defaultValue: 0 })) }
      },

      states: {
        test: {
          on: {
            INCREMENT: {
              guard: and("isBelowMax", "isAboveMin"),
              actions: ["increment"],
            },
            "COUNT.SET": {
              actions: ["setValue"],
            },
          },
        },
      },

      implementations: {
        guards: {
          isBelowMax: ({ prop, context }) => prop("max") > context.get("count"),
          isAboveMin: ({ prop, context }) => prop("min") < context.get("count"),
        },
        actions: {
          increment: ({ context }) => context.set("count", context.get("count") + 1),
          setValue: ({ context, event }) => context.set("count", event.value),
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    await send({ type: "INCREMENT" })
    expect(result.context.get("count")).toEqual(0)

    await send({ type: "COUNT.SET", value: 2 })
    expect(result.context.get("count")).toEqual(2)

    await send({ type: "INCREMENT" })
    expect(result.context.get("count")).toEqual(3)
  })

  test("context: controlled", async () => {
    const machine = createMachine<any>({
      props() {
        return { value: "foo", defaultValue: "" }
      },
      initialState() {
        return "test"
      },

      context({ bindable, prop }) {
        return {
          value: bindable(() => ({
            defaultValue: prop("defaultValue"),
            value: prop("value"),
          })),
        }
      },

      states: {
        test: {
          on: {
            "VALUE.SET": {
              actions: ["setValue"],
            },
          },
        },
      },

      implementations: {
        actions: {
          setValue: ({ context, event }) => context.set("value", event.value),
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    await send({ type: "VALUE.SET", value: "next" })

    // since value is controlled, it should not change
    expect(result.context.get("value")).toEqual("foo")
  })

  test("effects", async () => {
    const cleanupFn = vi.fn()
    const machine = createMachine<any>({
      initialState() {
        return "test"
      },
      states: {
        test: {
          effects: ["waitForMs"],
          on: {
            DONE: { target: "success" },
          },
        },
        success: {},
      },
      implementations: {
        effects: {
          waitForMs({ send }) {
            const id = setTimeout(() => {
              send({ type: "DONE" })
            }, 200)
            return () => {
              cleanupFn()
              clearTimeout(id)
            }
          },
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    await send({ type: "START" })
    expect(result.state.get()).toEqual("test")

    await new Promise((r) => setTimeout(r, 300))
    await tick()
    expect(result.state.get()).toEqual("success")
    expect(cleanupFn).toHaveBeenCalledOnce()
  })
})

describe("useMachine - transition actions", () => {
  it("should execute transition actions with correct event data", async () => {
    const capturedEvents: any[] = []

    const machine: Machine<any> = {
      id: "test",
      initial: "idle",
      initialState: () => "idle",
      states: {
        idle: {
          on: {
            START: {
              target: "active",
              actions: ["captureEvent"],
            },
          },
        },
        active: {
          on: {
            STOP: {
              target: "idle",
              actions: ["captureEvent"],
            },
          },
        },
      },
      implementations: {
        actions: {
          captureEvent(params: any) {
            capturedEvents.push(params.event)
          },
        },
      },
    } as any

    const { send } = await renderMachine(machine)

    await send({ type: "START", value: "test-1" })
    await send({ type: "STOP", value: "test-2" })

    expect(capturedEvents).toHaveLength(2)
    expect(capturedEvents[0]).toMatchObject({ type: "START", value: "test-1" })
    expect(capturedEvents[1]).toMatchObject({ type: "STOP", value: "test-2" })
  })

  it("should preserve event data when multiple sends happen before state change", async () => {
    const capturedEvents: any[] = []

    const machine: Machine<any> = {
      id: "test",
      initial: "a",
      initialState: () => "a",
      states: {
        a: {
          on: {
            GO_B: {
              target: "b",
              actions: ["capture"],
            },
          },
        },
        b: {
          on: {
            GO_C: {
              target: "c",
              actions: ["capture"],
            },
          },
        },
        c: {},
      },
      implementations: {
        actions: {
          capture(params: any) {
            capturedEvents.push({ type: params.event.type, data: params.event.data })
          },
        },
      },
    } as any

    const { send } = await renderMachine(machine)

    await send({ type: "GO_B", data: "first" })
    await send({ type: "GO_C", data: "second" })

    expect(capturedEvents[0]).toMatchObject({ type: "GO_B", data: "first" })
    expect(capturedEvents[1]).toMatchObject({ type: "GO_C", data: "second" })
  })

  it("should execute actions in correct order: exit -> transition -> enter", async () => {
    const executionOrder: string[] = []

    const machine: Machine<any> = {
      id: "test",
      initial: "state1",
      initialState: () => "state1",
      states: {
        state1: {
          exit: ["exitState1"],
          on: {
            TRANSITION: {
              target: "state2",
              actions: ["transitionAction"],
            },
          },
        },
        state2: {
          entry: ["enterState2"],
        },
      },
      implementations: {
        actions: {
          exitState1() {
            executionOrder.push("exit")
          },
          transitionAction() {
            executionOrder.push("transition")
          },
          enterState2() {
            executionOrder.push("enter")
          },
        },
      },
    } as any

    const { send } = await renderMachine(machine)

    await send({ type: "TRANSITION" })

    expect(executionOrder).toEqual(["exit", "transition", "enter"])
  })
})

describe("edge cases", () => {
  test("state.matches() helper", async () => {
    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      states: {
        idle: {
          on: {
            START: { target: "loading" },
          },
        },
        loading: {
          on: {
            SUCCESS: { target: "success" },
            ERROR: { target: "error" },
          },
        },
        success: {},
        error: {},
      },
    })

    const { result, send } = await renderMachine(machine)

    expect(result.state.matches("idle")).toBe(true)
    expect(result.state.matches("idle", "loading")).toBe(true)
    expect(result.state.matches("loading", "success")).toBe(false)

    await send({ type: "START" })
    expect(result.state.matches("loading")).toBe(true)
    expect(result.state.matches("idle", "loading", "error")).toBe(true)

    await send({ type: "SUCCESS" })
    expect(result.state.matches("success", "error")).toBe(true)
    expect(result.state.matches("idle", "loading")).toBe(false)
  })

  test("same-state transitions with actions", async () => {
    const actionSpy = vi.fn()
    const entrySpy = vi.fn()

    const machine = createMachine<any>({
      initialState() {
        return "active"
      },
      states: {
        active: {
          entry: ["onEntry"],
          on: {
            PING: {
              target: "active",
              actions: ["onPing"],
            },
          },
        },
      },
      implementations: {
        actions: {
          onEntry: entrySpy,
          onPing: actionSpy,
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    expect(result.state.get()).toBe("active")
    expect(entrySpy).toHaveBeenCalledTimes(1)

    await send({ type: "PING" })
    expect(result.state.get()).toBe("active")
    expect(actionSpy).toHaveBeenCalledTimes(1)
    expect(entrySpy).toHaveBeenCalledTimes(1)

    await send({ type: "PING" })
    expect(result.state.get()).toBe("active")
    expect(actionSpy).toHaveBeenCalledTimes(2)
    expect(entrySpy).toHaveBeenCalledTimes(1)
  })

  test("reenter transition action order", async () => {
    const order: string[] = []

    const machine = createMachine<any>({
      initialState() {
        return "active"
      },
      states: {
        active: {
          entry: ["onEntry"],
          exit: ["onExit"],
          on: {
            REENTER: {
              target: "active",
              reenter: true,
              actions: ["onTransition"],
            },
          },
        },
      },
      implementations: {
        actions: {
          onEntry: () => order.push("entry"),
          onExit: () => order.push("exit"),
          onTransition: () => order.push("transition"),
        },
      },
    })

    const { send } = await renderMachine(machine)
    order.length = 0

    await send({ type: "REENTER" })

    expect(order).toEqual(["exit", "transition", "entry"])
  })

  test("cleanup on state transition", async () => {
    const exitSpy = vi.fn()
    const effectCleanupSpy = vi.fn()

    const machine = createMachine<any>({
      initialState() {
        return "mounted"
      },
      states: {
        mounted: {
          exit: ["onStateExit"],
          effects: ["mountEffect"],
          on: {
            LEAVE: { target: "done" },
          },
        },
        done: {},
      },
      implementations: {
        actions: {
          onStateExit: exitSpy,
        },
        effects: {
          mountEffect() {
            return effectCleanupSpy
          },
        },
      },
    })

    const { send } = await renderMachine(machine)

    expect(exitSpy).not.toHaveBeenCalled()
    expect(effectCleanupSpy).not.toHaveBeenCalled()

    await send({ type: "LEAVE" })

    expect(exitSpy).toHaveBeenCalledOnce()
    expect(effectCleanupSpy).toHaveBeenCalledOnce()
  })

  test("event previous/current tracking", async () => {
    let capturedPrevious: any = null
    let capturedCurrent: any = null

    const machine = createMachine<any>({
      initialState() {
        return "test"
      },
      states: {
        test: {
          on: {
            FIRST: {
              target: "second",
            },
            SECOND: {
              actions: ["captureEvents"],
            },
          },
        },
        second: {
          on: {
            THIRD: {
              actions: ["captureEvents"],
            },
          },
        },
      },
      implementations: {
        actions: {
          captureEvents({ event }) {
            capturedPrevious = event.previous()
            capturedCurrent = event.current()
          },
        },
      },
    })

    const { send } = await renderMachine(machine)

    await send({ type: "FIRST", data: "first-data" })
    await send({ type: "THIRD", data: "third-data" })

    expect(capturedCurrent).toMatchObject({ type: "THIRD", data: "third-data" })
    expect(capturedPrevious).toMatchObject({ type: "FIRST", data: "first-data" })
  })
})

describe("uniform coverage", () => {
  test("root lifecycle runs entry and effects on init", async () => {
    const rootEntry = vi.fn()
    const rootEffectSetup = vi.fn()

    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      entry: ["rootEntry"],
      effects: ["rootEffect"],
      states: {
        idle: {},
      },
      implementations: {
        actions: {
          rootEntry,
        },
        effects: {
          rootEffect() {
            rootEffectSetup()
            return () => {}
          },
        },
      },
    })

    await renderMachine(machine)

    expect(rootEntry).toHaveBeenCalledOnce()
    expect(rootEffectSetup).toHaveBeenCalledOnce()
  })

  test("internal transition without target runs actions without reentry", async () => {
    const onEntry = vi.fn()
    const onInternal = vi.fn()
    const machine = createMachine<any>({
      initialState() {
        return "active"
      },
      states: {
        active: {
          entry: ["onEntry"],
          on: {
            INTERNAL: {
              actions: ["onInternal"],
            },
          },
        },
      },
      implementations: {
        actions: {
          onEntry,
          onInternal,
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    expect(result.state.get()).toBe("active")
    expect(onEntry).toHaveBeenCalledOnce()

    await send({ type: "INTERNAL" })

    expect(result.state.get()).toBe("active")
    expect(onInternal).toHaveBeenCalledOnce()
    expect(onEntry).toHaveBeenCalledOnce()
  })

  test("guard fallback selects the next passing transition", async () => {
    const blocked = vi.fn()
    const allowed = vi.fn()

    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      states: {
        idle: {
          on: {
            NEXT: [
              { guard: "allowBlocked", target: "blocked", actions: ["onBlocked"] },
              { target: "allowed", actions: ["onAllowed"] },
            ],
          },
        },
        blocked: {},
        allowed: {},
      },
      implementations: {
        guards: {
          allowBlocked: () => false,
        },
        actions: {
          onBlocked: blocked,
          onAllowed: allowed,
        },
      },
    })

    const { result, send } = await renderMachine(machine)
    await send({ type: "NEXT" })

    expect(result.state.get()).toBe("allowed")
    expect(allowed).toHaveBeenCalledOnce()
    expect(blocked).not.toHaveBeenCalled()
  })

  test("events only process when machine is started", async () => {
    const actionSpy = vi.fn()
    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      states: {
        idle: {
          on: {
            NEXT: {
              target: "done",
              actions: ["onNext"],
            },
          },
        },
        done: {},
      },
      implementations: {
        actions: {
          onNext: actionSpy,
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    // Verify machine processes events when started
    expect(result.getStatus()).toBe("Started")
    await send({ type: "NEXT" })
    expect(result.state.get()).toBe("done")
    expect(actionSpy).toHaveBeenCalledOnce()
  })

  test("reenter transition works without explicit target", async () => {
    const order: string[] = []

    const machine = createMachine<any>({
      initialState() {
        return "active"
      },
      states: {
        active: {
          entry: ["onEntry"],
          exit: ["onExit"],
          on: {
            REENTER: {
              reenter: true,
              actions: ["onTransition"],
            },
          },
        },
      },
      implementations: {
        actions: {
          onEntry: () => order.push("entry"),
          onExit: () => order.push("exit"),
          onTransition: () => order.push("transition"),
        },
      },
    })

    const { send } = await renderMachine(machine)
    order.length = 0

    await send({ type: "REENTER" })
    expect(order).toEqual(["exit", "transition", "entry"])
  })

  test("unknown events are no-ops", async () => {
    const actionSpy = vi.fn()
    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      states: {
        idle: {
          on: {
            KNOWN: { target: "done", actions: ["onKnown"] },
          },
        },
        done: {},
      },
      implementations: {
        actions: {
          onKnown: actionSpy,
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    await send({ type: "UNKNOWN" })
    expect(result.state.get()).toBe("idle")
    expect(actionSpy).not.toHaveBeenCalled()

    await send({ type: "KNOWN" })
    expect(result.state.get()).toBe("done")
    expect(actionSpy).toHaveBeenCalledOnce()
  })

  test("effect setup and cleanup stay balanced during state churn", async () => {
    const setupSpy = vi.fn()
    const cleanupSpy = vi.fn()

    const machine = createMachine<any>({
      initialState() {
        return "on"
      },
      states: {
        on: {
          effects: ["trackOn"],
          on: {
            TOGGLE: { target: "off" },
          },
        },
        off: {
          on: {
            TOGGLE: { target: "on" },
          },
        },
      },
      implementations: {
        effects: {
          trackOn() {
            setupSpy()
            return () => cleanupSpy()
          },
        },
      },
    })

    const { send } = await renderMachine(machine)

    // 6 toggles: on->off->on->off->on->off->on
    // "on" state is entered 4 times total (initial + 3 re-entries via toggle)
    // Each exit from "on" triggers cleanup
    for (let i = 0; i < 6; i++) {
      await send({ type: "TOGGLE" })
    }

    // After 6 toggles starting from "on":
    // setup runs on each "on" entry, cleanup runs on each "on" exit
    // Final state is "on" (even toggles), so one more setup than cleanup
    expect(setupSpy.mock.calls.length).toBeGreaterThan(0)
    expect(cleanupSpy).toHaveBeenCalledTimes(setupSpy.mock.calls.length - 1)
  })

  test("reenter restarts state effects exactly once per reenter", async () => {
    const setupSpy = vi.fn()
    const cleanupSpy = vi.fn()

    const machine = createMachine<any>({
      initialState() {
        return "active"
      },
      states: {
        active: {
          effects: ["trackEffect"],
          on: {
            REENTER: {
              target: "active",
              reenter: true,
            },
          },
        },
      },
      implementations: {
        effects: {
          trackEffect() {
            setupSpy()
            return () => cleanupSpy()
          },
        },
      },
    })

    const { send } = await renderMachine(machine)

    expect(setupSpy).toHaveBeenCalledTimes(1)
    expect(cleanupSpy).not.toHaveBeenCalled()

    await send({ type: "REENTER" })
    expect(setupSpy).toHaveBeenCalledTimes(2)
    expect(cleanupSpy).toHaveBeenCalledTimes(1)

    await send({ type: "REENTER" })
    expect(setupSpy).toHaveBeenCalledTimes(3)
    expect(cleanupSpy).toHaveBeenCalledTimes(2)
  })

  test("event baseline before first send", async () => {
    let currentType = "unset"
    let previousEvent: any = "unset"

    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      entry: ["capture"],
      states: {
        idle: {},
      },
      implementations: {
        actions: {
          capture({ event }) {
            currentType = event.current().type
            previousEvent = event.previous()
          },
        },
      },
    })

    await renderMachine(machine)

    expect(currentType).toBe("")
    expect(previousEvent == null || previousEvent.type === "").toBe(true)
  })

  test("multi-action transition order is deterministic", async () => {
    const order: string[] = []

    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      states: {
        idle: {
          exit: ["onExit"],
          on: {
            NEXT: { target: "done", actions: ["a1", "a2", "a3"] },
          },
        },
        done: {
          entry: ["onEntry"],
        },
      },
      implementations: {
        actions: {
          onExit: () => order.push("exit"),
          a1: () => order.push("a1"),
          a2: () => order.push("a2"),
          a3: () => order.push("a3"),
          onEntry: () => order.push("entry"),
        },
      },
    })

    const { send } = await renderMachine(machine)
    await send({ type: "NEXT" })

    expect(order).toEqual(["exit", "a1", "a2", "a3", "entry"])
  })

  test("all guards false results in no transition and no actions", async () => {
    const actionSpy = vi.fn()
    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      states: {
        idle: {
          on: {
            NEXT: [
              { guard: "g1", target: "blocked1", actions: ["onAttempt"] },
              { guard: "g2", target: "blocked2", actions: ["onAttempt"] },
            ],
          },
        },
        blocked1: {},
        blocked2: {},
      },
      implementations: {
        guards: {
          g1: () => false,
          g2: () => false,
        },
        actions: {
          onAttempt: actionSpy,
        },
      },
    })

    const { result, send } = await renderMachine(machine)
    await send({ type: "NEXT" })

    expect(result.state.get()).toBe("idle")
    expect(actionSpy).not.toHaveBeenCalled()
  })

  test("rapid sends in same tick are processed deterministically", async () => {
    const seen: string[] = []
    const machine = createMachine<any>({
      initialState() {
        return "a"
      },
      states: {
        a: {
          on: {
            GO_B: { target: "b", actions: ["record"] },
          },
        },
        b: {
          on: {
            GO_C: { target: "c", actions: ["record"] },
          },
        },
        c: {},
      },
      implementations: {
        actions: {
          record({ event }) {
            seen.push(event.type)
          },
        },
      },
    })

    const { result } = await renderMachine(machine)

    result.send({ type: "GO_B" })
    result.send({ type: "GO_C" })
    await tick()

    expect(result.state.get()).toBe("c")
    expect(seen).toEqual(["GO_B", "GO_C"])
  })
})

describe("controlled state", () => {
  test("watch reacts to tracked prop changes (controlled open pattern)", async () => {
    const watchSpy = vi.fn()

    const machine = createMachine<any>({
      initialState({ prop }) {
        return prop("open") ? "open" : "closed"
      },
      watch({ track, prop, action }) {
        track([() => prop("open")], () => {
          action(["toggleVisibility"])
        })
      },
      states: {
        closed: {
          on: {
            "controlled.open": { target: "open" },
          },
        },
        open: {
          on: {
            "controlled.close": { target: "closed" },
          },
        },
      },
      implementations: {
        actions: {
          toggleVisibility({ prop, send }) {
            watchSpy(prop("open"))
            send({ type: prop("open") ? "controlled.open" : "controlled.close" })
          },
        },
      },
    })

    // Use the controlled harness that manages tracked values inside a component
    const { mount, tick } = await import("ripple")
    const { default: ControlledHarness } = await import("./ControlledHarness.ripple")

    let ctrl: any
    const target = document.createElement("div")
    document.body.appendChild(target)

    mount(ControlledHarness, {
      target,
      props: {
        machine,
        initialOpen: false,
        onReady(api: any) {
          ctrl = api
        },
      },
    })
    await tick()

    // Initially closed
    expect(ctrl.service.state.get()).toBe("closed")

    // Toggle open via tracked prop
    ctrl.setOpen(true)
    await tick()
    await Promise.resolve()

    expect(watchSpy).toHaveBeenCalledWith(true)
    expect(ctrl.service.state.get()).toBe("open")

    // Toggle closed via tracked prop
    ctrl.setOpen(false)
    await tick()
    await Promise.resolve()

    expect(watchSpy).toHaveBeenCalledWith(false)
    expect(ctrl.service.state.get()).toBe("closed")

    target.remove()
  })
})

describe("re-entrant send (keyboard nav pattern)", () => {
  test("focusedValue updates when action triggers re-entrant blur/focus sends", async () => {
    // This mimics the accordion keyboard navigation pattern:
    // ArrowDown → GOTO.NEXT action → calls .focus() on next element
    // → blur fires on current → send(TRIGGER.BLUR) mid-action
    // → focus fires on next → send(TRIGGER.FOCUS) mid-action
    // The machine must correctly process all three events.

    const log: string[] = []

    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      context({ bindable }) {
        return {
          focusedValue: bindable(() => ({ defaultValue: null as string | null })),
        }
      },
      states: {
        idle: {
          on: {
            "TRIGGER.FOCUS": {
              target: "focused",
              actions: ["setFocusedValue"],
            },
          },
        },
        focused: {
          on: {
            "GOTO.NEXT": {
              actions: ["focusNext"],
            },
            "TRIGGER.FOCUS": {
              actions: ["setFocusedValue"],
            },
            "TRIGGER.BLUR": {
              target: "idle",
              actions: ["clearFocusedValue"],
            },
          },
        },
      },
      implementations: {
        actions: {
          setFocusedValue({ context, event }) {
            log.push(`setFocusedValue: ${event.value}`)
            context.set("focusedValue", event.value)
          },
          clearFocusedValue({ context }) {
            log.push(`clearFocusedValue`)
            context.set("focusedValue", null)
          },
          focusNext({ context, send }) {
            const current = context.get("focusedValue")
            log.push(`focusNext: current=${current}`)
            const items = ["home", "about", "contact"]
            const idx = items.indexOf(current!)
            const next = items[(idx + 1) % items.length]
            log.push(`focusNext: next=${next}`)

            // Simulate what .focus() does: triggers blur on current, then focus on next
            // These sends are RE-ENTRANT (called during an action)
            send({ type: "TRIGGER.BLUR" })
            send({ type: "TRIGGER.FOCUS", value: next })
          },
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    // 1) Focus "home"
    await send({ type: "TRIGGER.FOCUS", value: "home" })
    expect(result.state.get()).toBe("focused")
    expect(result.context.get("focusedValue")).toBe("home")
    log.push("---")

    // 2) ArrowDown: GOTO.NEXT should move focus from "home" → "about"
    await send({ type: "GOTO.NEXT" })
    log.push(`after GOTO.NEXT #1: state=${result.state.get()}, focused=${result.context.get("focusedValue")}`)
    log.push("---")

    // 3) ArrowDown: GOTO.NEXT should move focus from "about" → "contact"
    await send({ type: "GOTO.NEXT" })
    log.push(`after GOTO.NEXT #2: state=${result.state.get()}, focused=${result.context.get("focusedValue")}`)

    console.log("REENTRANT SEND LOG:", JSON.stringify(log, null, 2))

    // Verify the final state
    expect(result.context.get("focusedValue")).toBe("contact")
    expect(result.state.get()).toBe("focused")
  })
})
