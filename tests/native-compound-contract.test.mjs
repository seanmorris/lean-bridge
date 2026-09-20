/**
 * Native compound admission, typed helpers and downstream rejection boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateCopiedNativeCalls } from "../src/backends/c/native-copied-values.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { nativeCompoundConsumer } from "./helpers/native-compound-consumers.mjs";

const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const unit = { kind: "primitive", name: "unit", lean: "Unit", abi: { ...abi, heap: false } };
const option = element => ({ kind: "option", element, abi });
const binary = (kind, a, b) => ({ kind, arguments: [a, b], abi });
const model = () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = option(binary("result", binary("tuple", projection.result, unit), option(unit)));
	projection.result = projection.parameters[0].type;
	return createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
};

test("installed native compound evidence covers independent signatures and all four packages", async () => {
	const evidence = JSON.parse(await readFile("docs/evidence/native-compounds-20260920.json"));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(evidence.signatures), sort(compoundSignatures));
	assert.deepEqual(evidence.runs.map(run => `${run.path}/${run.profile}`).sort(), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of evidence.runs)
	{
		assert.equal(run.checks, run.profile === "c" ? 1549 : 1008);
		assert.deepEqual(run.faultChecks, { native: 306, gmp: 11 });
		assert.equal(run.consumerSha256, sha256(await nativeCompoundConsumer(run.profile)));
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true); assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].target, run.profile);
		assert.match(run.packages[0].artifacts[0].sha256, /^[a-f0-9]{64}$/);
	}
});

test("native compounds preserve copied ownership, arity and nesting limits", () => {
	assert.doesNotThrow(() => validateNativeType(option(binary("result", unit, binary("tuple", unit, unit)))));
	for(const shape of [binary("tuple", unit)
		, { ...option(unit), extra: 1 }
		, { ...binary("result", unit, unit), arguments: [unit] }
		, { ...binary("tuple", unit, unit), arguments: [unit, unit, unit] }
		, option({ kind: "callback", parameters: [unit], result: unit, abi })
		, option({ kind: "resource", name: "Sample.R", lean: "Sample.R", module: "Sample", abi })])
		assert.throws(() => validateNativeType(shape), /native-library-v1/);
	let deep = unit; for(let i = 0; i < 34; i++) deep = option(deep);
	assert.throws(() => validateNativeType(deep), /nesting/);
});

test("native helpers call typed Lean constructors and projections without constructor offsets", () => {
	const original = model(), rebuilt = JSON.parse(canonicalJson(original));
	assert.deepEqual(generateNativeLeanAdapters(original), generateNativeLeanAdapters(rebuilt));
	const surface = compilePrimitiveCSurface(original.bindingIr, { compounds: true });
	const calls = generateCopiedNativeCalls(original, surface);
	assert.match(calls, /value->has_value > 1/); assert.match(calls, /value->is_ok > 1/);
	assert.match(calls, /_none\(lean_box\(0\)\)/); assert.match(calls, /_some\(/);
	assert.match(calls, /_ok\(/); assert.match(calls, /_error\(/);
	assert.doesNotMatch(calls, /lean_ctor_|lean_obj_tag/);
	const output = generateCBindingPackage(original.bindingIr);
	assert.match(output["include/sample.h"], /uint8_t has_value;/);
	assert.match(output["include/sample.h"], /uint8_t is_ok;/);
	assert.match(output["src/sample.c"], /_clear\(&value->ok\)/);
});

test("host projections without compound adapters reject these shapes before generation", () => {
	assert.throws(() => compileCopiedPhpModel(compoundReviewedIr()), /compound values are not implemented/);
	assert.throws(() => compilePrimitiveCSurface(compoundReviewedIr()), /compound values are not implemented/);
	assert.throws(() => generatePerlBindingPackage(model(), {}), /Perl compound values are not implemented/);
});

test("compiled native callable admission still rejects copied compound payloads", () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = { kind: "callback", parameters: [option(unit)], result: unit, abi };
	const native = createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
	assert.throws(() => compilePrimitiveCSurface(native.bindingIr, { callables: true, compounds: true }), /callbacks currently require copied primitive/);
});

test("C compounds retain name collisions and forbid identity-bearing payloads", () => {
	const ir = compoundReviewedIr();
	const f = ir.declarations.find(fn => fn.name === "option_bool");
	f.name = "option_bool_value";
	assert.throws(() => compilePrimitiveCSurface(ir, { compounds: true }), /collides/);
	const nested = model().bindingIr;
	nested.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compilePrimitiveCSurface(nested, { compounds: true }), /copy ownership/);
});
