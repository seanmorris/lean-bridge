/**
 * Reconstruct the exact source closures behind hosted Fin and checked-record
 * callback PHP-Wasm production, consumption, checking and evidence archiving.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import {
	checkedRecordValueIndexHostedOriginal
} from "./checked-record-value-index-hosted-evidence-sources.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

/** Read one exact tracked file from a selected revision. */
export const callbackRefinementsPhpWasmHostedOriginal
	= checkedRecordValueIndexHostedOriginal;

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = callbackRefinementsPhpWasmHostedOriginal(revision, path);
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

const fixture = (root, files) => files.map(path =>
	`tests/fixtures/onboarding/${root}/${path}`);
const fixtures = [
	...fixture("reviewed-callback-fin", [
		"ReviewedCallbacks.lean", "LICENSE", "lakefile.toml"
		, "lean-toolchain", "package.json"
	])
	, ...fixture("callback-checked-records", [
		"CallbackCheckedRecords.lean", "LICENSE", "lakefile.toml"
		, "lean-toolchain", "package.json"
	])
];
const callers = [
	"tests/fixtures/reviewed-callback-fin-consumers/php-wasm.php"
	, "tests/fixtures/callback-checked-record-consumers/php-native.php"
];
const commonData = [
	...fixtures, ...callers, "lean-toolchain", "package-lock.json"
	, "package.json", "src/analyze/NativeExports.lean"
	, "src/backends/c/gmp.source.tar.xz"
	, "src/backends/php/brick-math.source.json"
	, "src/build/ResolveLakeWorkspace.lean"
];

const freeze = roles => Object.freeze(roles.flatMap(
	({ role, revision, paths }) => [...new Set(paths)].sort().map(path =>
		Object.freeze({ role, revision, path })))
);

/**
 * Select every source required to explain one hosted callback-refinement
 * PHP-Wasm artifact and its independent immutable archive.
 *
 * @param revisions - Producer, consumer, checker and archiver revisions.
 */
export const callbackRefinementsPhpWasmEvidenceSources = revisions => {
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
					"tests/helpers/callback-refinements-php-wasm-installed-tests.mjs"
				])
				, ...commonData
			]
		}
		, {
			role: "consumer", revision: revisions.consumer
			, paths: [
				...closure(revisions.consumer, [
					"tests/helpers/callback-fin-php-wasm-fixture.mjs"
					, "tests/helpers/callback-checked-record-php-wasm-fixture.mjs"
				])
				, ...callers
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: [
				...closure(revisions.checker, [
					"scripts/check-callback-refinements-php-wasm-reports.mjs"
				])
				, ".github/actions/bounded-apt/action.yml"
				, ".github/workflows/callback-refinements-php-wasm.yml"
				, "flake.lock", "flake.nix"
				, "scripts/bootstrap-php-wasm-ci.sh"
				, "scripts/bootstrap-toolchains.sh"
				, "scripts/build-lean-runtime.sh", "scripts/env.sh"
				, "scripts/install-playwright-browsers.sh"
			]
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-callback-refinements-php-wasm-evidence.mjs"
				, "tests/helpers/callback-refinements-php-wasm-hosted-archive-tests.mjs"
			])
		}
	]);
};
