/**
 * Reconstruct the frozen source closure behind inherited checked-record npm
 * production, browser execution, hosted checking and evidence archiving.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

const originals = new Map();
const allowedRoots = [
	".github/"
	, "config/"
	, "docs/"
	, "schema/"
	, "scripts/"
	, "site/"
	, "src/"
	, "tests/"
];
const allowedFiles = new Set(["lean-toolchain", "package-lock.json", "package.json"]);
const sourceKey = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.equal(posix.normalize(path), path);
	assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
	assert.ok(allowedFiles.has(path)
		|| allowedRoots.some(root => path.startsWith(root)), path);
	return `${revision}:${path}`;
};

/**
 * Read one exact Git blob from a frozen revision.
 *
 * @param revision - Full immutable Git revision.
 * @param path - Repository-relative source path.
 */
export const inheritedCheckedRecordBrowserOriginal = (revision, path) => {
	const key = sourceKey(revision, path);
	if(!originals.has(key)) originals.set(key, execFileSync(
		"git", ["cat-file", "blob", key], { maxBuffer: 32 * 1024 ** 2 }
	));
	return Buffer.from(originals.get(key));
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = inheritedCheckedRecordBrowserOriginal(revision, path);
		paths.add(path);
		if(!path.endsWith(".mjs")) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths].sort();
};

const onboarding = [
	"LICENSE", "InheritedCheckedRecords.lean", "lakefile.toml"
	, "lean-toolchain", "package.json"
].map(path => `tests/fixtures/onboarding/inherited-checked-records/${path}`);
const npmCallers = ["javascript.mjs", "full.mts", "result-only.mts"]
	.map(path => `tests/fixtures/inherited-checked-record-consumers/${path}`);
const browserCallers = [
	"tests/fixtures/inherited-checked-record-consumers/browser.mjs"
	, ...["plain", "react", "worker", "worker-main"]
		.map(name => `tests/fixtures/type-corpus/consumers/browser/${name}.mjs`)
];

/**
 * Select every frozen source whose bytes explain the hosted artifact.
 *
 * @param revisions - Independent producer/checker/consumer/archive revisions.
 */
export const inheritedCheckedRecordBrowserEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "npmChecker", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const roles = [
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/inherited-checked-record-npm-installed-tests.mjs"
				])
				, ...onboarding, ...npmCallers, "src/analyze/NativeExports.lean"
				, "lean-toolchain", "package-lock.json", "package.json"
			]
		}
		, {
			role: "npm-checker", revision: revisions.npmChecker
			, paths: closure(revisions.npmChecker, [
				"tests/helpers/inherited-checked-record-npm-report.mjs"
				, "tests/helpers/inherited-checked-record-npm-installed-tests.mjs"
			])
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/inherited-checked-record-browser.test.mjs"
					, "tests/helpers/inherited-checked-record-browser.mjs"
				])
				, ...browserCallers, "package-lock.json", "package.json"
				, "site/serve.mjs"
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-inherited-checked-record-browser-ci.mjs"
					, "tests/inherited-checked-record-browser-controls.test.mjs"
				])
				, ".github/actions/bounded-apt/action.yml"
				, ".github/workflows/inherited-checked-record-browser.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/build-lean-link-spike.sh"
				, "scripts/env.sh", "scripts/install-playwright-browsers.sh"
				, "scripts/run-inherited-checked-record-browser-ci.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-inherited-checked-record-browser-evidence.mjs"
				, "tests/helpers/inherited-checked-record-browser-evidence-tests.mjs"
			])
		}
	];
	return Object.freeze(
		roles.flatMap(({ role, revision, paths }) =>
			[...new Set(paths)].sort().map(path => Object.freeze({
				role, revision, path
			}))
		)
	);
};
