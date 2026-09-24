/**
 * Original recursive Composer archives, offline installs and runtime-only calls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir, rm, statfs } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { ordinaryPhpEvidence } from "../../src/build/native-php-artifacts.mjs";
import { packageOrdinaryPhp } from "../../src/release/native-composer.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { installedPhpCorpus } from "./type-corpus-php.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";
import { withCorruptedNativeAsset } from "./native-asset-tamper.mjs";

const environmentForPhp = () => ({ ...nativeFixtureEnvironment(["php-native"])
	, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
	, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" });

const prepare = async ({ author, handoff, environment, reviewed, diagnostic }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release"), ir = nativeRecursiveReviewedIr();
	await saveLakeFile(projectRoot, "Recursive.lean", await nativeRecursiveSource());
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
		, modules: ["Recursive"]
		, ...reviewed ? {} : { exports: ir.declarations.map(item => item.source.declaration) }
		, targets: { "php-native": { name: "lean-bridge/recursive", version: "1.0.0" } } }));
	if(reviewed) await saveLakeFile(projectRoot, "recursive.binding-ir.json", canonicalJson(ir));
	const before = await lakeInputState(projectRoot);
	diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building Composer-only recursive release`);
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-native"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const handoffReceipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(handoffReceipt.packages.length, 1); assert.equal(handoffReceipt.packages[0].target, "php-native");
	const nativeRoot = join(outputRoot, "native/component"), runtimeRoot = join(outputRoot, "native/runtime"), adapterRoot = join(outputRoot, "native/c-binding");
	const { model, receipt, adapter, evidence } = await ordinaryPhpEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(model.schemaVersion, reviewed ? 5 : 4); assert.equal(model.exports.length, 18);
	assert.equal(adapter.gmp, undefined); assert.equal(adapter.files["include/recursive.h"], undefined);
	assert.ok(Object.keys(adapter.files).every(path => !/gmp|boost/.test(path)));
	assert.ok(adapter.files["src/php-graph-clear.c"]);
	const releaseOptions = { working: join(author, "repackaged")
		, nativeRoot, runtimeRoot, adapterRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: { name: "lean-bridge/recursive", version: "1.0.0" }
		, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, environment: { ...copiedCleanEnvironment, LEAN_BRIDGE_PHP: environment.LEAN_BRIDGE_PHP } };
	const repeated = await packageOrdinaryPhp(releaseOptions); assert.deepEqual(repeated.packages, built.packages);
	await rm(releaseOptions.working, { recursive: true, force: true });
	for(const copiedGraph of [undefined, { schemaVersion: 1, layoutSha256: "0".repeat(64) }, { ...adapter.copiedGraph, extra: true }])
	{
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, copiedGraph }));
		await assert.rejects(() => ordinaryPhpEvidence({ nativeRoot, runtimeRoot, adapterRoot }), /PHP C adapter differs/);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	for(const path of ["src/native.c", "include/detail/recursive-graph.h", "include/detail/recursive-graph-types.h", "src/php-graph-clear.c"])
	{
		const original = await readFile(join(adapterRoot, path), "utf8"), changed = `${original}\n/* re-signed source drift */\n`;
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, files: { ...adapter.files
			, [path]: { bytes: Buffer.byteLength(changed), sha256: sha256(changed) } } }));
		await assert.rejects(() => packageOrdinaryPhp(releaseOptions), /Generated PHP graph adapter source differs/);
		await saveLakeFile(adapterRoot, path, original); await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	}
	return { pkg: handoffReceipt.packages[0]
		, bindingIr: model.bindingIr, nativeEvidence: evidence
		, provenance: { exports: 18, bindingIrSha256: built.bindingIrSha256
			, binarySha256: receipt.nativeLibrary.sha256
			, layoutSha256: adapter.copiedGraph.layoutSha256
			, modelSha256: sha256(canonicalJson(model))
			, checkedSourceUnchanged: true, composerOnly: true
			, deterministicReassembly: true, compilerFreeReassembly: true
			, rejectsGraphReceiptDrift: 3, rejectsRegeneratedSourceDrift: 4 } };
};

const tamper = async ({ deployment, evidence, environment }) => {
	const packageRoot = join(deployment, "vendor/lean-bridge/recursive"), rejections = [];
	const source = `<?php\nrequire __DIR__ . '/vendor/autoload.php';
