/**
 * Fixed hosted identities and frozen producer, checker and archiver source closures for
 * inherited checked-record C/C++ evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

export const inheritedCheckedRecordNativeEvidence
	= "docs/evidence/inherited-checked-record-native-20261017";
/** Exact revision whose hosted run produced every archived record. */
export const inheritedCheckedRecordNativeProducer
	= "a1b07e11c3c05f4efb5d2facf5f0d98efe2baa33";
/** The hosted runner checked each selection with the producer revision's own checker. */
export const inheritedCheckedRecordNativeChecker = inheritedCheckedRecordNativeProducer;
/** Clean tooling revision that generated the archive; null until the evidence is pinned. */
export const inheritedCheckedRecordNativeArchiver
	= "decb369936acc758557534d3471d9c8eab96b027";
/** The green hosted run that carried the original records. */
export const inheritedCheckedRecordNativeRunId = 39069688253;
/** The hosted run and artifact that carried the original records. */
export const inheritedCheckedRecordNativeHostedRun = Object.freeze({
	repository: "seanmorris/lean-bridge", runId: inheritedCheckedRecordNativeRunId
	, workflow: ".github/workflows/inherited-checked-record-native.yml"
	, artifact: `inherited-checked-record-native-${inheritedCheckedRecordNativeProducer}`
	, root: "inherited-checked-record-native-ci"
});
/** The hosted runner's own platform facts, as its checker observed them. */
export const inheritedCheckedRecordNativeHostedRuntime = Object.freeze({
	platform: "linux", arch: "x64", glibc: "2.39"
});
export const inheritedCheckedRecordNativeFloor = "2.38";
export const inheritedCheckedRecordNativeMaxLoad = 12;
/** Hosted runner order from run-inherited-checked-record-native-ci.sh: modes outer, routes inner. */
export const inheritedCheckedRecordNativeSelections = Object.freeze([
	Object.freeze({ route: "ordinary", mode: "full" })
	, Object.freeze({ route: "reviewed", mode: "full" })
	, Object.freeze({ route: "ordinary", mode: "result-only" })
	, Object.freeze({ route: "reviewed", mode: "result-only" })
]);

/**
 * Require every frozen revision, including the archiver, before evidence is authenticated.
 */
export const inheritedCheckedRecordNativePinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordNativeProducer
		, checker: inheritedCheckedRecordNativeChecker
		, archiver: inheritedCheckedRecordNativeArchiver
	};
	for(const revision of Object.values(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, "Pin the inherited native producer, checker and archiver revisions first");
	return revisions;
};

const originals = new Map();
const allowedRoots = [".github/", "config/", "poc/", "scripts/", "site/", "src/", "tests/"];
const allowedFiles = new Set(["LICENSE", "lean-toolchain", "package-lock.json", "package.json"]);

/**
 * Read one exact Git blob from a frozen revision, never the current worktree.
 *
 * @param revision - Full immutable Git revision.
 * @param path - Normalized repository-relative source path.
 */
export const inheritedCheckedRecordNativeOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.equal(posix.normalize(path), path);
	assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
	assert.ok(allowedFiles.has(path) || allowedRoots.some(root => path.startsWith(root)), path);
	const key = `${revision}:${path}`;
	if(!originals.has(key)) originals.set(key, execFileSync("git", ["cat-file", "blob", key]
		, { maxBuffer: 64 * 1024 ** 2 }));
	return Buffer.from(originals.get(key));
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = inheritedCheckedRecordNativeOriginal(revision, path);
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
	"LICENSE"
	, "poc/lean-link-spike/bindings/alpha.binding-ir.json"
	, "poc/lean-link-spike/graph-lock.json"
	, "src/analyze/NativeExports.lean"
	, "src/backends/c/gmp.source.tar.xz"
	, "src/backends/cpp/boost.source.json"
	, ...["InheritedCheckedRecords.lean", "LICENSE", "lakefile.toml", "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/inherited-checked-records/${path}`)
	, ...["c.c", "cpp.cpp"]
		.map(path => `tests/fixtures/inherited-checked-record-consumers/${path}`)
	, ".github/workflows/inherited-checked-record-native.yml"
	, "scripts/run-inherited-checked-record-native-ci.sh"
	, "lean-toolchain", "package-lock.json", "package.json"
]);

/**
 * Select every frozen source whose bytes explain the hosted artifact and its archive.
 *
 * @param revisions - Independent producer, checker and archiver revisions.
 */
export const inheritedCheckedRecordNativeEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), ["archiver", "checker", "producer"]);
	for(const revision of Object.values(revisions)) assert.match(revision, /^[a-f0-9]{40}$/u);
	const roles = [
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer
					, ["tests/helpers/inherited-checked-record-native-installed-tests.mjs"])
				, ...producerData
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: closure(revisions.checker, ["scripts/check-inherited-checked-record-native-ci.mjs"])
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-inherited-checked-record-native-evidence.mjs"
				, "tests/helpers/inherited-checked-record-native-archive-tests.mjs"
				, "tests/inherited-checked-record-native.test.mjs"
			])
		}
	];
	return Object.freeze(roles.flatMap(({ role, revision, paths }) =>
		[...new Set(paths)].sort().map(path => Object.freeze({ role, revision, path }))));
};
