import { mount, tick } from "ripple"
import Harness from "./MachineHarness.ripple"

export async function renderMachine(machine: any, machineProps?: any) {
  let current: any
  const target = document.createElement("div")
  document.body.appendChild(target)

  const unmount = mount(Harness, {
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

  const advanceTime = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms)
    await tick()
  }

  const cleanup = () => {
    try {
      unmount()
    } catch {
      // Ripple's DOM removal may fail in jsdom
    }
    target.remove()
  }

  return { result: current, send, advanceTime, cleanup }
}
