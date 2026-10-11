/**
 * Authenticate original WIT late-input and hosted JVM observations without expanding their scope.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { assertFinForeignReport } from "./fin-container-foreign-report.mjs";

export const finLateWitArchive = "docs/evidence/fin-container-late-wit-20261011";
export const finLateWitIndexSha256 = "6ac00aee5cc42e33232fff81d29a49d4b3a4995dc4d47d5419a0866cb0c5e5e9";
export const finJvmHostedArchive = "docs/evidence/fin-container-jvm-hosted-20261011";
export const finJvmHostedIndexSha256 = "3c566cff901be1024fa44354669e5d88c79e78cdcfe2db6016dc82978908bdef";

const authenticate = async (root, expected, read) => {
	const bytes = await read(`${root}/index.json`);
	assert.equal(sha256(bytes), expected, `${root}/index.json`);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.schemaVersion, 1);
	assert.equal(new Set(index.files.map(item => item.path)).size, index.files.length);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
		const value = await read(`${root}/${file.path}`);
		assert.equal(value.length, file.bytes, file.path);
		assert.equal(sha256(value), file.sha256, file.path);
		files.set(file.path, value);
	}
	return { index, files };
};
const json = (files, path) => JSON.parse(files.get(path));
const text = (files, path) => files.get(path).toString();
const tapCounts = (tap, expected) => {
	for(const [name, count] of Object.entries(expected))
	{
		const matches = [...tap.matchAll(new RegExp(`^# ${name} (\\d+)$`, "gm"))];
		assert.equal(matches.length, 1); assert.equal(Number(matches[0][1]), count);
	}
};

/**
 * Authenticate the failed and successful original WIT runs and their exact build identities.
 *
 * @param read - Repository-relative byte reader; injectable for corruption tests.
 */
