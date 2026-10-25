/**
 * Authenticate WIT bootstrap repair and preserve failed producer evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeOwnedCheckedWitBootstrapSource
	, ownedCheckedWitBootstrapAddedPaths
	, ownedCheckedWitBootstrapChangedPaths
	, ownedCheckedWitBootstrapImplementationPaths
	, ownedCheckedWitBootstrapHistoryPath
	, ownedCheckedWitBootstrapImplementation
	, ownedCheckedWitBootstrapIntegrationPaths
	, ownedCheckedWitBootstrapPredecessor
	, reverseOwnedCheckedWitBootstrapUpdate
} from "./owned-checked-wit-bootstrap-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 ** 2 });
const blob = path => execFileSync("git", ["show", `${implementation}:${path}`]
	, { maxBuffer: 2 * 1024 ** 2 });
const read = async () => JSON.parse(await readFile(ownedCheckedWitBootstrapHistoryPath));
const qualification = () => JSON.parse(blob("docs/evidence/owned-checked-wit-bootstrap-20261025.json"));
const predecessor = ownedCheckedWitBootstrapPredecessor;
const implementation = ownedCheckedWitBootstrapImplementation;
const failureRoot = "docs/evidence/owned-wit-bootstrap-failure-20261025";

test("Owned checked WIT bootstrap records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-checked-wit-bootstrap-source-v1");
	assert.equal(record.predecessorCommit, predecessor);
	assert.equal(record.implementationCommit, implementation);
	assert.equal(record.integrationBaseCommit, implementation);
	assert.deepEqual(record.implementationCommits, [implementation]);
	assert.equal(git(["show", "-s", "--format=%P", implementation]).trim(), predecessor);
	assert.deepEqual(git(["diff", "--name-only", predecessor, implementation]).trim().split("\n")
		, [...ownedCheckedWitBootstrapImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path), ownedCheckedWitBootstrapChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path), ownedCheckedWitBootstrapIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path), ownedCheckedWitBootstrapAddedPaths);
});

test("Owned checked WIT bootstrap reverses all four source transitions and retains binary evidence", async () => {
	const record = await read();
	assert.equal(record.updates.length + record.integrationUpdates.length, 4);
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
		const prior = record.integrationUpdates.includes(update) ? implementation : predecessor;
		const original = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseOwnedCheckedWitBootstrapUpdate(current, update), original);
		assert.equal(beforeOwnedCheckedWitBootstrapSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), original);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
	{
		if(addition.path.startsWith(`${failureRoot}/`))
		{
			assert.equal(sha256(blob(addition.path)), addition.currentSha256);
			assert.equal(git(["rev-parse", `HEAD:${addition.path}`])
				, git(["rev-parse", `${implementation}:${addition.path}`]));
		}
		else assert.equal(sha256(await sourceAtFinHistoryMilestone(addition.path, addition.currentSha256))
			, addition.currentSha256);
	}
});

test("Owned checked WIT bootstrap preserves runtime, inventory, docs and older evidence", () => {
	for(const path of ["src", "docs/reference", "docs/consume", "docs/lean"
		, "site", "package.json", "package-lock.json", "lean-toolchain", "flake.nix"
		, "flake.lock", "docs/type-surface.v1.json"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	assert.equal(git(["diff", "--name-only", "--diff-filter=MDRCT"
		, predecessor, implementation, "--", "docs/evidence"]), "");
});

test("Owned checked WIT bootstrap retains the original failed setup without accepting it", () => {
	const { failure } = qualification();
	assert.equal(failure.accepted, false);
	assert.equal(failure.root, failureRoot);
	assert.equal(failure.files.length, 5);
	for(const file of failure.files)
	{
		const bytes = blob(file.path);
		assert.equal(bytes.length, file.bytes, file.path);
		assert.equal(sha256(bytes), file.sha256, file.path);
	}
	const run = JSON.parse(blob(`${failureRoot}/run.json`));
	const job = JSON.parse(blob(`${failureRoot}/job.json`));
	const artifact = JSON.parse(blob(`${failureRoot}/artifact.json`));
	assert.equal(run.id, 40209972746);
	assert.equal(job.id, 121218910962);
	assert.equal(artifact.id, 12605812923);
	assert.equal(failure.run, run.id);
	assert.equal(failure.job, job.id);
	assert.equal(failure.artifact, artifact.id);
	assert.equal(run.head_sha, failure.producer);
	assert.equal(job.head_sha, failure.producer);
	assert.equal(job.run_id, run.id);
	assert.equal(artifact.workflow_run.id, run.id);
	assert.equal(artifact.workflow_run.head_sha, failure.producer);
	assert.equal(run.status, "completed");
	assert.equal(run.conclusion, "failure");
	assert.equal(job.status, "completed");
	assert.equal(job.conclusion, "failure");
	assert.equal(job.steps.find(step => step.name === failure.stage).conclusion, "failure");
	assert.equal(job.steps.find(step => step.name === "Execute source-free managed acceptance").conclusion, "skipped");
	const archive = blob(`${failureRoot}/artifact.zip`);
	assert.equal(archive.length, artifact.size_in_bytes);
	assert.equal(`sha256:${sha256(archive)}`, artifact.digest);
	const log = blob(`${failureRoot}/job.log`).toString("utf8");
	assert.ok(log.includes(failure.diagnostic));
	assert.match(log, /while fetching the input 'git\+file:\/\/\/home\/runner\/work\/lean-bridge\/lean-bridge/u);
	assert.deepEqual(failure.artifactMembers, ["owned-checked-record-managed-ci/toolchain.log"]);
});

test("Owned checked WIT bootstrap binds local qualification and records remaining workflow work", () => {
	const evidence = qualification();
	assert.equal(evidence.profile, "owned-checked-wit-bootstrap-source-qualification");
	assert.equal(evidence.predecessorCommit, predecessor);
	assert.equal(evidence.sourceIdentity.kind, "pre-implementation-working-tree-bytes");
	assert.equal(evidence.sourceIdentity.files.length, 3);
	for(const file of evidence.sourceIdentity.files)
	{
		const bytes = blob(file.path);
		assert.equal(bytes.length, file.bytes, file.path);
		assert.equal(sha256(bytes), file.sha256, file.path);
	}
	assert.equal(evidence.validation.sourceChecks.pass, 2);
	assert.equal(evidence.validation.offlineBootstrapCases.length, 6);
	const actual = evidence.validation.actualBootstrap;
	assert.equal(actual.actualArchiveDownloaded, true);
	assert.equal(actual.workflowBootstrapUnchanged, true);
	assert.equal(actual.installedFiles, 162);
	assert.equal(actual.installedBytes, 77793060);
	assert.equal(actual.selectedFiles, 38);
	assert.equal(actual.version, "42.0.1");
	assert.equal(actual.archiveSha256, "2097a47351918a446b26c7e65f487278f63bc947591b71897db547cd90c05082");
	assert.equal(actual.filesSha256, "ec43764474c7f9cedf469659d0c5cc9401f65b79f5df88acda772280ae81fe01");
	assert.equal(actual.leanBuilds, 0);
	assert.equal(actual.installedPackageAcceptance, false);
	assert.equal(evidence.validation.acceptedRuntimeRuns, 0);
	assert.equal(evidence.validation.liveInventoryAudit.stalePins, 0);
	assert.equal(evidence.inventory.changed, false);
	assert.equal(evidence.inventory.refreshedPins, 0);
	assert.equal(evidence.inventory.supportObservationsChanged, false);
	assert.equal(evidence.inventory.originalArchivesChanged, false);
	const remaining = git(["grep", "-l", "-F", "nix build .#wasmtime-c-api"
		, implementation, "--", ".github/workflows"]).trim().split("\n")
		.map(path => path.slice(implementation.length + 1)).sort();
	assert.equal(remaining.length, 12);
	assert.deepEqual(evidence.remainingNixWasmtimeWorkflows, remaining);
	assert.equal(evidence.pending.length, 3);
});

test("Owned checked WIT bootstrap preserves callers, acceptance and default matrix scope", () => {
	for(const path of ["tests/fixtures"
		, "tests/helpers/owned-checked-record-mixed-fixture.mjs"
		, "tests/helpers/owned-checked-record-managed-fixture.mjs"])
		assert.equal(git(["rev-parse", `${predecessor}:${path}`])
			, git(["rev-parse", `${implementation}:${path}`]), path);
	const path = ".github/workflows/owned-checked-record-managed.yml";
	const previous = git(["show", `${predecessor}:${path}`]);
	const current = blob(path).toString("utf8");
	const marker = "      - name: Execute source-free managed acceptance\n";
	const restored = current.slice(current.indexOf(marker))
		.replace('              LEAN_BRIDGE_MAVEN="$(command -v mvn)"\n              export LEAN_BRIDGE_MAVEN'
			, '              export LEAN_BRIDGE_MAVEN="$(command -v mvn)"')
		.replace('              LEAN_BRIDGE_PHP="$(command -v php)"\n              LEAN_BRIDGE_COMPOSER="$(command -v composer)"\n              export LEAN_BRIDGE_PHP LEAN_BRIDGE_COMPOSER'
			, '              export LEAN_BRIDGE_PHP="$(command -v php)"\n              export LEAN_BRIDGE_COMPOSER="$(command -v composer)"');
	assert.equal(restored, previous.slice(previous.indexOf(marker)));
	assert.ok(current.includes('group: ${{ fromJSON(github.event_name == \'workflow_dispatch\' && inputs.wit_only && \'["wit"]\' || \'["dotnet","jvm","php","wit"]\') }}'));
	assert.match(current, /type: boolean\n {8}default: false/u);
	const testsPath = "tests/owned-checked-record-managed-packaging.test.mjs";
	const names = source => [...source.matchAll(/^test\("([^"]+)"/gmu)].map(match => match[1]);
	assert.deepEqual(names(blob(testsPath).toString("utf8")), names(git(["show", `${predecessor}:${testsPath}`])));
});

test("Owned checked WIT bootstrap refuses unknown and altered transitions", async () => {
	const update = (await read()).updates[0];
	const current = await sourceAtFinHistoryMilestone(update.path, update.currentSha256);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseOwnedCheckedWitBootstrapUpdate(current, forged));
	assert.equal(beforeOwnedCheckedWitBootstrapSource(update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeOwnedCheckedWitBootstrapSource("unrelated.mjs", current), current);
});

test("Owned checked WIT bootstrap writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-checked-wit-bootstrap-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const child = spawnSync(process.execPath, [resolve("scripts/update-owned-checked-wit-bootstrap-source-history.mjs")]
		, { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(child.status, 0);
	assert.equal(child.stdout, "");
	assert.deepEqual(await readdir(root), []);
});

test("Owned checked WIT bootstrap writer cannot overwrite retained evidence", async () => {
	const before = await readFile(ownedCheckedWitBootstrapHistoryPath);
	const result = spawnSync(process.execPath, ["--max-old-space-size=512"
		, "scripts/update-owned-checked-wit-bootstrap-source-history.mjs"]
	, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(ownedCheckedWitBootstrapHistoryPath), before);
});
