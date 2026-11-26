import * as api from "@example/callback-budget";
import {taskRuntimeStats,waitTaskRuntimeIdle,closeTaskRuntime} from "@lean-bridge/runtime";
import {runBudget} from "./calls.mjs";
export const run=()=>runBudget(api,taskRuntimeStats,waitTaskRuntimeIdle);
export const close=closeTaskRuntime;
