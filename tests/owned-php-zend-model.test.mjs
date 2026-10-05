/**
 * Bind public PHP-Wasm names to the finite native ownership layout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { compileOwnedPhpZendModel } from "../src/backends/php/owned-zend-model.mjs";
import { ownedZendDescriptorSource } from "../src/backends/php/owned-zend-descriptors.mjs";
import { graphZendSupport } from "../src/backends/php/copied-graph-zend-runtime.mjs";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned Zend schemas preserve nominal PHP identities and the exact wasm32 layout", () => {
	const ir = ownedCppCompositionReviewedIr(), before = structuredClone(ir);
	const model = compileOwnedPhpZendModel(ir);
	assert.deepEqual(ir, before); assert.deepEqual(compileOwnedPhpZendModel(ir), model);
	assert.equal(model.types.length, 41); assert.equal(model.functions.length, 31); assert.equal(model.callbacks.length, 7);
	assert.equal(model.types.filter(node => node.identity).length, 8);
	assert.equal(model.namespace, "LeanOwnedAggregates");
	assert.equal(model.integerBits, 32); assert.equal(model.wordBits, 32); assert.equal(model.layout.wordBits, 32);
	assert.equal(model.layoutSha256, sha256(canonicalJson(model.layout)));
	assert.equal(Object.hasOwn(model, "c"), false);
	assert.equal(model.aliases.find(alias => alias.name === "BundleAlias").phpType, "Bundle");
	assert.equal(model.aliases.find(alias => alias.name === "TicketRow").phpType, "list<Some<Ticket>|null>");
	assert.equal(model.functions.find(fn => fn.name === "newTicket").publicName, "new_ticket");
	assert.equal(model.functions.find(fn => fn.name === "callbackRecord").hostArguments[1], true);
	assert.ok(model.callbacks.some(callback => !callback.automaticRecovery));
	assert.ok(model.callbacks.some(callback => callback.automaticRecovery));
	for(const node of model.types)
	{
		assert.equal(node.id, model.layout.nodes[node.index].id);
		assert.equal(node.cName, model.layout.nodes[node.index].cName);
		if(node.identity)
		{
			assert.equal(model.descriptors[node.index].identityKind, node.identityKind);
			assert.match(model.layout.header, new RegExp(`struct ${node.cName} \\{\\n  uint64_t token;\\n\\};`, "u"));
		}
	}
});

test("owned Zend scalar schemas keep signed machine words and 64-bit values exact", () => {
	const model = compileOwnedPhpZendModel(ownedPythonScalarsReviewedIr());
	const node = name => model.descriptors.find(item => item.scalar === name);
	assert.equal(model.descriptors.filter(item => item.scalar).length, 19);
	for(const name of ["uint32", "uint64", "int64", "usize", "nat", "int"])
		assert.equal(node(name).publicType, "\\Brick\\Math\\BigInteger");
	assert.equal(node("usize").cName, "uint32_t"); assert.equal(node("isize").cName, "int32_t");
	assert.equal(node("uint64").cName, "uint64_t"); assert.equal(node("int64").cName, "int64_t");
	assert.equal(node("isize").publicType, "int"); assert.equal(node("int32").publicType, "int");
	const source = ownedZendDescriptorSource(model);
	assert.doesNotMatch(source, /mpz_srcptr|FFI|gmp_/u);
	assert.match(source, /lb_big_in/u); assert.match(source, /lb_big_out/u);
	assert.match(source, /lb_readable\(&walk->scope/u);
	assert.match(source, /lgo_identity_input/u); assert.match(source, /lgo_identity_output/u);
});

test("owned Zend branches preserve nested options, canonical result order and recursive fields", () => {
	const model = compileOwnedPhpZendModel(ownedCppCompositionReviewedIr());
	const result = model.descriptors.filter(node => node.kind === "result");
	assert.ok(result.length > 0);
	for(const node of result)
	{
		assert.equal(node.resultTag, "error"); assert.equal(node.tag, "tag");
		assert.deepEqual(node.branches.map(branch => branch.class), ["LeanOwnedAggregates\\Ok", "LeanOwnedAggregates\\Err"]);
		assert.deepEqual(node.branches.map(branch => branch.fields[0].path), ["f0", "f1"]);
		assert.deepEqual(node.branches.map(branch => branch.fields[0].publicKey), ["value", "value"]);
	}
	for(const node of model.descriptors.filter(node => node.kind === "option"))
	{
		assert.equal(node.tag, "tag"); assert.deepEqual(node.branches[0], { class: null, fields: [] });
		assert.equal(node.branches[1].class, "LeanOwnedAggregates\\Some");
		assert.equal(node.branches[1].fields.length, 1);
	}
	const chain = model.types.find(node => node.publicType === "Chain");
	const descriptor = model.descriptors[chain.index];
	assert.equal(descriptor.branches[1].class, "LeanOwnedAggregates\\ChainLink");
	assert.deepEqual(descriptor.branches[1].fields.map(field => field.path), ["cases.c1.f0", "cases.c1.f1"]);
	assert.deepEqual(descriptor.branches[1].fields.map(field => field.pointer), [false, true]);
	assert.ok(model.descriptors.every(node => node.inhabited));
	assert.ok(ownedZendDescriptorSource(model).length < 50000);
});

test("owned Zend schemas reject copied identities and public naming collisions", () => {
	const copied = ownedCppCompositionReviewedIr();
	Object.assign(copied.declarations.find(item => item.name === "newTicket").result, { ownership: "copy", lifetime: null });
	assert.throws(() => compileOwnedPhpZendModel(copied));
	const reserved = ownedCppCompositionReviewedIr();
	const declaration = reserved.declarations.find(item => item.name === "newTicket");
	declaration.name = "withRecovery";
	assert.throws(() => compileOwnedPhpZendModel(reserved), /with_recovery/u);
	const duplicate = ownedCppCompositionReviewedIr();
	duplicate.types.find(item => item.name === "Ticket").name = "Some";
	assert.throws(() => compileOwnedPhpZendModel(duplicate));
});

test("owned Zend schemas match the carriers of actual compiled scalar and recursive fixtures", async () => {
	const receipt = JSON.parse(await readFile("docs/evidence/owned-aggregate-execution-20260926.json", "utf8"));
	for(const input of Object.values(receipt.inputs))
	{
		const native = generateOwnedNativeValueAdapters({ ...input, wordBits: 32 });
		const model = compileOwnedPhpZendModel(native.carriers.model.bindingIr);
		assert.deepEqual(model.layout, native.layout);
		assert.equal(model.layout.header, native.typesHeader);
		assert.equal(model.functions.length, native.layout.functions.length);
		assert.equal(model.callbacks.length, native.layout.callbacks.length);
	}
});

test("all owned Zend descriptor offsets compile against the pinned 32-bit PHP headers", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_ZEND_TEST !== "1", timeout: 180000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-zend-schema-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const php = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	for(const [name, ir] of [["scalars", ownedPythonScalarsReviewedIr()], ["aggregates", ownedCppCompositionReviewedIr()]])
	{
		const model = compileOwnedPhpZendModel(ir);
		await saveLakeFile(directory, `${name}.h`, model.layout.header);
		await saveLakeFile(directory, `${name}.c`, `#include <php.h>
#include <stdbool.h>
#include <limits.h>
#include "${name}.h"
_Static_assert(sizeof(zend_long) == 4 && sizeof(void *) == 4, "wasm32 PHP required");
${graphZendSupport}
/* Compile-only hooks. Runtime ownership is checked by the transport tests. */
static int lgo_identity_input(lb_scope *scope, unsigned type, zval *value, uint64_t *token) {
  (void)scope; (void)type; (void)value; (void)token; return 0;
}
static int lgo_identity_output(lb_scope *scope, unsigned type, uint64_t token, zval *value) {
  (void)scope; (void)type; (void)value; (void)token; return 0;
}
${ownedZendDescriptorSource(model)}
`);
		await processBuildRunner.capture({ command: join(sdk, "upstream/emscripten/emcc")
			, args: ["-fsyntax-only", "-Wall", "-Wextra", "-Werror"
				, "-Wno-unused-function", "-Wno-unused-parameter"
				, ...[directory, php, ...["Zend", "main", "TSRM", "ext"].map(path => join(php, path))].flatMap(path => ["-I", path])
				, `${name}.c`]
			, cwd: directory, timeoutMs: 60000
			, env: { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk }
		}).catch(error => { error.message += ": " + (error.details?.stderr ?? ""); throw error; });
	}
});
