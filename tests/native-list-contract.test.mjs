/**
 * Native List identity, representation-independent adapters and staged hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { generateCopiedNativeCalls } from "../src/backends/c/native-copied-values.mjs";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { compilePrimitiveCppModel, renderPrimitiveCppPackage } from "../src/backends/cpp/primitives.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { listReviewedIr, listSignatures } from "./helpers/list-fixture.mjs";
import { nativeListConsumer } from "./helpers/native-list-consumers.mjs";

const model = () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const value = { kind: "list", element: projection.result, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
	projection.parameters[0].type = value; projection.result = value;
	return createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
};

test("native List evidence binds both installed hosts, source paths and independent consumers", async () => {
	const record = JSON.parse(await readFile("docs/evidence/native-lists-20260920.json"));
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(listSignatures));
	assert.deepEqual(record.runs.map(run => `${run.path}/${run.profile}`).sort(), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of record.runs)
	{
		assert.deepEqual(sort(run.signatures), sort(listSignatures));
		assert.equal(run.checks, run.profile === "c" ? 31077 : 30942);
		assert.deepEqual(run.faultChecks, { native: 323, gmp: 23 });
		assert.equal(run.consumerSha256, sha256(await nativeListConsumer(run.profile)));
		assert.equal(run.offlineInstall, true); assert.equal(run.compilerFreePath, true); assert.equal(run.sourceRemovedBeforeInstallation, true);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(run[field], /^[a-f0-9]{64}$/);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].target, run.profile);
		assert.match(run.packages[0].artifacts[0].sha256, /^[a-f0-9]{64}$/);
	}
});

test("native List helpers use typed Lean walks with an over-budget sentinel element", () => {
	const value = model(), generated = generateNativeLeanAdapters(value);
	assert.deepEqual(generateNativeLeanAdapters(JSON.parse(canonicalJson(value))), generated);
	const text = canonicalJson(generated);
	assert.match(text, /value\.toList/); assert.match(text, /loop 2097153 value #\[\]/);
	assert.doesNotMatch(text, /sorry|unsafeCast|lean_ctor_get|lean_obj_tag/);
	const calls = generateCopiedNativeCalls(value, compilePrimitiveCSurface(value.bindingIr, { lists: true }));
	assert.match(calls, /_from_array\(result\)/); assert.match(calls, /lean_inc\(value\);\n.*_to_array\(value\)/);
	assert.match(calls, /lean_dec\(items\); return 0/); assert.match(calls, /lean_dec\(items\); return -1/);
	assert.match(calls, /lean_dec\(items\); .*_release\(owner\); return status/);
	assert.doesNotMatch(calls, /lean_ctor_get|lean_ctor_set|lean_obj_tag/);
});

test("C and C++ keep List and Array identities with shared copied sequence storage", () => {
	const ir = listReviewedIr(), surface = compilePrimitiveCSurface(ir, { lists: true, compounds: true });
	const copies = surface.copies.filter(copy => copy.element);
	assert.ok(copies.some(copy => copy.name === "lists_list_uint32_span"));
	assert.ok(copies.some(copy => copy.name === "lists_array_uint32_span"));
	const c = generateCBindingPackage(ir);
	assert.match(c["include/lists.h"], /typedef struct lists_list_uint32_span/);
	assert.match(c["include/lists.h"], /typedef struct lists_array_uint32_span/);
	assert.match(c["src/lists.c"], /lists_list_bytes_span_clear/);
	assert.ok(Object.keys(generateGmpProjection(ir)).length);
	const cpp = renderPrimitiveCppPackage(compilePrimitiveCppModel(ir));
	assert.match(canonicalJson(cpp), /std::vector<uint32_t>/);
});

test("unimplemented native List hosts and copied List callbacks fail closed", () => {
	assert.throws(() => compilePrimitiveCSurface(listReviewedIr(), { compounds: true }), { code: "unsupported-native-c-signature" });
	const ir = listReviewedIr(), declaration = ir.declarations.find(item => item.name === "reverse_uint32");
	declaration.parameters[0].ownership = "borrow";
	assert.throws(() => compilePrimitiveCSurface(ir, { lists: true, compounds: true }), /copy ownership/);
	for(const position of ["parameter", "result"])
	{
		const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
		const leaf = projection.result, list = model().exports[0].result;
		projection.parameters[0].type = { kind: "callback", parameters: [position === "parameter" ? list : leaf], result: position === "result" ? list : leaf, abi: list.abi };
		const native = createNativeModel({ ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
		assert.throws(() => compilePrimitiveCSurface(native.bindingIr, { lists: true, compounds: true, callables: true }), /callbacks currently require copied primitive/);
	}
});
