/**
 * Authenticate the immutable hosted C/C++ recursive checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkMutualCheckedRecordNativeCiRecords
} from "./mutual-checked-record-native-ci-report.mjs";
import {
	mutualCheckedRecordChangedPaths
} from "./mutual-checked-record-source-history.mjs";

export const mutualCheckedRecordNativeEvidence
	= "docs/evidence/mutual-checked-record-native-20261018";
// Filled after the one-shot hosted archive is committed.
export const mutualCheckedRecordNativeEvidenceSha256 = null;
export const mutualCheckedRecordNativeRoutes = Object.freeze([
	"ordinary", "reviewed"
]);

/** Exact source closure that produced the hosted package bytes. */
export const mutualCheckedRecordNativeProducerSources = () => [...new Set([
	"package.json", "package-lock.json", "lean-toolchain"
	, ...mutualCheckedRecordChangedPaths.filter(path =>
		path !== "docs/type-surface.v1.json")
	, "src/abi/component-recursive-abi.mjs"
	, "src/abi/component-recursive.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/backends/c/graph-package.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/cpp/copied-graph-conversions.mjs"
	, "src/binding-ir/canonical.mjs", "src/binding-ir/contract.mjs"
	, "src/build/canonical-build.mjs", "src/build/native-artifacts.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-graph-sources.mjs"
	, "src/build/refinement-mirrors.mjs"
	, "src/capsule/node.mjs", "src/release/package-set-receipt.mjs"
	, "scripts/check-mutual-checked-record-native-ci.mjs"
	, "scripts/run-mutual-checked-record-native-ci.sh"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/mutual-checked-record-fixture.mjs"
	, "tests/helpers/mutual-checked-record-native-ci-report.mjs"
	, "tests/helpers/mutual-checked-record-native-installed-tests.mjs"
	, "tests/helpers/mutual-checked-record-native-report.mjs"
	, "tests/helpers/package-set.mjs"
	, "tests/fixtures/mutual-checked-record-consumers/c.c"
	, "tests/fixtures/mutual-checked-record-consumers/cpp.cpp"
	, ...["LICENSE", "MutualCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"].map(path =>
		`tests/fixtures/onboarding/mutual-checked-records/${path}`)
])].sort();

export const mutualCheckedRecordNativeArchiveSources = Object.freeze([
	"scripts/archive-mutual-checked-record-native.mjs"
	, "tests/helpers/mutual-checked-record-native-evidence.mjs"
	, "tests/helpers/mutual-checked-record-native-report.mjs"
]);

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_@.+/-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
const original = (commit, path) => execFileSync(
	"git", ["show", `${commit}:${path}`], { maxBuffer: 64 * 1024 * 1024 }
);

/**
 * Reconcile every archived byte, source snapshot and hosted execution.
 *
 * @param read - Repository-relative archive reader.
 */
