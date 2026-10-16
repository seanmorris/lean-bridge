/**
 * Freeze the native PHP producer, verifier, tools, sources, and launch output.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	nestedCheckedRecordPhpGenerator
	, nestedCheckedRecordPhpOriginal
} from "./nested-checked-record-php-generators.mjs";

export { nestedCheckedRecordPhpOriginal };

export const nestedCheckedRecordPhpProducer
	= "933371c567f3296de2dac1dd2c9e77547708c7a2";
export const nestedCheckedRecordPhpVerifier
	= "0b7ecccfd6a987b6678b77873a1f99d3619a5f7e";
export const nestedCheckedRecordPhpEvidence
	= "docs/evidence/nested-checked-record-php-20261016";
export const nestedCheckedRecordPhpLoadCeiling = 20;
export const nestedCheckedRecordPhpSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
export const nestedCheckedRecordPhpTools = Object.freeze({
	php: "/usr/bin/php", composer: "/usr/bin/composer"
	, phpVersion: "8.2.33", composerVersion: "2.5.5"
});
export const nestedCheckedRecordPhpRuntime = Object.freeze({
	platform: "linux", arch: "x64", glibc: "2.36"
});

const closure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = nestedCheckedRecordPhpOriginal(revision, path).toString("utf8");
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
export const nestedCheckedRecordPhpEvidenceSources = async () => {
	if(selectedSources) return selectedSources;
	const fixture = ["LICENSE", "NestedCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"].map(path =>
		`tests/fixtures/onboarding/nested-checked-records/${path}`);
	const producer = [
		...closure(nestedCheckedRecordPhpProducer, [
			"tests/helpers/nested-checked-record-php-installed-tests.mjs"
		])
		, ...(await nestedCheckedRecordPhpGenerator(
			nestedCheckedRecordPhpProducer
		)).paths
		, ".github/workflows/nested-checked-record-php.yml"
		, "scripts/check-nested-checked-record-php-ci.mjs"
		, "scripts/run-nested-checked-record-php-ci.sh"
		, "tests/fixtures/nested-checked-record-consumers/php-native.php"
		, ...fixture
	];
	const verifier = closure(nestedCheckedRecordPhpVerifier, [
		"tests/helpers/nested-checked-record-php-controls.mjs"
		, "tests/helpers/nested-checked-record-php-ci-report.mjs"
	]);
	selectedSources = Object.freeze([
		...new Set(producer).values()
	].sort().map(path => Object.freeze({
		role: "producer", revision: nestedCheckedRecordPhpProducer, path
	})).concat([...new Set(verifier).values()].sort().map(path => Object.freeze({
		role: "verifier", revision: nestedCheckedRecordPhpVerifier, path
	}))));
	return selectedSources;
};

/**
 * Require the complete original four-cell serial TAP stream.
 *
 * @param source - Original producer standard output.
 */
export const assertNestedCheckedRecordPhpEvidenceTap = source => {
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	const names = nestedCheckedRecordPhpSelections.map(([route, mode]) =>
		`installed nested checked-record PHP packages reproduce and relocate ${route} ${mode}`);
	const successes = names.map((name, index) => [index + 1, name]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), names);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), successes);
	const diagnostics = nestedCheckedRecordPhpSelections.flatMap(([route, mode]) =>
		[0, 1].map(attempt => `${route} ${mode} author ${attempt}: reproducible nested checked-record Composer package`));
	assert.deepEqual([...source.matchAll(/^# (.+ author [01]: .+)$/gmu)]
		.map(match => match[1]), diagnostics);
	for(const [key, expected] of Object.entries({
		tests: 4, suites: 0, pass: 4, fail: 0
		, cancelled: 0, skipped: 0, todo: 0
	})) {
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key);
		assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)]
		.map(match => match[0]), ["1..4"]);
	assert.match(source, /\n1\.\.4\n# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};
