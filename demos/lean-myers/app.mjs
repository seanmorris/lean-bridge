/**
 * Compare exact text with compiled Lean scripts and display their aligned edits.
 *
 * @file
 */

import { prepareDiff, MAX_TOTAL_TOKENS } from "./runtime.mjs";
import { mountBenchmark } from "./browser-benchmark.mjs";
import {
	PRESETS, tokenize, prepareTextDiff, splitLineEnding, textareaValue
	, applyVisibleEdit, applyTextareaInput, alignLineRows
} from "./scenario.mjs";

const byId = id => globalThis.document.getElementById(id);
const elements = Object.fromEntries([
	"runtime-status", "result-title", "result-copy", "edit-count", "delete-count"
	, "insert-count"
	, "example"
	, "swap-text"
	, "mode-help"
	, "before-text"
	, "after-text"
	, "before-meta", "after-meta", "preview-title", "diff-preview", "replay-mark"
	, "replay-title", "replay-copy", "kept-count", "interaction-status"
].map(id => [id, byId(id)]));
const verification = globalThis.document.querySelector(".verification-row");
const element = (tag, className, text) => {
	const node = globalThis.document.createElement(tag);
	if(className) node.className = className;
	if(text !== undefined) node.textContent = text;
	return node;
};
const plural = (count, singular) => `${count} ${singular}${count === 1 ? "" : "s"}`;
let beforeText = PRESETS[0].before;
let afterText = PRESETS[0].after;
let mode = PRESETS[0].mode;
let revision = 0;
let timer = 0;
let alive = true;
const pendingPaste = { before: null, after: null };
const pendingInput = { before: null, after: null };
const undoModels = { before: { values: [beforeText], index: 0 }, after: { values: [afterText], index: 0 } };

const renderMode = () => {
	for(const button of globalThis.document.querySelectorAll("[data-mode]"))
		button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
	elements["mode-help"].textContent = mode === "lines"
		? "Each exact line, including its ending, is one item. Replacing a line counts as one removal plus one addition."
		: "Characters are Unicode code points, not joined symbols. A combined accent or emoji can contain several. Replacing one code point costs two edits.";
	for(const [side, text] of [["before", beforeText], ["after", afterText]])
		elements[`${side}-meta`].textContent = `${plural(tokenize(text, "lines").length, "line")} · ${Array.from(text).length} code points`;
};

const pending = () => {
	elements["runtime-status"].classList.remove("failed");
	elements["runtime-status"].textContent = "Comparing updated text with Lean…";
	elements["result-title"].textContent = "Finding the fewest edits…";
	elements["result-copy"].textContent = "The comparison updates as you type. No Run button is needed.";
	for(const id of ["edit-count", "delete-count", "insert-count"]) elements[id].textContent = "—";
	elements["diff-preview"].setAttribute("aria-busy", "true");
	verification.className = "verification-row pending";
	elements["replay-mark"].textContent = "…";
	elements["replay-title"].textContent = "Checking the updated script";
	elements["replay-copy"].textContent = "The previous preview stays visible until Lean finishes the new comparison.";
	elements["kept-count"].textContent = "— kept";
	renderMode();
};

const showError = error => {
	const message = error instanceof Error ? error.message : String(error);
	elements["runtime-status"].classList.add("failed");
	elements["runtime-status"].textContent = error instanceof RangeError ? "Text exceeds this demo's comparison limit" : "Lean/Wasm could not complete the comparison";
	elements["result-title"].textContent = error instanceof RangeError ? "This comparison has too many items." : "The comparison did not finish.";
	elements["result-copy"].textContent = message;
	elements["preview-title"].textContent = "Edit the input to continue.";
	elements["diff-preview"].replaceChildren(element("p", "preview-error", message));
	elements["diff-preview"].setAttribute("aria-busy", "false");
	verification.className = "verification-row failed";
	elements["replay-mark"].textContent = "!";
	elements["replay-title"].textContent = "No new script was returned";
	elements["replay-copy"].textContent = "Both input strings remain intact. Shorten them or choose line mode; the demo never truncates your text.";
	if(!(error instanceof RangeError)) console.error(error);
};

