import * as api from "@example/parked-reader";
import {taskRuntimeStats,waitTaskRuntimeIdle,closeTaskRuntime} from "@lean-bridge/runtime";
import {parked} from "./calls.mjs";
export const run = () => parked(api,taskRuntimeStats,waitTaskRuntimeIdle);
export const close = closeTaskRuntime;
