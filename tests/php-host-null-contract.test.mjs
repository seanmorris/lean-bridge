/**
 * Explicit HostNull projection through native PHP and PHP-Wasm generators.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateCopiedNativeCalls } from "../src/backends/c/native-copied-values.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { generateCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import {
	createNativeModel, createPhpWasmCopiedModel, generateNativeLeanAdapters
} from "../src/build/native-model.mjs";
import { hostNullReviewedIr } from "./helpers/host-null-fixture.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";

const hostProjection = Object.freeze({
	name: "Sample.HostNull"
	, nullConstructor: "Sample.HostNull.null"
	, valueConstructor: "Sample.HostNull.value"
});
const heap = Object.freeze({ cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true });

const nativeInput = () => {
	const input = nativeMetadataFixture();
	const previous = input.sourceIdentity.request;
	const { metadata, ...selection } = previous;
	const request = createMetadataRequest({ ...selection, hostProjections: [hostProjection] }, {
		toolchain: metadata.toolchain, modules: metadata.modules
		, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256
		, extractorSha256: input.sourceIdentity.extractorSha256
	});
	input.sourceIdentity.request = request;
	input.metadata.producer.invocationIdentitySha256 = request.metadata.invocationIdentitySha256;
	const leaf = input.metadata.modules[0].declarations[0].projection.result;
	const nullable = { kind: "host-null", element: leaf
		, nullConstructor: hostProjection.nullConstructor
		, valueConstructor: hostProjection.valueConstructor, abi: heap };
	const projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = nullable;
	projection.result = nullable;
	return { ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
};

test("PHP HostNull is the only nullable copied carrier and keeps both Option nestings distinct", () => {
	const ir = hostNullReviewedIr();
	const model = compileCopiedPhpModel(ir, { structuredCallables: true, lists: true, variants: true });
	assert.equal(model.hostNull, true);
	assert.equal(model.taggedOptions, true);
	assert.deepEqual(model.branches, ["None", "Some"]);
	const compounds = Object.fromEntries(model.surface.copies.filter(copy => copy.compound)
		.map(copy => [JSON.stringify(copy.ref), { type: copy.publicType, doc: copy.docType }]));
	const uint32 = { kind: "primitive", name: "uint32" };
	const apply = (constructor, argument) => ({ kind: "apply", constructor, arguments: [argument] });
	assert.deepEqual(compounds[JSON.stringify(apply("host-null", uint32))]
		, { type: "int|null", doc: "int|null" });
	assert.deepEqual(compounds[JSON.stringify(apply("host-null", apply("option", uint32)))]
		, { type: "None|Some|null", doc: "None|Some<int>|null" });
	assert.deepEqual(compounds[JSON.stringify(apply("option", apply("host-null", uint32)))]
		, { type: "None|Some", doc: "None|Some<int|null>" });

	const files = generateCopiedPhpPackage(ir), api = files["src/Api.php"], native = files["src/Internal/Native.php"];
	assert.match(api, /final readonly class None[^]*None requires no payload/u);
	assert.match(api, /function nullable_option\(mixed \$value0\): None\|Some\|null/u);
	assert.match(api, /function optional_nullable\(mixed \$value0\): None\|Some/u);
	assert.match(api, /public None\|Some\|null \$nullableOption;/u);
	assert.match(native, /Invalid native HostNull flag/u);
	assert.match(native, /instanceof \\LeanHostNullDemo\\None/u);
	assert.match(files["README.md"], /Only the compiler-authenticated HostNull wrapper uses PHP null/u);
	assert.doesNotMatch(api, /function optional_nullable\(mixed \$value0\): None\|Some\|null/u);
});

test("PHP-Wasm HostNull uses direct null-or-payload wire values while Option stays tagged", () => {
	const ir = hostNullReviewedIr(), files = generateCopiedPhpZendAdapter(ir);
	const manifest = JSON.parse(files["copied-zend-manifest.json"]);
	const c = files[`extension/${manifest.extension}.c`], php = files["src/Internal/Native.php"];
	assert.match(c, /Invalid native HostNull flag/u);
	assert.match(c, /Tagged Option wire requires zero or one payload/u);
	assert.match(c, /if \(Z_TYPE_P\(value\) == IS_NULL\) \{ out->has_value = 0; return 1; \}/u);
	assert.match(php, /instanceof \\LeanHostNullDemo\\None \? \[\]/u);
	assert.match(php, /\$value === null \? null : self::to/u);
	assert.doesNotMatch(c, /host-null/u);
});

test("native compiler helpers use the authenticated HostNull constructors", () => {
	for(const model of [createNativeModel(nativeInput()), createPhpWasmCopiedModel(nativeInput())])
	{
		assert.ok(model.types.some(type => type.kind === "host-null"));
		const adapters = generateNativeLeanAdapters(model);
		assert.match(adapters.leanSource, /_root_\.Sample\.HostNull\.null/u);
		assert.match(adapters.leanSource, /_root_\.Sample\.HostNull\.value value/u);
		const surface = compilePrimitiveCSurface(model.bindingIr, { compounds: true });
		const calls = generateCopiedNativeCalls(model, surface);
		assert.match(calls, /_null\(lean_box\(0\)\)/u);
		assert.match(calls, /_value\(/u);
		assert.match(calls, /value->has_value > 1/u);
		assert.doesNotMatch(calls, /lean_ctor_|lean_obj_tag/u);
	}
	const header = generateCBindingPackage(hostNullReviewedIr())["include/host_null_demo.h"];
	assert.match(header, /host_null_demo_host_null_uint32_value/u);
	assert.doesNotMatch(header, /host-null/u);
});

test("PHP rejects HostNull payloads whose direct representation is already null", () => {
	const ir = structuredClone(hostNullReviewedIr()), unit = { kind: "primitive", name: "unit" };
	for(const declaration of ir.declarations.filter(item => item.name === "echo"))
	{
		declaration.parameters[0].type.arguments[0] = unit;
		declaration.result.type.arguments[0] = unit;
	}
	assert.throws(() => compileCopiedPhpModel(ir, { structuredCallables: true, lists: true, variants: true })
		, /HostNull payloads must retain a value distinct from null/u);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("generated native and PHP-Wasm HostNull sources pass PHP syntax checks", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-host-null-syntax-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [group, files] of [["native", generateCopiedPhpPackage(hostNullReviewedIr())]
		, ["wasm", generateCopiedPhpZendAdapter(hostNullReviewedIr())]])
		for(const [path, source] of Object.entries(files)) if(path.endsWith(".php"))
		{
			const file = join(root, group, path);
			await mkdir(dirname(file), { recursive: true });
			await writeFile(file, source);
			const result = spawnSync(php, ["-n", "-l", file], { encoding: "utf8" });
			assert.equal(result.status, 0, result.stdout + result.stderr);
		}
});

test("the consumer matrix retains installed HostNull acceptance and reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const count = pattern => workflow.match(pattern)?.length ?? 0;
	assert.equal(count(/LEAN_BRIDGE_PHP_HOST_NULL_TEST=1/gu), 2);
	assert.equal(count(/LEAN_BRIDGE_PHP_WASM_HOST_NULL_TEST=1/gu), 2);
	assert.equal(count(/tests\/php-host-null\.test\.mjs/gu), 2);
	assert.equal(count(/tests\/php-wasm-host-null\.test\.mjs/gu), 2);
	assert.equal(count(/build\/host-null\/php-native\.json/gu), 3);
	assert.equal(count(/build\/host-null\/php-wasm\.json/gu), 3);
	assert.equal(count(/LEAN_BRIDGE_HOST_NULL_PACKAGE_DIR=/gu), 4);
	assert.equal(count(/scripts\/check-host-null-php-reports\.mjs/gu), 4);
	assert.match(workflow, /build\/host-null\/packages\/php-native/u);
	assert.match(workflow, /build\/host-null\/packages\/php-wasm/u);
	assert.match(workflow, /matrix\.profile == 'values-graph'[^]*LEAN_BRIDGE_PHP_WASM_HOST_NULL_TEST=1/u);
});
