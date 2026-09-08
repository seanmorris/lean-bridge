/**
 * Serialize exact Lean snapshots and release every prepared result, including stale ones.
 *
 * @file
 */

import { packScene } from "./scenario.mjs";

/**
 * Create a latest-frame solver with explicit suspension and lifetime ownership.
 *
 * @param {object} options Runtime loader, result observer, and optional clock.
 * @param {() => Promise<object>} options.loadRuntime Load the compiled solver adapter.
 * @param {(state: object) => void} options.onState Receive only current results.
 * @param {() => number} [options.now] Read a monotonic timing clock.
 */
export const createFrameController = ({ loadRuntime, onState, now = () => performance.now() }) => {
	let disposed = false;
	let suspended = false;
	let busy = false;
	let revision = 0;
	let pending;
	let latest;
	const pump = async () => {
		if(disposed || suspended || busy || !pending) return;
		busy = true;
		const input = pending;
		pending = undefined;
		const current = revision;
		let solve;
		try
		{
			const runtime = await loadRuntime();
			if(disposed || suspended || current !== revision) return;
			solve = await runtime.prepareSweep({ boxes: packScene(input.bodies), dimensions: 2, axis: input.axis });
			if(disposed || suspended || current !== revision) return;
			const start = now();
			const answer = solve();
			const milliseconds = now() - start;
			if(!disposed && !suspended && current === revision) onState({ status: "ready", input, answer, milliseconds });
		}
		catch(error)
		{
			if(!disposed && !suspended && current === revision) onState({ status: "error", error });
		}
		finally
		{
			solve?.dispose();
			busy = false;
			void pump();
		}
	};
	return {
		request: input => {
			if(disposed) return;
			revision++;
			latest = { ...input, bodies: input.bodies.map(body => ({ ...body, x: Math.round(body.x), y: Math.round(body.y) })) };
			pending = latest;
			void pump();
		}
		, suspend: () => { suspended = true; revision++; pending = latest; }
		, resume: () => { if(disposed) return; suspended = false; void pump(); }
		, isBusy: () => busy
		, dispose: () => { disposed = true; revision++; pending = undefined; latest = undefined; }
	};
};
