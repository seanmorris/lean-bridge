/**
 * Freeze the recursive checked-record Ruby producer, verifier, interpreter and source closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

export const recursiveCheckedRecordRubyProducer
	= "908bfa29b72e059f13e73a9db832da4b84276641";
export const recursiveCheckedRecordRubyVerifier
	= "5f00009d4b1d68adede0eb6c974ea294c2909f21";
export const recursiveCheckedRecordRubyEvidence
	= "docs/evidence/recursive-checked-record-ruby-20261016";
export const recursiveCheckedRecordRubyLoadCeiling = 8;
export const recursiveCheckedRecordRubySelections = Object.freeze([
	["ordinary", "recursive"], ["ordinary", "mutual"]
	, ["reviewed", "recursive"], ["reviewed", "mutual"]
]);
export const recursiveCheckedRecordRubyInterpreter = Object.freeze({
	command: "/app/.toolchains/ruby33/bin/ruby", version: "3.3.12"
	, sha256: "28eea9e1f4c7eef2f6812b0535409dce29f71ca86bbbddeccb6df6d3279bf6bb"
});
export const recursiveCheckedRecordRubyRuntime = Object.freeze({
	platform: "linux", arch: "x64", glibc: "2.36"
});

const sources = new Map();

/**
 * Read one normalized repository path from a full immutable revision.
 *
 * @param revision - Full immutable Git commit.
 * @param path - Normalized repository-relative path.
 */
export const recursiveCheckedRecordRubyOriginal = (revision, path) => {
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
		const source = recursiveCheckedRecordRubyOriginal(revision, path).toString("utf8");
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

/** Reconstruct every static producer and verifier module and generator input. */
export const recursiveCheckedRecordRubyEvidenceSources = () => {
	if(selectedSources) return selectedSources;
	const fixtures = ["recursive", "mutual"].flatMap(fixture => {
		const module = { recursive: "RecursiveCheckedRecords", mutual: "MutualCheckedRecords" }[fixture];
		const inputs = [
			"LICENSE", `${module}.lean`, "lakefile.toml", "lean-toolchain"
			, "package.json"
		];
		return inputs.map(path => `tests/fixtures/onboarding/${fixture}-checked-records/${path}`);
	});
	const producer = [
		...closure(recursiveCheckedRecordRubyProducer, [
			"tests/helpers/recursive-checked-record-ruby-installed-tests.mjs"
		])
		, "src/analyze/NativeExports.lean"
		, "tests/fixtures/recursive-checked-record-consumers/ruby.rb"
		, ...fixtures, "package.json", "package-lock.json", "lean-toolchain"
	];
	const verifier = [
		...closure(recursiveCheckedRecordRubyVerifier, [
			"tests/helpers/recursive-checked-record-ruby-controls.mjs"
			, "tests/helpers/recursive-checked-record-ruby-ci-report.mjs"
		])
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/recursive-checked-record-ruby.yml"
		, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
		, "scripts/check-recursive-checked-record-ruby-ci.mjs"
		, "scripts/run-recursive-checked-record-ruby-ci.sh"
	];
	selectedSources = Object.freeze([...new Set(producer)].sort().map(path => Object.freeze({
		role: "producer", revision: recursiveCheckedRecordRubyProducer, path
	})).concat([...new Set(verifier)].sort().map(path => Object.freeze({
		role: "verifier", revision: recursiveCheckedRecordRubyVerifier, path
	}))));
	return selectedSources;
};

/**
 * Require the complete original four-selection serial TAP stream.
 *
 * @param source - Original producer standard output, without the runner's exit line.
 */
export const assertRecursiveCheckedRecordRubyEvidenceTap = source => {
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	const names = recursiveCheckedRecordRubySelections.map(([route, fixture]) =>
		`installed recursive checked-record Ruby packages reproduce and relocate ${route} ${fixture}`);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), names);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), names.map((name, index) => [index + 1, name]));
	const authors = recursiveCheckedRecordRubySelections.flatMap(([route, fixture]) =>
		[0, 1].map(attempt => `${route} ${fixture} author ${attempt}: reproducible Ruby gem`));
	assert.deepEqual([...source.matchAll(/^# (.+ author [01]: .+)$/gmu)].map(match => match[1]), authors);
	// Admission waits are recorded diagnostics, not results.
	for(const match of source.matchAll(/^# Waiting for (.+)$/gmu))
		assert.match(match[1], /^host load below 8 before the next recursive Ruby phase: [0-9]+(?:\.[0-9]+)?$/u);
	const totals = { tests: 4, suites: 0, pass: 4, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
	for(const [key, expected] of Object.entries(totals))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..4"]);
	assert.match(source, /\n1\.\.4\n# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};
