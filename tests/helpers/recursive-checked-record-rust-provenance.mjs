/**
 * Freeze the recursive checked-record Rust producer, verifier and source closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { recursiveCheckedRecordRustGenerator } from "./recursive-checked-record-rust-generators.mjs";

export const recursiveCheckedRecordRustProducer
	= "1f3664ccd4b9d102ab0222061853ac90c72e0985";
export const recursiveCheckedRecordRustVerifier
	= "1f3664ccd4b9d102ab0222061853ac90c72e0985";
export const recursiveCheckedRecordRustEvidence
	= "docs/evidence/recursive-checked-record-rust-20261017";
export const recursiveCheckedRecordRustEvidenceLoadCeiling = 8;
export const recursiveCheckedRecordRustEvidenceFloor = "2.36";
export const recursiveCheckedRecordRustEvidenceRuntime = Object.freeze({
	platform: "linux", arch: "x64", glibc: "2.36"
});
export const recursiveCheckedRecordRustEvidenceToolchain = Object.freeze({
	cargo: Object.freeze({
		command: "/app/.toolchains/rust-1.90.0/bin/cargo"
		, bytes: 41_437_528
		, sha256: "51de284e8bb0d03dcee595a0fb1cb3a952fe9e7e4b953a8b1467b7f71725b561"
		, run: Object.freeze({
			code: 0, stderr: ""
			, stdout: "cargo 1.90.0 (840b83a10 2025-07-30)\n"
		})
	})
	, rustc: Object.freeze({
		command: "/app/.toolchains/rust-1.90.0/bin/rustc"
		, bytes: 656_496
		, sha256: "e6abf55ab1859e7c990be77fd593f51661ea99fb2fde626ae9f4108aaa34e7fa"
		, run: Object.freeze({
			code: 0, stderr: ""
			, stdout: "rustc 1.90.0 (1159e78c4 2025-09-14)\n"
		})
	})
});
export const recursiveCheckedRecordRustSelections = Object.freeze([
	["ordinary", "recursive"], ["ordinary", "mutual"]
	, ["reviewed", "recursive"], ["reviewed", "mutual"]
]);

const sources = new Map();

/**
 * Read one normalized repository path from a full immutable revision.
 *
 * @param revision - Full immutable Git commit.
 * @param path - Normalized repository-relative path.
 */
export const recursiveCheckedRecordRustEvidenceOriginal = (revision, path) => {
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
		const source = recursiveCheckedRecordRustEvidenceOriginal(revision, path)
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
export const recursiveCheckedRecordRustEvidenceSources = async () => {
	if(selectedSources) return selectedSources;
	const fixture = [
		...["LICENSE", "RecursiveCheckedRecords.lean", "lakefile.toml"
			, "lean-toolchain", "package.json"].map(path =>
			`tests/fixtures/onboarding/recursive-checked-records/${path}`)
		, ...["LICENSE", "MutualCheckedRecords.lean", "lakefile.toml"
			, "lean-toolchain", "package.json"].map(path =>
			`tests/fixtures/onboarding/mutual-checked-records/${path}`)
	];
	const producer = new Set([
		...closure(recursiveCheckedRecordRustProducer, [
			"tests/helpers/recursive-checked-record-rust-installed-tests.mjs"
		])
		, ...(await recursiveCheckedRecordRustGenerator(
			recursiveCheckedRecordRustProducer
		)).paths
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/recursive-checked-record-rust.yml"
		, "scripts/bootstrap-rust-ci.sh", "scripts/bootstrap-toolchains.sh"
		, "scripts/env.sh", "scripts/check-recursive-checked-record-rust-ci.mjs"
		, "scripts/run-recursive-checked-record-rust-ci.sh"
		, "tests/fixtures/recursive-checked-record-consumers/rust.rs"
		, ...fixture, "package.json", "package-lock.json", "lean-toolchain"
	]);
	const verifier = new Set(closure(recursiveCheckedRecordRustVerifier, [
		"tests/helpers/recursive-checked-record-rust-controls.mjs"
		, "tests/helpers/recursive-checked-record-rust-ci-report.mjs"
	]));
	const shared = [...producer].filter(path => verifier.has(path));
	const record = (role, revision, path) => Object.freeze({ role, revision, path });
	selectedSources = Object.freeze([
		...[...producer].filter(path => !verifier.has(path)).sort()
			.map(path => record("producer", recursiveCheckedRecordRustProducer, path))
		, ...[...verifier].filter(path => !producer.has(path)).sort()
			.map(path => record("verifier", recursiveCheckedRecordRustVerifier, path))
		, ...shared.sort()
			.map(path => record("shared", recursiveCheckedRecordRustProducer, path))
	]);
	return selectedSources;
};
