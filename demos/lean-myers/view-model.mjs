/**
 * Pure presentation of the edit decisions returned by Lean.
 *
 * @file
 */

import { alignLineRows, splitLineEnding } from "./scenario.mjs";

/**
 * Validate the complete returned script and collect its actual decisions.
 *
 * @param answer Returned compiled script and distance.
 * @param tokens Exact input strings and corresponding token IDs.
 */
export const replay = (answer, tokens) => {
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
			if(before >= tokens.beforeTokens.length || after >= tokens.afterTokens.length
				|| tokens.beforeTokens[before] !== tokens.afterTokens[after])
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
 * Attach code-point decisions to physical lines and their exact terminators.
 *
 * @param lines Exact physical lines including terminators.
 * @param kinds Per-code-point keep, delete, or insert decisions.
 */
export const characterLines = (lines, kinds) => {
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

/**
 * Align rows using Lean's line script, never an independent display diff.
 *
 * @param mode Selected comparison unit.
 * @param lineInput Exact physical line tokens.
 * @param lineAnswer Compiled line script used for row alignment.
 * @param details Selected script replay and per-token decisions.
 */
export const buildPreview = (mode, lineInput, lineAnswer, details) => ({
	rows: alignLineRows(lineAnswer.operations)
	, beforeLines: mode === "characters" ? characterLines(lineInput.beforeTokens, details.beforeKinds)
		: lineInput.beforeTokens.map(splitLineEnding)
	, afterLines: mode === "characters" ? characterLines(lineInput.afterTokens, details.afterKinds)
		: lineInput.afterTokens.map(splitLineEnding)
});
