/**
 * Exact editor/session and cancellation regressions for the React workbench.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createEditorSession } from "./editor-session.mjs";
import { attachExactEditor } from "./editor-binding.mjs";
import { createComparisonController } from "./comparison-controller.mjs";
import { buildPreview, characterLines, replay } from "./view-model.mjs";
import { PRESETS, prepareTextDiff, textareaValue } from "./scenario.mjs";
import { solveOracle } from "./reference.mjs";

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
	let resolve;
	let reject;
	const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
};
const empty = { id: "empty", before: "", after: "", mode: "characters" };
const caret = position => ({ start: position, end: position });
const input = { before: "abc\r\n", after: "adc\n", mode: "characters" };

test("model Undo/Redo preserves exact mixed endings, selections, and redo branches", () => {
	const session = createEditorSession(empty);
	session.edit("before", "first\r\nsecond\rthird\n", { afterSelection: caret(19) });
	session.edit("before", "Xfirst\r\nsecond\rthird\n", {
		beforeSelection: caret(0), afterSelection: caret(1)
	});
	assert.equal(session.undo("before"), true);
	assert.equal(session.getSnapshot().before, "first\r\nsecond\rthird\n");
	assert.equal(session.getSelection("before").start, 0);
	assert.equal(session.undo("before", 1), true);
	assert.equal(session.getSelection("before").start, 1);
	session.undo("before");
	session.edit("before", "first\r\nsecond\rthird\n!");
	assert.equal(session.getSnapshot().history.before.redo, false);
	assert.equal(session.getSnapshot().after, "");
});

test("contiguous typing groups one undo transaction but selections and pauses split it", () => {
	const session = createEditorSession(empty);
	for(const [index, source] of ["a", "ab", "abc"].entries()) session.edit("before", source, {
		beforeSelection: caret(index)
		, afterSelection: caret(index + 1)
		, group: "typing"
		, time: index * 100
	});
	session.undo("before");
	assert.equal(session.getSnapshot().before, "");
	session.undo("before", 1);
	session.edit("before", "abcd", { beforeSelection: caret(3), afterSelection: caret(4), group: "typing", time: 3000 });
	session.undo("before");
	assert.equal(session.getSnapshot().before, "abc");
	session.select("before", caret(0));
	session.edit("before", "Xabc", { beforeSelection: caret(0), afterSelection: caret(1), group: "typing", time: 3100 });
	session.undo("before");
	assert.equal(session.getSnapshot().before, "abc");
});

test("composition commits one history entry and reset/swap intentionally replace histories", () => {
	const session = createEditorSession(empty);
	session.edit("before", "n", { group: "composition", afterSelection: caret(1) });
	session.edit("before", "に", { group: "composition", beforeSelection: caret(0), afterSelection: caret(1) });
	session.edit("before", "日本", { group: "composition", beforeSelection: caret(0), afterSelection: caret(2) });
	session.undo("before");
	assert.equal(session.getSnapshot().before, "");
	session.undo("before", 1);
	assert.equal(session.getSnapshot().before, "日本");
	session.setMode("lines");
	assert.equal(session.getSnapshot().history.before.undo, true);
	session.swap();
	assert.equal(session.getSnapshot().after, "日本");
	assert.equal(session.getSnapshot().history.after.undo, false);
	session.preset(PRESETS[3]);
	assert.equal(session.getSnapshot().before, PRESETS[3].before);
	assert.equal(session.getSnapshot().mode, "characters");
});

test("history keeps a bounded 100 edits without truncating current text", () => {
	const session = createEditorSession(empty);
	for(let index = 0; index < 120; index++) session.edit("before", `${index}:` + "a".repeat(5000));
	assert.ok(session.getSnapshot().before.length > 5000);
	let undos = 0;
	while(session.undo("before")) undos++;
	assert.equal(undos, 100);
});

test("history drops oldest versions above its 8MiB budget but preserves oversized current input", () => {
	const session = createEditorSession(empty);
	for(let index = 0; index < 6; index++) session.edit("before", `${index}` + "a".repeat(1024 * 1024));
	let undos = 0;
	while(session.undo("before")) undos++;
	assert.equal(undos, 2);
	const large = "x".repeat(5 * 1024 * 1024);
	session.edit("before", large);
	assert.equal(session.getSnapshot().before, large);
	assert.equal(session.getSnapshot().history.before.undo, false);
});

/* The event-target fixture models only the textarea members consumed by the binding. */
/* eslint-disable jsdoc/require-jsdoc */
class Textarea extends EventTarget
{
	selectionStart = 0;
	selectionEnd = 0;
	selectionDirection = "none";
	scrollTop = 0;
	scrollLeft = 0;
	text = "";
	get value() { return this.text; }
	set value(value) { this.text = textareaValue(value); }
	setSelectionRange(start, end, direction = "none")
	{
		this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction;
	}
	focus() {}
}
/* eslint-enable jsdoc/require-jsdoc */
const event = (name, properties = {}) => Object.assign(new Event(name, { cancelable: true }), properties);
const edit = (element, visible, type = "insertText", data = null) => {
	element.dispatchEvent(event("beforeinput", { inputType: type, data }));
	element.value = visible;
	element.setSelectionRange(visible.length, visible.length);
	element.dispatchEvent(event("input", { inputType: type, data }));
};

