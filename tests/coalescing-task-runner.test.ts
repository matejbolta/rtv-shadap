import { describe, expect, it } from "vitest";
import { CoalescingTaskRunner } from "../src/content/coalescing-task-runner";

describe("CoalescingTaskRunner", () => {
  it("serializes work and coalesces repeated requests while a run is active", async () => {
    let active = 0;
    let maxActive = 0;
    let runs = 0;
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const runner = new CoalescingTaskRunner(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      runs += 1;
      if (runs === 1) await firstGate;
      active -= 1;
    });

    const first = runner.request();
    await Promise.resolve();
    const second = runner.request();
    const third = runner.request();
    releaseFirst?.();
    await Promise.all([first, second, third]);

    expect(runs).toBe(2);
    expect(maxActive).toBe(1);

    await runner.request();
    expect(runs).toBe(3);
  });

  it("can run again after a failed task", async () => {
    let runs = 0;
    const runner = new CoalescingTaskRunner(async () => {
      runs += 1;
      if (runs === 1) throw new Error("first run failed");
    });

    await expect(runner.request()).rejects.toThrow("first run failed");
    await expect(runner.request()).resolves.toBeUndefined();
    expect(runs).toBe(2);
  });
});