/**
 * Replay a returned script, recording only its actual keep/delete/insert decisions.
 *
 * @param {object} answer Compiled result.
 * @param {object} tokens Exact string token arrays and matching solver IDs.
 * @returns {object} Verified operation counts and per-token decisions.
 */
const replay = (answer, tokens) => {
	let before = 0;
	let after = 0;
	let kept = 0;
	let removed = 0;
	let added = 0;
	const reconstructed = [];
	const beforeKinds = [];
	const afterKinds = [];
	for(const operation of answer.operations)
	{
		if(operation === 0)
		{
			if(before >= tokens.beforeTokens.length || after >= tokens.afterTokens.length || tokens.beforeTokens[before] !== tokens.afterTokens[after])
				throw new Error("Lean's returned keep operation did not match the input tokens");
			reconstructed.push(tokens.beforeTokens[before++]);
			after++;
			beforeKinds.push(0);
			afterKinds.push(0);
			kept++;
		}
		else if(operation === 1)
		{
			if(before >= tokens.beforeTokens.length) throw new Error("Lean's returned deletion exceeded the input");
			before++;
			beforeKinds.push(1);
			removed++;
		}
		else if(operation === 2)
		{
			if(after >= tokens.afterTokens.length) throw new Error("Lean's returned insertion exceeded the target");
			reconstructed.push(tokens.afterTokens[after++]);
			afterKinds.push(2);
			added++;
		}
		else throw new Error("Lean returned an unknown edit opcode");
	}
	if(before !== tokens.beforeTokens.length || after !== tokens.afterTokens.length
		|| reconstructed.join("") !== tokens.afterTokens.join("") || removed + added !== answer.distance)
		throw new Error("The returned edit script did not reconstruct the exact target and reported cost");
	return { kept, removed, added, beforeKinds, afterKinds };
};

/**
 * Attach character decisions to their original physical lines for presentation.
 *
 * @param {string[]} lines Exact original line tokens.
 * @param {number[]} kinds Per-code-point opcodes from the selected Lean script.
 * @returns {object[]} Character segments and explicit line-ending decisions.
 */
const characterLines = (lines, kinds) => {
	let offset = 0;
	return lines.map(token => {
		const line = splitLineEnding(token);
		const segments = [];
		for(const point of Array.from(line.text))
		{
			const kind = kinds[offset++];
			if(segments.at(-1)?.kind === kind) segments.at(-1).text += point;
			else segments.push({ text: point, kind });
		}
		const endingKinds = Array.from(line.terminator, () => kinds[offset++]);
		return { ...line, segments, endingKinds };
	});
};

