/**
 * Keep reviewed scalar executions, installed identities and measured dispatch intact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeFinDispatchColumns } from "./native-fin-consumers.mjs";
import { pythonFinConsumer, pythonFinDispatchExpected, pythonFinDispatchProbe } from "./python-fin-consumers.mjs";
import { rustFinConsumer, rustFinDispatchExpected, rustFinDispatchProbe, rustFinInvalid } from "./rust-fin-consumers.mjs";
import { reviewedScalarHostIr } from "./reviewed-scalar-host-fixture.mjs";

const directory = "docs/evidence/reviewed-scalar-hosts-20261007";

test("reviewed scalar Python archive preserves both runtime floors and real adapter dispatch", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.planNode, 1438);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.glibcMinimumVersion, "2.36");
	assert.equal(receipt.sourcePath, "reviewed-ir");
	const reference = receipt.reports.find(item => item.id === "python");
	assert.equal(reference.revision, "c9ebbcec21b002abf7397fc96844ab3d777f8e61");
	assert.equal(reference.sha256, "c27ad521e5762908ad1b0b95e4fdfeb2fe1f81d670f86e83da0815017b5b0c19");
	assert.equal(reference.path, `${directory}/python.json`);
	assert.match(reference.reproduceCommand, /LEAN_BRIDGE_PYTHON_FIN_TEST=1/u);
	assert.ok(reference.reproduceCommand.includes("--test-name-pattern='independently reviewed Python wheels'"));
	const bytes = await readFile(reference.path);
	assert.equal(sha256(bytes), reference.sha256);
	const report = JSON.parse(bytes);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.python), ["3.11", "3.12"]);
	for(const item of report.reports)
	{
		assert.equal(item.profile, "python");
		assert.equal(item.path, "reviewed-ir");
		assert.equal(item.checks, 2032);
		assert.equal(item.consumerSha256, sha256(pythonFinConsumer()));
		assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(reviewedScalarHostIr())));
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "relocatedInstallation", "repeatExecution", "installedFilesUnchanged"])
			assert.equal(item[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "installedFilesSha256"])
			assert.match(item[key], /^[a-f0-9]{64}$/u, key);
		assert.match(item.sharedNativeLibraries["libnative_fin.so"], /^[a-f0-9]{64}$/u);
		for(const pkg of item.packages) for(const artifact of pkg.artifacts) assert.equal(report.archives[artifact.path], artifact.sha256);
		assert.equal(item.dispatch.interposer, "LD_PRELOAD");
		assert.deepEqual(item.dispatch.columns, nativeFinDispatchColumns);
		assert.deepEqual(item.dispatch.observed, pythonFinDispatchExpected);
		assert.equal(item.dispatch.probeSha256, sha256(pythonFinDispatchProbe()));
	}
});

test("reviewed scalar Rust archive preserves static rejections, relocation and real adapter dispatch", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.deepEqual(receipt.reports.map(item => item.id), ["python", "rust"]);
	const reference = receipt.reports.find(item => item.id === "rust");
	assert.equal(reference.revision, "c9ebbcec21b002abf7397fc96844ab3d777f8e61");
	assert.equal(reference.sha256, "fd91e8d0bdd481cc45816ecb0536a3b88ee107c98192733456a6ec0d75ad35f8");
	assert.equal(reference.path, `${directory}/rust.json`);
	assert.match(reference.reproduceCommand, /LEAN_BRIDGE_RUST_FIN_TEST=1/u);
	assert.ok(reference.reproduceCommand.includes("--test-name-pattern='independently reviewed Rust crates'"));
	const bytes = await readFile(reference.path);
	assert.equal(sha256(bytes), reference.sha256);
	const report = JSON.parse(bytes);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reproducible, true);
	assert.equal(report.reports.length, 1);
	const [item] = report.reports;
	assert.equal(item.profile, "rust");
	assert.equal(item.path, "reviewed-ir");
	assert.equal(item.checks, 2021);
	assert.equal(item.consumerSha256, sha256(rustFinConsumer()));
	assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(reviewedScalarHostIr())));
	for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath", "emptyCargoHome", "linkOnly", "relocatedExecutable", "installedSourcesRemoved", "repeatExecution"])
		assert.equal(item[key], true, key);
	for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "installedFilesSha256", "executableSha256"])
		assert.match(item[key], /^[a-f0-9]{64}$/u, key);
	assert.match(item.sharedNativeLibraries["libnative_fin.so"], /^[a-f0-9]{64}$/u);
	for(const pkg of item.packages) for(const artifact of pkg.artifacts) assert.equal(report.archives[artifact.path], artifact.sha256);
	const rejected = rustFinInvalid.map(({ name, code, statement }) => {
		const source = `use native_fin as api; fn main() { ${statement} }\n`;
		return { name, code, sourceSha256: sha256(source), diagnostics: 1 };
	});
	assert.deepEqual(item.rejected, rejected);
	assert.equal(item.dispatch.interposer, "LD_PRELOAD");
	assert.deepEqual(item.dispatch.columns, nativeFinDispatchColumns);
	assert.deepEqual(item.dispatch.observed, rustFinDispatchExpected);
	assert.equal(item.dispatch.probeSha256, sha256(rustFinDispatchProbe()));
});
