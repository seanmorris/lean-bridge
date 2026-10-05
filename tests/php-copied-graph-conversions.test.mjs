/**
 * Execute PHP recursive FFI conversions against independent native producers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { generateCopiedPhpGraphConversions } from "../src/backends/php/copied-graph-conversions.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { phpGraphConversionIr, phpGraphLayoutProbe, phpGraphNativeExtras, phpGraphProbe } from "./helpers/php-graph-conversion-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";
import { verifyPhpGraphConversionEvidence } from "./helpers/php-graph-conversion-receipt.mjs";

test("PHP recursive FFI converters preserve finite schemas and validate before lazy loading", () => {
	const ir = phpGraphConversionIr(), before = structuredClone(ir), model = generateCopiedPhpGraphConversions(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedPhpGraphConversions(ir), model);
	assert.doesNotMatch(model.definitions, /#|static inline/);
	assert.doesNotMatch(model.files["src/Api.php"], /FFI|GraphRuntime/);
	const runtime = model.files["src/Internal/GraphNative.php"], call = runtime.slice(runtime.indexOf("public static function call("));
	assert.ok(call.indexOf("Values::check") < call.indexOf("self::schema()"));
	assert.ok(call.indexOf("self::write") < call.indexOf("$target = $load()"));
	assert.match(call, /finally \{[\s\S]*\$target->clear[\s\S]*finally \{ \$scope->close/);
	assert.doesNotMatch(model.nativeReleaseSource, /\.kind|\.cases|\.length|\.data/);
	assert.match(runtime, /while \(\$stack\)/);
	assert.ok(phpGraphLayoutProbe(model).count > 450);
});

test("PHP FFI recursive conversions match C layouts and release all owned results after faults", {
	skip: process.env.LEAN_BRIDGE_PHP_GRAPH_CONVERSION_TEST !== "1"
	, timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-graph-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = phpGraphConversionIr(), model = generateCopiedPhpGraphConversions(ir), layout = phpGraphLayoutProbe(model);
	const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
	const nativeSource = `#include "recursive.h"\n${await readFile("tests/fixtures/structured-types/recursive-rust-native.c", "utf8")}\n${phpGraphNativeExtras(model)}\n${model.nativeReleaseSource}\n${layout.c}`;
	await saveLakeFile(root, "recursive.h", generateCopiedCGraphTypes(ir).header);
	await saveLakeFile(root, "native.c", nativeSource);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-Wall", "-Wextra", "-Werror", "-fPIC", "-shared", "native.c", "-o", "libgraph.so"], root, { PATH: "/usr/bin:/bin" });
	const generatedSourceHashes = {}, instrumentedSourceHashes = {};
	for(const [path, original] of Object.entries({ ...model.files, ...bundledBrickMath() }))
	{
		const source = path.endsWith("/GraphNative.php") ? original
			.replace("public static function checkpoint(): void {}", "public static function checkpoint(): void { \\GraphFaults::hit(); }")
			.replace("$this->owners[] = $owner;", "$this->owners[] = $owner; \\GraphFaults::allocated($owner);") : original;
		await saveLakeFile(root, path, source);
		if(Object.hasOwn(model.files, path))
		{
			generatedSourceHashes[path] = sha256(original); instrumentedSourceHashes[path] = sha256(source);
			await runCopied(php, ["-n", "-l", path], root);
		}
	}
	const caller = phpGraphProbe(model); await saveLakeFile(root, "caller.php", caller);
	const probe = await readFile("tests/fixtures/structured-types/recursive-php-conversions.php", "utf8"), observations = [];
	for(const mode of ["weak", "strict"])
	{
		const program = probe.replace("strict_types=0", `strict_types=${mode === "strict" ? 1 : 0}`);
		await saveLakeFile(root, "probe.php", program);
		const arguments_ = ["-d", "ffi.enable=true", "-d", "memory_limit=128M", "-d", "display_errors=stderr", "probe.php", join(root, "libgraph.so")];
		const result = await runCopied(php, arguments_, root).catch(async error => {
			if(process.env.LEAN_BRIDGE_PHP_GRAPH_DEBUG === "1")
			{
				const diagnostic = await runCopied("/usr/bin/gdb", ["--batch", "-ex", "run", "-ex", "bt", "-ex", "info registers", "-ex", "x/6i $pc", "-ex", "x/16gx $rsi", "--args", php, ...arguments_], root);
				throw new Error(diagnostic.stdout + diagnostic.stderr.slice(-8000), { cause: error });
			}
			throw error;
		});
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		assert.equal(observation.layoutChecks, layout.count); assert.equal(observation.live, 0);
		assert.ok(observation.checks > 500); assert.ok(observation.inputFailures > 5); assert.ok(observation.outputFailures > 20);
		observations.push({ mode, observation, programSha256: sha256(program) });
	}
	const version = await runCopied(php, ["-v"], root);
	await saveLakeFile("build/recursive", "php-conversions.json", canonicalJson({
		schemaVersion: 1, compiledLean: false, installedPackage: false
		, generatedSourceHashes, instrumentedSourceHashes
		, nativeSourceSha256: sha256(nativeSource)
		, nativeBinarySha256: sha256(await readFile(join(root, "libgraph.so")))
		, phpVersion: version.stdout, phpSha256: sha256(await readFile(php))
		, probeSha256: sha256(probe), callerSha256: sha256(caller), observations }));
});

test("ordinary and reviewed Lean graphs execute through PHP with cleanup and retirement", {
	skip: process.env.LEAN_BRIDGE_PHP_GRAPH_NATIVE_TEST !== "1", timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-native-graphs-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkPhpNativeGraphs } = await import("./helpers/php-native-graphs.mjs");
	const report = await checkPhpNativeGraphs(root);
	assert.deepEqual(report.observations.map(item => item.reviewed), [false, true]);
	for(const item of report.observations)
	{ assert.equal(item.exports, 18); assert.equal(item.scenarios.length, 8); }
	await saveLakeFile("build/recursive", "php-native.json", canonicalJson(report));
});

test("downstream CI requires isolated and real Lean PHP graph conversion reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_PHP_GRAPH_CONVERSION_TEST=1 LEAN_BRIDGE_PHP_GRAPH_NATIVE_TEST=1 node --test tests/php-copied-graph-conversions.test.mjs"));
	for(const name of ["php-conversions", "php-native"])
	{
		assert.ok(workflow.includes(`test -s build/recursive/${name}.json`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});

test("PHP conversion evidence binds fresh native runs without claiming installed releases", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-recursive-conversions-20260923.json", "utf8"));
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	await verifyPhpGraphConversionEvidence(record);
	for(const mutate of [
		r => { r.installedPackage = true; }
		, r => { r.reports.native.observations.pop(); }
		, r => { r.reports.native.observations[0].scenarios.pop(); }
		, r => { r.reports.isolated.observations.shift(); }
		, r => { r.reports.native.observations[0].scenarios[0].outputFailures = 0; }
		, r => { r.reports.native.observations[0].generatedSourceHashes["src/Internal/GraphNative.php"] = "0".repeat(64); }
	]){
		const changed = structuredClone(record); mutate(changed);
		for(const [name, report] of Object.entries(changed.reports)) changed.reportHashes[name] = sha256(canonicalJson(report));
		await assert.rejects(() => verifyPhpGraphConversionEvidence(changed));
	}
});
