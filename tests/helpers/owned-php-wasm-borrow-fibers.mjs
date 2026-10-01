/**
 * Native Zend companion for Fiber guards unavailable in the pinned Wasm host.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateTransferRuntime } from "../../src/backends/native/owned-aggregate-transfers.mjs";
import { generateOwnedPhpZendExtension } from "../../src/backends/php/owned-zend-extension.mjs";
import { generateOwnedPhpZendPhp } from "../../src/backends/php/owned-zend-php.mjs";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowSource } from "./owned-rust-borrow-fixture.mjs";
import { ownedPhpWasmTransferProbe } from "./owned-php-wasm-transfer-probe.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Link the unchanged Zend lifecycle against native PHP and native Lean objects.
 * Width-specific C carriers are generated independently, never reused as Wasm.
 *
 * @param t - Test context that removes its temporary native component.
 */
export const checkOwnedPhpWasmBorrowFibers = async t => {
	const compiled = await compileOwnedAggregateFixture(t, { hostCallbacks: true
		, sourceSuffix: ownedRustBorrowSource
		, configuration: await ownedRustBorrowConfiguration() });
	const input = { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.component };
	const options = { ...input, hostCallbacks: true, transferredInputs: true, anchoredResults: true };
	const wasm = generateOwnedNativeValueAdapters({ ...options, wordBits: 32 });
	const native = generateOwnedNativeValueAdapters({ ...options, wordBits: 64 });
	const extension = generateOwnedPhpZendExtension(wasm), { model } = extension;
	assert.equal(wasm.typesHeader, native.typesHeader);
	assert.equal(wasm.carriers.header, native.carriers.header);
	assert.equal(wasm.carriers.callbackSource, native.carriers.callbackSource);
	assert.ok(!model.types.some(node => ["usize", "isize"].includes(node.name)));
	const width = '_Static_assert(sizeof(void *) == 4 && sizeof(zend_long) == 4, "32-bit PHP-Wasm required");';
	assert.equal(extension.source.split(width).length, 2);
	const source = ownedPhpWasmTransferProbe(extension.source.replace(width,
		'_Static_assert(sizeof(void *) == 8 && sizeof(zend_long) == 8, "64-bit native Fiber companion required");'),
	{ consume: "static void lgo_whole_consume(void *opaque) {" });
	const files = { ...generateOwnedPhpZendPhp(model), ...bundledBrickMath()
		, "owned-values.h": native.typesHeader, "owned-values-codec.h": native.source
		, "owned-leases.h": ownedAggregateTransferRuntime({ anchoredResults: true })
		, "extension.c": source
		, "check.php": await readFile("tests/fixtures/structured-types/owned-php-wasm-borrow-fibers.php", "utf8")
		, "probe.php": (await readFile("tests/fixtures/structured-types/owned-php-zend-generated-probe.php", "utf8"))
			.replace("$item instanceof Resource", "$item instanceof Resource || $item instanceof \\LeanOwnedAggregates\\Value")
		, "probe-model.json": canonicalJson({ transport: model.transport, functions: Object.fromEntries(model.functions.map(fn => [fn.name, fn.publicName])) }) };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(compiled.directory, path, source);
	const php = process.env.LEAN_BRIDGE_ZEND_PHP ?? process.env.LEAN_BRIDGE_PHP ?? "php";
	const phpConfig = process.env.LEAN_BRIDGE_ZEND_PHP_CONFIG ?? php + "-config";
	const run = (command, args) => processBuildRunner.capture({ command, args, cwd: compiled.directory, timeoutMs: 240000, env: process.env })
		.catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	const includeFlags = (await run(phpConfig, ["--includes"])).stdout.trim().split(/\s+/u);
	await run("cc", ["-std=c11", "-O2", "-g", "-Wall", "-Wextra", "-Werror"
		, "-Wno-unused-parameter", "-Wno-unused-function"
		, "-fPIC", "-shared", "-pthread"
		, ...includeFlags, "-I", join(compiled.directory, "runtime/include")
		, "extension.c", "Owned.o", "Carriers.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "extension.so"]);
	const observations = [];
	for(const strict of [0, 1])
	{
		await saveLakeFile(compiled.directory, "check.php", files["check.php"].replace("strict_types=1", `strict_types=${strict}`));
		const result = await run(php, ["-n", "-d", "display_errors=stderr"
			, "-d", "zend.exception_ignore_args=0"
			, "-d", "extension=" + join(compiled.directory, "extension.so")
			, "check.php"]);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.equal(observed.phpBits, 64); assert.ok(observed.checks > 30);
		assert.equal(observed.fiberExecution, true); assert.equal(observed.forkExecution, true);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		observations.push({ strict, ...observed });
	}
	const report = { profile: "native-zend-borrow-fibers", wasm32: false, input
		, phpVersion: (await run(php, ["-v"])).stdout.split("\n")[0]
		, files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, observations };
	t.diagnostic(JSON.stringify(observations));
	await saveLakeFile("build/owned-php-wasm-borrows", "native-fibers.json", canonicalJson(report));
	return report;
};
