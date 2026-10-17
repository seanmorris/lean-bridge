/**
 * Freeze the recursive checked-record WIT producer, verifier, tools, attempts and source closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { assertRecursiveCheckedRecordWitCiTap, recursiveCheckedRecordWitCiTestName } from "./recursive-checked-record-wit-ci-report.mjs";

export const recursiveCheckedRecordWitProducer
	= "ffcb1cfec301ab15b47a8fbc41dacfa4164f0c04";
// The independent checker ran at the frozen producer revision.
export const recursiveCheckedRecordWitVerifier = recursiveCheckedRecordWitProducer;
export const recursiveCheckedRecordWitEvidence
	= "docs/evidence/recursive-checked-record-wit-20261017";
export const recursiveCheckedRecordWitLoadCeiling = 8;
/** Serial producer order: modules outer, routes inner. */
export const recursiveCheckedRecordWitSelections = Object.freeze([
	["ordinary", "recursive"], ["reviewed", "recursive"]
	, ["ordinary", "mutual"], ["reviewed", "mutual"]
]);
/** The serial attempts that produced each accepted cell; earlier attempts refused. */
export const recursiveCheckedRecordWitAttempts = Object.freeze({
	"ordinary-recursive": "r2", "reviewed-recursive": "r2"
	, "ordinary-mutual": "r2", "reviewed-mutual": "r3"
});
/** Fail-closed resource refusals preserved as observations, never as acceptance. */
export const recursiveCheckedRecordWitRefusals = Object.freeze([
	Object.freeze({ attempt: "r1", label: "ordinary-recursive", error: "C# producer requires 2 GiB free disk" })
	, Object.freeze({ attempt: "r2", label: "reviewed-mutual", error: "C# producer host load remained at or above 8 for five minutes" })
]);
export const recursiveCheckedRecordWitTools = Object.freeze({
	cc: "/usr/bin/cc"
	, wasmTools: "/app/.toolchains/wasm-tools/bin/wasm-tools"
	, wasmtimeCapi: "/app/.toolchains/wasmtime42"
});
export const recursiveCheckedRecordWitRuntime = Object.freeze({
	platform: "linux", arch: "x64", glibc: "2.36"
});

const sources = new Map();

/**
 * Read one normalized repository path from a full immutable revision.
 *
 * @param revision - Full immutable Git commit.
 * @param path - Normalized repository-relative path.
 */
export const recursiveCheckedRecordWitOriginal = (revision, path) => {
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
		const source = recursiveCheckedRecordWitOriginal(revision, path).toString("utf8");
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
export const recursiveCheckedRecordWitEvidenceSources = () => {
	if(selectedSources) return selectedSources;
	const fixtures = ["recursive", "mutual"].flatMap(fixture => {
		const module = { recursive: "RecursiveCheckedRecords", mutual: "MutualCheckedRecords" }[fixture];
		const inputs = ["LICENSE", `${module}.lean`, "lakefile.toml", "lean-toolchain", "package.json"];
		return inputs.map(path => `tests/fixtures/onboarding/${fixture}-checked-records/${path}`);
	});
	const producer = [
		...closure(recursiveCheckedRecordWitProducer, [
			"tests/helpers/recursive-checked-record-wit-installed-tests.mjs"
			, "tests/helpers/recursive-checked-record-wit-generators.mjs"
			, "src/backends/wit/copied-graph-package.mjs"
			, "src/backends/wit/copied-graph-host.mjs"
			, "src/backends/wit/host-evidence.mjs"
			, "src/build/native-graph-sources.mjs"
		])
		, "src/analyze/NativeExports.lean"
		, "tests/fixtures/recursive-checked-record-consumers/wit-wasi.c"
		, ...fixtures, "package.json", "package-lock.json", "lean-toolchain"
	];
	const verifier = [
		...closure(recursiveCheckedRecordWitVerifier, [
			"tests/helpers/recursive-checked-record-wit-controls.mjs"
			, "tests/helpers/recursive-checked-record-wit-ci-report.mjs"
			, "tests/helpers/recursive-checked-record-wit-handoff.mjs"
			, "scripts/check-recursive-checked-record-wit-ci.mjs"
		])
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/recursive-checked-record-wit.yml"
		, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
		, "scripts/run-recursive-checked-record-wit-ci.sh"
	];
	selectedSources = Object.freeze([...new Set(producer)].sort().map(path => Object.freeze({
		role: "producer", revision: recursiveCheckedRecordWitProducer, path
	})).concat([...new Set(verifier)].sort().map(path => Object.freeze({
		role: "verifier", revision: recursiveCheckedRecordWitVerifier, path
	}))));
	return selectedSources;
};

/**
 * Require one accepted cell's complete original TAP stream; admission waits are diagnostics.
 *
 * @param source - Original producer output for one selection.
 * @param route - Ordinary or reviewed author route.
 * @param fixture - Recursive or mutual module.
 */
export const assertRecursiveCheckedRecordWitEvidenceTap = (source, route, fixture) => {
	assertRecursiveCheckedRecordWitCiTap(source, route, fixture);
	assert.deepEqual([...source.matchAll(/^# (.+ author [01]: .+)$/gmu)].map(match => match[1])
		, [0, 1].map(attempt => `${route} ${fixture} author ${attempt}: reproducible WIT package`));
	for(const match of source.matchAll(/^# Waiting for (.+)$/gmu))
		assert.match(match[1], /^host load below 8 before the next recursive WIT phase: [0-9]+(?:\.[0-9]+)?$/u);
};

/**
 * Require a preserved refusal to be exactly one failed selection with the recorded resource error.
 *
 * @param source - Original producer output for the refused selection.
 * @param refusal - Frozen attempt, selection and error.
 */
export const assertRecursiveCheckedRecordWitRefusalTap = (source, refusal) => {
	const [route, fixture] = refusal.label.split("-"), name = recursiveCheckedRecordWitCiTestName(route, fixture);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.deepEqual([...source.matchAll(/^not ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.doesNotMatch(source, /^ok /gmu);
	assert.deepEqual([...source.matchAll(/^ {2}error: '(.+)'$/gmu)].map(match => match[1]), [refusal.error]);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};
