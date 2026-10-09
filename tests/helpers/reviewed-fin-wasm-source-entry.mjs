/**
 * Instrumented probe inputs for Lean source entry of the installed Fin npm corpus (VO #1438). Each measured export
 * body is wrapped in dbgTrace, and an unrefined control export is added. These are separate probe builds: their
 * bytes are never the unmodified packages, whose adapter entry is observed without any instrumentation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { reviewedFinWasmIr, reviewedFinWasmSelections } from "./reviewed-fin-wasm-fixture.mjs";
import { sourceEntryMarker as reviewedFinWasmEntryMarker } from "../fixtures/reviewed-fin-wasm/javascript-entry.mjs";

export const reviewedFinWasmSourceControl = "traceNat";
export const reviewedFinWasmSourceInstrumentation = "probe build: dbgTrace markers in the fixture source and an unrefined control export; not the unmodified packages whose adapter entry is observed";
// Out-of-range numbers for every refined export, which the unrefined control must still accept and enter.
export const reviewedFinWasmSourceControls = Object.freeze([[reviewedFinWasmSourceControl, Object.freeze([10n, 11n, 2n ** 128n, 184467440737095516170n, 184467440737095516171n])]]);
const exported = ["mirror", "never", "only", "huge", "tenth", "label", "rows", "empty", "nested"];

/**
 * Wrap each export body of the fixture in a source-entry marker and add the control export. Signatures and every
 * other line stay byte-equal.
 *
 * @param lean - The unchanged ReviewedFin.lean fixture.
 */
export const instrumentReviewedFinWasmLean = lean => {
	const definitions = [...lean.matchAll(/^def (\w+) [\s\S]*?:=/gmu)];
	assert.deepEqual(definitions.map(match => match[1]), exported, "every export, once, in order");
	let output = "", cursor = 0;
	for(const match of definitions)
	{
		const end = match.index + match[0].length;
		output += lean.slice(cursor, end) + ` dbgTrace "${reviewedFinWasmEntryMarker} ${match[1]}" fun _ =>`;
		cursor = end;
	}
	output += lean.slice(cursor);
	const close = "end ReviewedFin\n";
	assert.equal(output.split(close).length, 2);
	output = output.replace(close, `def ${reviewedFinWasmSourceControl} (value : Nat) : Nat := dbgTrace "${reviewedFinWasmEntryMarker} ${reviewedFinWasmSourceControl}" fun _ => value\n\n${close}`);
	// Removing the markers and the control restores the fixture byte for byte.
	assert.equal(output.replace(/ dbgTrace "[^"]+" fun _ =>/gu, "").replace(new RegExp(`def ${reviewedFinWasmSourceControl} [^\\n]*\\n\\n`, "u"), ""), lean);
	return output;
};

/**
 * The reviewed contract of a probe build: the unchanged reviewed declarations, then the unrefined control, which
 * has no refinement extension.
 *
 * @param selection - Scalar-only or structural corpus.
 */
export const instrumentReviewedFinWasmIr = selection => {
	assert.ok(reviewedFinWasmSelections.includes(selection));
	const document = reviewedFinWasmIr(selection);
	const [control] = corpusReviewedIr({ id: "reviewed-fin" }, [{ name: `ReviewedFin.${reviewedFinWasmSourceControl}`, parameters: ["nat"], result: "nat" }]).declarations;
	control.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
	// An unrefined export carries no refinement extension, as the compiler emits it; an all-null one is refused.
	assert.equal(Object.hasOwn(control.source.extensions, "lean-lang.org/refinements"), false);
	const instrumented = { ...document, declarations: [...document.declarations, control] };
	assert.deepEqual(instrumented.declarations.slice(0, -1), reviewedFinWasmIr(selection).declarations, "reviewed refinements are unchanged");
	return instrumented;
};
