/**
 * Recursive PHP public APIs, cold validation and original Composer releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedPhpGraphPackage, compileCopiedPhpGraphPackageModel } from "../src/backends/php/copied-graph-package.mjs";
import { auditPhpPackage } from "../src/backends/php/package-audit.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { assertPhpGraphPackageReports } from "./helpers/php-graph-receipt.mjs";
import { assertCurrentPhpGraphSources } from "./helpers/current-php-graph-evidence.mjs";

const evidence = ir => ({ componentId: ir.component.id
	, library: "librecursive.so"
	, runtimeIdentity: "1".repeat(64), componentReceiptSha256: "2".repeat(64)
	, copiedGraph: { schemaVersion: 1, layoutSha256: compileCopiedPhpGraphPackageModel(ir).layoutSha256 }
	, libraries: Object.fromEntries(["librecursive.so", "libcomponent_recursive.so", "libleanshared.so", "liblean_bridge_native.so"].map(name => [name, "3".repeat(64)])) });

test("recursive PHP packages expose named functions and completely audited private sources", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir), files = generateCopiedPhpGraphPackage(ir);
	assert.deepEqual(ir, before); assert.deepEqual(files, generateCopiedPhpGraphPackage(ir));
	assert.equal(auditPhpPackage(ir, files), true);
	assert.match(files["src/Api.php"], /function tree\(mixed \$value0\): Tree/);
	assert.match(files["src/Api.php"], /@param list<Tree> \$value0/);
	assert.match(files["src/Api.php"], /\\func_num_args\(\) !== 2/);
	assert.doesNotMatch(files["src/Api.php"], /FFI|GraphTarget|GraphRuntime/);
	assert.equal(compileNativeGraphProjection(ir, ["php-native"]).namespace, "LeanRecursive");
	assert.equal(compileNativeGraphProjection(ir, ["php-native", "maven"]).prefix, "recursive");
	assert.throws(() => compileNativeGraphProjection(ir, ["php-native", "wit-wasi"]), { code: "native-graph-projection-unavailable" });
	assert.throws(() => auditPhpPackage(ir, files, { integerBits: 32 }), { code: "unsupported-copied-php-profile" });
	for(const path of Object.keys(files).filter(path => path !== "binding-manifest.json"))
	{
		const changed = { ...files, [path]: files[path] + "\n/* source drift */\n" };
		const manifest = JSON.parse(files["binding-manifest.json"]); manifest.filesSha256[path] = sha256(changed[path]);
		changed["binding-manifest.json"] = canonicalJson(manifest);
		assert.throws(() => auditPhpPackage(ir, changed), { code: "copied-graph-source-drift" }, path);
	}
	for(const mutate of [m => { m.publicFiles = []; }, m => { m.aliases = []; }, m => { m.exports.pop(); }])
	{
		const manifest = JSON.parse(files["binding-manifest.json"]); mutate(manifest);
		assert.throws(() => auditPhpPackage(ir, { ...files, "binding-manifest.json": canonicalJson(manifest) }), { code: "copied-graph-source-drift" });
	}
});

test("recursive PHP loaders require exact layout and native identities", () => {
	const ir = nativeRecursiveReviewedIr(), pinned = evidence(ir), files = generateCopiedPhpGraphPackage(ir, pinned);
	assert.equal(auditPhpPackage(ir, files), true);
	assert.match(files["src/Internal/Native.php"], /Runtime::ensureProcess\(\)/);
	assert.match(files["src/Internal/Native.php"], /recursive_graph_initialize/);
	assert.match(files["src/Internal/Native.php"], /catch \(GraphInvalidNative \$error\)/);
	for(const changed of [{ componentId: "wrong" }, { runtimeIdentity: "x" }
		, { componentReceiptSha256: "x" }, { library: "../librecursive.so" }
		, { copiedGraph: { ...pinned.copiedGraph, extra: true } }
		, { copiedGraph: { schemaVersion: 1, layoutSha256: "0".repeat(64) } }
		, { libraries: { ...pinned.libraries, "../liboutside.so": "3".repeat(64) } }
		, { libraries: { "librecursive.so": "3".repeat(64) } }, { extra: true }])
		assert.throws(() => generateCopiedPhpGraphPackage(ir, { ...pinned, ...changed }), /evidence|identities/);
});

test("recursive PHP package APIs reject invalid cold calls without the FFI extension", {
	skip: process.env.LEAN_BRIDGE_PHP_GRAPH_PACKAGE_TEST !== "1", timeout: 60_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-graph-cold-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = nativeRecursiveReviewedIr(), files = generateCopiedPhpGraphPackage(ir), php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
	for(const [path, source] of Object.entries({ ...files, ...bundledBrickMath() })) await saveLakeFile(root, path, source);
	for(const path of Object.keys(files).filter(path => path.endsWith(".php"))) await runCopied(php, ["-n", "-l", path], root);
	await saveLakeFile(root, "vendor/autoload.php", "<?php\nrequire __DIR__ . '/../dependencies/brick-math/autoload.php';\nrequire __DIR__ . '/../src/Api.php';\n");
	await saveLakeFile(root, "request.json", canonicalJson({ path: "reviewed-ir" }));
	const original = await readFile("tests/fixtures/structured-types/recursive-php-installed.php", "utf8"), observations = [];
	for(const mode of ["weak", "strict"])
	{
		const source = original.replace("strict_types=0", `strict_types=${mode === "strict" ? 1 : 0}`);
		await saveLakeFile(root, "caller.php", source);
		const result = await runCopied(php, ["-n", "-d", "display_errors=stderr", "caller.php"], root, { ...copiedCleanEnvironment, GRAPH_COLD: "1" });
		assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
		assert.equal(observation.exports, 18); assert.equal(observation.ffiLoaded, false);
		assert.ok(observation.checks > 100); assert.ok(observation.rejections > 30);
		observations.push({ mode, programSha256: sha256(source), observation });
	}
	await saveLakeFile("build/recursive", "php-package-cold.json", canonicalJson({ schemaVersion: 1
		, installedPackage: false, phpSha256: sha256(await readFile(php))
		, generatedSourceHashes: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, observations }));
});