test("native bindings retain exact paste and portable Undo/Redo after dispose/remount", () => {
	const session = createEditorSession(empty);
	const first = new Textarea();
	const binding = attachExactEditor({ element: first, session, side: "before" });
	const raw = "first\r\nsecond\rthird\n";
	first.dispatchEvent(event("paste", { clipboardData: { getData: () => raw } }));
	edit(first, textareaValue(raw), "insertFromPaste");
	assert.equal(session.getSnapshot().before, raw);
	first.setSelectionRange(2, 4, "backward");
	binding.dispose();
	const second = new Textarea();
	const rebound = attachExactEditor({ element: second, session, side: "before" });
	assert.equal(second.value, textareaValue(raw));
	assert.equal(second.selectionStart, 2);
	assert.equal(second.selectionEnd, 4);
	assert.equal(second.selectionDirection, "backward");
	second.dispatchEvent(event("keydown", { key: "z", ctrlKey: true }));
	assert.equal(second.value, "");
	second.dispatchEvent(event("keydown", { key: "z", ctrlKey: true, shiftKey: true }));
	assert.equal(session.getSnapshot().before, raw);
	rebound.dispose();
	edit(second, "detached");
	assert.equal(session.getSnapshot().before, raw);
});

test("native composition pauses comparisons and settles as one exact history transaction", async () => {
	const session = createEditorSession({ ...empty, before: "\r\n" });
	const element = new Textarea();
	const activity = [];
	const binding = attachExactEditor({ element, session, side: "before", onComposition: active => activity.push(active) });
	element.dispatchEvent(event("compositionstart"));
	edit(element, "n\n", "insertCompositionText", "n");
	element.setSelectionRange(0, 1);
	edit(element, "に\n", "insertCompositionText", "に");
	element.dispatchEvent(event("compositionend"));
	await flush();
	assert.deepEqual(activity, [true, false]);
	assert.equal(session.getSnapshot().before, "に\r\n");
	session.undo("before");
	assert.equal(session.getSnapshot().before, "\r\n");
	binding.dispose();
});

const mockRuntime = () => {
	const counts = { prepared: 0, solved: 0, disposed: 0 };
	const prepareDiff = async ({ before, after }) => {
		counts.prepared++;
		const solve = () => { counts.solved++; return solveOracle(before, after); };
		solve.dispose = () => { counts.disposed++; };
		return solve;
	};
	return { counts, runtime: { MAX_TOTAL_TOKENS: 4096, prepareDiff } };
};

test("character presentation uses two real script decisions and releases both handles", async () => {
	const { runtime, counts } = mockRuntime();
	const states = [];
	const controller = createComparisonController({ loadRuntime: async () => runtime, onState: state => states.push(state) });
	controller.schedule(input, true);
	await flush();
	assert.deepEqual(counts, { prepared: 2, solved: 2, disposed: 2 });
	const state = states.at(-1);
	assert.equal(state.status, "ready");
	assert.equal(state.result.answer.distance, 3);
	assert.equal(state.result.preview.beforeLines[0].ending, "CRLF");
	assert.equal(state.result.details.removed, 2);
	controller.dispose();
});

test("disposed controller releases a late prepared handle without executing or publishing", async () => {
	const pending = deferred();
	const states = [];
	let disposed = 0;
	const runtime = { MAX_TOTAL_TOKENS: 4096, prepareDiff: () => pending.promise };
	const controller = createComparisonController({ loadRuntime: async () => runtime, onState: state => states.push(state) });
	controller.schedule(input, true);
	await flush();
	controller.dispose();
	const solve = () => { throw new Error("A stale solver must not run"); };
	solve.dispose = () => disposed++;
	pending.resolve(solve);
	await flush();
	assert.equal(disposed, 1);
	assert.deepEqual(states.map(state => state.status), ["pending"]);
});

