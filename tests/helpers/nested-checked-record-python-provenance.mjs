/**
 * Freeze the nested checked-record Python producer, verifier, interpreters, and source closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { nominalSubtypePythonGenerator } from "./nominal-subtype-python-generators.mjs";

export const nestedCheckedRecordPythonProducer
	= "c9ae6614a20f4d1b1cc3ba9a45d9ca45da9cd1ab";
export const nestedCheckedRecordPythonVerifier
	= "127a02cf98632210c6cac6cafee12ee5fdb380fd";
export const nestedCheckedRecordPythonEvidence
	= "docs/evidence/nested-checked-record-python-20261016";
export const nestedCheckedRecordPythonLoadCeiling = 20;
export const nestedCheckedRecordPythonSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
export const nestedCheckedRecordPythonInterpreters = Object.freeze([
	Object.freeze({
		minor: "3.11", binary: "/app/.toolchains/python311/bin/python3.11"
		, python: "3.11.16"
		, sha256: "22e747b1e8a04719d4af2094133a0479b33728d2e4d03ab01539064dc6f45cfb"
	})
	, Object.freeze({
		minor: "3.12", binary: "/app/.toolchains/python312/bin/python3.12"
		, python: "3.12.14"
		, sha256: "4dbf3143240288fb2170257ffaa7bd030cdda5d2703d1f5f30b627042267e2e3"
	})
]);
export const nestedCheckedRecordPythonRuntime = Object.freeze({
	platform: "linux", arch: "x64", glibc: "2.36"
});

const sources = new Map();

/**
 * Read one normalized repository path from a full immutable revision.
 *
 * @param revision - Full immutable Git commit.
 * @param path - Normalized repository-relative path.
 */
export const nestedCheckedRecordPythonOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path)
		&& !path.startsWith("/") && posix.normalize(path) === path
		&& path.split("/").every(part => part && part !== "." && part !== ".."), path);
	const key = `${revision}:${path}`;
	if(!sources.has(key))
		sources.set(key, execFileSync("git", ["show", key], { maxBuffer: 64 * 1024 * 1024 }));
	return Buffer.from(sources.get(key));
};

const closure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = nestedCheckedRecordPythonOriginal(revision, path).toString("utf8");
		files.add(path);
		if(!path.endsWith(".mjs")) return;
		for(const specifier of moduleSpecifiers(source, path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...files];
};

let selectedSources;

/** Reconstruct every static producer/verifier module and generator input. */
export const nestedCheckedRecordPythonEvidenceSources = async () => {
	if(selectedSources) return selectedSources;
	const fixture = ["LICENSE", "NestedCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"].map(path =>
		`tests/fixtures/onboarding/nested-checked-records/${path}`);
	const producer = [
		...closure(nestedCheckedRecordPythonProducer, [
			"tests/helpers/nested-checked-record-python-installed-tests.mjs"
		])
		, ...(await nominalSubtypePythonGenerator(nestedCheckedRecordPythonProducer)).paths
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/nested-checked-record-python.yml"
		, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
		, "scripts/check-nested-checked-record-python-ci.mjs"
		, "scripts/run-nested-checked-record-python-ci.sh"
		, "tests/fixtures/nested-checked-record-consumers/python.py"
		, ...fixture, "package.json", "package-lock.json", "lean-toolchain"
	];
	const verifier = closure(nestedCheckedRecordPythonVerifier, [
		"tests/helpers/nested-checked-record-python-controls.mjs"
		, "tests/helpers/nested-checked-record-python-ci-report.mjs"
	]);
	selectedSources = Object.freeze([
		...new Set(producer).values()
	].sort().map(path => Object.freeze({
		role: "producer", revision: nestedCheckedRecordPythonProducer, path
	})).concat([...new Set(verifier).values()].sort().map(path => Object.freeze({
		role: "verifier", revision: nestedCheckedRecordPythonVerifier, path
	}))));
	return selectedSources;
};

/**
 * Require the complete original four-cell serial TAP stream.
 *
 * @param source - Original producer standard output.
 */
export const assertNestedCheckedRecordPythonEvidenceTap = source => {
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	const names = nestedCheckedRecordPythonSelections.map(([route, mode]) =>
		`installed nested checked-record Python packages reproduce and relocate ${route} ${mode}`);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), names);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), names.map((name, index) => [index + 1, name]));
	const authors = nestedCheckedRecordPythonSelections.flatMap(([route, mode]) =>
		[0, 1].map(attempt => `${route} ${mode} author ${attempt}: one wheel for Python 3.11 and 3.12`));
	assert.deepEqual([...source.matchAll(/^# (.+ author [01]: .+)$/gmu)]
		.map(match => match[1]), authors);
	const installs = nestedCheckedRecordPythonSelections.flatMap(([route, mode]) =>
		["3.11", "3.12"].map(minor => `Installing ${route}/${mode} on Python ${minor}`));
	assert.deepEqual([...source.matchAll(/^# (Installing .+)$/gmu)]
		.map(match => match[1]), installs);
	for(const [key, expected] of Object.entries({
		tests: 4, suites: 0, pass: 4, fail: 0
		, cancelled: 0, skipped: 0, todo: 0
	})) {
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..4"]);
	assert.match(source, /\n1\.\.4\n# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};
