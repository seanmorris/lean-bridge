/**
 * Reconstruct the exact source closure behind one hosted callback
 * Subtype artifact.
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
	"CallbackSubtypes.lean", "LICENSE", "lakefile.toml"
	, "lean-toolchain", "package.json"
].map(path => `tests/fixtures/onboarding/callback-subtypes/${path}`);
const consumer = path => `tests/fixtures/callback-subtype-consumers/${path}`;
const common = [
	...fixture, "src/analyze/NativeExports.lean", "lean-toolchain"
	, "package-lock.json", "package.json"
	, "src/backends/c/gmp.source.tar.xz"
	, "src/build/ResolveLakeWorkspace.lean"
];
const checkerCommon = [
	".github/actions/bounded-apt/action.yml"
	, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
];

const lanes = Object.freeze({
	browser: {
		test: "tests/callback-subtype-npm-browser.test.mjs"
		, checker: "scripts/check-callback-subtype-browser-ci.mjs"
		, run: "scripts/run-callback-subtype-browser-ci.sh"
		, workflow: ".github/workflows/callback-subtype-browser.yml"
		, consumers: [consumer("javascript.mjs"), consumer("types.mts")]
		, checkerAssets: ["flake.lock", "flake.nix"
			, "scripts/build-lean-link-spike.sh"
			, "scripts/install-playwright-browsers.sh"]
	}
	, native: {
		test: "tests/callback-subtype-native-installed.test.mjs"
		, checker: "scripts/check-callback-subtype-native-ci.mjs"
		, run: "scripts/run-callback-subtype-native-ci.sh"
		, workflow: ".github/workflows/callback-subtype-native.yml"
		, consumers: [consumer("c.c"), consumer("cpp.cpp")]
	}
	, languages: {
		test: "tests/callback-subtype-language-installed.test.mjs"
		, checker: "scripts/check-callback-subtype-languages-ci.mjs"
		, run: "scripts/run-callback-subtype-languages-ci.sh"
		, workflow: ".github/workflows/callback-subtype-languages.yml"
		, consumers: [consumer("python.py"), consumer("ruby.rb")
			, consumer("rust.rs")]
		, producerAssets: ["src/backends/rust/dependencies.lock"]
		, checkerAssets: ["scripts/bootstrap-rust-ci.sh"]
	}
	, perl: {
		test: "tests/callback-subtype-perl-installed.test.mjs"
		, checker: "scripts/check-callback-subtype-perl-ci.mjs"
		, run: "scripts/run-callback-subtype-perl-ci.sh"
		, workflow: ".github/workflows/callback-subtype-perl.yml"
		, consumers: [consumer("perl.pl")]
		, producerAssets: [
			"src/backends/perl/Build.pm"
			, "src/backends/perl/BuildCallbackResults.pm"
			, "src/backends/perl/Runtime.pm"
			, "src/backends/perl/Runtime.xs"
			, "src/backends/perl/runtime.h"
		]
		, checkerEntries: ["scripts/build-perl-toolchains.mjs"]
	}
	, dotnet: {
		test: "tests/callback-subtype-remaining-installed.test.mjs"
		, checker: "scripts/check-callback-subtype-remaining-ci.mjs"
		, run: "scripts/run-callback-subtype-remaining-ci.sh"
		, workflow: ".github/workflows/callback-subtype-remaining.yml"
		, consumers: [consumer("dotnet.cs")]
	}
	, jvm: {
		test: "tests/callback-subtype-remaining-installed.test.mjs"
		, checker: "scripts/check-callback-subtype-remaining-ci.mjs"
		, run: "scripts/run-callback-subtype-remaining-ci.sh"
		, workflow: ".github/workflows/callback-subtype-remaining.yml"
		, consumers: [consumer("java.java"), consumer("kotlin.kt")]
	}
	, "php-native": {
		test: "tests/callback-subtype-remaining-installed.test.mjs"
		, checker: "scripts/check-callback-subtype-remaining-ci.mjs"
		, run: "scripts/run-callback-subtype-remaining-ci.sh"
		, workflow: ".github/workflows/callback-subtype-remaining.yml"
		, consumers: [consumer("php-native.php")]
	}
	, "wit-wasi": {
		test: "tests/callback-subtype-remaining-installed.test.mjs"
		, checker: "scripts/check-callback-subtype-remaining-ci.mjs"
		, run: "scripts/run-callback-subtype-remaining-ci.sh"
		, workflow: ".github/workflows/callback-subtype-remaining.yml"
		, consumers: [consumer("wit-wasi.c")]
		, checkerAssets: ["flake.lock", "flake.nix"]
	}
});

const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/** Read one exact tracked file from a selected revision. */
export const callbackSubtypeHostedOriginal = original;

/** Known hosted callback Subtype archive lane names. */
export const callbackSubtypeHostedLanes
	= Object.freeze(Object.keys(lanes));

/**
 * Select every source needed to explain one hosted artifact and its archive.
 *
 * @param lane - Closed hosted lane name.
 * @param value - Producer/consumer/checker/archiver revisions.
 */
export const callbackSubtypeEvidenceSources = (lane, value) => {
	assert.ok(callbackSubtypeHostedLanes.includes(lane));
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
				, ...(selected.producerAssets ?? [])
			]
		}
		, {
			role: "consumer", revision: value.consumer
			, paths: selected.consumers
		}
		, {
			role: "checker", revision: value.checker
			, paths: [
				...closure(value.checker, [selected.checker
					, ...(selected.checkerEntries ?? [])])
				, selected.run, selected.workflow, ...checkerCommon
				, ...(selected.checkerAssets ?? [])
			]
		}
		, {
			role: "archiver", revision: value.archiver
			, paths: closure(value.archiver, [
				"scripts/archive-callback-subtype-evidence.mjs"
			])
		}
	]);
};
