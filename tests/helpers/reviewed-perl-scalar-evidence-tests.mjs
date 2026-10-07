/**
 * Authenticate four actual Perl ABI executions with measured source dispatch.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedScalarHostIr } from "./reviewed-scalar-host-fixture.mjs";

const directory = "docs/evidence/reviewed-perl-scalar-20261007";
test("reviewed scalar Perl archive binds all four ABIs to reproduced packages and measured rejection dispatch", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.planNode, 1438);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.revision, "f315e47b5f202a98b7398e1390188ebb3ba669ba");
	assert.equal(receipt.sourcePath, "reviewed-ir");
	assert.deepEqual(receipt.producerEnvironment.overrides, {
		LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36"
	});
	assert.equal(receipt.report.path, `${directory}/perl.json`);
	assert.equal(receipt.report.sha256, "fd3d402aae575dff95e480890d49683c2cdaba6fd9aa79dd384b5934c2161c5a");
	const bytes = await readFile(receipt.report.path), report = JSON.parse(bytes);
	assert.equal(sha256(bytes), receipt.report.sha256);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reproducible, true);
	const interpreters = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"].map(abi => `/app/.toolchains/perl/${abi}/bin/perl`);
	assert.deepEqual(report.reports.map(item => item.perl), interpreters);
	for(const item of report.reports)
	{
		assert.equal(item.path, "reviewed-ir");
		assert.equal(item.profile, "perl");
		assert.equal(item.checks, 2024);
		assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(reviewedScalarHostIr())));
		assert.equal(item.consumerSha256, "a939676bc4bd5d545079a56f70f2160be3b383375aec2471290e7c052f2e5f36");
		for(const key of ["compilerFreePath", "offlineInstall", "repeatExecution", "sourceRemovedBeforeInstallation"])
			assert.equal(item[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"])
		{
			assert.match(item[key], /^[a-f0-9]{64}$/u, key);
			assert.equal(item[key], report.reports[0][key]);
		}
		assert.equal(item.dispatch.interposer, "LD_PRELOAD");
		assert.deepEqual(item.dispatch.columns, ["l_NativeFin_mirror", "l_NativeFin_impossible", "l_NativeFin_label"]);
		assert.deepEqual(item.dispatch.observed, [
			["valid-mirror", [1, 0, 0]], ["invalid-only", [0, 0, 0]]
			, ["valid-label", [0, 0, 1]], ["invalid-then-valid", [1, 0, 0]]
		]);
		assert.equal(item.dispatch.positiveControl, "valid public calls increment their source count");
		for(const pkg of item.packages) for(const artifact of pkg.artifacts)
			assert.equal(report.archives[artifact.path], artifact.sha256);
	}
});

test("the corrected Perl invocation retains both floor overrides and the complete passing log", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.log.path, `${directory}/installed.txt`);
	assert.equal(receipt.log.sha256, "4caf0c5209de673a045f523c74c6b68d5dfa31024e2448bea38b1cf6ee583293");
	const log = await readFile(receipt.log.path, "utf8");
	assert.equal(sha256(log), receipt.log.sha256);
	assert.match(log, /✔ independently reviewed Perl packages/u);
	assert.match(log, /ℹ tests 1\nℹ suites 0\nℹ pass 1\nℹ fail 0/u);
	assert.match(log, /ℹ skipped 0/u);
	for(const name of ["NATIVE", "PERL"])
		assert.ok(receipt.command.includes(`LEAN_BRIDGE_${name}_TEST_GLIBC_FLOOR=2.36`));
	assert.ok(receipt.command.includes("LEAN_BRIDGE_PERL_FIN_TEST=1"));
});
