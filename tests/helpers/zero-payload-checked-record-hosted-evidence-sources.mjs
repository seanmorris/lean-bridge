/**
 * Reconstruct the exact source closures behind hosted zero-payload npm and
 * browser production, consumption, checking and evidence archiving.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

const originals = new Map();
const allowedRoots = [
	".github/", "config/", "poc/", "schema/", "scripts/", "site/", "src/"
	, "tests/"
];
const allowedFiles = new Set([
	"LICENSE", "flake.lock", "flake.nix", "lean-toolchain"
	, "package-lock.json", "package.json"
]);

/**
 * Read one exact Git blob without consulting mutable worktree bytes.
 *
 * @param revision - Full immutable Git revision.
 * @param path - Normalized repository-relative path.
 */
export const zeroPayloadHostedOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.equal(posix.normalize(path), path);
	assert.ok(!path.startsWith("/") && !path.split("/").includes(".."));
	assert.ok(allowedFiles.has(path)
		|| allowedRoots.some(root => path.startsWith(root)), path);
	const key = `${revision}:${path}`;
	if(!originals.has(key)) originals.set(key, execFileSync(
		"git", ["cat-file", "blob", key], { maxBuffer: 64 * 1024 ** 2 }
	));
	return Buffer.from(originals.get(key));
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = zeroPayloadHostedOriginal(revision, path);
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
	"LICENSE", "ZeroPayloadCheckedRecords.lean", "lakefile.toml"
	, "lean-toolchain", "package.json"
].map(path => `tests/fixtures/onboarding/zero-payload-checked-records/${path}`);
const callers = [
	"browser.mjs", "full.mts", "javascript.mjs", "result-only.mts"
].map(path => `tests/fixtures/zero-payload-checked-record-browser/${path}`);
const nativeCallers = [
	"c.c", "cpp.cpp", "result-only-c.c", "result-only-cpp.cpp"
].map(path => `tests/fixtures/zero-payload-checked-record-native/${path}`);
const dotnetCallers = [
	"dotnet.cs"
].map(path => `tests/fixtures/zero-payload-checked-record-dotnet/${path}`);
const jvmCallers = ["java.java", "kotlin.kt"].map(
	path => `tests/fixtures/zero-payload-checked-record-jvm/${path}`
);
const commonData = [
	...fixture, ...callers, "src/analyze/NativeExports.lean", "lean-toolchain"
	, "package-lock.json", "package.json"
];
const boundedApt = ".github/actions/bounded-apt/action.yml";
const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/**
 * Select every source whose bytes explain the hosted browser artifact.
 *
 * @param revisions - Producer, npm checker, consumer, checker and archiver.
 */
export const zeroPayloadBrowserEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "npmChecker", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/zero-payload-checked-record-npm-installed-tests.mjs"
				])
				, ...commonData
			]
		}
		, {
			role: "npm-checker", revision: revisions.npmChecker
			, paths: closure(revisions.npmChecker, [
				"tests/helpers/zero-payload-checked-record-browser-report.mjs"
				, "tests/helpers/zero-payload-checked-record-npm-installed-tests.mjs"
			])
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/zero-payload-checked-record-browser.mjs"
				])
				, ...callers, "package-lock.json", "package.json", "site/serve.mjs"
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-zero-payload-checked-record-browser-ci.mjs"
					, "tests/zero-payload-checked-record-javascript.test.mjs"
				])
				, boundedApt
				, ".github/workflows/zero-payload-checked-record-browser.yml"
				, "scripts/bootstrap-toolchains.sh"
				, "scripts/build-lean-link-spike.sh", "scripts/env.sh"
				, "scripts/install-playwright-browsers.sh"
				, "scripts/run-zero-payload-checked-record-browser-ci.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-zero-payload-checked-record-browser-evidence.mjs"
				, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source whose bytes explain the hosted native artifact.
 *
 * @param revisions - Producer, consumer, checker and archiver revisions.
 */
export const zeroPayloadNativeEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/zero-payload-checked-record-native-installed-tests.mjs"
				])
				, ...commonData, ...nativeCallers
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/zero-payload-checked-record-native-fixture.mjs"
				])
				, ...nativeCallers, "package-lock.json", "package.json"
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-zero-payload-checked-record-native-ci.mjs"
					, "tests/zero-payload-checked-records.test.mjs"
				])
				, boundedApt
				, ".github/workflows/zero-payload-checked-record-native.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-zero-payload-checked-record-native-ci.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-zero-payload-checked-record-native-evidence.mjs"
				, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source whose bytes explain the hosted .NET artifact.
 *
 * @param revisions - Producer, consumer, checker and archiver revisions.
 */
export const zeroPayloadDotnetEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/zero-payload-checked-record-dotnet-installed-tests.mjs"
				])
				, ...fixture, ...dotnetCallers, "src/analyze/NativeExports.lean"
				, "lean-toolchain", "package-lock.json", "package.json"
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/zero-payload-checked-record-dotnet-fixture.mjs"
				])
				, ...dotnetCallers, "package-lock.json", "package.json"
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-zero-payload-checked-record-dotnet-ci.mjs"
					, "tests/zero-payload-checked-record-dotnet.test.mjs"
				])
				, boundedApt
				, ".github/workflows/zero-payload-checked-record-dotnet.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-zero-payload-checked-record-dotnet-ci.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-zero-payload-checked-record-dotnet-evidence.mjs"
				, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source whose bytes explain the hosted Java/Kotlin artifact.
 *
 * @param revisions - Producer, consumer, checker and archiver revisions.
 */
export const zeroPayloadJvmEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return freeze([
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/zero-payload-checked-record-jvm-installed-tests.mjs"
				])
				, ...fixture, ...jvmCallers, "src/analyze/NativeExports.lean"
				, "lean-toolchain", "package-lock.json", "package.json"
				, ".github/workflows/zero-payload-checked-record-jvm.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-zero-payload-checked-record-jvm-ci.sh"
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/zero-payload-checked-record-jvm-fixture.mjs"
				])
				, ...jvmCallers
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-zero-payload-checked-record-jvm-ci.mjs"
					, "tests/zero-payload-checked-record-jvm.test.mjs"
				])
				, boundedApt
				, ".github/workflows/zero-payload-checked-record-jvm.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-zero-payload-checked-record-jvm-ci.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-zero-payload-checked-record-jvm-evidence.mjs"
				, "tests/helpers/zero-payload-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};
