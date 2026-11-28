import type * as api from "@example/callback-budget";
import type {taskRuntimeStats,waitTaskRuntimeIdle} from "@lean-bridge/runtime";
export declare function runBudget(a:typeof api,stats:typeof taskRuntimeStats,idle:typeof waitTaskRuntimeIdle):
  Promise<{first:number;many:number;nested:number;attempted:number;sameFunction:number;recovered:number;live:number[]}>;
