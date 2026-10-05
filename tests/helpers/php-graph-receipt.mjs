/**
 * Check original recursive Composer archives and source-free runtime evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { generateCopiedPhpGraphPackage, compileCopiedPhpGraphPackageModel } from "../../src/backends/php/copied-graph-package.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { phpIsolationFlags, composerProbe } from "./type-corpus-php.mjs";
import { validateBrickMathInstall } from "./brick-math.mjs";

const hash = value => assert.match(value, /^[a-f0-9]{64}$/);
const required = (value, keys) => { for(const key of keys) assert.equal(value[key], true, key); };
const inventory = files => {
	assert.ok(Object.keys(files).length > 0);
	for(const [path, file] of Object.entries(files))
	{ assert.ok(!path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..")); hash(file.sha256); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0); }
};
const artifact = pkg => {
	assert.equal(pkg.target, "php-native"); assert.equal(pkg.ecosystem, "composer");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1); hash(pkg.runtimeIdentity);
	const zip = pkg.artifacts[0]; assert.match(zip.path, /^archives\/[a-z0-9._-]+\.zip$/); hash(zip.sha256); assert.ok(zip.bytes > 0); return zip;
};
const natives = receipt => Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith("native/linux-x64/")).map(([path, value]) => [path.split("/").at(-1), value.sha256]));
const generatedHashes = files => Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]));

const loading = async (report, source) => {
	assert.equal(report.schemaVersion, 1); inventory(report.deployment);
	assert.equal(report.sourceSha256, sha256(await readFile(`tests/fixtures/structured-types/${source}`)));
	const install = report.installation;
	required(install, ["offline", "emptyHome", "emptyCache", "repeatInstall", "sourceFreeExecution", "compilerFreeExecution", "handoffRemoved"]);
	hash(install.phpSha256); hash(install.composerSha256); hash(install.lockSha256);
	validateBrickMathInstall(install, report.deployment);
	assert.equal(install.lock.packages.length, report.packages.length + 1);
	assert.equal(install.installed.packages.length, report.packages.length + 1);
	assert.deepEqual(install.lock["packages-dev"], []);
	assert.deepEqual(install.manifest.require, Object.fromEntries(report.packages.map(item => [item.package.name, item.package.version])));
	for(const entry of report.packages)
	{
		artifact(entry.package); hash(entry.sourceSha256); required(entry, ["authorInputsUnchanged"]);
		assert.equal(entry.receipt.name, entry.package.name); assert.equal(entry.receipt.version, entry.package.version);
		assert.equal(entry.receipt.runtimeIdentity, entry.package.runtimeIdentity);
		inventory(entry.receipt.files); assert.equal(Object.keys(natives(entry.receipt)).length, 4);
		const prefix = `vendor/${entry.package.name}/`;
		for(const [path, identity] of Object.entries(entry.inspected)) assert.deepEqual(report.deployment[prefix + path], identity);
		assert.equal(entry.inspected["lean-bridge/package-receipt.json"].sha256, sha256(canonicalJson(entry.receipt)));
		for(const [path, identity] of Object.entries(entry.receipt.files)) assert.deepEqual(entry.inspected[path], identity);
		assert.equal(entry.receipt.files["binding-manifest.json"].sha256, sha256(canonicalJson(entry.manifest)));
		assert.equal(entry.receipt.files["composer.json"].sha256, sha256(canonicalJson(entry.composer)));
		for(const selected of [install.lock.packages, install.installed.packages].map(list => list.find(pkg => pkg.name === entry.package.name)))
		{ assert.equal(selected.version, entry.package.version); assert.deepEqual(selected.dist, entry.dist); }
	}
	assert.equal(new Set(report.packages.map(item => item.package.runtimeIdentity)).size, 1);
	for(const observation of report.observations) required(observation, ["repeatExecution", "unchangedDeployment"]);
};

/**
 * Require both source paths and caller modes, exact regeneration, independent
 * archives, native tamper rejection and multi-package runtime observations.
 *
 * @param reports - Actual CI-retained reports, not generated expectations.
 */