export const readFinLateWitArchive = async (read = readFile) => {
	const { index, files } = await authenticate(finLateWitArchive, finLateWitIndexSha256, read);
	assert.equal(index.kind, "fin-container-late-wit-archive-v1");
	assert.equal(index.files.length, 54);
	assert.deepEqual(index.runs.map(run => [run.attempt, run.conclusion]), [[1, "failed"], [2, "passed"]]);
	for(const run of index.runs)
	{
		const prefix = `r${run.attempt}/`, start = json(files, prefix + "run.start.json"), end = json(files, prefix + "run.end.json");
		assert.equal(start.revision, run.revision);
		assert.equal(start.environment.LEAN_BRIDGE_FIN_LATE_WIT_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
		assert.equal(start.command, "/usr/bin/taskset");
		assert.deepEqual(start.args.slice(0, 2), ["-c", "3"]);
		assert.match(start.args[2], /^\/.+\/node$/u);
		assert.deepEqual(start.args.slice(3), ["--test", "--test-concurrency=1", "tests/helpers/fin-container-late-wit-installed-tests.mjs"]);
		assert.equal(end.code, run.attempt === 1 ? 1 : 0); assert.equal(end.signal, null); assert.equal(end.diskStop, false);
		assert.ok(end.minimumMiB >= 768);
		assert.equal(end.tapSha256, sha256(files.get(prefix + "run.tap")));
		tapCounts(text(files, prefix + "run.tap"), { tests: 1, pass: run.attempt === 1 ? 0 : 1, fail: run.attempt === 1 ? 1 : 0, skipped: 0 });
	}
	assert.match(text(files, "r1/run.tap"), /Unknown export, invalid WIT input or 16 MiB conversion limit/u);
	assert.equal(text(files, "diagnostic/stdout.txt"), "fin-late-ok:7065\n");
	assert.equal(text(files, "diagnostic/stderr.txt"), "");
	const prefix = "r2/records/", report = json(files, prefix + "report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "fin-container-late-wit-v1");
	assert.equal(report.profile, "wit-wasi"); assert.equal(report.path, "ordinary-source");
	assert.equal(report.checks, 7065); assert.equal(report.snapshotNegativeControls, 11);
	assert.equal(report.authorRoots, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	assert.equal(report.glibcMinimumVersion, "2.36"); assert.equal(report.dispatch.observed, false);
	assert.deepEqual(report.inputTreesCompared, ["arg0", "arg1"]);
	assert.deepEqual([report.rejectionsPerExecution, report.recoveriesPerExecution, report.boundRejectionsPerExecution, report.structuralRejectionsPerExecution], [1009, 1009, 673, 336]);
	for(const field of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "relocatedInstallation", "installedFilesUnchanged", "callerUnchanged", "repeatExecution"])
		assert.equal(report[field], true, field);
	for(const attempt of [0, 1])
	{
		const root = `${prefix}author-${attempt}/`, model = json(files, root + "model.json"), receipt = json(files, root + "package-set-receipt.json");
		assert.equal(report.builds[attempt].modelSha256, sha256(files.get(root + "model.json")));
		assert.equal(report.builds[attempt].receiptSha256, sha256(files.get(root + "package-set-receipt.json")));
		assert.equal(report.builds[attempt].bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(report.builds[attempt].sourceTreeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(receipt.packages, report.packages);
		assert.deepEqual(report.builds[attempt].archives, Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(file => [file.path, file.sha256]))));
	}
	const installed = json(files, prefix + "installed-receipt.json");
	assert.equal(report.receiptSha256, sha256(files.get(prefix + "installed-receipt.json")));
	assert.equal(installed.bindingIrSha256, report.builds[0].bindingIrSha256);
	assert.equal(installed.runtimeIdentity, report.packages[0].runtimeIdentity);
	assert.equal(report.packageFileSetSha256, sha256(canonicalJson([...Object.keys(installed.files), "lean-bridge-package.json"].sort())));
	assert.equal(report.callerSha256, sha256(files.get(prefix + "consumer.c")));
	const sourceRoot = "r2/sources/tests/fixtures/fin-container-late-consumers/";
	const original = text(files, sourceRoot + "wit-wasi.c.txt");
	const include = '#include "wit-values.h"\n';
	assert.equal(original.split(include).length, 2);
	assert.equal(text(files, prefix + "consumer.c"), original.replace(include, text(files, sourceRoot + "wit-values.h.txt") + "\n"));
	assert.match(report.executableSha256, /^[a-f0-9]{64}$/u);
	assert.equal(report.runtimeSearchPath, "$ORIGIN/fincontainers-1.0.0-wit-wasi/lib");
	for(const name of ["before.stdout", "relocated.stdout"])
		assert.equal(text(files, prefix + name), "fin-late-ok:7065\n");
	return { index, files, report };
};

/**
 * Authenticate the hosted JVM gate without turning its failed whole job into a pass.
 *
 * @param read - Repository-relative byte reader; injectable for corruption tests.
 */
export const readFinJvmHostedArchive = async (read = readFile) => {
	const { index, files } = await authenticate(finJvmHostedArchive, finJvmHostedIndexSha256, read);
	assert.equal(index.kind, "fin-container-jvm-hosted-v1"); assert.equal(index.files.length, 19);
	assert.equal(index.revision, "c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722");
	assert.deepEqual([index.runId, index.jobId, index.artifactId], [38095922360, 114341674825, 11687334246]);
	assert.equal(index.jobConclusion, "failure");
	const meta = json(files, "artifact.json"), report = json(files, "report.json");
	assert.equal(meta.id, index.artifactId); assert.equal(meta.workflow_run.id, index.runId);
	assert.equal(meta.workflow_run.head_sha, index.revision);
	assert.equal(meta.digest, "sha256:" + sha256(files.get("artifact.zip")));
	assert.equal(meta.size_in_bytes, files.get("artifact.zip").length);
	for(const ref of index.references)
	{
		const bytes = await read(ref.path);
		assert.equal(bytes.length, ref.bytes); assert.equal(sha256(bytes), ref.sha256);
		files.set(ref.path, bytes);
	}
	const job = json(files, "docs/evidence/refinement-perl-ci-20261011/114341674825.json");
	assert.equal(job.id, index.jobId); assert.equal(job.run_id, index.runId);
	assert.equal(job.head_sha, index.revision); assert.equal(job.conclusion, "failure");
	const log = text(files, "docs/evidence/refinement-perl-ci-20261011/114341674825.log");
	const success = log.indexOf("ok 1 - installed source-free native packages execute zero-bound and nested-position Fin edge cases");
	const checked = log.indexOf("Fin container raw, public and foreign-carrier measurements verified for java, kotlin.");
	const failed = log.indexOf("not ok 16 - documentation paths name product components and the active Except branch");
	assert.ok(success >= 0 && checked > success && failed > checked);
	await assertFinForeignReport(report, ["java", "kotlin"]);
	return { index, files, report };
};
