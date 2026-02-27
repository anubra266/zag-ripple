import { createMachine } from "@zag-js/core"
import { mount, tick } from "ripple"
import { normalizeProps, mergeProps, onMount } from "../dist/index.mjs"
import Harness from "./DistHarness.ripple"

async function renderMachine(machine: any, machineProps?: any) {
  let current: any
  const target = document.createElement("div")
  document.body.appendChild(target)

  mount(Harness, {
    target,
    props: {
      machine,
      machineProps,
      onReady(service: any) {
        current = service
      },
    },
  })

  await tick()

  const send = async (event: any) => {
    current.send(event)
    await tick()
    await Promise.resolve()
  }

  return { result: current, send }
}

describe("dist build", () => {
  test("useMachine: init, send, and state transitions", async () => {
    const entrySpy = vi.fn()

    const machine = createMachine<any>({
      initialState() {
        return "idle"
      },
      entry: ["onEntry"],
      states: {
        idle: {
          on: {
            START: { target: "running" },
          },
        },
        running: {
          on: {
            STOP: { target: "idle" },
          },
        },
      },
      implementations: {
        actions: {
          onEntry: entrySpy,
        },
      },
    })

    const { result, send } = await renderMachine(machine)

    expect(result.state.get()).toBe("idle")
    expect(entrySpy).toHaveBeenCalledOnce()

    await send({ type: "START" })
    expect(result.state.get()).toBe("running")

    await send({ type: "STOP" })
    expect(result.state.get()).toBe("idle")
  })

  test("normalizeProps maps event names correctly", () => {
    const props = (normalizeProps as any).element({
      onFocus: () => {},
      onBlur: () => {},
      onChange: () => {},
      className: "test",
      htmlFor: "input-1",
    })

    expect(props).toHaveProperty("onFocusIn")
    expect(props).toHaveProperty("onFocusOut")
    expect(props).toHaveProperty("onInput")
    expect(props).toHaveProperty("class", "test")
    expect(props).toHaveProperty("for", "input-1")
    expect(props).not.toHaveProperty("onFocus")
    expect(props).not.toHaveProperty("className")
  })

  test("mergeProps combines objects", () => {
    const merged = mergeProps({ a: 1 }, { b: 2 })
    expect(merged).toMatchObject({ a: 1, b: 2 })
  })

  test("onMount runs callback", async () => {
    const fn = vi.fn()
    const target = document.createElement("div")
    document.body.appendChild(target)

    // onMount needs a component context, so use a minimal harness
    const { default: OnMountTest } = await import("./OnMountTest.ripple")
    mount(OnMountTest, { target, props: { fn } })
    await tick()

    expect(fn).toHaveBeenCalledOnce()
    target.remove()
  })
})
