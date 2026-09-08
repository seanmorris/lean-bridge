/**
 * Coalesce capacity edits and release each prepared Lean handle exactly once.
 *
 * @file
 */

import { buildGraphRequest } from "./network.mjs";
import { copyNetwork } from "./network-session.mjs";

/**
 * Create the disposable asynchronous owner for one mounted graph workbench.
 *
 * @param root0 Runtime loader, state callback, and injectable animation-frame clock.
 * @param root0.loadRuntime Load the unchanged compiled-runtime adapter on demand.
 * @param root0.onState Receive pending, ready, or failed solve state.
 * @param root0.requestFrame Schedule a coalesced capacity solve.
 * @param root0.cancelFrame Cancel scheduled work on navigation or suspension.
 */
export const createFlowController = ({ loadRuntime, onState, requestFrame = callback => globalThis.requestAnimationFrame(callback), cancelFrame = handle => globalThis.cancelAnimationFrame(handle) }) => {
	let revision = 0;
	let frame = 0;
	let disposed = false;
	let active = true;
	let latest;
	let result;
	const invalidate = () => { revision++; if(frame) cancelFrame(frame); frame = 0; };
	const solve = async current => {
		const network = copyNetwork(latest);
		const packed = buildGraphRequest(network);
		let prepared;
		const valid = () => !disposed && active && revision === current;
		try
		{
			const runtime = await loadRuntime();
			if(!valid()) return;
			prepared = await runtime.prepareGraph(packed.request);
			if(!valid()) return;
			const start = performance.now();
			const answer = prepared();
			result = { network, answer, edgeIndex: packed.edgeIndex, milliseconds: performance.now() - start };
			onState({ status: "ready", result });
		}
		catch(error)
		{ if(valid()) onState({ status: "error", error }); }
		finally
		{ prepared?.dispose(); }
	};
	const schedule = (network, immediate = false) => {
		if(disposed) return;
		latest = copyNetwork(network);
		invalidate();
		if(!active) return;
		onState({ status: "pending", result });
		const current = revision;
		if(immediate) void solve(current);
		else frame = requestFrame(() => { frame = 0; void solve(current); });
	};
	return {
		schedule
		, suspend: () => {
			if(!active) return;
			active = false;
			invalidate();
		}
		, resume: () => { if(disposed || active) return; active = true; if(latest) schedule(latest, true); }
		, dispose: () => { if(disposed) return; disposed = true; active = false; invalidate(); }
	};
};