test("ordinary and reviewed recursive Composer archives execute after offline installation", {
	skip: process.env.LEAN_BRIDGE_PHP_GRAPH_INSTALLED_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-graph-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkPhpGraphPackages } = await import("./helpers/php-graph-packages.mjs");
	const report = await checkPhpGraphPackages(root, message => t.diagnostic(message));
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	await saveLakeFile("build/recursive", "php-packages.json", canonicalJson(report));
});

test("independent recursive Composer builds reproduce the original installed archives", {
	skip: process.env.LEAN_BRIDGE_PHP_GRAPH_REPRO_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const original = JSON.parse(await readFile("build/recursive/php-packages.json", "utf8"));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-graph-repro-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkPhpGraphReproducibility } = await import("./helpers/php-graph-packages.mjs");
	const report = await checkPhpGraphReproducibility(root, original, message => t.diagnostic(message));
	await saveLakeFile("build/recursive", "php-reproducibility.json", canonicalJson(report));
});

test("CI requires recursive Composer installation and independent reproduction reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const command of [
		"LEAN_BRIDGE_PHP_GRAPH_PACKAGE_TEST=1 LEAN_BRIDGE_PHP_GRAPH_INSTALLED_TEST=1 node --test tests/php-graph-package.test.mjs"
		, "LEAN_BRIDGE_PHP_GRAPH_REPRO_TEST=1 node --test tests/php-graph-package.test.mjs"
		, "LEAN_BRIDGE_PHP_GRAPH_LOADING_TEST=1 node --test tests/php-graph-package.test.mjs"
	]) assert.ok(workflow.includes(`          ${command}\n`));
	for(const name of ["php-package-cold", "php-packages", "php-reproducibility", "php-composition", "php-conflicts"])
	{
		assert.ok(workflow.includes(`test -s build/recursive/${name}.json`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});

for(const scenario of ["Composition", "Conflicts"])
	test(`recursive Composer packages verify shared-runtime ${scenario.toLowerCase()}`, {
		skip: process.env.LEAN_BRIDGE_PHP_GRAPH_LOADING_TEST !== "1"
		, timeout: 600_000
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), `lean-bridge-php-graph-${scenario.toLowerCase()}-`));
		t.after(() => rm(root, { recursive: true, force: true }));
		const helpers = await import("./helpers/php-graph-loading.mjs");
		const report = await helpers[`checkPhpGraph${scenario}`](root, message => t.diagnostic(message));
		await saveLakeFile("build/recursive", `php-${scenario.toLowerCase()}.json`, canonicalJson(report));
	});

test("recursive Composer evidence binds original packages and rejects incomplete acceptance", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-recursive-packages-20260923.json", "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.finalAcceptance, false);
	assert.deepEqual(record.pending, ["shared-backend regressions", "source-lineage verification", "complete repository suite"]);
	await assertCurrentPhpGraphSources(record);
	for(const [name, report] of Object.entries(record.reports)) assert.equal(record.reportHashes[name], sha256(canonicalJson(report)));
	await assertPhpGraphPackageReports(record.reports);
	for(const [name, log] of Object.entries(record.logs))
	{
		assert.equal(log.sha256, sha256(log.text));
		assert.match(log.text, new RegExp(`# pass ${name === "loading" ? 2 : 1}\\n# fail 0\\n# cancelled 0\\n# skipped 0`));
	}
	for(const mutate of [
		r => { r.packages.observations.pop(); }
		, r => { r.packages.observations[0].php.executions.pop(); }
		, r => { r.packages.observations[0].php.executions[0].observation.rejections = 0; }
		, r => { r.packages.observations[0].tamper.rejections.pop(); }
		, r => { r.reproducibility.observations[0].originalArchiveSha256 = "0".repeat(64); }
		, r => { r.composition.observations[0].observed.componentInitializations = 2; }
		, r => { r.conflicts.observations[0].observed.originalUsable = false; }
		, r => {
			const php = r.packages.observations[0].php, path = "src/Internal/Native.php", prefix = "vendor/lean-bridge/recursive/";
			php.packageReceipt.files[path].sha256 = "0".repeat(64);
			php.deployment[prefix + path] = structuredClone(php.packageReceipt.files[path]);
			php.packageReceiptSha256 = sha256(canonicalJson(php.packageReceipt));
			php.deployment[prefix + "lean-bridge/package-receipt.json"].sha256 = php.packageReceiptSha256;
		}
	]){
		const changed = structuredClone(record.reports); mutate(changed);
		changed.reproducibility.originalReportSha256 = sha256(canonicalJson(changed.packages));
		await assert.rejects(() => assertPhpGraphPackageReports(changed));
	}
});