const renderPreview = (viewMode, lineInput, lineAnswer, details) => {
	const rows = alignLineRows(lineAnswer.operations);
	const beforeLines = viewMode === "characters" ? characterLines(lineInput.beforeTokens, details.beforeKinds) : lineInput.beforeTokens.map(splitLineEnding);
	const afterLines = viewMode === "characters" ? characterLines(lineInput.afterTokens, details.afterKinds) : lineInput.afterTokens.map(splitLineEnding);
	if(!rows.length)
	{
		elements["diff-preview"].replaceChildren(element("p", "preview-empty", "Both versions are empty. There is nothing to remove or add."));
		return;
	}
	const cell = (lines, index, changed, side) => {
		const tone = side === "before" ? "removed" : "added";
		const node = element("div", `diff-cell${index === null ? " empty" : changed && viewMode === "lines" ? ` ${tone}-line` : ""}`);
		if(index === null)
		{
			node.setAttribute("aria-label", `No corresponding ${side} line`);
			node.append(element("span", "line-number", "—"));
			return node;
		}
		const line = lines[index];
		const number = element("span", "line-number", String(index + 1));
		number.setAttribute("aria-label", `${side} line ${index + 1}`);
		const marker = element("span", "line-marker", viewMode === "lines" && changed ? side === "before" ? "−" : "+" : "·");
		marker.setAttribute("aria-hidden", "true");
		const content = element("pre", "line-content");
		if(viewMode === "characters")
			for(const segment of line.segments) content.append(element("span", segment.kind === 1 ? "char-removed" : segment.kind === 2 ? "char-added" : "", segment.text));
		else content.append(element("span", "", line.text));
		const changedEnding = viewMode === "lines" && changed;
		const ending = element("span", `ending${line.ending !== "LF" ? " special" : ""}${changedEnding ? ` ${tone}` : ""}`, line.ending === "LF" ? "↵ LF" : line.ending === "No newline" ? "∅ No newline" : `↵ ${line.ending}`);
		if(viewMode === "characters" && line.terminator)
		{
			ending.replaceChildren(element("span", "", "↵ "));
			for(const [position, point] of Array.from(line.terminator).entries())
			{
				const kind = line.endingKinds[position];
				ending.append(element("span", kind === 1 ? "char-removed" : kind === 2 ? "char-added" : "", point === "\r" ? "CR" : "LF"));
			}
		}
		ending.title = line.ending === "No newline" ? "This line has no terminal newline" : `Original line ending: ${line.ending}`;
		content.append(ending);
		node.append(number, marker, content);
		return node;
	};
	elements["diff-preview"].replaceChildren(...rows.map(row => {
		const node = element("div", "diff-row");
		node.append(cell(beforeLines, row.before, row.changed, "before"), cell(afterLines, row.after, row.changed, "after"));
		return node;
	}));
};

const compare = async () => {
	const current = ++revision;
	const original = beforeText;
	const target = afterText;
	const viewMode = mode;
	let selectedSolve;
	let lineSolve;
	try
	{
		const input = prepareTextDiff(original, target, viewMode);
		const total = input.before.length + input.after.length;
		if(total > MAX_TOTAL_TOKENS)
			throw new RangeError(`This ${viewMode === "lines" ? "line" : "code-point"} comparison has ${total.toLocaleString("en-US")} items. The limit is ${MAX_TOTAL_TOKENS.toLocaleString("en-US")} across both versions.`);
		selectedSolve = await prepareDiff(input);
		if(current !== revision || !alive) return;
		const started = globalThis.performance.now();
		const answer = selectedSolve();
		const milliseconds = globalThis.performance.now() - started;
		const details = replay(answer, input);
		let lineInput = input;
		let lineAnswer = answer;
		if(viewMode === "characters")
		{
			lineInput = prepareTextDiff(original, target, "lines");
			if(lineInput.before.length + lineInput.after.length > MAX_TOTAL_TOKENS) throw new RangeError("The line layout exceeds this demo's comparison limit");
			lineSolve = await prepareDiff(lineInput);
			if(current !== revision || !alive) return;
			lineAnswer = lineSolve();
			replay(lineAnswer, lineInput);
		}
		renderPreview(viewMode, lineInput, lineAnswer, details);
		elements["diff-preview"].setAttribute("aria-busy", "false");
		elements["edit-count"].textContent = String(answer.distance);
		elements["delete-count"].textContent = String(details.removed);
		elements["insert-count"].textContent = String(details.added);
		elements["result-title"].textContent = answer.distance ? `${plural(answer.distance, "edit")}. No shorter script exists.` : "The versions match. No edits needed.";
		elements["result-copy"].textContent = viewMode === "lines"
			? "The total counts line removals and additions. A changed line can appear opposite its replacement, but still costs two edits."
			: "The total counts individual Unicode code-point removals and additions. Highlighted characters come from that shortest script; Lean's line comparison aligns the rows.";
		elements["preview-title"].textContent = answer.distance ? viewMode === "lines" ? "Changed lines, with their original context." : "The edits inside each line." : "Every item is shared.";
		elements["runtime-status"].classList.remove("failed");
		elements["runtime-status"].textContent = `Lean/Wasm ready · ${milliseconds.toFixed(2)} ms ${viewMode === "lines" ? "line" : "character"} solve`;
		verification.className = "verification-row";
		elements["replay-mark"].textContent = "✓";
		elements["replay-title"].textContent = "Script reproduces After exactly.";
		elements["replay-copy"].textContent = `The browser replayed all ${answer.operations.length} operations and recovered the exact target string, including its whitespace and line endings.`;
		elements["kept-count"].textContent = `${details.kept} ${viewMode === "lines" ? "lines" : "code points"} kept`;
		elements["interaction-status"].textContent = `${plural(answer.distance, "edit")}: ${details.removed} removed and ${details.added} added. The script reconstructs the target exactly.`;
	}
	catch(error)
	{ if(current === revision && alive) showError(error); }
	finally
	{
		selectedSolve?.dispose();
		lineSolve?.dispose();
	}
};

