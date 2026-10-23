/**
 * Reconstruct the exact source closure behind one hosted callback
 * checked-record artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

const sourceCache = new Map();

/**
 * Read a tracked path exactly as it existed at one revision.
 *
 * @param revision - Full Git commit identity.
 * @param path - Repository-relative tracked path.
 */
const original = (revision, path) => {
	const key = `${revision}:${path}`;
	if(!sourceCache.has(key)) sourceCache.set(key, execFileSync(
		"git", ["show", key], { maxBuffer: 256 * 1024 ** 2 }
	));
	return sourceCache.get(key);
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = original(revision, path);
		paths.add(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths];
};

const fixture = [
	"CallbackCheckedRecords.lean", "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
].map(path => `tests/fixtures/onboarding/callback-checked-records/${path}`);
const consumer = path => `tests/fixtures/callback-checked-record-consumers/${path}`;
const common = [
	...fixture, "src/analyze/NativeExports.lean", "lean-toolchain"
	, "package-lock.json", "package.json"
];

const lanes = Object.freeze({
	browser: {
		test: "tests/callback-checked-record-npm-browser.test.mjs"
		, checker: "scripts/check-callback-checked-record-browser-ci.mjs"
		, run: "scripts/run-callback-checked-record-browser-ci.sh"
		, workflow: ".github/workflows/callback-checked-record-browser.yml"
		, consumers: [consumer("javascript.mjs"), consumer("types.mts")]
	}
	, native: {
		test: "tests/callback-checked-record-native-installed.test.mjs"
		, checker: "scripts/check-callback-checked-record-native-ci.mjs"
		, run: "scripts/run-callback-checked-record-native-ci.sh"
		, workflow: ".github/workflows/callback-checked-record-native.yml"
		, consumers: [consumer("c.c"), consumer("cpp.cpp")]
	}
	, languages: {
		test: "tests/callback-checked-record-language-installed.test.mjs"
		, checker: "scripts/check-callback-checked-record-languages-ci.mjs"
		, run: "scripts/run-callback-checked-record-languages-ci.sh"
		, workflow: ".github/workflows/callback-checked-record-languages.yml"
		, consumers: [consumer("python.py"), consumer("ruby.rb")
			, consumer("rust.rs")]
	}
	, perl: {
		test: "tests/callback-checked-record-perl-installed.test.mjs"
		, checker: "scripts/check-callback-checked-record-perl-ci.mjs"
		, run: "scripts/run-callback-checked-record-perl-ci.sh"
		, workflow: ".github/workflows/callback-checked-record-perl.yml"
		, consumers: [consumer("perl.pl")]
	}
	, dotnet: {
		test: "tests/callback-checked-record-remaining-installed.test.mjs"
		, checker: "scripts/check-callback-checked-record-remaining-ci.mjs"
		, run: "scripts/run-callback-checked-record-remaining-ci.sh"
		, workflow: ".github/workflows/callback-checked-record-remaining.yml"
		, consumers: [consumer("dotnet.cs")]
	}
	, jvm: {
		test: "tests/callback-checked-record-remaining-installed.test.mjs"
		, checker: "scripts/check-callback-checked-record-remaining-ci.mjs"
		, run: "scripts/run-callback-checked-record-remaining-ci.sh"
		, workflow: ".github/workflows/callback-checked-record-remaining.yml"
		, consumers: [consumer("java.java"), consumer("kotlin.kt")]
	}
	, "php-native": {
		test: "tests/callback-checked-record-remaining-installed.test.mjs"
		, checker: "scripts/check-callback-checked-record-remaining-ci.mjs"
		, run: "scripts/run-callback-checked-record-remaining-ci.sh"
		, workflow: ".github/workflows/callback-checked-record-remaining.yml"
		, consumers: [consumer("php-native.php")]
	}
	, "wit-wasi": {
		test: "tests/callback-checked-record-remaining-installed.test.mjs"
		, checker: "scripts/check-callback-checked-record-remaining-ci.mjs"
		, run: "scripts/run-callback-checked-record-remaining-ci.sh"
		, workflow: ".github/workflows/callback-checked-record-remaining.yml"
		, consumers: [consumer("wit-wasi.c")]
	}
});

const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/** Read one exact tracked file from a selected revision. */
export const callbackCheckedRecordHostedOriginal = original;

/** Known hosted callback checked-record archive lane names. */
export const callbackCheckedRecordHostedLanes
	= Object.freeze(Object.keys(lanes));

/**
 * Immutable archive root for the retained-package callback acceptance rerun.
 *
 * @param lane - Closed hosted lane name.
 */
export const callbackCheckedRecordHostedEvidenceRoot = lane => {
	assert.ok(callbackCheckedRecordHostedLanes.includes(lane));
	return `docs/evidence/callback-checked-record-${lane}-20261023`;
};

/**
 * Keep hosted execution and independent archive replay revisions distinct.
 *
 * @param producer - Hosted producer and consumer commit.
 * @param archiver - Current independent checker and archiver commit.
 */
export const callbackCheckedRecordArchiveRevisions = (producer, archiver) => {
	assert.match(producer, /^[a-f0-9]{40}$/u);
	assert.match(archiver, /^[a-f0-9]{40}$/u);
	return Object.freeze({
		producer, consumer: producer, checker: archiver, archiver
	});
};

/**
 * Map replay roles to the public commit fields written into an archive index.
 *
 * @param value - Producer/consumer/checker/archiver revisions.
 */
export const callbackCheckedRecordArchiveIndexCommits = value => {
	assert.deepEqual(Object.keys(value).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(value))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return Object.freeze({
		producerCommit: value.producer
		, consumerCommit: value.consumer
		, checkerCommit: value.checker
		, archiveCommit: value.archiver
	});
};

/**
 * Select every source needed to explain one hosted artifact and its archive.
 *
 * @param lane - Closed hosted lane name.
 * @param value - Producer/consumer/checker/archiver revisions.
 */
export const callbackCheckedRecordEvidenceSources = (lane, value) => {
	assert.ok(callbackCheckedRecordHostedLanes.includes(lane));
	assert.deepEqual(Object.keys(value).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(value))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const selected = lanes[lane];
	return freeze([
		{
			role: "producer", revision: value.producer
			, paths: [
				...closure(value.producer, [selected.test])
				, ...common, ...selected.consumers
			]
		}
		, {
			role: "consumer", revision: value.consumer
			, paths: selected.consumers
		}
		, {
			role: "checker", revision: value.checker
			, paths: [
				...closure(value.checker, [selected.checker])
				, selected.run, selected.workflow, "scripts/env.sh"
			]
		}
		, {
			role: "archiver", revision: value.archiver
			, paths: closure(value.archiver, [
				"scripts/archive-callback-checked-record-evidence.mjs"
			])
		}
	]);
};
