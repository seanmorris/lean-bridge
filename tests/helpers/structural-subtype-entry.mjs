/**
 * Separately identified native entry probes for structural Subtypes.
 * Annotations preserve definition bodies; the interposer uses exact public and Lean ABIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeCType } from "../../src/build/native-model.mjs";
import { constructorRefinementLeaves } from "../../src/build/component-refinements.mjs";
import { generateGmpProjection } from "../../src/backends/c/gmp-projection.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { structuralSubtypeConfiguration, structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";

const constructors = ["checkedPositive", "normalizePositive", "checkedWord", "checkedByte"];
const sources = ["scalar", "arrays", "lists", "options", "product", "branch", "byteBranches", "nested", "aliasPair", "aliasArguments", "plainFin", "generic"];
const control = "\nnamespace StructuralSubtypes\n@[noinline, export lb_structural_source_unrestricted]\ndef unrestricted (value : Nat) : Nat := value\nend StructuralSubtypes\n";
const symbol = (kind, name) => `lb_structural_${kind}_${name}`;

/**
 * Add reversible observation annotations and one unrefined positive control.
 *
 * @param original - Exact original author fixture, without any probe annotations.
 */
export const structuralSubtypeEntrySource = original => {
	assert.equal(typeof original, "string"); assert.doesNotMatch(original, /lb_structural_|def unrestricted\b/u);
	const edits = [], entries = [];
	for(const [kind, names] of [["constructor", constructors], ["source", sources]]) for(const name of names)
	{
		const matches = [...original.matchAll(new RegExp(`^def ${name}\\b`, "gmu"))];
		assert.equal(matches.length, 1, `one original definition for ${name}`);
		const exported = symbol(kind, name);
		edits.push({ offset: matches[0].index, previous: matches[0][0], current: `@[noinline, export ${exported}]\ndef ${name}` });
		entries.push({ kind, label: `StructuralSubtypes.${name}`
			, symbol: name === "generic" ? "l_StructuralSubtypes_generic___redArg" : exported
			, result: "lean_object *"
			, parameters: name === "checkedByte" ? ["uint8_t"] : Array(name === "aliasArguments" ? 2 : 1).fill("lean_object *") });
	}
	edits.sort((a, b) => b.offset - a.offset);
	let source = original;
	for(const edit of edits) source = source.slice(0, edit.offset) + edit.current + source.slice(edit.offset + edit.previous.length);
	source += control;
	entries.push({ kind: "source", label: "StructuralSubtypes.unrestricted", symbol: symbol("source", "unrestricted"), result: "lean_object *", parameters: ["lean_object *"] });
	let restored = source.slice(0, -control.length);
	for(const edit of [...edits].reverse())
	{
		assert.equal(restored.slice(edit.offset, edit.offset + edit.current.length), edit.current);
		restored = restored.slice(0, edit.offset) + edit.previous + restored.slice(edit.offset + edit.current.length);
	}
	assert.equal(restored, original);
	return { source, entries, edits, appendedControl: control, originalSha256: sha256(original), probeSha256: sha256(source) };
};

/** Independent review adds only the unrefined control to the original structural API. */
export const structuralSubtypeEntryReview = () => {
	const review = structuralSubtypeReview();
	review.declarations.push(corpusReviewedIr({ id: "structuralsubtypes" }, [{ name: "StructuralSubtypes.unrestricted", parameters: ["nat"], result: "nat" }]).declarations[0]);
	return review;
};

/**
 * Preserve the ordinary constructor choices or the independent reviewed route.
 *
 * @param route - Ordinary or reviewed author source.
 */
export const structuralSubtypeEntryConfiguration = route => {
	const configuration = structuralSubtypeConfiguration(route, ["c"]);
	if(route === "ordinary") configuration.exports.push("StructuralSubtypes.unrestricted");
	return configuration;
};

/**
 * Bind observation labels to fresh compiler symbols and typed public C declarations.
 *
 * @param model - Fresh compiled probe model with the original twelve exports plus the control.
 * @param sourceProbe - Independently annotated source and its constructor/source signatures.
 */
export const structuralSubtypeEntrySelection = (model, sourceProbe) => {
	assert.equal(model.pointerBits, 64); assert.equal(model.exports.length, 13);
	const selected = structuredClone(sourceProbe.entries);
	for(const item of model.exports)
	{
		selected.push({ kind: "adapter", label: item.name, symbol: item.symbol, result: "lean_object *", parameters: item.parameters.map(parameter => nativeCType(parameter.type)) });
		item.refinements?.parameters.forEach((refinement, index) => {
			for(const leaf of constructorRefinementLeaves(refinement, item.parameters[index].type))
				selected.push({ kind: "validator"
					, label: `${item.name}:${index}${leaf.suffix}`
					, symbol: `${item.symbol}_refinement_${index}${leaf.suffix}`
					, result: "uint8_t"
					, parameters: [nativeCType(leaf.type)] });
		});
	}
	const projection = generateGmpProjection(model.bindingIr), header = projection.files["include/detail/structuralsubtypes_gmp.h"];
	for(const fn of projection.surface.functions)
	{
		const name = fn.name.replace("structuralsubtypes_", "structuralsubtypes_gmp_");
		const matches = [...header.matchAll(new RegExp(`^(structuralsubtypes_gmp_status) ${name}\\(([^;\\n]*)\\);$`, "gmu"))];
		assert.equal(matches.length, 1, `one exact public prototype for ${name}`);
		const declarations = matches[0][2].split(", "), args = declarations.map(value => /([A-Za-z_][A-Za-z0-9_]*)$/u.exec(value)?.[1]);
		assert.ok(args.every(Boolean));
		selected.push({ kind: "public", label: fn.declaration.name, symbol: name, result: matches[0][1], declarations, args });
	}
	assert.equal(new Set(selected.map(item => item.symbol)).size, selected.length);
	assert.equal(new Set(selected.map(item => `${item.kind}/${item.label}`)).size, selected.length);
	for(const item of selected)
	{
		assert.match(item.symbol, /^[A-Za-z_][A-Za-z0-9_]*$/u);
		assert.match(item.label, /^[A-Za-z_][A-Za-z0-9_.:]*$/u);
	}
	return selected;
};

/**
 * Render wrappers with uint8_t validators, an unboxed UInt8 constructor and boxed other values.
 *
 * @param selected - Exact independently labelled symbols and their compiler-checked signatures.
 */
export const structuralSubtypeEntryInterposer = selected => {
	const wrappers = selected.map(item => {
		const declarations = item.declarations ?? item.parameters.map((type, index) => `${type} a${index}`);
		const args = item.args ?? item.parameters.map((_, index) => `a${index}`);
		const enter = `LB_SUBTYPE_ENTRY_V1 ${item.kind === "public" ? "begin public" : `enter ${item.kind}`} ${item.label}\n`;
		return `${item.result} ${item.symbol}(${declarations.join(", ")}) {
  static ${item.result} (*next)(${declarations.join(", ")});
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${item.symbol}"); if (!next) { fprintf(stderr, "missing interposed target: ${item.symbol}\\n"); abort(); } }
  fputs(${JSON.stringify(enter)}, stderr);
  ${item.result} result = next(${args.join(", ")});
  ${item.kind === "public" ? `fputs(${JSON.stringify(`LB_SUBTYPE_ENTRY_V1 end public ${item.label}\n`)}, stderr);` : ""}
  return result;
}`;
	});
	return `#define _GNU_SOURCE
#include <structuralsubtypes.h>
#include <lean/lean.h>
#include <stdint.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
${wrappers.join("\n")}
`;
};
