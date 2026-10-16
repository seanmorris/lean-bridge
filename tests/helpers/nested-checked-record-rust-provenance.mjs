/**
 * Freeze the nested checked-record Rust producer, verifier and source closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { nestedCheckedRecordRustGenerator } from "./nested-checked-record-rust-generators.mjs";

export const nestedCheckedRecordRustProducer
	= "da01260bc9655c7016bc8f0f7211a448136ab2cf";
export const nestedCheckedRecordRustVerifier
	= "da01260bc9655c7016bc8f0f7211a448136ab2cf";
export const nestedCheckedRecordRustEvidence
	= "docs/evidence/nested-checked-record-rust-20261016";
export const nestedCheckedRecordRustEvidenceLoadCeiling = 20;
export const nestedCheckedRecordRustEvidenceFloor = "2.36";
export const nestedCheckedRecordRustEvidenceRuntime = Object.freeze({
	platform: "linux", arch: "x64", glibc: "2.36"
});
export const nestedCheckedRecordRustSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);

const sources = new Map();

/**
 * Read one normalized repository path from a full immutable revision.
 *
 * @param revision - Full immutable Git commit.
 * @param path - Normalized repository-relative path.
 */
export const nestedCheckedRecordRustEvidenceOriginal = (revision, path) => {
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
		const source = nestedCheckedRecordRustEvidenceOriginal(revision, path)
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

/** Reconstruct every static producer/verifier module and dynamic generator input. */
export const nestedCheckedRecordRustEvidenceSources = async () => {
	if(selectedSources) return selectedSources;
	const fixture = ["LICENSE", "NestedCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"].map(path =>
		`tests/fixtures/onboarding/nested-checked-records/${path}`);
	const producer = new Set([
		...closure(nestedCheckedRecordRustProducer, [
			"tests/helpers/nested-checked-record-rust-installed-tests.mjs"
		])
		, ...(await nestedCheckedRecordRustGenerator(
			nestedCheckedRecordRustProducer
		)).paths
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/nested-checked-record-rust.yml"
		, "scripts/bootstrap-rust-ci.sh", "scripts/bootstrap-toolchains.sh"
		, "scripts/env.sh", "scripts/check-nested-checked-record-rust-ci.mjs"
		, "scripts/run-nested-checked-record-rust-ci.sh"
		, "tests/fixtures/nested-checked-record-consumers/rust.rs"
		, ...fixture, "package.json", "package-lock.json", "lean-toolchain"
	]);
	const verifier = new Set(closure(nestedCheckedRecordRustVerifier, [
		"tests/helpers/nested-checked-record-rust-controls.mjs"
		, "tests/helpers/nested-checked-record-rust-ci-report.mjs"
	]));
	const shared = [...producer].filter(path => verifier.has(path));
	const record = (role, revision, path) => Object.freeze({ role, revision, path });
	selectedSources = Object.freeze([
		...[...producer].filter(path => !verifier.has(path)).sort()
			.map(path => record("producer", nestedCheckedRecordRustProducer, path))
		, ...[...verifier].filter(path => !producer.has(path)).sort()
			.map(path => record("verifier", nestedCheckedRecordRustVerifier, path))
		, ...shared.sort()
			.map(path => record("shared", nestedCheckedRecordRustProducer, path))
	]);
	return selectedSources;
};
