/**
 * Generated and installed Java/Kotlin acceptance for recursive checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	compileCopiedJvmGraphPackageModel, generateCopiedJvmGraphPackage
} from "../src/backends/jvm/copied-graph-package.mjs";
import {
	mutualCheckedRecordJvmCaller, mutualCheckedRecordJvmExpected
	, mutualCheckedRecordJvmReview
}
	from "./helpers/mutual-checked-record-jvm-fixture.mjs";
import "./helpers/mutual-checked-record-jvm-installed-tests.mjs";

test("recursive Kotlin callers preserve exact route metadata names", async () => {
	const [ordinary, reviewed] = await Promise.all([
		mutualCheckedRecordJvmCaller("kotlin", "ordinary")
		, mutualCheckedRecordJvmCaller("kotlin", "reviewed")
	]);
	assert.equal((ordinary.match(/parameter arg0/gu) ?? []).length, 2);
	assert.equal((reviewed.match(/parameter value0/gu) ?? []).length, 2);
	assert.doesNotMatch(ordinary + reviewed, /__ROUTE_PARAMETER__/u);
	for(const [route, parameter] of [["ordinary", "arg0"], ["reviewed", "value0"]])
	{
		const expected = mutualCheckedRecordJvmExpected("kotlin", route);
		assert.ok(expected.failures["null-record"].message.endsWith(
			`parameter ${parameter}`
		));
	}
});

test("recursive checked-record JVM packages bind exact native diagnostics", () => {
	const ir = mutualCheckedRecordJvmReview();
	const model = compileCopiedJvmGraphPackageModel(ir);
	assert.equal(model.refinementDiagnostics, true);
	const hash = "a".repeat(64);
	const files = generateCopiedJvmGraphPackage(ir, {
		componentId: ir.component.id, library: "libmutualcheckedrecords.so"
		, runtimeIdentity: hash, componentReceiptSha256: hash
		, libraries: Object.fromEntries([
			"libmutualcheckedrecords.so", "libmutualcheckedrecords_component.so"
			, "libleanshared.so", "liblean_bridge_native.so"
		].map(name => [name, hash]))
	});
	const java = "src/main/java/org/leanbridge/mutualcheckedrecords/";
	assert.match(files[java + "_GraphNative.java"]
		, /mutualcheckedrecords_graph_error/u);
	assert.match(files[java + "_GraphRuntime.java"]
		, /CodingErrorAction\.REPORT/u);
	const manifest = JSON.parse(files["binding-manifest.json"]);
	assert.ok(manifest.supportedFeatures.includes(
		"checked-refinement-diagnostics"
	));
});
