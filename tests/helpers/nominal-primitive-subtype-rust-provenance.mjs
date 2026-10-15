/**
 * Frozen local provenance for primitive-base nominal Rust acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import { nominalPrimitiveSubtypeRustGenerator } from "./nominal-primitive-subtype-rust-generators.mjs";

export const nominalPrimitiveSubtypeRustProducer = "dee41df18abca029ede0b66fc6ef0f4d0c31cc16";
export const nominalPrimitiveSubtypeRustInterruptedProducer = "ba2f62b89078b5eca495b0bf7d66ed1e723e5d67";
export const nominalPrimitiveSubtypeRustLoadCeiling = 8;
export const nominalPrimitiveSubtypeRustEvidence = "docs/evidence/nominal-primitive-subtype-rust-20261015";
export const nominalPrimitiveSubtypeRustWorktree = "/app/build/worktrees/nominal-primitive-rust-installed-vo1491";
export const nominalPrimitiveSubtypeRustSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
export const nominalPrimitiveSubtypeRustAcceptedLaunches = Object.freeze([
	{ route: "ordinary", mode: "full", attempt: "r2" }
	, { route: "ordinary", mode: "result-only", attempt: "r1" }
	, { route: "reviewed", mode: "full", attempt: "r1" }
	, { route: "reviewed", mode: "result-only", attempt: "r1" }
]);
export const nominalPrimitiveSubtypeRustPreservedLaunches = Object.freeze([
	{ route: "ordinary", mode: "full", attempt: "r1", producerCommit: nominalPrimitiveSubtypeRustInterruptedProducer }
]);

const validPath = path => typeof path === "string" && /^[A-Za-z0-9_.+/-]+$/u.test(path)
	&& !path.startsWith("/") && posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const originals = new Map();

/**
 * Read one immutable repository file at an exact revision.
 *
 * @param revision - Full immutable commit.
 * @param path - Normalized repository-relative file.
 */
export const nominalPrimitiveSubtypeRustOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u); assert.ok(validPath(path), path);
	const key = `${revision}:${path}`;
	if(!originals.has(key)) originals.set(key, execFileSync("git", ["show", key], { maxBuffer: 64 * 1024 * 1024 }));
	return Buffer.from(originals.get(key));
};

const closureEntries = Object.freeze([
	"scripts/check-nominal-primitive-subtype-rust-ci.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-controls.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-installed-tests.mjs"
]);
const extraSources = Object.freeze([
	".github/workflows/nominal-primitive-subtype-rust.yml"
	, "scripts/run-nominal-primitive-subtype-rust-ci.sh"
	, "tests/fixtures/nominal-primitive-subtype-consumers/rust.rs"
	, ...["LICENSE", "NominalPrimitiveSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/nominal-primitive-subtypes/${path}`)
]);

const historicalClosure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		assert.ok(validPath(path), path); if(files.has(path)) return;
		const source = nominalPrimitiveSubtypeRustOriginal(revision, path).toString("utf8"); files.add(path);
		for(const specifier of moduleSpecifiers(source, path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...files].sort();
};

let selectedSources;

/**
 * Reconstruct the producer modules, dynamic fixture inputs and Rust generator closure.
 */
export const nominalPrimitiveSubtypeRustEvidenceSources = async () => selectedSources ??= Object.freeze([
	...new Set([
		...historicalClosure(nominalPrimitiveSubtypeRustProducer, closureEntries)
		, ...(await nominalPrimitiveSubtypeRustGenerator(nominalPrimitiveSubtypeRustProducer)).paths
		, ...extraSources
	])
].sort());

/**
 * Resolve one accepted run's original local records and logs.
 *
 * @param launch - Frozen source route, API mode and attempt.
 */
export const nominalPrimitiveSubtypeRustLaunchPaths = launch => {
	assert.ok(nominalPrimitiveSubtypeRustAcceptedLaunches.some(item => item.route === launch.route && item.mode === launch.mode && item.attempt === launch.attempt));
	const slug = `${launch.route}-${launch.mode}-${launch.attempt}`;
	return Object.freeze({
		records: `/app/build/vo1491-rust-installed-${slug}-records/${launch.route}/${launch.mode}`
		, tap: `/app/build/vo1491-rust-installed-${slug}.tap`
		, verification: `/app/build/vo1491-rust-installed-${slug}-verification.json`
	});
};

export const nominalPrimitiveSubtypeRustInterruptedPaths = Object.freeze({
	records: "/app/build/vo1491-rust-installed-ordinary-full-r1-records/ordinary/full"
	, tap: "/app/build/vo1491-rust-installed-ordinary-full-r1.tap"
});
