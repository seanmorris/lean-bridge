/**
 * Preserve four reviewed Perl-container executions and the counter probe repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finContainerReviewedIr } from "./reviewed-fin-container-fixture.mjs";

const directory = "docs/evidence/reviewed-perl-containers-20261007";
const hashes = [
	"d7c1f5ff52003dc03501be3f8f183ce7dfa5f963a392c33b1389e09c7b9fd2c1"
	, "99afd2963e7676c54108e9a78d1bf74a2c0f51c5d5028f2e4f73ad1105bcab69"
	, "81e4c545b35b6a231063b7a4d70af1ac286cc7f71c25c5e94979b1f21d19b081"
	, "83104d9c73b759456620d37033871dc97a78f3d86344cdc37813d11fb6f2608e"
];
const receipt = async () => JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
const artifact = async record => {
	const bytes = await readFile(record.path);
	assert.equal(sha256(bytes), record.sha256);
	return bytes;
};

test("reviewed Perl containers retain all four ABI runs, reproduced archives and actual dispatch counts", async () => {
	const record = await receipt();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.planNode, 1438);
	assert.equal(record.execution, "local");
	assert.equal(record.revision, "9d5a708809b42d5847e1106814985bed0fddc97b");
	assert.equal(record.sourcePath, "reviewed-ir");
	assert.deepEqual(record.runs.map(run => run.abi), ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]);
	assert.deepEqual(record.producerEnvironment.overrides, {
		LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: "2.36"
	});
	for(const [index, run] of record.runs.entries())
	{
		assert.equal(run.interpreter, `/app/.toolchains/perl/${run.abi}/bin/perl`);
		assert.ok(run.command.includes(`LEAN_BRIDGE_CORPUS_PERL=${run.interpreter}`));
		assert.ok(run.command.includes("LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=perl"));
		for(const [key, value] of Object.entries(record.producerEnvironment.overrides)) assert.ok(run.command.includes(`${key}=${value}`));
		assert.equal(run.report.path, `${directory}/${run.abi}.json`);
		assert.equal(run.report.sha256, hashes[index]);
		const result = JSON.parse(await artifact(run.report));
		assert.equal(result.schemaVersion, 1);
		assert.equal(result.reproducible, true);
		assert.equal(result.reports.length, 1);
		const item = result.reports[0];
		assert.equal(item.profile, "perl");
		assert.equal(item.path, "reviewed-ir");
		assert.equal(item.checks, 2027);
		assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(finContainerReviewedIr())));
		assert.equal(item.consumerSha256, "7851aed00c573e8c2e019a64f052540329c7cf9026a03895e3a2250142499649");
		for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"]) assert.equal(item[flag], true);
		assert.equal(item.dispatch.interposer, "LD_PRELOAD");
		assert.deepEqual(item.dispatch.columns, ["l_FinContainers_mirrorAll", "l_FinContainers_orDefault", "adapter:FinContainers.mirrorAll", "adapter:FinContainers.orDefault"]);
		assert.deepEqual(item.dispatch.observed, [
			["valid-mirror", [1, 0, 1, 0]], ["valid-absent", [0, 1, 0, 1]]
			, ["invalid-only", [0, 0, 0, 0]], ["invalid-then-valid", [1, 0, 1, 0]]
		]);
		for(const pkg of item.packages) for(const file of pkg.artifacts) assert.equal(result.archives[file.path], file.sha256);
		assert.equal(run.log.path, `${directory}/${run.abi}.txt`);
		const log = (await artifact(run.log)).toString();
		assert.match(log, /✔ independently reviewed native packages/u);
		assert.match(log, /ℹ tests 1\nℹ suites 0\nℹ pass 1\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0/u);
	}
	assert.equal(record.scope.sourceDispatchObserved, true);
	for(const flag of ["directRawAdapterDispatchObserved", "reviewedSubtypeObserved", "browserObserved"]) assert.equal(record.scope[flag], false);
});

test("Perl container evidence retains the original inlined-source counter failure", async () => {
	const record = await receipt(), failed = record.initialFailure;
	assert.equal(failed.revision, "f315e47b5f202a98b7398e1390188ebb3ba669ba");
	assert.equal(failed.log.path, `${directory}/initial-counter-failure.txt`);
	assert.equal(failed.log.sha256, "2402b0334f18d4ccb6303f02ef334bb5e931764d964cfe9f8df1ec7fc7377654");
	const log = (await artifact(failed.log)).toString();
	assert.match(log, /ℹ fail 1/u);
	assert.match(log, /actual: \[ 0, 0, 0, 1 \]/u);
	assert.match(log, /expected: \[ 0, 1, 0, 1 \]/u);
	assert.match(failed.cause, /inlines countNone/u);
	assert.match(failed.repair, /Observe orDefault/u);
});
