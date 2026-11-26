import * as api from "@example/callback-budget";
import {taskRuntimeStats, waitTaskRuntimeIdle, closeTaskRuntime} from "@lean-bridge/runtime";
import {runBudget} from "./calls.mjs";

try {
  const work = api.single(1, async (n: number): Promise<number> => n);
  const result = work.catch((error: unknown) => error instanceof Error && "code" in error && error.code);
  const won: boolean = work.cancel();
  if (!won || await result !== "operation-cancelled") throw new Error("typed cancellation lost");
  await waitTaskRuntimeIdle();
  console.log(JSON.stringify(await runBudget(api, taskRuntimeStats, waitTaskRuntimeIdle)));
} finally {
  await closeTaskRuntime();
}