test("stale second-pass completion is discarded and both handles are disposed", async () => {
	const pending = deferred();
	const { runtime, counts } = mockRuntime();
	const prepare = runtime.prepareDiff;
	let preparations = 0;
	runtime.prepareDiff = async packed => ++preparations === 2 ? pending.promise : prepare(packed);
	const states = [];
	const controller = createComparisonController({ loadRuntime: async () => runtime, onState: state => states.push(state) });
	controller.schedule(input, true);
	await flush();
	controller.suspend();
	const lineSolve = () => { throw new Error("Stale layout must not execute"); };
	lineSolve.dispose = () => { counts.disposed++; };
	pending.resolve(lineSolve);
	await flush();
	assert.equal(counts.disposed, 2);
	assert.equal(states.some(state => state.status === "ready"), false);
	controller.schedule({ ...input, mode: "lines" });
	controller.resume();
	await flush();
	assert.equal(states.at(-1).status, "ready");
	controller.dispose();
});

test("failed initialization can retry and limits reject without truncation or preparation", async () => {
	const { runtime, counts } = mockRuntime();
	let attempt = 0;
	const states = [];
	const controller = createComparisonController({ loadRuntime: async () => {
		if(++attempt === 1) throw new Error("Unavailable");
		return runtime;
	}
	, onState: state => states.push(state) });
	controller.schedule(input, true);
	await flush();
	assert.equal(states.at(-1).status, "error");
	controller.schedule({ before: "A".repeat(2500), after: "B".repeat(2500), mode: "characters" }, true);
	await flush();
	assert.ok(states.at(-1).error instanceof RangeError);
	assert.equal(counts.prepared, 0);
	controller.schedule({ ...input, mode: "lines" }, true);
	await flush();
	assert.equal(states.at(-1).status, "ready");
	assert.equal(counts.disposed, 1);
	controller.dispose();
});

test("debounced revisions cancel obsolete text and cleanup cancels the scheduled callback", async () => {
	const { runtime, counts } = mockRuntime();
	const states = [];
	const controller = createComparisonController({ loadRuntime: async () => runtime, onState: state => states.push(state), delay: 10 });
	controller.schedule(input);
	controller.schedule({ before: "x", after: "x", mode: "lines" }, true);
	await new Promise(resolve => setTimeout(resolve, 20));
	assert.equal(counts.prepared, 1);
	assert.equal(states.at(-1).result.answer.distance, 0);
	controller.schedule(input);
	controller.dispose();
	await new Promise(resolve => setTimeout(resolve, 20));
	assert.equal(counts.prepared, 1);
});

test("pure replay rejects malformed scripts and character rows preserve code points and endings", () => {
	const tokens = prepareTextDiff("😀é\r\n", "😀é\n", "characters");
	const answer = solveOracle(tokens.before, tokens.after);
	const details = replay(answer, tokens);
	assert.equal(details.removed + details.added, answer.distance);
	for(const invalid of [
		{ operations: [9], distance: 0 }, { operations: [], distance: 0 }
		, { operations: [0, 0, 0], distance: 0 }, { ...answer, distance: NaN }
	]) assert.throws(() => replay(invalid, tokens));
	const lines = characterLines(["😀é\r\n"], details.beforeKinds);
	assert.equal(lines[0].segments.map(segment => segment.text).join(""), "😀é");
	assert.equal(lines[0].endingKinds.length, 2);
	const lineInput = prepareTextDiff(tokens.beforeTokens.join(""), tokens.afterTokens.join(""), "lines");
	const preview = buildPreview("characters", lineInput, solveOracle(lineInput.before, lineInput.after), details);
	assert.deepEqual(preview.rows, [{ before: 0, after: 0, changed: true }]);
	assert.equal(preview.afterLines[0].ending, "LF");
});

test("React comparison controller produces the original Unicode result with actual Lean Wasm", async () => {
	const states = [];
	const controller = createComparisonController({ loadRuntime: () => import("./runtime.mjs"), onState: state => states.push(state) });
	const settled = new Promise((resolve, reject) => {
		const check = () => {
			const state = states.at(-1);
			if(state?.status === "ready") return resolve(state);
			if(state?.status === "error") return reject(state.error);
			setTimeout(check, 5);
		};
		check();
	});
	controller.schedule({ ...PRESETS[3] }, true);
	try
	{
		const state = await settled;
		assert.equal(state.result.answer.distance, 5);
		assert.equal(state.result.preview.beforeLines[0].ending, "CRLF");
	}
	finally
	{ controller.dispose(); }
});
