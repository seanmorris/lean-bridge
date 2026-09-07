/**
 * Exact text adapters and examples for the generic Myers token solver.
 *
 * @file
 */

export const PRESETS = [
	{
		id: "settings", name: "Change settings", mode: "lines"
		, before: 'const settings = {\n  theme: "light",\n  autosave: false,\n  language: "en",\n};\n\nstartEditor(settings);\n'
		, after: 'const settings = {\n  theme: "dark",\n  autosave: true,\n  language: "en",\n};\n\nstartEditor(settings);\n'
	}
	, {
		id: "prose", name: "Prose", mode: "characters"
		, before: "The doors open at six.\nBring your ticket.\nTea is included.\n"
		, after: "The doors open at seven.\nBring your digital ticket.\nCoffee is included.\n"
	}
	, {
		id: "repeated", name: "Repeated lines", mode: "lines"
		, before: "A\nB\nA\nC\nA\n", after: "A\nA\nB\nC\nA\n"
	}
	, {
		id: "unicode", name: "Unicode & endings", mode: "characters"
		, before: "Hello, Zoë 👋\r\nCafé is ready.\r\n"
		, after: "Hello, Zoë 👋🏽\r\nCafé is ready.\n"
	}
	, { id: "empty", name: "Empty target", mode: "lines", before: "Keep this note.\nOne last line.", after: "" }
];

/**
 * Preserve exact line terminators or split into Unicode code points.
 *
 * @param {string} text Original source string.
 * @param {string} mode Lines or characters.
 * @returns {string[]} Tokens whose concatenation equals the original string.
 */
export const tokenize = (text, mode) => {
	if(mode === "characters") return Array.from(text);
	if(mode !== "lines") throw new RangeError("Token mode must be lines or characters");
	return text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/gu) ?? [];
};

/**
 * Intern both inputs in one shared symbol table without normalizing their text.
 *
 * @param {string} beforeText Exact before source.
 * @param {string} afterText Exact after source.
 * @param {string} mode Lines or characters.
 * @returns {object} String tokens and generic uint32 solver inputs.
 */
export const prepareTextDiff = (beforeText, afterText, mode) => {
	const beforeTokens = tokenize(beforeText, mode);
	const afterTokens = tokenize(afterText, mode);
	const symbols = new Map();
	const intern = token => {
		if(!symbols.has(token)) symbols.set(token, symbols.size);
		return symbols.get(token);
	};
	return {
		beforeTokens, afterTokens
		, before: Uint32Array.from(beforeTokens, intern)
		, after: Uint32Array.from(afterTokens, intern)
	};
};

/**
 * Separate a line's content from its exact terminator for visible ending badges.
 *
 * @param {string} token One exact line token.
 * @returns {object} Content, original terminator, and a display label.
 */
export const splitLineEnding = token => {
	const terminator = token.match(/(?:\r\n|\r|\n)$/u)?.[0] ?? "";
	return {
		text: terminator ? token.slice(0, -terminator.length) : token
		, terminator
		, ending: terminator === "\r\n" ? "CRLF" : terminator === "\r" ? "CR" : terminator === "\n" ? "LF" : "No newline"
	};
};

/**
 * Match the browser textarea's visible value while retaining the original model.
 *
 * @param {string} source Exact source text.
 * @returns {string} Browser display form, never used as the solver's source.
 */
export const textareaValue = source => source.replace(/\r\n?/gu, "\n");

/**
 * Map a textarea UTF-16 selection offset back into the exact source string.
 *
 * @param {string} source Exact source text.
 * @param {number} offset Visible UTF-16 offset.
 * @returns {number} Offset in the original source string.
 */
export const sourceOffset = (source, offset) => {
	let visible = 0;
	let index = 0;
	while(index < source.length && visible < offset)
	{
		index += source[index] === "\r" && source[index + 1] === "\n" ? 2 : 1;
		visible++;
	}
	return index;
};

/**
 * Replace a visible selection with exact inserted text, preserving other endings.
 *
 * @param {string} source Exact source text.
 * @param {number} start Visible selection start.
 * @param {number} end Visible selection end.
 * @param {string} insertion Exact typed or clipboard text.
 * @returns {string} Updated exact source model.
 */
export const applyVisibleEdit = (source, start, end, insertion) => source.slice(0, sourceOffset(source, start))
	+ insertion + source.slice(sourceOffset(source, end));

/**
 * Reconcile the edited textarea slice without rewriting untouched line endings.
 * This is an input adapter, not the diff algorithm used by the preview.
 *
 * @param {string} source Previous exact source model.
 * @param {string} nextVisible New browser textarea value.
 * @returns {string} Exact unchanged slices plus the browser's edited slice.
 */
export const reconcileTextareaChange = (source, nextVisible) => {
	const previous = textareaValue(source);
	let start = 0;
	while(start < previous.length && start < nextVisible.length && previous[start] === nextVisible[start]) start++;
	let oldEnd = previous.length;
	let newEnd = nextVisible.length;
	while(oldEnd > start && newEnd > start && previous[oldEnd - 1] === nextVisible[newEnd - 1])
	{
		oldEnd--;
		newEnd--;
	}
	return applyVisibleEdit(source, start, oldEnd, nextVisible.slice(start, newEnd));
};

/**
 * Use the browser's selection and input intent to preserve exact edit boundaries.
 *
 * @param {string} source Previous exact source model.
 * @param {string} nextVisible Updated browser display value.
 * @param {object} edit Captured beforeinput selection, inputType, and insertion data.
 * @returns {string} Updated source with untouched original terminators preserved.
 */
export const applyTextareaInput = (source, nextVisible, edit) => {
	if(edit)
	{
		let { start, end } = edit;
		let insertion = edit.inputType === "insertLineBreak" || edit.inputType === "insertParagraph" ? "\n" : edit.data;
		if(edit.inputType?.startsWith("delete"))
		{
			insertion = "";
			const removed = textareaValue(source).length - nextVisible.length;
			if(start === end && edit.inputType.endsWith("Backward")) start = Math.max(0, start - removed);
			else if(start === end && edit.inputType.endsWith("Forward")) end += removed;
		}
		if(typeof insertion === "string")
		{
			const candidate = applyVisibleEdit(source, start, end, insertion);
			if(textareaValue(candidate) === nextVisible) return candidate;
		}
	}
	return reconcileTextareaChange(source, nextVisible);
};

/**
 * Pair adjacent removed and inserted lines for display, using Lean's line script.
 *
 * @param {Uint32Array} operations Compiled line-mode keep/delete/insert opcodes.
 * @returns {object[]} Aligned line indices; null denotes an empty preview cell.
 */
export const alignLineRows = operations => {
	const rows = [];
	let before = 0;
	let after = 0;
	for(let index = 0; index < operations.length;)
	{
		if(operations[index] === 0)
		{
			rows.push({ before: before++, after: after++, changed: false });
			index++;
			continue;
		}
		const removed = [];
		const inserted = [];
		while(index < operations.length && operations[index] !== 0)
		{
			if(operations[index] === 1) removed.push(before++);
			else if(operations[index] === 2) inserted.push(after++);
			else throw new Error("Unknown edit opcode");
			index++;
		}
		for(let offset = 0; offset < Math.max(removed.length, inserted.length); offset++)
			rows.push({ before: removed[offset] ?? null, after: inserted[offset] ?? null, changed: true });
	}
	return rows;
};
