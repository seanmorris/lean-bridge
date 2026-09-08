/**
 * Native textarea events backed by exact strings and portable model history.
 *
 * @file
 */

import { applyTextareaInput, applyVisibleEdit, textareaValue } from "./scenario.mjs";

const readSelection = element => ({
	start: element.selectionStart
	, end: element.selectionEnd
	, direction: element.selectionDirection
	, scrollTop: element.scrollTop
	, scrollLeft: element.scrollLeft });

/**
 * Attach to an uncontrolled textarea. Cleanup never clears its retained session.
 *
 * @param root0 Editor binding configuration.
 * @param root0.element Uncontrolled textarea node.
 * @param root0.session Retained strings, selections, and edit history.
 * @param root0.side Before or after editor.
 * @param root0.onComposition Composition activity callback.
 */
export const attachExactEditor = ({ element, session, side, onComposition = () => {} }) => {
	let alive = true;
	let pendingInput;
	let pendingPaste;
	let composing = false;
	const listeners = [];
	const listen = (name, handler) => {
		element.addEventListener(name, handler);
		listeners.push([name, handler]);
	};
	const sync = (focus = false) => {
		const visible = session.visible(side);
		if(element.value !== visible) element.value = visible;
		const selection = session.getSelection(side);
		element.setSelectionRange(selection.start, selection.end, selection.direction);
		element.scrollTop = selection.scrollTop;
		element.scrollLeft = selection.scrollLeft;
		if(focus) element.focus({ preventScroll: true });
		pendingInput = undefined;
		pendingPaste = undefined;
	};
	const history = direction => {
		session.undo(side, direction);
		sync();
	};
	listen("keydown", event => {
		if(composing || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
		const key = event.key.toLowerCase();
		if(key !== "z" && key !== "y") return;
		event.preventDefault();
		history(key === "y" || event.shiftKey ? 1 : -1);
	});
	listen("beforeinput", event => {
		if((event.inputType === "historyUndo" || event.inputType === "historyRedo") && event.cancelable)
		{
			event.preventDefault();
			history(event.inputType === "historyUndo" ? -1 : 1);
			return;
		}
		pendingInput = {
			...readSelection(element)
			, inputType: event.inputType
			, data: event.data
			, previousVisible: element.value };
	});
	listen("paste", event => {
		const text = event.clipboardData?.getData("text/plain");
		if(text === undefined) return;
		const { start, end } = readSelection(element);
		pendingPaste = { text, start, end
			, expected: element.value.slice(0, start) + textareaValue(text) + element.value.slice(end) };
	});
	listen("input", event => {
		if(event.inputType === "historyUndo" || event.inputType === "historyRedo")
		{
			history(event.inputType === "historyUndo" ? -1 : 1);
			return;
		}
		const source = session.getSnapshot()[side];
		const input = pendingInput?.previousVisible === textareaValue(source) ? pendingInput : null;
		const pasted = pendingPaste?.expected === element.value ? pendingPaste : null;
		const next = pasted ? applyVisibleEdit(source, pasted.start, pasted.end, pasted.text)
			: applyTextareaInput(source, element.value, input);
		const group = composing || event.isComposing ? "composition"
			: !pasted && event.inputType === "insertText" && typeof event.data === "string" && !/\s/u.test(event.data)
				? "typing" : ["deleteContentBackward", "deleteContentForward"].includes(event.inputType)
					? event.inputType : null;
		session.edit(side, next, { beforeSelection: input ?? session.getSelection(side)
			, afterSelection: readSelection(element), group });
		pendingInput = undefined;
		pendingPaste = undefined;
	});
	listen("compositionstart", () => {
		composing = true;
		session.breakGroup(side);
		onComposition(true);
	});
	listen("compositionend", () => {
		queueMicrotask(() => {
			if(!alive) return;
			composing = false;
			session.breakGroup(side);
			onComposition(false);
		});
	});
	const remember = () => session.select(side, readSelection(element));
	for(const name of ["select", "keyup", "pointerup", "blur", "scroll"]) listen(name, remember);
	sync();
	return {
		sync
		, dispose: () => {
			if(!alive) return;
			alive = false;
			remember();
			for(const [name, listener] of listeners) element.removeEventListener(name, listener);
			pendingInput = undefined;
			pendingPaste = undefined;
		}
	};
};
