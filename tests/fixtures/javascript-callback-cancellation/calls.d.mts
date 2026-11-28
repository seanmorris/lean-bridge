import type * as api from "@example/callback-budget";
import type {taskRuntimeStats, waitTaskRuntimeIdle} from "@lean-bridge/runtime";

type Race = {beforeReply: number[]; successes: number; failures: number; freshSettlements: number; calls: number[]};
export declare function runBudget(
  a: typeof api, stats: typeof taskRuntimeStats, idle: typeof waitTaskRuntimeIdle,
): Promise<{earlyEntries: number; lateValue: Race; lateError: Race; recovered: number; live: number[]}>;
