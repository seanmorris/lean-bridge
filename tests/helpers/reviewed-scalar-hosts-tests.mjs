/**
 * Reviewed scalar host gates retain independent decisions and separate reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedSourceSelection, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { nativeFinReviewedIr } from "./reviewed-fin-fixture.mjs";
import { reviewedScalarHostIr } from "./reviewed-scalar-host-fixture.mjs";

test("reviewed scalar host fixture changes argument labels without changing authored bounds", () => {
	const original = nativeFinReviewedIr(), ir = reviewedScalarHostIr();
	for(const [index, declaration] of ir.declarations.entries())
	{
		assert.deepEqual(declaration.parameters.map(parameter => parameter.name), declaration.parameters.map((_, position) => `arg${position}`));
		assert.deepEqual(declaration.source.extensions, original.declarations[index].source.extensions);
	}
	const restored = structuredClone(ir);
	for(const [index, declaration] of restored.declarations.entries())
		declaration.parameters.forEach((parameter, position) => { parameter.name = original.declarations[index].parameters[position].name; });
	assert.deepEqual(restored, original);
	const source = canonicalJson(ir);
	const input = { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
	validateReviewedSource(input);
	assert.deepEqual(reviewedSourceSelection(input), {
		exports: ["NativeFin.impossible", "NativeFin.label", "NativeFin.mirror", "NativeFin.only", "NativeFin.succHuge", "NativeFin.twice", "NativeFin.wrap"]
		, arities: []
	});
});

test("reviewed Python and Rust scalar gates require separate uploaded observations", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const profile of ["python", "rust"])
	{
		const source = await readFile(`tests/${profile}-fin.test.mjs`, "utf8");
		assert.ok(source.includes('const reviewedSource = reviewed ? canonicalJson(reviewedScalarHostIr()) : null;'));
		assert.ok(source.includes('assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);'));
		assert.ok(source.includes('assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));'));
		assert.ok(source.includes(`reviewed ? "${profile}-reviewed.json" : "${profile}.json"`));
		assert.ok(source.includes('path: reviewed ? "reviewed-ir" : "ordinary-source"'));
		assert.ok(workflow.includes(`LEAN_BRIDGE_${profile.toUpperCase()}_FIN_TEST=1 node --test tests/${profile}-fin.test.mjs`));
		assert.ok(workflow.includes(`          test -s build/native-fin/${profile}-reviewed.json\n`));
		assert.ok(workflow.includes(`            build/native-fin/${profile}-reviewed.json\n`));
	}
});
