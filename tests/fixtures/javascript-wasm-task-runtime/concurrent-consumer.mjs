/** @file Ordinary imports from two independently compiled packages using one worker pool. */
import {hold,release} from "@example/lean-jobs";
import {sum} from "@example/lean-totals";
import {closeTaskRuntime,taskRuntimeStats,waitTaskRuntimeIdle} from "@lean-bridge/runtime";

/** Keep one component pending while another completes, then drain both. */
export const exercise=async () => {
	const pending=hold();
	try
	{
		const total=await sum(17,12), during=taskRuntimeStats().nativeOwners;
		release(71);
		const held=await pending; await waitTaskRuntimeIdle();
		return {during,sum: total,held,after: taskRuntimeStats().nativeOwners};
	} finally
	{ release(0); await closeTaskRuntime(); }
};
