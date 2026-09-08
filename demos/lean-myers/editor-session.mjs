/**
 * Exact editor state retained in memory across client-side route visits.
 *
 * @file
 */

import { PRESETS, textareaValue } from "./scenario.mjs";

const HISTORY_BYTES = 8 * 1024 * 1024;
const selection = (value = {}) => ({
	start: value.start ?? 0
	, end: value.end ?? 0
	, direction: value.direction ?? "none"
	, scrollTop: value.scrollTop ?? 0
	, scrollLeft: value.scrollLeft ?? 0 });
const sameCaret = (left, right) => left.start === right.start && left.end === right.end;
const makeEditor = source => ({
	source
	, selection: selection()
	, values: [{ source, selection: selection() }]
	, index: 0, group: null });

/**
 * Create an independent editor session. No DOM, storage, runtime, or SSR side effects.
 *
 * @param preset Initial exact strings and comparison mode.
 */
export const createEditorSession = (preset = PRESETS[0]) => {
	const listeners = new Set();
	let editors = { before: makeEditor(preset.before), after: makeEditor(preset.after) };
	let mode = preset.mode;
	let presetId = preset.id;
	let revision = 0;
	let snapshot;
	const refresh = () => {
		snapshot = {
			before: editors.before.source
			, after: editors.after.source
			, mode
			, preset: presetId
			, revision
			, history: Object.fromEntries(Object.entries(editors).map(([side, editor]) => [side
				, { undo: editor.index > 0, redo: editor.index + 1 < editor.values.length }])) };
	};
	const notify = () => { revision++; refresh(); for(const listener of listeners) listener(); };
	refresh();
	return {
		getSnapshot: () => snapshot
		, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }
		, getSelection: side => ({ ...editors[side].selection })
		, select: (side, value) => {
			const next = selection(value);
			if(editors[side].group?.type !== "composition" && !sameCaret(editors[side].selection, next))
				editors[side].group = null;
			editors[side].selection = next;
		}
		, breakGroup: side => { editors[side].group = null; }
		, edit: (side, source, options = {}) => {
			const editor = editors[side];
			const before = selection(options.beforeSelection ?? editor.selection);
			const after = selection(options.afterSelection ?? editor.selection);
			editor.selection = after;
			if(source === editor.source) return;
			const type = options.group ?? null;
			const time = options.time ?? Date.now();
			const merged = type && editor.group?.type === type && editor.index + 1 === editor.values.length
				&& (type === "composition" || sameCaret(editor.group.after, before))
				&& (type === "composition" || time - editor.group.time < 1000);
			if(!merged)
			{
				editor.values[editor.index].selection = before;
				editor.values.splice(editor.index + 1);
				editor.values.push({ source, selection: after });
				editor.index++;
				if(editor.values.length > 101)
				{ editor.values.shift(); editor.index--; }
			}
			else editor.values[editor.index] = { source, selection: after };
			let retainedBytes = editor.values.reduce((sum, value) => sum + value.source.length * 2, 0);
			while(editor.index > 0 && retainedBytes > HISTORY_BYTES)
			{
				retainedBytes -= editor.values.shift().source.length * 2;
				editor.index--;
			}
			editor.source = source;
			editor.group = type ? { type, time, after } : null;
			presetId = "custom";
			notify();
		}
		, undo: (side, direction = -1) => {
			const editor = editors[side];
			const index = editor.index + direction;
			if(index < 0 || index >= editor.values.length) return false;
			editor.index = index;
			editor.source = editor.values[index].source;
			editor.selection = { ...editor.values[index].selection };
			editor.group = null;
			presetId = "custom";
			notify();
			return true;
		}
		, setMode: next => {
			if(!["lines", "characters"].includes(next)) throw new RangeError("Unknown comparison mode");
			if(next === mode) return;
			mode = next;
			notify();
		}
		, preset: next => {
			editors = { before: makeEditor(next.before), after: makeEditor(next.after) };
			mode = next.mode;
			presetId = next.id;
			notify();
		}
		, swap: () => {
			editors = { before: makeEditor(editors.after.source), after: makeEditor(editors.before.source) };
			presetId = "custom";
			notify();
		}
		, visible: side => textareaValue(editors[side].source)
	};
};

let browserSession;

/** Call from a client effect only. A full reload discards this single bounded session. */
export const getBrowserEditorSession = () => browserSession ??= createEditorSession();
