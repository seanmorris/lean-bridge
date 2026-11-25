/** @file Mount an installed consumer, then unmount while Lean awaits its callback. */
import React, {useEffect, useRef, useState} from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {AsyncStep_Workshop_openCursor, withHosts} from "@lean-bridge/workshop-host-example";
import {closeTaskRuntime, taskRuntimeStats, waitTaskRuntimeIdle} from "@lean-bridge/runtime";
import {nestedDelivery, terminalDelivery} from "./terminal-delivery.mjs";

/** Application instance whose level is reset by the Lean iterator finalizer. */
class Meter
{
	/** Public host-member value. */
	level = 0;
	/** Count actual Lean calls to the host read method. */
	reads = 0;
	/**
	 * Set the initial level.
	 *
	 * @param n - Initial reading.
	 */
	constructor(n) { this.level = n; }
	/** Return the current level on the browser thread. */
	read() { ++this.reads; return this.level; }
	/** Return the identical application instance. */
	identity() { return this; }
}

/** Run the UI after the compiled pthread module has initialized in this page. */
export const exerciseDelivery = async () => {
	const api = withHosts({Box: Meter}), meter = await api.start(7);
	const view = globalThis.document.querySelector("#component"), root = createRoot(view);
	const done = Promise.withResolvers(), entered = Promise.withResolvers(), reply = Promise.withResolvers();
	let outcome, canceled, won, nested, stream, lateCommits = 0;
	const App = () => {
		const active = useRef(null), [label, setLabel] = useState("run");
		useEffect(() => () => { if(active.current) won = active.current.cancel(); }, []);
		const clicked = async () => {
			try
			{
				if(label === "run")
				{
					const result = await nestedDelivery(cb => api.work(meter, cb));
					nested = result.trace;
					const n = result.value;
					let seen = 0;
					for await(const item of api.open_cursor(meter))
					{
						if(item !== meter) throw new Error("Wrong cursor item");
						++seen; break;
					}
					const sample = new Meter(13), cursor = api.open_cursor(sample);
					await api.work(meter, x => x);
					const idleReads = sample.reads;
					let count = 0;
					for await(const item of cursor)
					{
						if(item !== sample) throw new Error("Wrong item during natural iteration");
						++count;
					}
					const exhausted = (await cursor.next()).done;
					const invalid = new Meter(99), failed = api.open_cursor(invalid);
					let phase;
					try
					{ await failed.next(); throw new Error("Expected a typed pull failure"); }
					catch(error)
					{
						if(!(error instanceof AsyncStep_Workshop_openCursor)) throw error;
						phase = error.phase;
					}
					finally
					{ await failed.return(); }
					stream = {idleReads, count, exhausted, reads: sample.reads, final: sample.level, phase, failedFinal: invalid.level};
					flushSync(() => setLabel(n + ":" + seen + ":" + meter.level));
					done.resolve();
				} else
				{
					active.current = api.work(meter, () => { entered.resolve(); return reply.promise; });
					outcome = active.current.then(value => { ++lateCommits; setLabel(String(value)); }, e => { canceled = e.code; });
				}
			} catch(error)
			{ done.reject(error); entered.reject(error); }
		};
		return React.createElement("button", {onClick: clicked}, label);
	};
	let mounted = true;
	try
	{
		flushSync(() => root.render(React.createElement(App)));
		const button = view.querySelector("button");
		button.click(); await done.promise;
		const text = button.textContent;
		button.click(); await entered.promise;
		flushSync(() => root.unmount()); mounted = false;
		await outcome; reply.resolve(999);
		const next = await api.work(meter, n => n + 3);
		await api.dispose(); await waitTaskRuntimeIdle();
		const stats = taskRuntimeStats();
		const drained = ["pending", "frames", "nativeOwners", "allocations", "notifications", "hostPins", "hostErrors"]
			.every(key => stats[key] === 0);
		const retiring = withHosts({Box: Meter});
		const terminal = await terminalDelivery(cb => retiring.work(meter, cb));
		return {text, won, canceled, lateCommits, next, empty: view.childElementCount === 0, drained, nested, stream, terminal};
	} finally
	{
		if(mounted) flushSync(() => root.unmount());
		reply.resolve(0); await api.dispose(); await closeTaskRuntime();
	}
};
