/**
 * Cancellable two-pass presentation controller for the generic Lean solver.
 *
 * @file
 */

import { prepareTextDiff } from "./scenario.mjs";
import { buildPreview, replay } from "./view-model.mjs";

/**
 * Create a route-owned controller. Runtime loading occurs only after scheduling.
 *
 * @param root0 Comparison controller configuration.
 * @param root0.loadRuntime Load the unchanged compiled-runtime adapter.
 * @param root0.onState Receive current comparison state.
 * @param root0.delay Typing debounce in milliseconds.
 */
export const createComparisonController = ({ loadRuntime, onState, delay = 120 }) => {
	let revision = 0;
	let timer = 0;
	let active = true;
	let disposed = false;
	let latest;
	let result;
	const invalidate = () => { revision++; clearTimeout(timer); timer = 0; };
	const compare = async current => {
		const inputText = { ...latest };
		let selectedSolve;
		let lineSolve;
		const currentFrame = () => active && !disposed && revision === current;
		try
		{
			const runtime = await loadRuntime();
			if(!currentFrame()) return;
			const input = prepareTextDiff(inputText.before, inputText.after, inputText.mode);
			const total = input.before.length + input.after.length;
			if(total > runtime.MAX_TOTAL_TOKENS)
				throw new RangeError(`This ${inputText.mode === "lines" ? "line" : "code-point"} comparison has ${total.toLocaleString("en-US")} items. The limit is ${runtime.MAX_TOTAL_TOKENS.toLocaleString("en-US")} across both versions.`);
			selectedSolve = await runtime.prepareDiff(input);
			if(!currentFrame()) return;
			const started = performance.now();
			const answer = selectedSolve();
			const milliseconds = performance.now() - started;
			const details = replay(answer, input);
			let lineInput = input;
			let lineAnswer = answer;
			if(inputText.mode === "characters")
			{
				lineInput = prepareTextDiff(inputText.before, inputText.after, "lines");
				if(lineInput.before.length + lineInput.after.length > runtime.MAX_TOTAL_TOKENS)
					throw new RangeError("The line layout exceeds this demo's comparison limit");
				lineSolve = await runtime.prepareDiff(lineInput);
				if(!currentFrame()) return;
				lineAnswer = lineSolve();
				replay(lineAnswer, lineInput);
			}
			result = { input: inputText, answer, details, milliseconds
				, preview: buildPreview(inputText.mode, lineInput, lineAnswer, details) };
			onState({ status: "ready", result });
		}
		catch(error)
		{ if(currentFrame()) onState({ status: "error", error }); }
		finally
		{
			selectedSolve?.dispose();
			lineSolve?.dispose();
		}
	};
	const schedule = (input, immediate = false) => {
		if(disposed) return;
		latest = { before: input.before, after: input.after, mode: input.mode };
		invalidate();
		if(!active) return;
		onState({ status: "pending", result });
		const current = revision;
		if(immediate) void compare(current);
		else timer = setTimeout(() => { timer = 0; void compare(current); }, delay);
	};
	return {
		schedule
		, suspend: () => { active = false; invalidate(); }
		, resume: () => {
			if(disposed) return;
			active = true;
			if(latest) schedule(latest, true);
		}
		, dispose: () => { disposed = true; active = false; invalidate(); }
	};
};
