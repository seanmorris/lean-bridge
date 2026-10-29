/**
 * Explicit HostNull projections for Perl, Python and Ruby packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { hostNullReviewedIr } from "./helpers/host-null-fixture.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";

const heap = Object.freeze({ cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true });
const uint32 = Object.freeze({ kind: "primitive", name: "uint32", lean: "UInt32"
	, abi: { cType: "uint32_t", box: "lean_box_uint32", unbox: "lean_unbox_uint32", heap: false } });
const unit = Object.freeze({ kind: "primitive", name: "unit", lean: "Unit"
	, abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } });
const projection = Object.freeze({ name: "Sample.HostNull"
	, nullConstructor: "Sample.HostNull.null"
	, valueConstructor: "Sample.HostNull.value" });
const hostNull = element => ({ kind: "host-null", element
	, nullConstructor: projection.nullConstructor
	, valueConstructor: projection.valueConstructor, abi: heap });
const option = element => ({ kind: "option", element, abi: heap });
const tuple = (...arguments_) => ({ kind: "tuple", arguments: arguments_, abi: heap });
const publicUnit = Object.freeze({ kind: "primitive", name: "unit" });
const publicNestedHostNull = Object.freeze({ kind: "apply"
	, constructor: "host-null"
	, arguments: [{ kind: "primitive", name: "uint32" }] });
const receipt = Object.freeze({ library: "libcomponent_test.so"
	, nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64)
	, initializer: "initialize_Sample" });

const perlModel = shape => {
	const input = nativeMetadataFixture(), previous = input.sourceIdentity.request;
	const { metadata, ...selection } = previous;
	input.sourceIdentity.request = createMetadataRequest({ ...selection
		, hostProjections: [projection] }, { toolchain: metadata.toolchain
		, modules: metadata.modules
		, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256
		, extractorSha256: input.sourceIdentity.extractorSha256 });
	input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
	const declaration = input.metadata.modules[0].declarations[0].projection;
	declaration.parameters[0].type = shape; declaration.result = shape;
	return createNativeModel({ ...input
		, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }
		, moduleName: "LeanBridge::Sample" });
};

const invalidIr = element => {
	const ir = structuredClone(hostNullReviewedIr());
	const echo = ir.declarations.find(item => item.name === "echo");
	echo.parameters[0].type.arguments[0] = element;
	echo.result.type.arguments[0] = structuredClone(element);
	return ir;
};

test("Python reserves None for authenticated HostNull and tags every Option state", async t => {
	const ir = hostNullReviewedIr(), model = compileCopiedPythonModel(ir);
	assert.equal(model.hostNull, true); assert.equal(model.taggedOptions, true);
	assert.deepEqual(model.surface.copies.filter(copy => copy.compound === "host-null")
		.map(copy => copy.publicType), ["int | None", "Option[int] | None"]);
	assert.deepEqual(model.surface.copies.filter(copy => copy.compound === "option")
		.map(copy => copy.publicType), ["Option[int]", "Option[int | None]"]);
	const files = generateCopiedPythonPackage(ir), publicSource = files["lean_host_null_demo/__init__.py"];
	const native = files["lean_host_null_demo/_native.py"];
	assert.match(publicSource, /class None_:/u);
	assert.match(publicSource, /Option = None_ \| Some\[_T\]/u);
	assert.match(publicSource, /def nullable_option\(value0: Option\[int\] \| None\)/u);
	assert.match(publicSource, /optional_nullable: Option\[int \| None\]/u);
	assert.match(native, /Invalid native HostNull flag/u);
	assert.match(native, /type\(value\) is None_/u);
	assert.doesNotMatch(native, /Option requires None or Some/u);
	assert.match(files["README.md"], /HostNull\(Option T\).*None_\(\).*Option\.none/u);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-python-host-null-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, source] of Object.entries(files).filter(([path]) => path.endsWith(".py")))
	{
		const file = join(root, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, source);
		const result = spawnSync(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3"
			, ["-I", "-m", "py_compile", file], { encoding: "utf8" });
		assert.equal(result.status, 0, result.stdout + result.stderr);
	}
	for(const bad of [publicUnit, publicNestedHostNull])
		assert.throws(() => compileCopiedPythonModel(invalidIr(bad)), /distinct from None/u);
});

test("Ruby reserves nil for authenticated HostNull and tags every Option state", async t => {
	const ir = hostNullReviewedIr(), model = compileCopiedRubyModel(ir);
	assert.equal(model.hostNull, true); assert.equal(model.taggedOptions, true);
	const files = generateCopiedRubyPackage(ir), publicSource = files["lib/lean_bridge/host_null_demo.rb"];
	const native = files["lib/lean_bridge/host_null_demo/native.rb"];
	assert.match(publicSource, /None = ::Data\.define/u);
	assert.match(publicSource, /Some = ::Data\.define\(:value\)/u);
	assert.match(native, /Invalid native HostNull flag/u);
	assert.match(native, /Option requires None\.new or Some\.new\(value\)/u);
	assert.match(native, /when 0 then None\.new/u);
	assert.match(files["README.md"], /HostNull\(Option T\).*None\.new.*Option\.none/u);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-host-null-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, source] of Object.entries(files).filter(([path]) => path.endsWith(".rb")))
	{
		const file = join(root, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, source);
		const result = spawnSync(process.env.LEAN_BRIDGE_RUBY ?? "/usr/bin/ruby"
			, ["--disable-gems", "-c", file], { encoding: "utf8" });
		assert.equal(result.status, 0, result.stdout + result.stderr);
	}
	for(const bad of [publicUnit, publicNestedHostNull])
		assert.throws(() => compileCopiedRubyModel(invalidIr(bad)), /distinct from nil/u);
});

test("Perl reserves undef for authenticated HostNull and tags every Option state", () => {
	const original = perlModel(tuple(hostNull(option(uint32)), option(hostNull(uint32))));
	const files = generatePerlBindingPackage(original, receipt);
	assert.deepEqual(files, generatePerlBindingPackage(structuredClone(original), receipt));
	const xs = files["Component.xs"], pm = files["lib/LeanBridge/Sample.pm"];
	assert.match(xs, /lb_t[a-f0-9]+_null\(lean_box\(0\)\)/u);
	assert.match(xs, /lb_t[a-f0-9]+_value\(item\)/u);
	assert.match(xs, /LeanBridge::Sample::None/u);
	assert.match(pm, /package LeanBridge::Sample::None;/u);
	assert.match(pm, /None->new\(\) is Option\.none/u);
	assert.match(pm, /Some->new\(undef\) is a present HostNull null/u);
	for(const bad of [unit, hostNull(uint32)])
		assert.throws(() => generatePerlBindingPackage(perlModel(hostNull(bad)), receipt)
			, /distinct from undef/u);
});
