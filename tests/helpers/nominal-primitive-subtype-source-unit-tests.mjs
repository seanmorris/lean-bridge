/**
 * Check the independent behavior oracle, refusal fixtures and strict diagnostic reader.
 * These tests do not run Lean or establish an installed-runtime result.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeAssertions } from "./nominal-primitive-subtype-assertions.mjs";
import { nominalPrimitiveSubtypeRefusals } from "./nominal-primitive-subtype-refusals.mjs";
import { assertNominalPrimitiveNativeDiagnostics } from "./nominal-primitive-subtype-native-source.mjs";

test("nominal primitive executable checks retain each field and both API modes without deriving outputs", () => {
	for(const component of [false, true]) for(const resultOnly of [false, true])
	{
		const names = new Set();
		const cases = nominalPrimitiveSubtypeAssertions({ component, resultOnly, call: name => { names.add(name); return name; } });
		assert.equal(cases.length, resultOnly ? 46 : 129);
		assert.equal(new Set(cases.map(item => item.label)).size, cases.length);
		for(const field of nominalPrimitiveSubtypeFields)
		{
			assert.equal(cases.filter(item => item.label === `result-${field.name}`).length, 1);
			for(const choice of ["A", "B"]) assert.equal(cases.filter(item => item.label === `${choice}-${field.name}`).length, resultOnly ? 0 : 1);
		}
		for(const item of cases) assert.match(item.source, /^#eval show IO Unit from do\n {2}unless /u);
		if(resultOnly) assert.deepEqual([...names].map(name => name.split(".").at(-1)).sort(), ["produce", "produceChoices", "produceEvent", "produceGroup", "producePair", "wordBits"]);
	}
});

test("nominal primitive refusal fixtures independently agree for every base and mismatch class", () => {
	const fixture = nominalPrimitiveSubtypeRefusals(); validateBindingIr(fixture.review);
	assert.equal(fixture.controls.length, 38); assert.equal(fixture.review.declarations.length, 38);
	assert.doesNotMatch(fixture.source, /\b(?:sorry|axiom|unsafe|partial)\b/u);
	for(const field of nominalPrimitiveSubtypeFields)
		assert.deepEqual(fixture.controls.filter(control => control.primitive === field.primitive).map(control => control.kind), ["input", "predicate"]);
	const source = canonicalJson(fixture.review);
	const selection = reviewedSourceSelection({ schemaVersion: 1
		, path: "api.binding-ir.json", source, sourceSha256: sha256(source)
		, semanticSha256: hashBindingIr(fixture.review) });
	assert.deepEqual(selection.contracts, fixture.contracts);
	assert.deepEqual(selection.exports, Object.keys(fixture.contracts).sort());
});

test("nominal primitive diagnostics accept only complete known unit-binding warnings", () => {
	const warning = "PrimitiveNativeAdapters.lean:12:3: warning: Variable name `unit` is not explicitly referenced.\n\nThe binding can be removed (if unused) or named `_` (if used implicitly).\n\nNote: This linter can be disabled with `set_option linter.unusedVariables false`\n";
	assertNominalPrimitiveNativeDiagnostics(""); assertNominalPrimitiveNativeDiagnostics(warning);
	assertNominalPrimitiveNativeDiagnostics(warning + warning);
	for(const value of [warning + "unexpected", warning.replace("`unit`", "`other`"), warning.replace("PrimitiveNativeAdapters", "OtherFile"), warning.slice(0, -1), "warning: declaration uses `sorry`\n"])
		assert.throws(() => assertNominalPrimitiveNativeDiagnostics(value));
});
