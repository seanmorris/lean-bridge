import * as api from "@example/callback-budget";
import {taskRuntimeStats,waitTaskRuntimeIdle,closeTaskRuntime} from "@lean-bridge/runtime";
import {runBudget} from "./calls.mjs";
try {
  const typed = await api.single(40, async (n:number):Promise<number> => n + 2);
  if (typed !== 42) throw new Error("typed callback returned the wrong value");
  console.log(JSON.stringify(await runBudget(api,taskRuntimeStats,waitTaskRuntimeIdle)));
} finally { await closeTaskRuntime(); }
