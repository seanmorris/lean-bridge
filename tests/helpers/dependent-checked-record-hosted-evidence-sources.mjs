/**
 * Reconstruct the exact source closures behind hosted dependent checked-record
 * Python, Ruby, Rust and Perl production, consumption, checking and archiving.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { checkedRecordValueIndexHostedOriginal } from "./checked-record-value-index-hosted-evidence-sources.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const dependentCheckedRecordHostedOriginal
	= checkedRecordValueIndexHostedOriginal;

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = dependentCheckedRecordHostedOriginal(revision, path);
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
	"DependentRecords.lean", "LICENSE", "lakefile.toml", "lean-toolchain"
	, "package.json"
].map(path => `tests/fixtures/onboarding/dependent-checked-records/${path}`);
const caller = extension =>
	`tests/fixtures/dependent-checked-record-consumers/${extension}`;
const commonData = [
	...fixture, "src/analyze/NativeExports.lean", "lean-toolchain"
	, "package-lock.json", "package.json"
];
const boundedApt = ".github/actions/bounded-apt/action.yml";

const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

const revisions = value => {
	assert.deepEqual(Object.keys(value).sort(), [
		"archiver", "checker", "consumer", "producer"
	]);
	for(const revision of Object.values(value))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return value;
};

/**
 * Select every source that explains the hosted Python wheel artifact.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordPythonEvidenceSources = value => {
	const selected = revisions(value);
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-python-installed-tests.mjs"
				])
				, ...commonData, caller("python.py")
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-python-fixture.mjs"
				])
				, caller("python.py")
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-python-ci.mjs"
					, "tests/dependent-checked-record-native-foundation.test.mjs"
				])
				, boundedApt, ".github/workflows/dependent-checked-record-python.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-dependent-checked-record-python-ci.sh"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-python-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source that explains the hosted Ruby gem artifact.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordRubyEvidenceSources = value => {
	const selected = revisions(value);
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-ruby-installed-tests.mjs"
				])
				, ...commonData, caller("ruby.rb")
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-ruby-fixture.mjs"
				])
				, caller("ruby.rb")
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-ruby-ci.mjs"
					, "tests/dependent-checked-record-native-foundation.test.mjs"
				])
				, boundedApt, ".github/workflows/dependent-checked-record-ruby.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-dependent-checked-record-ruby-ci.sh"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-ruby-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source that explains the hosted Rust crate artifact.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordRustEvidenceSources = value => {
	const selected = revisions(value);
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-rust-installed-tests.mjs"
				])
				, ...commonData, caller("rust.rs")
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-rust-fixture.mjs"
				])
				, caller("rust.rs")
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-rust-ci.mjs"
					, "tests/dependent-checked-record-native-foundation.test.mjs"
				])
				, boundedApt, ".github/workflows/dependent-checked-record-rust.yml"
				, "scripts/bootstrap-rust-ci.sh", "scripts/bootstrap-toolchains.sh"
				, "scripts/env.sh", "scripts/run-dependent-checked-record-rust-ci.sh"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-rust-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source that explains the hosted four-ABI Perl CPAN artifact.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordPerlEvidenceSources = value => {
	const selected = revisions(value);
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-perl-installed-tests.mjs"
				])
				, ...commonData, caller("perl.pl")
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-perl-fixture.mjs"
				])
				, caller("perl.pl")
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-perl-ci.mjs"
					, "tests/helpers/dependent-checked-record-perl-tests.mjs"
				])
				, boundedApt, ".github/workflows/dependent-checked-record-perl.yml"
				, "scripts/bootstrap-toolchains.sh"
				, "scripts/build-perl-toolchains.mjs", "scripts/env.sh"
				, "scripts/run-dependent-checked-record-perl-ci.sh"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-perl-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source that explains the hosted dependent checked-record
 * NuGet artifact and its independent C# verification.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordDotnetEvidenceSources = value => {
	const selected = revisions(value);
	const consumerCaller = caller("dotnet.cs");
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-dotnet-installed-tests.mjs"
				])
				, ...commonData, consumerCaller
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-dotnet-fixture.mjs"
				])
				, consumerCaller
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-dotnet-ci.mjs"
					, "tests/helpers/dependent-checked-record-dotnet-controls.mjs"
				])
				, boundedApt, ".github/workflows/dependent-checked-record-dotnet.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-dependent-checked-record-dotnet-ci.sh"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-dotnet-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source that explains the hosted dependent checked-record
 * Maven artifact and its Java/Kotlin verification.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordJvmEvidenceSources = value => {
	const selected = revisions(value);
	const callers = [caller("java.java"), caller("kotlin.kt")];
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-jvm-installed-tests.mjs"
				])
				, ...commonData, ...callers
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-jvm-fixture.mjs"
				])
				, ...callers
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-jvm-ci.mjs"
				])
				, boundedApt, ".github/workflows/dependent-checked-record-jvm.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-dependent-checked-record-jvm-ci.sh"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-jvm-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source that explains the hosted dependent checked-record
 * Composer artifact and native-PHP verification.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordPhpEvidenceSources = value => {
	const selected = revisions(value);
	const consumerCaller = caller("php.php");
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-php-installed-tests.mjs"
				])
				, ...commonData, consumerCaller
				, "src/backends/php/brick-math.source.json"
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-php-fixture.mjs"
				])
				, consumerCaller
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-php-ci.mjs"
				])
				, boundedApt, ".github/workflows/dependent-checked-record-php.yml"
				, "scripts/bootstrap-toolchains.sh", "scripts/env.sh"
				, "scripts/run-dependent-checked-record-php-ci.sh"
				, "scripts/select-nominal-subtype-php-ci-tools.mjs"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-php-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source that explains the hosted dependent checked-record WIT
 * component artifact and native Wasmtime verification.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordWitEvidenceSources = value => {
	const selected = revisions(value);
	const callers = [caller("wit-values.h"), caller("wit-wasi.c")];
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-wit-installed-tests.mjs"
				])
				, ...commonData, ...callers
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-wit-fixture.mjs"
				])
				, ...callers
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-wit-ci.mjs"
				])
				, boundedApt, ".github/workflows/dependent-checked-record-wit.yml"
				, "flake.lock", "flake.nix", "scripts/bootstrap-toolchains.sh"
				, "scripts/env.sh", "scripts/run-dependent-checked-record-wit-ci.sh"
				, "scripts/select-nominal-subtype-wit-ci-tools.mjs"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-wit-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source that explains the hosted dependent checked-record npm
 * packages and Node/page/React/worker verification.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordBrowserEvidenceSources = value => {
	const selected = revisions(value);
	const consumers = [
		"tests/fixtures/dependent-checked-record-browser/javascript.mjs"
		, "tests/fixtures/dependent-checked-record-browser/browser.mjs"
		, "tests/fixtures/dependent-checked-record-browser/full.mts"
		, "tests/fixtures/dependent-checked-record-browser/result-only.mts"
		, ...["plain.mjs", "react.mjs", "worker-main.mjs", "worker.mjs"]
			.map(path => `tests/fixtures/type-corpus/consumers/browser/${path}`)
	];
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-browser-installed-tests.mjs"
				])
				, ...commonData, ...consumers
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-browser.mjs"
					, "tests/helpers/dependent-checked-record-browser-fixture.mjs"
				])
				, ...consumers
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-browser-ci.mjs"
					, "tests/helpers/dependent-checked-record-browser-ci-report-tests.mjs"
				])
				, boundedApt
				, ".github/workflows/dependent-checked-record-browser.yml"
				, "flake.lock", "flake.nix"
				, "scripts/bootstrap-toolchains.sh"
				, "scripts/build-lean-link-spike.sh", "scripts/env.sh"
				, "scripts/install-playwright-browsers.sh"
				, "scripts/run-dependent-checked-record-browser-ci.sh"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-browser-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};

/**
 * Select every source that explains the hosted dependent checked-record
 * PHP-Wasm package set and its Node/Chromium verification.
 *
 * @param {object} value Role revisions.
 */
