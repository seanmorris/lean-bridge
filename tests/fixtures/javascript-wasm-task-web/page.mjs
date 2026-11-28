/** @file Run the deployed worker and observe the parent through the installed public API. */
/* global Worker */

/**
 * Do not send the first request until the worker has installed its handler.
 *
 * @param progress - Receive worker startup and assertion diagnostics.
 */
const child = progress => new Promise((resolve, reject) => {
	const worker = new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" });
	let last = "starting module worker";
	const timeout = setTimeout(() => finish(reject, new Error("Worker stalled after " + last)), 60000);
	const finish = (fn, value) => { clearTimeout(timeout); worker.terminate(); fn(value); };
	worker.onerror = e => finish(reject, new Error(e.message));
	worker.onmessage = ({ data }) => {
		if(data.ready)
		{
			last = "worker ready"; progress(last); worker.postMessage("run");
		}
		else if(data.last)
		{ last = data.last; progress(last); }
		else if(data.error) finish(reject, new Error(data.error));
		else finish(resolve, data.value);
	};
});

globalThis.runInstalledWorker = async (progress = () => {}) => {
	progress("importing the parent component");
	const { run } = await import("./parent.mjs");
	const result = await run(child, progress);
	const { taskRuntimeStats } = await import("@lean-bridge/runtime");
	const { state, frames, allocations, pending, nativeOwners, notifications } = taskRuntimeStats();
	return { ...result, state, frames, allocations, pending, nativeOwners, notifications };
};
