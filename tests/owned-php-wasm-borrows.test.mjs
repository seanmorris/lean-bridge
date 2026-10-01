/**
 * Preserve original-result anchors in the explicitly enabled wasm32 model.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../src/build/php-wasm-graph-model.mjs";
import { compileOwnedPhpZendModel } from "../src/backends/php/owned-zend-model.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateTransferRuntime } from "../src/backends/native/owned-aggregate-transfers.mjs";
import { ownedZendWalkSource } from "../src/backends/php/owned-zend-walk.mjs";
import { generateOwnedPhpZendExtension } from "../src/backends/php/owned-zend-extension.mjs";
import { generateOwnedPhpZendPhp } from "../src/backends/php/owned-zend-php.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { prepareOwnedPhpWasmRuntime } from "./helpers/owned-php-wasm-runtime.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { checkOwnedPhpWasmBorrows } from "./helpers/owned-php-wasm-borrows.mjs";
import { generateCompiledPhpWasmOwned } from "../src/build/php-wasm-owned-component.mjs";
import { checkOwnedPhpWasmBorrowFibers } from "./helpers/owned-php-wasm-borrow-fibers.mjs";
import { assertOwnedPhpWasmBorrowCi, ownedPhpWasmBorrowReports } from "./helpers/owned-php-wasm-borrow-ci.mjs";

test("Zend borrowed-result models require exact whole owners and explicit admission", () => {
	const ir = ownedRustBorrowReviewedIr();
	assert.throws(() => compileOwnedPhpZendModel(ir, { transferredInputs: true }), /explicit output leases/u);
	const model = compileOwnedPhpZendModel(ir, { transferredInputs: true, anchoredResults: true });
	assert.equal(model.anchoredResults, true);
	assert.equal(model.wordBits, 32); assert.equal(model.integerBits, 32);
	assert.equal(model.functions.length, 26);
	assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, 19);
	assert.equal(model.functions.filter(fn => fn.transfers?.length).length, 4);
	assert.equal(model.functions.find(fn => fn.name === "bundle").anchor, 2);
	const files = generateOwnedPhpZendPhp(model);
	for(const fn of model.functions)
	{
		const type = model.types.find(node => node.id === fn.result);
		assert.equal(fn.whole, type.representation !== "copied", fn.name);
		const signature = `): ${fn.whole ? "Value" : type.publicType} {`;
		assert.ok(files["src/Api.php"].split(`function ${fn.publicName}(`)[1].startsWith(
			fn.publicParameters.map(name => `mixed $${name}`).join(", ") + signature), fn.name);
	}
	for(const fn of model.functions.filter(fn => fn.anchor !== undefined))
	{
		assert.equal(fn.whole, true); assert.equal(fn.hostArguments[fn.anchor], false);
		assert.equal(fn.transfers?.includes(fn.anchor) ?? false, false);
	}
	for(const fixture of [ownedAggregateReviewedIr, ownedRustTransferReviewedIr])
		assert.deepEqual(compileOwnedPhpZendModel(fixture(), { transferredInputs: true, anchoredResults: true }),
			compileOwnedPhpZendModel(fixture(), { transferredInputs: true }));
});

test("PHP-Wasm borrowed-result carriers preserve authenticated lifetimes and reject drift", async () => {
	const previous = JSON.parse(await readFile("docs/evidence/owned-php-borrows-20261001.json", "utf8"));
	for(const { input } of previous.runtime)
	{
		const before = canonicalJson(input);
		assert.throws(() => createCompiledPhpWasmModel({ ...input, anchoredResults: false }), /owner-anchored result consumer/u);
		const model = createCompiledPhpWasmModel({ ...input, anchoredResults: true });
		assert.deepEqual(model, createCompiledPhpWasmModel(input));
		assert.equal(canonicalJson(input), before);
		assert.equal(model.schemaVersion, 9); assert.equal(model.pointerBits, 32);
		assert.equal(model.ownedGraph.schemaVersion, 4);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		const adapters = generateCompiledPhpWasmLeanAdapters(model);
		assert.match(adapters.header, /sizeof\(void \*\) == 4/u);
		const generated = generateCompiledPhpWasmOwned(model, input.metadata, adapters);
		assert.equal(generated.manifest.schemaVersion, 3); assert.equal(generated.receipt.schemaVersion, 3);
		assert.deepEqual(generated.manifest.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(generated.receipt.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(generated.receipt.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(generated.files["owned/owned-leases.h"], ownedAggregateTransferRuntime({ anchoredResults: true }));
		assert.deepEqual(generated.receipt.files, Object.fromEntries(Object.entries(generated.files).map(([path, value]) => [path, sha256(value)])));
		for(const mutate of [
			value => { value.schemaVersion = 8; }
			, value => { value.ownedGraph.schemaVersion = 3; }
			, value => { delete value.ownedGraph.resultAnchors; }
			, value => { value.ownedGraph.resultAnchors.anchor = "snapshot"; }
			, value => { value.ownedGraph.resultAnchors.expiration = "never"; }
			, value => { value.ownedGraph.resultAnchors.exports.pop(); }
			, value => { value.ownedGraph.resultAnchors.exports[0].parameter++; }
			, value => { value.ownedGraph.layoutSha256 = "0".repeat(64); }
			, value => { value.ownedGraph.inputTransfers.exports.pop(); }
		]) {
			const changed = structuredClone(model); mutate(changed);
			assert.throws(() => generateCompiledPhpWasmLeanAdapters(changed));
			assert.throws(() => generateCompiledPhpWasmOwned(changed, input.metadata, adapters));
		}
	}
});

test("borrowed-result support preserves captured non-anchored Zend sources byte for byte", async () => {
	const transfers = JSON.parse(await readFile("docs/evidence/owned-php-wasm-transfers-20260930.json", "utf8"));
	const integration = JSON.parse(await readFile("docs/evidence/owned-php-wasm-integration-20260928.json", "utf8"));
	for(const record of [...transfers.runtime, integration.reports.generated, integration.reports.generatedReviewed])
	{
		const input = record.input ?? record.inputs;
		const native = generateOwnedNativeValueAdapters({ ...input, wordBits: 32, hostCallbacks: true, transferredInputs: Boolean(record.input) });
		const extension = generateOwnedPhpZendExtension(native);
		assert.equal(extension.model.anchoredResults, undefined);
		assert.equal(sha256(extension.source), record.sourceSha256);
		for(const [path, source] of Object.entries(generateOwnedPhpZendPhp(extension.model)))
			assert.equal(sha256(source), record.files[path], path);
	}
});

test("CI requires complete installed PHP-Wasm borrowed-result execution", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assert.deepEqual(assertOwnedPhpWasmBorrowCi(workflow, manifest), { testFiles: 3, tests: 12, reports: 7 });
	for(const [before, after] of [
		["          npm run test:owned-php-wasm-borrows 2>&1 | tee build/owned-php-wasm-borrows.log\n", ""]
		, [" && npm run test:owned-php-wasm-borrows", ""]
		, ["        id: owned_php_wasm\n", "        id: owned_php_wasm\n        if: false\n"]
		, ...["tests 12", "fail 0", "cancelled 0", "skipped 0"].map(value => [`          rg '^# ${value}$' build/owned-php-wasm-borrows.log\n`, ""])
		, ...ownedPhpWasmBorrowReports.flatMap(path => [["          test -s " + path + "\n", ""], ["            " + path + "\n", ""]])
	]) {
		const changed = workflow.replace(before, after); assert.notEqual(changed, workflow);
		assert.throws(() => assertOwnedPhpWasmBorrowCi(changed, manifest));
	}
	const disabled = structuredClone(manifest);
	disabled.scripts["test:owned-php-wasm-borrows"] = disabled.scripts["test:owned-php-wasm-borrows"].replace("BORROW_TEST=1", "BORROW_TEST=0");
	assert.throws(() => assertOwnedPhpWasmBorrowCi(workflow, disabled));
});

test("whole Zend roots and pins compile against the actual pinned wasm32 headers", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_BORROW_TEST !== "1"
	, timeout: 600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-zend-borrow-syntax-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const runtime = await prepareOwnedPhpWasmRuntime(directory);
	const receipt = JSON.parse(await readFile("docs/evidence/owned-php-borrows-20261001.json", "utf8"));
	const { input } = receipt.runtime[0];
	const generated = generateOwnedNativeValueAdapters({ ...input
		, wordBits: 32, hostCallbacks: true
		, transferredInputs: true, anchoredResults: true });
	const model = compileOwnedPhpZendModel(generated.carriers.model.bindingIr, { transferredInputs: true, anchoredResults: true });
	const phpFiles = generateOwnedPhpZendPhp(model);
	const files = {
		...phpFiles
		, "extension.c": generateOwnedPhpZendExtension(generated).source
		, "owned-values.h": generated.typesHeader
		, "owned-values-codec.h": generated.source
		, "owned-leases.h": ownedAggregateTransferRuntime({ anchoredResults: true })
		, "carriers.h": generated.carriers.header
		, "roots.c": '#include <php.h>\n#include "owned-values-codec.h"\n'
			+ ownedZendWalkSource(model)
			+ '\nstatic int lgo_initialize(void) { (void)lgo_depth; return LB_OWNED_OK; }\n'
	};
	for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
	for(const path of Object.keys(phpFiles))
		await processBuildRunner.capture({ command: "/usr/bin/php", args: ["-n", "-l", path], cwd: directory });
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const php = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const roots = [directory, join(runtime.root, "include"), php
		, ...["Zend", "main", "TSRM", "ext"].map(path => join(php, path))];
	const result = await processBuildRunner.capture({ command: join(sdk, "upstream/emscripten/emcc")
		, args: ["-fsyntax-only", "-DLEAN_EMSCRIPTEN", "-fbracket-depth=4096"
			, "-Wall", "-Wextra", "-Werror"
			, "-Wno-unused-parameter", "-Wno-unused-function"
			, ...roots.flatMap(path => ["-I", path]), "roots.c", "extension.c"]
		, cwd: directory, timeoutMs: 300000
		, env: { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk }
	}).catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	assert.doesNotMatch(result.stderr, /error:|warning:/u);
});

for(const mode of ["ordinary", "reviewed"]) test(`PHP-Wasm borrowed results follow whole owners in the real VM (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_BORROW_TEST !== "1"
	, timeout: 900000
}, t => checkOwnedPhpWasmBorrows(t, mode));

for(const mode of ["ordinary", "reviewed"]) test(`PHP-Wasm empty borrowed results work without consuming exports (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_BORROW_TEST !== "1"
	, timeout: 900000
}, t => checkOwnedPhpWasmBorrows(t, mode, { borrowOnly: true }));

test("whole Zend roots reject Fiber calls and defer implicit native destruction", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_BORROW_TEST !== "1"
	, timeout: 600000
}, checkOwnedPhpWasmBorrowFibers);
