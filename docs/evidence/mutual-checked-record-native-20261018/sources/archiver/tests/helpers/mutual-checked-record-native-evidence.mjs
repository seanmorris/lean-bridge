/**
 * Authenticate the immutable hosted C/C++ recursive checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	assertMutualCheckedRecordNativeCurrentReplay
	, checkMutualCheckedRecordNativeControls
} from "./mutual-checked-record-native-controls.mjs";
import {
	assertMutualCheckedRecordNativeCiTap
} from "./mutual-checked-record-native-ci-report.mjs";
import {
	assertMutualCheckedRecordNativeRecordPaths
	, checkMutualCheckedRecordNativeHistoricalControls
	, mutualCheckedRecordNativeRecords, mutualCheckedRecordNativeRoutes
} from "./mutual-checked-record-native-report.mjs";

export const mutualCheckedRecordNativeEvidence
	= "docs/evidence/mutual-checked-record-native-20261018";
// Filled after the one-shot hosted archive is committed.
export const mutualCheckedRecordNativeEvidenceSha256 = null;

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
const originals = new Map();
const allowedRoots = [".github/", "config/", "poc/", "scripts/", "site/", "src/", "tests/"];
const allowedFiles = new Set(["LICENSE", "lean-toolchain", "package-lock.json", "package.json"]);

/**
 * Read one exact repository blob from a frozen revision.
 *
 * @param revision - Full immutable Git revision.
 * @param path - Normalized repository-relative source path.
 */
export const mutualCheckedRecordNativeOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.equal(posix.normalize(path), path);
	assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
	assert.ok(allowedFiles.has(path) || allowedRoots.some(root => path.startsWith(root)), path);
	const key = `${revision}:${path}`;
	if(!originals.has(key)) originals.set(key, execFileSync(
		"git", ["cat-file", "blob", key], { maxBuffer: 64 * 1024 ** 2 }));
	return Buffer.from(originals.get(key));
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = mutualCheckedRecordNativeOriginal(revision, path);
		paths.add(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths];
};

const producerData = Object.freeze([
	"LICENSE", "lean-toolchain", "package-lock.json", "package.json"
	, ".github/workflows/recursive-checked-record-native.yml"
	, ".github/actions/bounded-apt/action.yml"
	, ".github/actions/bounded-apt/apt-network.conf"
	, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
	, "scripts/run-mutual-checked-record-native-ci.sh"
	, "src/analyze/NativeExports.lean"
	, "src/backends/c/gmp.source.tar.xz"
	, "src/backends/cpp/boost.source.json"
	, "tests/helpers/mutual-checked-record-native-ci-workflow.mjs"
	, ...["LICENSE", "MutualCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"].map(path =>
		`tests/fixtures/onboarding/mutual-checked-records/${path}`)
	, ...["c.c", "cpp.cpp"].map(path =>
		`tests/fixtures/mutual-checked-record-consumers/${path}`)
]);
const producerDynamicEntries = Object.freeze([
	"tests/helpers/mutual-checked-record-fixture.mjs"
	, "tests/helpers/mutual-checked-record-native-controls.mjs"
	, "src/backends/c/generate.mjs", "src/backends/c/gmp-projection.mjs"
	, "src/backends/cpp/generate.mjs", "src/backends/cpp/boost.mjs"
]);

/**
 * Select every source byte that produced, checked and archived the hosted records.
 *
 * @param revisions - Independent producer, checker and archiver revisions.
 */
export const mutualCheckedRecordNativeEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), ["archiver", "checker", "producer"]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const roles = [
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer
					, ["tests/helpers/mutual-checked-record-native-installed-tests.mjs"])
				, ...closure(revisions.producer, producerDynamicEntries)
				, ...producerData
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: closure(revisions.checker
				, ["scripts/check-mutual-checked-record-native-ci.mjs"])
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-mutual-checked-record-native.mjs"
				, "tests/helpers/mutual-checked-record-native-evidence.mjs"
			])
		}
	];
	return Object.freeze(roles.flatMap(({ role, revision, paths }) =>
		[...new Set(paths)].sort().map(path => Object.freeze({ role, revision, path }))));
};

/**
 * Reconcile every archived byte, source snapshot and hosted execution.
 *
 * @param read - Repository-relative archive reader.
 */
