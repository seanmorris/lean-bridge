/**
 * Measured run of the unchanged shared Fin corpus, portable across Node, pages and workers. Every public and raw
 * call is recorded once, in order, with the adapter counter change across that call; begin and end brackets go to
 * the realm's console.error, the stream the Lean runtime's dbgTrace output also reaches.
 *
 * @file
 */
import { executeCorpus } from "./javascript.mjs";

export const entryBegin = "lean-bridge-call-begin";
// The marker an instrumented probe build's Lean source prints, through dbgTrace, when an export's body is entered.
export const sourceEntryMarker = "lean-bridge-source-entry";
export const entryEnd = "lean-bridge-call-end";

/**
 * Canonical text of call arguments. Bigints and undefined are tagged objects, so no string can collide with them.
 *
 * @param value - Arguments of one call.
 */
export const encodeEntryArguments = value => JSON.stringify(value, (_, item) => (typeof item === "bigint" ? { bigint: String(item) } : item === undefined ? { undefined: true } : item));

/**
 * Record every console.error line of this realm synchronously, from before the package loads. The runtime binds
 * console.error when it loads, so the recorder stays installed; stop() ends recording and forwards again.
 */
export const captureConsoleError = () => {
	const original = console.error, lines = [];
	let recording = true;
	const recorder = (...parts) => {
		if(recording) lines.push(parts.map(String).join(" "));
		else original(...parts);
	};
	console.error = recorder;
	const stop = () => {
		recording = false;
		if(console.error === recorder) console.error = original;
	};
	return { lines, stop };
};

/**
 * Run the shared corpus through a recorder of every call.
 *
 * @param request - Package name and selection.
 * @param api - Installed exports plus the package-internal raw call.
 * @param counts - Adapter counters, one per selected symbol; empty when only source entry is measured.
 * @param controls - Extra calls of an unrefined control export, run after the corpus.
 */
export const measureCorpus = (request, api, counts = () => [], controls = []) => {
	const calls = [];
	let next = 0;
	const call = (name, route, args, run) => {
		const id = next++, before = counts();
		console.error(`${entryBegin} ${id}`);
		let outcome = 1;
		try
		{ return run(); }
		catch(error)
		{ outcome = 0; throw error; }
		finally
		{
			console.error(`${entryEnd} ${id}`);
			const after = counts();
			calls.push([id, name, route, encodeEntryArguments(args), outcome, after.map((value, index) => value - before[index])]);
		}
	};
	const measured = new Proxy(api, { get: (target, key) => {
		if(key === "raw") return (name, args) => call(name, "raw", args, () => target.raw(name, args));
		return typeof target[key] === "function" ? (...args) => call(String(key), "public", args, () => target[key](...args)) : target[key];
	} });
	const result = executeCorpus(request, measured);
	for(const [name, values] of controls) for(const value of values)
	{
		measured[name](value);
		measured.raw(name, [value]);
	}
	return { result, calls };
};
