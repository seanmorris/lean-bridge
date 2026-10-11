/**
 * Verify a live WIT late-input run against its original models, receipts and caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { finContainerRefinements, finContainerTargets } from "./fin-container-install.mjs";
import { finLateWitChecks, finLateWitConsumer, finLateWitExpected } from "./fin-container-late-wit.mjs";

/**
 * Require the exact installed test without skips, cancellation or failures.
 *
 * @param tap - Original producer TAP.
 */
export const assertFinLateWitTap = tap => {
	assert.match(tap, /^ok 1 - installed WIT late Fin rejection preserves both complete caller inputs and recovers after relocation$/mu);
	for(const [name, expected] of Object.entries({ tests: 1, pass: 1, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
	{
		const matches = [...tap.matchAll(new RegExp(`^# ${name} (\\d+)$`, "gm"))];
		assert.equal(matches.length, 1); assert.equal(Number(matches[0][1]), expected);
	}
	assert.doesNotMatch(tap, /^not ok |# (?:SKIP|TODO)\b/mu);
};

/**
 * Validate retained originals from a completed run, with an independently selected package floor.
 *
 * @param read - Byte reader of paths relative to the original record directory.
 * @param glibc - Explicit expected glibc minimum version.
 */
export const assertFinLateWitRecords = async (read, glibc) => {
	assert.match(glibc, /^2\.\d+$/u);
	const files = new Map();
	const get = async path => { const bytes = await read(path); assert.ok(Buffer.isBuffer(bytes)); files.set(path, bytes); return bytes; };
	const report = JSON.parse(await get("report.json")), context = JSON.parse(await get("context.json"));
	assert.equal(context.profile, "wit-wasi"); assert.equal(context.floor, glibc);
	for(const field of ["root", "lean", "wasmtime"]) assert.ok(typeof context[field] === "string" && isAbsolute(context[field]));
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "fin-container-late-wit-v1");
	assert.equal(report.profile, "wit-wasi"); assert.equal(report.path, "ordinary-source");
	assert.equal(report.checks, finLateWitChecks); assert.equal(report.snapshotNegativeControls, 11);
	assert.equal(report.authorRoots, 2); assert.equal(report.builds.length, 2);
	assert.deepEqual(report.builds[1], report.builds[0]); assert.equal(report.glibcMinimumVersion, glibc);
	assert.deepEqual(report.dispatch, { observed: false, reason: "Public rejection, caller preservation and recovery; no entry counters in this supplement." });
	assert.deepEqual(report.inputTreesCompared, ["arg0", "arg1"]);
	assert.deepEqual([report.rejectionsPerExecution, report.recoveriesPerExecution, report.boundRejectionsPerExecution, report.structuralRejectionsPerExecution], [1009, 1009, 673, 336]);
	for(const field of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "relocatedInstallation", "installedFilesUnchanged", "callerUnchanged", "repeatExecution"])
		assert.equal(report[field], true, field);
	const expectedSource = await readFile("tests/fixtures/onboarding/native-fin-containers/FinContainers.lean");
	let firstModel;
	for(const attempt of [0, 1])
	{
		const prefix = `author-${attempt}/`, modelBytes = await get(prefix + "model.json"), receiptBytes = await get(prefix + "package-set-receipt.json");
		const model = JSON.parse(modelBytes), receipt = JSON.parse(receiptBytes), build = report.builds[attempt];
		assert.equal(build.modelSha256, sha256(modelBytes)); assert.equal(build.receiptSha256, sha256(receiptBytes));
		assert.equal(build.bindingIrSha256, hashBindingIr(model.bindingIr)); assert.equal(model.bindingIrSha256, build.bindingIrSha256);
		assert.equal(build.sourceTreeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements ?? null])), finContainerRefinements);
		assert.deepEqual(await get(prefix + "FinContainers.lean"), expectedSource);
		const source = model.sourceIdentity.modules.find(item => item.module === "FinContainers").source;
		assert.deepEqual(source, { path: "FinContainers.lean", bytes: expectedSource.length, sha256: sha256(expectedSource) });
		const config = await get(prefix + "lean-bridge.exports.json");
		assert.equal(config.toString(), canonicalJson({ schemaVersion: 1, modules: ["FinContainers"], targets: Object.fromEntries([finContainerTargets["wit-wasi"]]) }));
		assert.equal(model.sourceIdentity.exportConfigurationSource, config.toString());
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(config));
		assert.equal(receipt.kind, "lean-bridge-package-set-receipt"); assert.equal(receipt.schemaVersion, 1);
		assert.deepEqual(receipt.component, model.component); assert.equal(receipt.source.treeSha256, build.sourceTreeSha256);
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].id, "native-library-v1");
		assert.equal(receipt.profiles[0].bindingIrSha256, build.bindingIrSha256);
		assert.deepEqual(receipt.packages, report.packages); assert.equal(receipt.packages.length, 1);
		const pkg = receipt.packages[0];
		assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.name, "fincontainers"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
		assert.equal(pkg.runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		assert.equal(pkg.artifacts.length, 1);
		for(const file of pkg.artifacts)
		{ assert.match(file.sha256, /^[a-f0-9]{64}$/u); assert.ok(!isAbsolute(file.path) && !file.path.split("/").includes("..")); }
		assert.deepEqual(build.archives, Object.fromEntries(pkg.artifacts.map(file => [file.path, file.sha256])));
		firstModel ??= model;
	}
	const installedBytes = await get("installed-receipt.json"), installed = JSON.parse(installedBytes);
	assert.equal(report.receiptSha256, sha256(installedBytes));
	assert.equal(installed.kind, "lean-bridge-ordinary-wit-package"); assert.equal(installed.ecosystem, "wit-wasi");
	assert.equal(installed.name, "fincontainers"); assert.equal(installed.version, "1.0.0");
	assert.equal(installed.bindingIrSha256, report.builds[0].bindingIrSha256);
	assert.equal(installed.runtimeIdentity, report.packages[0].runtimeIdentity);
	assert.deepEqual(installed.sourceIdentity, firstModel.sourceIdentity); assert.equal(installed.glibcMinimumVersion, glibc);
	assert.equal(report.packageFileSetSha256, sha256(canonicalJson([...Object.keys(installed.files), "lean-bridge-package.json"].sort())));
	const caller = await get("consumer.c"); assert.equal(caller.toString(), await finLateWitConsumer());
	assert.equal(report.callerSha256, sha256(caller));
	assert.match(report.executableSha256, /^[a-f0-9]{64}$/u);
	assert.equal(report.runtimeSearchPath, "$ORIGIN/fincontainers-1.0.0-wit-wasi/lib");
	for(const name of ["before.stdout", "relocated.stdout"]) assert.equal((await get(name)).toString(), finLateWitExpected);
	return { report, files };
};

/**
 * Read an actual producer directory without relying on a temporary installation.
 *
 * @param directory - Retained originals directory.
 * @param glibc - Explicit expected package floor.
 */
export const readFinLateWitRecords = (directory, glibc) => assertFinLateWitRecords(path => readFile(join(directory, path)), glibc);
