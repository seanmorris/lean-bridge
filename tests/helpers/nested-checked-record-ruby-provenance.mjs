/**
 * Freeze the nested checked-record Ruby producer, verifier, interpreter, and sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { nominalSubtypeRubyGenerator as nestedCheckedRecordRubyGenerator } from "./nominal-subtype-ruby-generators.mjs";

export const nestedCheckedRecordRubyProducer
	= "6d0c683e2da19cd6216384ff588294951af216db";
export const nestedCheckedRecordRubyVerifier
	= "f3fbb05652bf05c08060de32f48f92970552d460";
export const nestedCheckedRecordRubyEvidence
	= "docs/evidence/nested-checked-record-ruby-20261016";
export const nestedCheckedRecordRubyLoadCeiling = 20;
export const nestedCheckedRecordRubySelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
export const nestedCheckedRecordRubyInterpreter = Object.freeze({
	binary: "/app/.toolchains/ruby33/bin/ruby"
	, version: "3.3.12"
	, sha256: "28eea9e1f4c7eef2f6812b0535409dce29f71ca86bbbddeccb6df6d3279bf6bb"
});
export const nestedCheckedRecordRubyRuntime = Object.freeze({
	platform: "linux", arch: "x64", glibc: "2.36"
});

const sources = new Map();

/**
 * Read one normalized repository path from a full immutable revision.
 *
 * @param revision - Full immutable Git commit.
 * @param path - Normalized repository-relative path.
 */
export const nestedCheckedRecordRubyOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path)
		&& !path.startsWith("/") && posix.normalize(path) === path
		&& path.split("/").every(part => part && part !== "." && part !== "..")
	, path);
	const key = `${revision}:${path}`;
	if(!sources.has(key)) sources.set(key, execFileSync(
		"git", ["show", key], { maxBuffer: 64 * 1024 * 1024 }
	));
	return Buffer.from(sources.get(key));
};

const closure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = nestedCheckedRecordRubyOriginal(revision, path)
			.toString("utf8");
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
export const nestedCheckedRecordRubyEvidenceSources = async () => {
	if(selectedSources) return selectedSources;
	const fixture = ["LICENSE", "NestedCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"].map(path =>
		`tests/fixtures/onboarding/nested-checked-records/${path}`);
	const producer = [
		...closure(nestedCheckedRecordRubyProducer, [
			"tests/helpers/nested-checked-record-ruby-installed-tests.mjs"
		])
		, ...(await nestedCheckedRecordRubyGenerator(
			nestedCheckedRecordRubyProducer
		)).paths
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/nested-checked-record-ruby.yml"
		, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
		, "scripts/check-nested-checked-record-ruby-ci.mjs"
		, "scripts/run-nested-checked-record-ruby-ci.sh"
		, "tests/fixtures/nested-checked-record-consumers/ruby.rb"
		, ...fixture, "package.json", "package-lock.json", "lean-toolchain"
	];
	const verifier = closure(nestedCheckedRecordRubyVerifier, [
		"tests/helpers/nested-checked-record-ruby-controls.mjs"
		, "tests/helpers/nested-checked-record-ruby-ci-report.mjs"
	]);
	selectedSources = Object.freeze([
		...new Set(producer).values()
	].sort().map(path => Object.freeze({
		role: "producer", revision: nestedCheckedRecordRubyProducer, path
	})).concat([...new Set(verifier).values()].sort().map(path => Object.freeze({
		role: "verifier", revision: nestedCheckedRecordRubyVerifier, path
	}))));
	return selectedSources;
};

/**
 * Require the complete original four-cell serial TAP stream.
 *
 * @param source - Original producer standard output.
 */
export const assertNestedCheckedRecordRubyEvidenceTap = source => {
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	const names = nestedCheckedRecordRubySelections.map(([route, mode]) =>
		`installed nested checked-record Ruby packages reproduce and relocate ${route} ${mode}`);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), names);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]])
	, names.map((name, index) => [index + 1, name]));
	const authors = nestedCheckedRecordRubySelections.flatMap(([route, mode]) =>
		[0, 1].map(attempt =>
			`${route} ${mode} author ${attempt}: reproducible Ruby gem`));
	assert.deepEqual([...source.matchAll(/^# (.+ author [01]: .+)$/gmu)]
		.map(match => match[1]), authors);
	for(const [key, expected] of Object.entries({
		tests: 4, suites: 0, pass: 4, fail: 0
		, cancelled: 0, skipped: 0, todo: 0
	})) {
		const matches = [...source.matchAll(
			new RegExp(`^# ${key} (\\d+)$`, "gmu")
		)];
		assert.equal(matches.length, 1, key);
		assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)]
		.map(match => match[0]), ["1..4"]);
	assert.match(source, /\n1\.\.4\n# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};