export const dependentCheckedRecordPhpWasmEvidenceSources = value => {
	const selected = revisions(value);
	const consumerCaller = caller("php.php");
	return freeze([
		{
			role: "producer", revision: selected.producer
			, paths: [
				...closure(selected.producer, [
					"tests/helpers/dependent-checked-record-php-wasm-installed-tests.mjs"
					, "tests/helpers/dependent-checked-record-php-wasm-lean-tests.mjs"
				])
				, ...commonData, consumerCaller
				, "src/backends/php/brick-math.source.json"
			]
		}
		, {
			role: "consumer", revision: selected.consumer
			, paths: [
				...closure(selected.consumer, [
					"tests/helpers/dependent-checked-record-php-wasm-fixture.mjs"
				])
				, consumerCaller
			]
		}
		, {
			role: "checker", revision: selected.checker
			, paths: [
				...closure(selected.checker, [
					"scripts/check-dependent-checked-record-php-wasm-ci.mjs"
					, "scripts/check-dependent-checked-record-php-wasm-compiler-ci.mjs"
				])
				, boundedApt
				, ".github/workflows/dependent-checked-record-php-wasm.yml"
				, "flake.lock", "flake.nix"
				, "scripts/bootstrap-php-wasm-ci.sh"
				, "scripts/bootstrap-toolchains.sh", "scripts/build-lean-runtime.sh"
				, "scripts/env.sh", "scripts/install-playwright-browsers.sh"
				, "scripts/run-dependent-checked-record-php-wasm-ci.sh"
			]
		}
		, {
			role: "archiver", revision: selected.archiver
			, paths: closure(selected.archiver, [
				"scripts/archive-dependent-checked-record-php-wasm-evidence.mjs"
				, "tests/helpers/dependent-checked-record-hosted-evidence-sources-tests.mjs"
			])
		}
	]);
};
