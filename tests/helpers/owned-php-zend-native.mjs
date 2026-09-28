/**
 * Actual Fiber execution of the same Zend lifetime source on native PHP.
 * The wasm32 host lacks getcontext; this probe is not wasm32 acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../../src/backends/native/owned-aggregate-leases.mjs";
import { compileOwnedPhpZendModel } from "../../src/backends/php/owned-zend-model.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { ownedPhpZendOwnershipProbe } from "./owned-php-zend-ownership-probe.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Validate actual Fiber rejection and deferred finalizers, with fresh Lean.
 *
 * @param t - Test context that removes its native compiler scratch directory.
 */
export const checkOwnedZendNativeFibers = async t => {
	const compiled = await compileOwnedAggregateFixture(t);
	const inputs = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, wordBits: 64 };
	const generated = generateOwnedNativeValueAdapters(inputs);
	const model = compileOwnedPhpZendModel(generated.carriers.model.bindingIr);
	assert.equal(model.layout.model.bindingIrSha256, generated.layout.model.bindingIrSha256);
	const php = process.env.LEAN_BRIDGE_ZEND_PHP ?? process.env.LEAN_BRIDGE_PHP ?? "php";
	const phpConfig = process.env.LEAN_BRIDGE_ZEND_PHP_CONFIG ?? php + "-config";
	const run = (command, args) => processBuildRunner.capture({ command, args
		, cwd: compiled.directory, timeoutMs: 240000, env: process.env
	}).catch(error => { throw new Error(JSON.stringify(error.details ?? error.message), { cause: error }); });
	const includeFlags = (await run(phpConfig, ["--includes"])).stdout.trim().split(/\s+/u);
	const source = await readFile("tests/fixtures/structured-types/owned-php-zend-ownership.php", "utf8");
	const files = { "owned-values.h": generated.typesHeader
		, "owned-leases.h": ownedAggregateLeaseSource
		, "owned-values-codec.h": generated.source
		, "probe.c": ownedPhpZendOwnershipProbe(model, generated)
		, "check.php": source
		, "fiber.php": await readFile("tests/fixtures/structured-types/owned-php-zend-fiber.php", "utf8") };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(compiled.directory, path, source);
	t.diagnostic("Compiling the production Zend ownership runtime against native PHP for real Fiber execution");
	const compile = () => run("cc", ["-std=c11", "-O2", "-g"
		, "-Wall", "-Wextra", "-Werror"
		, "-Wno-unused-parameter", "-Wno-unused-function"
		, "-fPIC", "-shared", "-pthread"
		, ...includeFlags, "-I", join(compiled.directory, "runtime/include")
		, "probe.c", "Owned.o", "Carriers.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib"), "-o", "probe.so"]);
	await compile();
	const execute = () => run(php, ["-n", "-d", "display_errors=stderr"
		, "-d", "extension=" + join(compiled.directory, "probe.so")
		, "-r", "const OWNED_EXPECTED_BITS=64; require 'check.php';"]);
	const observations = [];
	for(const strict of [0, 1])
	{
		await saveLakeFile(compiled.directory, "check.php", source.replace("strict_types=0", "strict_types=" + strict));
		const result = await execute();
		assert.equal(result.stderr, "");
		const observed = JSON.parse(result.stdout);
		assert.equal(observed.fiberExecution, true); assert.equal(observed.stats.phpBits, 64);
		assert.ok(observed.checks > 100);
		assert.equal(observed.stats.live, 0); assert.equal(observed.stats.identities, 0);
		assert.equal(observed.stats.retired, false);
		observations.push({ strict, ...observed });
	}
	const mutations = [
		{ name: "early-context-release", before: "  lgo_borrow_expire(*borrow);"
			, after: "  lgo_borrow_end(borrow);"
			, failure: /shutdown_during_callback_live/u }
		, { name: "late-borrow-expiry"
			, before: "borrow->active = 0; borrow->scope = NULL;"
			, after: "(void)borrow;", failure: /reply_destructor_exception/u }
		, { name: "missing-fiber-guard"
			, before: "return EG(current_fiber_context) == EG(main_fiber_context);"
			, after: "return 1;", failure: /fiber_new_accepted/u }
		, { name: "lost-original-exception"
			, before: "if (failure) zend_throw_exception_internal(failure);"
			, after: "if (failure) OBJ_RELEASE(failure);"
			, failure: /exception_identity/u }
	];
	for(const mutation of mutations)
	{
		assert.equal(files["probe.c"].split(mutation.before).length, 2);
		await saveLakeFile(compiled.directory, "probe.c", files["probe.c"].replace(mutation.before, mutation.after));
		await compile();
		await assert.rejects(execute, mutation.failure);
	}
	await saveLakeFile(compiled.directory, "probe.c", files["probe.c"]);
	const report = { profile: "native-zend-owned-lifetime-fibers", wasm32: false
		, phpVersion: (await run(php, ["-v"])).stdout.split("\n")[0]
		, files: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, observations, rejectedMutations: mutations.map(mutation => mutation.name) };
	t.diagnostic(JSON.stringify(report));
	await saveLakeFile("build/owned-php-zend", "native-fibers.json", canonicalJson(report));
	return report;
};