try { \\LeanRecursive\\empty_(); } catch (RuntimeException $error) {
    if (!str_contains($error->getMessage(), 'Native library differs from compiled evidence')) throw $error;
    if (preg_match('~/liblean(?:shared|_bridge_native)\\.so(?: \\(deleted\\))?$~m', file_get_contents('/proc/self/maps'))) throw new RuntimeException('Mapped before rejection');
    echo "rejected-before-native-loading\\n"; exit;
}
throw new RuntimeException('Native tamper was accepted');\n`;
	await saveLakeFile(deployment, "tamper.php", source);
	for(const [path, identity] of Object.entries(evidence.packageReceipt.files).filter(([path]) => path.startsWith("native/linux-x64/")))
	{
		const result = await withCorruptedNativeAsset(join(packageRoot, path), () => runCopied(environment.LEAN_BRIDGE_PHP, [...evidence.runtimeOptions, "tamper.php"], deployment));
		assert.equal(result.stderr, ""); assert.equal(result.stdout, "rejected-before-native-loading\n");
		assert.equal(sha256(await readFile(join(packageRoot, path))), identity.sha256);
		rejections.push({ path, originalSha256: identity.sha256, rejectedBeforeMapping: true, restored: true });
	}
	await rm(join(deployment, "tamper.php"));
	return { sourceSha256: sha256(source), rejections };
};

/**
 * Build both source paths serially, delete author inputs and call relocated ZIPs.
 *
 * @param directory - Test-owned scratch root.
 * @param diagnostic - Progress callback for fresh native builds.
 */
export const checkPhpGraphPackages = async (directory, diagnostic = () => {}) => {
	const environment = environmentForPhp(), observations = [];
	const original = await readFile("tests/fixtures/structured-types/recursive-php-installed.php", "utf8");
	for(const reviewed of [false, true])
	{
		const space = await statfs(directory); assert.ok(Number(space.bavail) * Number(space.bsize) >= 2 * 1024 ** 3, "Recursive Composer acceptance needs 2 GiB free at each source-path start");
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author"), handoff = join(root, "handoff");
		const { pkg, provenance } = await prepare({ author, handoff, environment, reviewed, diagnostic });
		await rm(author, { recursive: true, force: true }); await assert.rejects(() => readdir(author), { code: "ENOENT" });
		diagnostic(`${reviewed ? "reviewed" : "ordinary"}: offline Composer install and source-free relocation`);
		const { php, observation } = await installedPhpCorpus({ library: { phpModule: "LeanRecursive" }
			, consumer: join(root, "consumer"), handoff, pkg, environment
			, clean: copiedCleanEnvironment
			, sourcePath: reviewed ? "reviewed-ir" : "ordinary-source"
			, fixture: { source: mode => original.replace("strict_types=0", `strict_types=${mode === "strict" ? 1 : 0}`)
				, request: path => canonicalJson({ path }), removeHandoff: true } })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		await assert.rejects(() => readdir(handoff), { code: "ENOENT" });
		validateBrickMathInstall(php, php.deployment);
		for(const { observation: result } of php.executions)
		{
			assert.ok(result.checks > 1300); assert.ok(result.rejections > 30);
			assert.equal(result.exports, 18); assert.equal(result.compiledLean, true); assert.equal(result.installedPackage, true);
			assert.equal(result.actualPhpBits, 64); assert.equal(Object.keys(result.nativeLibraries).length, 4);
		}
		const tampered = await tamper({ deployment: join(root, "consumer/php-native/relocated"), evidence: php, environment });
		assert.equal(tampered.rejections.length, 4);
		observations.push({ reviewed, package: pkg, ...provenance, php, observation, tamper: tampered, sourceRemovedBeforeInstallation: true, probeSha256: sha256(original) });
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: true, observations };
};

/**
 * Compare independent fresh builds with the exact installed original archives.
 *
 * @param directory - New test-owned scratch root.
 * @param original - Original installed-package observations.
 * @param diagnostic - Progress callback for fresh native builds.
 */
export const checkPhpGraphReproducibility = async (directory, original, diagnostic = () => {}) => {
	assert.equal(original.schemaVersion, 1); assert.equal(original.compiledLean, true); assert.equal(original.installedPackage, true);
	assert.deepEqual(original.observations.map(run => run.reviewed), [false, true]);
	const environment = environmentForPhp(), observations = [];
	for(const reviewed of [false, true])
	{
		const space = await statfs(directory); assert.ok(Number(space.bavail) * Number(space.bsize) >= 2 * 1024 ** 3, "Recursive Composer reproduction needs 2 GiB free at each source-path start");
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), prior = original.observations.find(run => run.reviewed === reviewed);
		const { pkg, provenance, bindingIr, nativeEvidence } = await prepare({ author: join(root, "author"), handoff: join(root, "handoff"), environment, reviewed, diagnostic });
		assert.deepEqual(pkg, prior.package);
		for(const key of Object.keys(provenance)) assert.deepEqual(provenance[key], prior[key], key);
		observations.push({ reviewed, package: pkg
			, ...provenance
			, bindingIr, nativeEvidence
			, originalArchiveSha256: prior.php.archiveSha256
			, reproducedOriginalArchive: true });
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, independentBuilds: true
		, originalReportSha256: sha256(canonicalJson(original)), observations };
};