export const assertPhpGraphPackageReports = async reports => {
	assert.deepEqual(Object.keys(reports).sort(), ["cold", "composition", "conflicts", "packages", "reproducibility"]);
	const { cold, packages, reproducibility, composition, conflicts } = reports;
	assert.equal(cold.schemaVersion, 1); assert.equal(cold.installedPackage, false); hash(cold.phpSha256);
	assert.deepEqual(cold.generatedSourceHashes, generatedHashes(generateCopiedPhpGraphPackage(nativeRecursiveReviewedIr())));
	assert.deepEqual(cold.observations.map(item => item.mode), ["weak", "strict"]);
	const source = await readFile("tests/fixtures/structured-types/recursive-php-installed.php", "utf8");
	for(const item of cold.observations)
	{
		assert.equal(item.programSha256, sha256(source.replace("strict_types=0", `strict_types=${item.mode === "strict" ? 1 : 0}`)));
		assert.deepEqual(item.observation, { checks: 126, rejections: 34, exports: 18, ffiLoaded: false });
	}
	assert.equal(packages.schemaVersion, 1); required(packages, ["compiledLean", "installedPackage"]);
	assert.deepEqual(packages.observations.map(item => item.reviewed), [false, true]);
	assert.equal(reproducibility.schemaVersion, 1); assert.equal(reproducibility.independentBuilds, true);
	assert.equal(reproducibility.originalReportSha256, sha256(canonicalJson(packages)));
	assert.deepEqual(reproducibility.observations.map(item => item.reviewed), [false, true]);
	for(const run of packages.observations)
	{
		const zip = artifact(run.package), php = run.php, receipt = php.packageReceipt;
		required(run, ["checkedSourceUnchanged", "composerOnly", "deterministicReassembly", "compilerFreeReassembly", "sourceRemovedBeforeInstallation"]);
		assert.equal(run.exports, 18); assert.equal(run.rejectsGraphReceiptDrift, 3); assert.equal(run.rejectsRegeneratedSourceDrift, 4);
		for(const key of ["binarySha256", "bindingIrSha256", "layoutSha256", "modelSha256"]) hash(run[key]);
		assert.equal(run.probeSha256, sha256(source)); required(php, phpIsolationFlags);
		assert.equal(php.archiveSha256, zip.sha256); assert.equal(php.bindingIrSha256, run.bindingIrSha256);
		assert.equal(php.requestSha256, sha256(canonicalJson({ path: run.reviewed ? "reviewed-ir" : "ordinary-source" })));
		assert.equal(php.composerProbeSha256, sha256(composerProbe)); assert.equal(php.manifestSha256, sha256(canonicalJson(php.manifest)));
		for(const key of ["hostSha256", "composerSha256", "lockSha256", "installedSha256"]) hash(php[key]);
		assert.match(php.composerVersion, /^Composer version 2\./); assert.match(php.version, /^8\./);
		assert.deepEqual(php.manifest.repositories[0], { "packagist.org": false });
		assert.deepEqual(php.manifest.require, { [run.package.name]: run.package.version });
		assert.deepEqual(php.manifest.config, { "allow-plugins": false });
		assert.equal(php.lock.packages.length, 2); assert.equal(php.installed.packages.length, 2);
		validateBrickMathInstall(php, php.deployment); inventory(php.deployment); inventory(receipt.files);
		assert.equal(receipt.kind, "lean-bridge-ordinary-php-package"); assert.equal(receipt.ecosystem, "composer");
		assert.equal(receipt.name, run.package.name); assert.equal(receipt.version, run.package.version); assert.equal(receipt.namespace, "LeanRecursive");
		assert.equal(receipt.runtimeIdentity, run.package.runtimeIdentity); assert.equal(receipt.bindingIrSha256, run.bindingIrSha256);
		assert.equal(php.packageReceiptSha256, sha256(canonicalJson(receipt)));
		const prefix = `vendor/${run.package.name}/`, nativeFiles = natives(receipt);
		for(const [path, identity] of Object.entries(receipt.files)) assert.deepEqual(php.deployment[prefix + path], identity);
		assert.equal(php.deployment[prefix + "lean-bridge/package-receipt.json"].sha256, php.packageReceiptSha256);
		assert.equal(Object.keys(nativeFiles).length, 4);
		assert.equal(Object.entries(nativeFiles).find(([name]) => name.startsWith("libcomponent_"))[1], run.binarySha256);
		assert.equal(php.declarationsSha256, receipt.files["src/Api.php"].sha256);
		assert.deepEqual(php.executions.map(item => item.mode), ["weak", "strict"]);
		assert.deepEqual(run.observation, php.executions[0].observation);
		for(const item of php.executions)
		{
			const programSha256 = sha256(source.replace("strict_types=0", `strict_types=${item.mode === "strict" ? 1 : 0}`));
			assert.equal(php.consumerSources[item.mode], programSha256); assert.equal(php.deployment[`${item.mode}.php`].sha256, programSha256);
			assert.deepEqual(item.observation, { checks: 1457, rejections: 35
				, exports: 18, hostVersion: php.version, actualPhpBits: 64
				, nativeLibraries: nativeFiles, compiledLean: true
				, installedPackage: true });
		}
		assert.deepEqual(run.tamper.rejections.map(item => item.path).sort(), Object.keys(nativeFiles).map(name => `native/linux-x64/${name}`).sort());
		for(const item of run.tamper.rejections)
		{ required(item, ["rejectedBeforeMapping", "restored"]); assert.equal(item.originalSha256, receipt.files[item.path].sha256); }
		hash(run.tamper.sourceSha256);
		const repeated = reproducibility.observations.find(item => item.reviewed === run.reviewed);
		assert.equal(repeated.reproducedOriginalArchive, true); assert.equal(repeated.originalArchiveSha256, zip.sha256);
		assert.deepEqual(repeated.package, run.package);
		for(const key of ["binarySha256", "bindingIrSha256", "layoutSha256", "modelSha256"]) assert.equal(repeated[key], run[key], key);
		assert.equal(hashBindingIr(repeated.bindingIr), run.bindingIrSha256);
		assert.equal(compileCopiedPhpGraphPackageModel(repeated.bindingIr).layoutSha256, run.layoutSha256);
		const generated = generateCopiedPhpGraphPackage(repeated.bindingIr, repeated.nativeEvidence);
		for(const [path, text] of Object.entries(generated))
			assert.deepEqual(receipt.files[path], { bytes: Buffer.byteLength(text), sha256: sha256(text) }, path);
		assert.deepEqual(repeated.nativeEvidence.libraries, nativeFiles);
	}
	assert.equal(new Set(packages.observations.map(item => item.binarySha256)).size, 1);
	await loading(composition, "recursive-php-composition.php");
	assert.equal(composition.packages.length, 3); assert.deepEqual(composition.packages.map(item => item.graph), [true, true, false]);
	assert.deepEqual(composition.packages[1].targets, ["cpp", "php-native"]);
	assert.deepEqual(composition.observations.map(item => item.args), [["graph-first"], ["peer-first"]]);
	const mappings = Object.assign({}, ...composition.packages.map(item => natives(item.receipt))); assert.equal(Object.keys(mappings).length, 8);
	for(const run of composition.observations)
	{
		assert.equal(run.observed.mode, run.args[0]); assert.ok(run.observed.checks > 400);
		assert.equal(run.observed.runtimeInitializations, 1); assert.equal(run.observed.componentInitializations, 3);
		required(run.observed, ["forkRejected", "sharedRetirement"]); assert.deepEqual(run.observed.mappings, mappings);
	}
	await loading(conflicts, "recursive-php-conflicts.php");
	assert.equal(conflicts.packages.length, 2);
	assert.equal(conflicts.packages[0].receipt.component.id, conflicts.packages[1].receipt.component.id);
	assert.deepEqual(conflicts.observations.map(item => item.args), ["duplicate", "conflict"].flatMap(mode => [0, 1].map(first => [mode, String(first)])));
	for(const run of conflicts.observations)
	{
		const first = Number(run.args[1]); assert.equal(run.observed.first, first); assert.equal(run.observed.mode, run.args[0]);
		required(run.observed, ["mappingUnchanged", "originalUsable"]);
		assert.deepEqual(run.observed.mappings, natives(conflicts.packages[first].receipt));
	}
};