export const checkMutualCheckedRecordNativeEvidence = async (read = readFile) => {
	assert.match(mutualCheckedRecordNativeEvidenceSha256 ?? "", /^[a-f0-9]{64}$/u
		, "Pin the recursive native archive index first");
	const indexPath = `${mutualCheckedRecordNativeEvidence}/index.json`;
	const indexBytes = Buffer.from(await read(indexPath));
	assert.equal(sha256(indexBytes), mutualCheckedRecordNativeEvidenceSha256);
	const index = json(indexBytes, indexPath), files = new Map();
	exactKeys(index, [
		"schemaVersion", "kind", "producerCommit", "checkerCommit", "archiveCommit"
		, "hostedRun", "runtime", "floor", "runs", "selectedSources"
		, "limitations", "files"
	], "index keys");
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "mutual-checked-record-native-hosted-v1");
	for(const key of ["producerCommit", "checkerCommit", "archiveCommit"])
		assert.match(index[key], /^[a-f0-9]{40}$/u, key);
	assert.equal(index.checkerCommit, index.producerCommit
		, "The hosted checker must be the exact producer revision");
	exactKeys(index.hostedRun, [
		"repository", "runId", "jobId", "artifactId", "artifactBytes"
		, "artifactSha256", "apiDigest"
	], "hosted run keys");
	assert.equal(index.hostedRun.repository, "seanmorris/lean-bridge");
	for(const key of ["runId", "jobId", "artifactId"])
		assert.ok(Number.isSafeInteger(index.hostedRun[key]) && index.hostedRun[key] > 0);
	assert.ok(Number.isSafeInteger(index.hostedRun.artifactBytes)
		&& index.hostedRun.artifactBytes > 0);
	assert.match(index.hostedRun.artifactSha256, /^[a-f0-9]{64}$/u);
	assert.equal(index.hostedRun.apiDigest, `sha256:${index.hostedRun.artifactSha256}`);
	exactKeys(index.runtime, ["platform", "arch", "glibc"], "runtime");
	assert.equal(index.runtime.platform, "linux");
	assert.equal(index.runtime.arch, "x64");
	assert.match(index.runtime.glibc, /^2\.[0-9]+$/u);
	assert.equal(index.floor, "2.38");
	assert.ok(Number(index.runtime.glibc.split(".")[1])
		>= Number(index.floor.split(".")[1]));
	assert.equal(index.limitations.length, 6);
	assert.ok(index.limitations.every(item => typeof item === "string" && item.length > 0));
	let previous = "";
	for(const entry of index.files)
	{
		exactKeys(entry, ["path", "bytes", "sha256"], entry.path);
		assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
		assert.ok(!previous || previous.localeCompare(entry.path) < 0, entry.path);
		previous = entry.path;
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
		assert.match(entry.sha256, /^[a-f0-9]{64}$/u);
		const bytes = Buffer.from(await read(`${mutualCheckedRecordNativeEvidence}/${entry.path}`));
		assert.equal(bytes.length, entry.bytes, entry.path);
		assert.equal(sha256(bytes), entry.sha256, entry.path);
		files.set(entry.path, bytes);
	}
	const revisions = {
		producer: index.producerCommit, checker: index.checkerCommit
		, archiver: index.archiveCommit
	};
	const selectedSources = mutualCheckedRecordNativeEvidenceSources(revisions);
	assert.deepEqual(index.selectedSources, selectedSources);
	const expectedPaths = [];
	for(const { role, revision, path } of selectedSources)
	{
		const retained = `sources/${role}/${path}`;
		assert.deepEqual(files.get(retained)
			, mutualCheckedRecordNativeOriginal(revision, path), retained);
		expectedPaths.push(retained);
	}
	assert.deepEqual(index.runs.map(item => item.route)
		, [...mutualCheckedRecordNativeRoutes]);
	const archivedRuns = [], checkedRuns = [];
	for(const run of index.runs)
	{
		exactKeys(run, [
			"route", "recordCount", "reportSha256", "verificationSha256"
			, "tapSha256", "bindingIrSha256", "independentBuilds"
			, "profiles", "controls", "artifacts"
		], `${run.route} run keys`);
		const prefix = `${run.route}/records/`;
		const archivedRead = path => {
			const value = files.get(prefix + path);
			assert.ok(value, path);
			return value;
		};
		const tapPath = `${run.route}/run.tap`;
		const verificationPath = `${run.route}/verification.json`;
		const receipt = json(archivedRead("build-0/package-set-receipt.json")
			, `${run.route} receipt`);
		const records = [...mutualCheckedRecordNativeRecords(run.route, receipt)
			, "controls.json"].sort();
		const routeFiles = [...files.keys()].filter(path => path.startsWith(prefix))
			.map(path => path.slice(prefix.length)).sort();
		assertMutualCheckedRecordNativeRecordPaths(routeFiles, run.route, receipt);
		assert.equal(run.recordCount, records.length);
		const options = {
			route: run.route, producerCommit: index.producerCommit
			, runtime: index.runtime, floor: index.floor
		};
		const archived = await checkMutualCheckedRecordNativeHistoricalControls(
			archivedRead, options);
		const checked = await checkMutualCheckedRecordNativeControls(
			archivedRead, options);
		assertMutualCheckedRecordNativeCurrentReplay(archived, checked);
		assert.equal(run.reportSha256, archived.reportSha256);
		assertMutualCheckedRecordNativeCiTap(
			files.get(tapPath).toString(), run.route);
		assert.equal(run.tapSha256, sha256(files.get(tapPath)));
		assert.equal(run.verificationSha256, sha256(files.get(verificationPath)));
		assert.equal(run.bindingIrSha256, archived.bindingIrSha256);
		assert.equal(run.independentBuilds, archived.independentBuilds);
		assert.deepEqual(run.profiles, archived.profiles);
		assert.deepEqual(run.controls, archived.controls);
		assert.deepEqual(run.artifacts, archived.artifacts);
		assert.equal(files.get(verificationPath).toString(), canonicalJson(archived));
		assert.equal(archivedRead("controls.json").toString(), canonicalJson(archived));
		expectedPaths.push(tapPath, verificationPath
			, ...records.map(path => prefix + path));
		archivedRuns.push(archived); checkedRuns.push(checked);
	}
	expectedPaths.push("toolchain.log");
	assert.ok(files.get("toolchain.log").length > 0);
	assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
	return {
		producerCommit: index.producerCommit, checkerCommit: index.checkerCommit
		, archiveCommit: index.archiveCommit, hostedRun: index.hostedRun
		, runtime: index.runtime, floor: index.floor, runs: checkedRuns
		, archivedRuns
		, files: index.files, selectedSources: index.selectedSources
		, limitations: index.limitations, installedProfiles: ["c", "cpp"]
		, hostedAcceptance: true, supportPromoted: false
	};
};