const schedule = (immediate = false) => {
	revision++;
	globalThis.clearTimeout(timer);
	pending();
	if(immediate) void compare();
	else timer = globalThis.setTimeout(() => { timer = 0; void compare(); }, 120);
};

const setText = (before, after) => {
	beforeText = before;
	afterText = after;
	elements["before-text"].value = before;
	elements["after-text"].value = after;
	for(const [side, value] of [["before", before], ["after", after]])
	{
		undoModels[side] = { values: [value], index: 0 };
		pendingPaste[side] = null;
		pendingInput[side] = null;
	}
};

for(const side of ["before", "after"])
{
	const textarea = elements[`${side}-text`];
	textarea.addEventListener("beforeinput", event => {
		pendingInput[side] = {
			start: textarea.selectionStart, end: textarea.selectionEnd
			, inputType: event.inputType, data: event.data
			, previousVisible: textarea.value
		};
	});
	textarea.addEventListener("paste", event => {
		const text = event.clipboardData?.getData("text/plain");
		if(text === undefined) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		pendingPaste[side] = {
			text, start, end
			, expected: textarea.value.slice(0, start) + textareaValue(text) + textarea.value.slice(end)
		};
	});
	textarea.addEventListener("input", event => {
		const source = side === "before" ? beforeText : afterText;
		const history = undoModels[side];
		let next;
		if(event.inputType === "historyUndo" || event.inputType === "historyRedo")
		{
			const direction = event.inputType === "historyUndo" ? -1 : 1;
			for(let index = history.index + direction; index >= 0 && index < history.values.length; index += direction)
				if(textareaValue(history.values[index]) === textarea.value)
				{
					next = history.values[index];
					history.index = index;
					break;
				}
		}
		if(next === undefined)
		{
			const pasted = pendingPaste[side];
			const input = pendingInput[side];
			next = pasted && pasted.expected === textarea.value
				? applyVisibleEdit(source, pasted.start, pasted.end, pasted.text)
				: applyTextareaInput(source, textarea.value, input?.previousVisible === textareaValue(source) ? input : null);
			history.values.splice(history.index + 1);
			history.values.push(next);
			history.index++;
		}
		pendingPaste[side] = null;
		pendingInput[side] = null;
		if(side === "before") beforeText = next;
		else afterText = next;
		elements.example.value = "custom";
		schedule();
	});
}

elements.example.addEventListener("change", () => {
	const preset = PRESETS.find(item => item.id === elements.example.value);
	if(!preset) return;
	mode = preset.mode;
	setText(preset.before, preset.after);
	schedule(true);
});
for(const button of globalThis.document.querySelectorAll("[data-mode]")) button.addEventListener("click", () => {
	mode = button.dataset.mode;
	schedule(true);
});
elements["swap-text"].addEventListener("click", () => {
	setText(afterText, beforeText);
	elements.example.value = "custom";
	schedule(true);
});
globalThis.addEventListener("pagehide", () => {
	alive = false;
	revision++;
	globalThis.clearTimeout(timer);
	timer = 0;
});
globalThis.addEventListener("pageshow", event => {
	if(event.persisted)
	{
		alive = true;
		schedule(true);
	}
});

setText(beforeText, afterText);
mountBenchmark();
schedule(true);
