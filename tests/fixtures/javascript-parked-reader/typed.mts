import * as reader from "@example/parked-reader";
import {taskRuntimeStats,waitTaskRuntimeIdle,closeTaskRuntime} from "@lean-bridge/runtime";
import {parked} from "./calls.mjs";
try {
  const result=await parked(reader,taskRuntimeStats,waitTaskRuntimeIdle);
  if (result.late !== 73) throw new Error("missing late value");
  console.log(JSON.stringify(result));
} finally { await closeTaskRuntime(); }
