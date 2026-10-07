/**
 * Authenticate the reviewed scalar host successes without hiding the failed Perl invocation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedScalarHostIr } from "./reviewed-scalar-host-fixture.mjs";

const directory = "docs/evidence/reviewed-scalar-rollout-20261007";
const reports = [
	["dotnet", "e0f009a0d5fee4446a6d708d7c1747136d6044db65b4e16d33355973728bef46", [["dotnet", 2022]]]
	, ["jvm", "6f1e827fd1da45d697f52995788e0fd7673a1a5332c117ee11be83626c0445aa", [["java", 2023], ["kotlin", 2022]]]
	, ["php", "4f5f7534816ce8479c34940916b15b1018dbc5bea093d4bc6c3bbf3d37dffb66", [["php-native", 2028]]]
	, ["ruby", "a03b69e4b0965385d04337ea225539f14765c8fa8d7d2d3c9feecbc08cae4d70", [["ruby", 2029]]]
	, ["wit", "2844e489e534075d6213b05ba15013652adac43c413eeb9a91ff77c5d48dde45", [["wit-wasi", 2027]]]
];

test("reviewed scalar rollout archives preserve six installed hosts without claiming measured dispatch", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.planNode, 1438);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.sourcePath, "reviewed-ir");
	assert.equal(receipt.revision, "f315e47b5f202a98b7398e1390188ebb3ba669ba");
	assert.deepEqual(receipt.producerEnvironment, {
		platform: "Debian 12", hostGlibcVersion: "2.36"
		, overrides: { LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36", LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: null } });
	assert.deepEqual(receipt.reports.map(item => item.id), reports.map(([id]) => id));
	for(const [id, digest, checks] of reports)
	{
		const reference = receipt.reports.find(item => item.id === id);
		assert.equal(reference.path, `${directory}/${id}.json`);
		assert.equal(reference.sha256, digest);
		const bytes = await readFile(reference.path), report = JSON.parse(bytes);
		assert.equal(sha256(bytes), digest);
		assert.equal(report.schemaVersion, 1);
		assert.equal(report.reproducible, true);
		assert.deepEqual(report.reports.map(item => item.profile), reference.profiles);
		assert.deepEqual(report.reports.map(item => [item.profile, item.checks ?? item.observation.checks]), checks);
		const review = id === "wit" ? reviewedScalarHostIr("nativefin") : reviewedScalarHostIr();
		for(const item of report.reports)
		{
			assert.equal(item.path, "reviewed-ir");
			assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(review)));
			assert.equal(item.sourceRemovedBeforeInstallation, true);
			assert.equal(item.dispatch.observed, false);
			assert.match(item.dispatch.reason, /privately|isolates/u);
			assert.equal(Object.hasOwn(item.dispatch, "columns"), false);
			for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"])
				assert.match(item[key], /^[a-f0-9]{64}$/u, key);
			const library = id === "wit" ? "libnativefin.so" : "libnative_fin.so";
			assert.match(item.sharedNativeLibraries[library], /^[a-f0-9]{64}$/u);
			for(const pkg of item.packages) for(const artifact of pkg.artifacts)
				assert.equal(report.archives[artifact.path], artifact.sha256);
			if(id === "wit")
			{
				assert.equal(item.observation.rejections, 1013);
				assert.equal(item.observation.hostVersion, "42.0.1");
				assert.ok(item.observation.loadedLibraries.some(path => path.endsWith("/relocated/lib/libnativefin.so")));
			}
			else
			{
				for(const key of ["offlineInstall", "compilerFreePath", "relocatedInstallation", "repeatExecution"])
					assert.equal(item[key], true, key);
				assert.match(item.consumerSha256, /^[a-f0-9]{64}$/u);
			}
		}
	}
});

test("the rollout log retains the local CPAN floor mistake and does not invent Perl success", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.log.sha256, "5f7d8063dc4a39554f97f76e3bdf2661b3e44c68cc12ba5260cfbf04930f0bbc");
	const log = await readFile(receipt.log.path, "utf8");
	assert.equal(sha256(log), receipt.log.sha256);
	assert.deepEqual([receipt.log.passed, receipt.log.failed, receipt.log.skipped], [5, 1, 0]);
	for(const label of ["Dotnet", "Jvm", "Php", "Ruby", "Wit"])
		assert.ok(log.includes(`✔ independently reviewed ${label} packages`));
	assert.match(log, /✖ independently reviewed Perl packages/u);
	assert.match(log, /Package requires glibc 2\.38 or later/u);
	assert.match(log, /Makefile\.PL/u);
	assert.match(log, /ℹ pass 5\nℹ fail 1/u);
	assert.equal(receipt.failure.profile, "perl");
	assert.equal(receipt.failure.stage, "producer-runtime-install");
	assert.equal(receipt.reports.some(item => item.id === "perl"), false);
	assert.ok(receipt.command.includes("LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36"));
	assert.ok(!receipt.command.includes("LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR="));
});
