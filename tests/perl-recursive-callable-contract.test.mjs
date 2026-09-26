/**
 * Checked Perl recursive callback layouts, ownership boundaries and namespaces.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { compileCallablePerlGraphPackageModel } from "../src/backends/perl/callable-graph-model.mjs";
import { generateCallablePerlGraphXs } from "../src/backends/perl/callable-graph-xs.mjs";
import { generateCallablePerlGraphPackage } from "../src/backends/perl/callable-graph-package.mjs";
import { compileCallableGraphPackageModel } from "../src/backends/c/callable-graph-model.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";

const moduleName = "LeanBridge::Recursive";

test("CPAN recursive callbacks validate their namespace and agree with every supported native target", () => {
	const ir = nativeRecursiveCallableReviewedIr();
	const expected = compileCallablePerlGraphPackageModel(ir, moduleName).layoutSha256;
	for(const targets of [["cpan"], ["c", "cpan"], ["cpan", "cpp"], ["pypi", "cpan"], ["cargo", "cpan"], ["rubygems", "cpan"], ["nuget", "cpan"], ["cpan", "maven"], ["cpan", "php-native"], ["cpan", "wit-wasi"], ["c", "cpp", "pypi", "cargo", "rubygems", "cpan", "nuget", "maven", "php-native", "wit-wasi"]])
		assert.equal(compileNativeGraphProjection(ir, targets, moduleName).layoutSha256, expected);
	for(const targets of [[], ["cpan", "cpan"], ["cpan", "php-wasm"], ["unknown"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets, moduleName), { code: "native-graph-projection-unavailable" });
	for(const targets of [["cpan"], ["c", "cpan"], ["rubygems", "cpan"]])
	{
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
		assert.throws(() => compileNativeGraphProjection(ir, targets, "LeanBridge::Runtime"), /module/);
	}
});

test("Perl recursive callbacks preserve the checked native graph without changing the IR", () => {
	const ir = nativeRecursiveCallableReviewedIr(), before = canonicalJson(ir);
	const model = compileCallablePerlGraphPackageModel(ir, moduleName);
	assert.equal(canonicalJson(ir), before);
	assert.equal(model.layoutSha256, compileCallableGraphPackageModel(ir, ["c", "cpp"]).layoutSha256);
	assert.equal(model.functions.length, 33); assert.equal(model.callbacks.size, 18);
	assert.deepEqual(compileCallablePerlGraphPackageModel(ir, moduleName).layout, model.layout);
	for(const callback of model.callbacks.values())
	{
		assert.ok(callback.parameters.every(parameter => model.types.includes(parameter)));
		assert.ok(model.types.includes(callback.result));
	}
});

test("Perl recursive packages hide native handles and retain callback replies in the initiating scope", () => {
	const ir = nativeRecursiveCallableReviewedIr(), projection = generateCallablePerlGraphXs(ir, moduleName);
	const model = { bindingIr: ir, component: ir.component, moduleName
		, copiedGraph: projection.descriptor
		, sourceIdentity: { modules: [{ module: "Structured", source: { sha256: "a".repeat(64) } }] } };
	const receipt = { initializer: "initialize_LeanBridgeNative0123456789abcdef"
		, library: "libcomponent_0123456789abcdef0123.so"
		, nativeLibrary: { sha256: "b".repeat(64) }
		, runtimeIdentity: "c".repeat(64) };
	const before = canonicalJson(model), files = generateCallablePerlGraphPackage(model, receipt);
	assert.equal(canonicalJson(model), before);
	assert.deepEqual(generateCallablePerlGraphPackage(model, receipt), files);
	const expectedFiles = ["Component.xs", "binding-manifest.json"
		, "lib/LeanBridge/Recursive.pm", "structured-callable-borrows.h"
		, "structured-graph-types.h", "structured-graph.h"];
	assert.deepEqual(Object.keys(files).sort(), expectedFiles.sort());
	const publicSource = files["lib/LeanBridge/Recursive.pm"];
	assert.match(publicSource, /package LeanBridge::Recursive::LeanClosure;/);
	assert.match(publicSource, /package LeanBridge::Recursive::Tree::Branch;/);
	assert.match(publicSource, /LeanBridge::Runtime::_load_component/);
	assert.doesNotMatch(publicSource, /\blpc_|\blpg_|\bng_|lean_object|uint64_t|lease_call|lease_dispose/);
	assert.match(files["structured-graph.h"], /visibility\("hidden"\)/);
	assert.equal(files["Component.xs"].split("BOOT:\n")[1], "  lbp_check_interpreter(aTHX);\n");
	assert.match(projection.source, /save_scalar\(PL_errgv\);/);
	assert.match(projection.source, /frame->error = GvSV\(PL_errgv\);/);
	assert.match(projection.source, /G_VOID \| G_EVAL/);
	assert.match(projection.source, /lease->process == getpid\(\)/);
	assert.equal((projection.xs.match(/lpg_scope \*scope = invocation->callback->frame->scope;/g) ?? []).length, 18);
	assert.equal((projection.xs.match(/FREETMPS; LEAVE;\n {4}invocation->returned = 1;/g) ?? []).length, 18);
});

test("Perl recursive callables reject hidden identity fields and asynchronous signatures", () => {
	for(const change of [
		ir => { ir.types.find(type => type.kind === "callback").callable.resultMode = "promise"; }
		, ir => { ir.types.find(type => type.kind === "callback").callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Payload").fields[0].type = { kind: "named", id: ir.types.find(type => type.kind === "callback").id }; }
	]) {
		const ir = nativeRecursiveCallableReviewedIr(); change(ir);
		assert.throws(() => compileCallablePerlGraphPackageModel(ir, moduleName));
	}
});

test("Perl recursive callables reserve closure names for records, variants and transparent aliases", () => {
	const base = compileCallablePerlGraphPackageModel(nativeRecursiveCallableReviewedIr(), moduleName);
	const names = ["LeanClosure", [...base.callbacks.values()][0].publicType.split("::").at(-1)];
	for(const name of names) for(const kind of ["alias", "record", "variant"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.types.find(type => type.kind === kind).name = name;
		assert.throws(() => compileCallablePerlGraphPackageModel(ir, moduleName), /Reserved Perl callable type/);
	}
	for(const name of ["Some", "Ok", "Err", "Runtime"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.types.find(type => type.name === "Tree").name = name;
		assert.throws(() => compileCallablePerlGraphPackageModel(ir, moduleName), /reserved/);
	}
});

test("Perl recursive callables validate module namespaces and projected export names", () => {
	for(const name of [undefined, "", "Other::Recursive", "LeanBridge::Runtime", "LeanBridge::Runtime::Child", "LeanBridge::Bad;Code"])
		assert.throws(() => compileCallablePerlGraphPackageModel(nativeRecursiveCallableReviewedIr(), name), /module/);
	for(const name of ["true", "false", "close", "closed", "new", "can", "isa", "import", "unimport"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.declarations[0].source.declaration = `Structured.${name}`;
		assert.throws(() => compileCallablePerlGraphPackageModel(ir, moduleName), /collision|(?:Reserved or invalid Perl graph|Invalid Perl) function/);
	}
	const ir = nativeRecursiveCallableReviewedIr(); ir.declarations[1].source.declaration = ir.declarations[0].source.declaration;
	assert.throws(() => compileCallablePerlGraphPackageModel(ir, moduleName), /collision/);
});