export const checkMutualCheckedRecordNativeEvidence = async (
	read = readFile
) => {
	assert.match(mutualCheckedRecordNativeEvidenceSha256, /^[a-f0-9]{64}$/u);
	const indexPath = `${mutualCheckedRecordNativeEvidence}/index.json`;
	const indexBytes = Buffer.from(await read(indexPath));
	assert.equal(sha256(indexBytes), mutualCheckedRecordNativeEvidenceSha256);
	const index = json(indexBytes, indexPath), files = new Map();
	exactKeys(index, [
		"schemaVersion", "kind", "producerCommit", "archiveCommit"
		, "hostedRun", "runtime", "floor", "runs", "sourceSnapshots"
		, "limitations", "files"
	], "index keys");
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "mutual-checked-record-native-hosted-v1");
	assert.match(index.producerCommit, /^[a-f0-9]{40}$/u);
	assert.match(index.archiveCommit, /^[a-f0-9]{40}$/u);
	exactKeys(index.hostedRun, [
		"repository", "runId", "jobId", "artifactId", "artifactBytes"
		, "artifactSha256", "apiDigest"
	], "hosted run keys");
	assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
	for(const key of ["runId", "jobId", "artifactId"])
		assert.ok(Number.isSafeInteger(index.hostedRun[key])
			&& index.hostedRun[key] > 0, key);
	assert.ok(Number.isSafeInteger(index.hostedRun.artifactBytes)
		&& index.hostedRun.artifactBytes > 0);
	assert.match(index.hostedRun.artifactSha256, /^[a-f0-9]{64}$/u);
	assert.equal(index.hostedRun.apiDigest
		, `sha256:${index.hostedRun.artifactSha256}`);
	assert.deepEqual(index.runtime, {
		platform: "linux", arch: "x64", runner: "ubuntu-24.04"
	});
	assert.equal(index.floor, "2.38");
	assert.equal(index.limitations.length, 6);
	assert.ok(index.limitations.every(item =>
		typeof item === "string" && item.length > 0));
	let previous = "";
	for(const entry of index.files)
	{
		exactKeys(entry, ["path", "bytes", "sha256"], entry.path);
		assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
		assert.ok(!previous || previous.localeCompare(entry.path) < 0, entry.path);
		previous = entry.path;
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
		assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		const bytes = Buffer.from(await read(
			`${mutualCheckedRecordNativeEvidence}/${entry.path}`));
		assert.equal(bytes.length, entry.bytes, entry.path);
		assert.equal(sha256(bytes), entry.sha256, entry.path);
		files.set(entry.path, bytes);
	}
	const snapshots = [
		{ role: "producer", commit: index.producerCommit
			, paths: mutualCheckedRecordNativeProducerSources() }
		, { role: "archive", commit: index.archiveCommit
			, paths: [...mutualCheckedRecordNativeArchiveSources] }
	];
	assert.deepEqual(index.sourceSnapshots, snapshots);
	const expectedPaths = [];
	for(const snapshot of snapshots) for(const path of snapshot.paths)
	{
		const retained = `sources/${snapshot.role}/${path}`;
		assert.deepEqual(files.get(retained)
			, original(snapshot.commit, path), retained);
		expectedPaths.push(retained);
	}
	assert.deepEqual(index.runs.map(item => item.route)
		, [...mutualCheckedRecordNativeRoutes]);
	const checkedRuns = [];
	for(const run of index.runs)
	{
		exactKeys(run, [
			"route", "recordCount", "reportSha256", "verificationSha256"
			, "tapSha256", "bindingIrSha256", "independentBuilds"
			, "profiles", "artifacts"
		], `${run.route} run keys`);
		const prefix = `${run.route}/records/`;
		const routeFiles = [...files.keys()].filter(path => path.startsWith(prefix))
			.map(path => path.slice(prefix.length)).sort();
		const tapPath = `${run.route}/run.tap`;
		const verificationPath = `${run.route}/verification.json`;
		const checked = await checkMutualCheckedRecordNativeCiRecords({
			route: run.route, producer: index.producerCommit
			, directory: "records", tap: "run.tap"
		}, {
			tap: files.get(tapPath).toString()
			, read: path => {
				const value = files.get(prefix + path);
				assert.ok(value, path); return value;
			}
		});
		assert.deepEqual(routeFiles, checked.recordPaths);
		assert.equal(run.recordCount, checked.recordPaths.length);
		assert.equal(run.reportSha256, checked.reportSha256);
		assert.equal(run.tapSha256, sha256(files.get(tapPath)));
		assert.equal(run.verificationSha256
			, sha256(files.get(verificationPath)));
		assert.equal(run.bindingIrSha256, checked.bindingIrSha256);
		assert.equal(run.independentBuilds, checked.independentBuilds);
		assert.deepEqual(run.profiles, checked.observations.map(item => ({
			profile: item.profile, checks: item.checks
		})));
		const verification = json(files.get(verificationPath), verificationPath);
		assert.deepEqual(verification, {
			schemaVersion: 1, route: checked.route
			, producerCommit: checked.producerCommit
			, reportSha256: checked.reportSha256
			, bindingIrSha256: checked.bindingIrSha256
			, records: checked.recordPaths.length
			, independentBuilds: checked.independentBuilds
			, profiles: checked.observations.map(item => ({
				profile: item.profile, checks: item.checks
			}))
		});
		assert.deepEqual(run.artifacts
			, checked.receipt.packages.flatMap(pkg => pkg.artifacts));
		expectedPaths.push(...routeFiles.map(path => prefix + path)
			, tapPath, verificationPath);
		checkedRuns.push(checked);
	}
	expectedPaths.push("toolchain.log");
	assert.ok(files.get("toolchain.log").length > 0);
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit, archiveCommit: index.archiveCommit
		, hostedRun: index.hostedRun, runtime: index.runtime, floor: index.floor
		, runs: checkedRuns, files: index.files
		, sourceSnapshots: index.sourceSnapshots, limitations: index.limitations
		, installedProfiles: ["c", "cpp"], hostedAcceptance: true
		, supportPromoted: false
	};
};
