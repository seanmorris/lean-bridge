/**
 * Reconstruct the frozen source closure behind hosted inherited checked-record
 * PHP-Wasm production, checking, and evidence archiving.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	inheritedCheckedRecordPhpWasmGeneratorClosure
	, inheritedCheckedRecordPhpWasmOriginal
} from "./inherited-checked-record-php-wasm-sources.mjs";

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = inheritedCheckedRecordPhpWasmOriginal(revision, path);
		paths.add(path);
		if(!path.endsWith(".mjs")) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier
			));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths].sort();
};

const fixture = [
	"LICENSE", "InheritedCheckedRecords.lean", "lakefile.toml"
	, "lean-toolchain", "package.json"
].map(path => `tests/fixtures/onboarding/inherited-checked-records/${path}`);
const caller = [
	"tests/fixtures/inherited-checked-record-consumers/php-native.php"
];

/**
 * Select every frozen source whose bytes explain one hosted artifact.
 *
 * @param revisions - Independent producer, checker, and archiver revisions.
 */
export const inheritedCheckedRecordPhpWasmEvidenceSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "producer"]);
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	const roles = [
		{
			role: "producer", revision: revisions.producer
			, paths: [
				...closure(revisions.producer, [
					"tests/helpers/inherited-checked-record-php-wasm-installed-tests.mjs"
					, "scripts/snapshot-nominal-subtype-php-wasm-ci.mjs"
					, "tests/helpers/owned-php-wasm-runtime.mjs"
				])
				, ...inheritedCheckedRecordPhpWasmGeneratorClosure(
					revisions.producer
				)
				, ...fixture, ...caller
				, ".github/actions/bounded-apt/action.yml"
				, ".github/workflows/inherited-checked-record-php-wasm.yml"
				, "scripts/bootstrap-php-wasm-ci.sh"
				, "scripts/bootstrap-toolchains.sh", "scripts/build-lean-runtime.sh"
				, "scripts/env.sh", "scripts/install-playwright-browsers.sh"
				, "scripts/run-inherited-checked-record-php-wasm-ci.sh"
				, "lean-toolchain", "package-lock.json", "package.json"
			]
		}
		, {
			role: "checker", revision: revisions.checker
			, paths: closure(revisions.checker, [
				"scripts/check-inherited-checked-record-php-wasm-ci.mjs"
			])
		}
		, {
			role: "archiver", revision: revisions.archiver
			, paths: closure(revisions.archiver, [
				"scripts/archive-inherited-checked-record-php-wasm-evidence.mjs"
				, "tests/helpers/inherited-checked-record-php-wasm-evidence-tests.mjs"
			])
		}
	];
	return Object.freeze(roles.flatMap(({ role, revision, paths }) =>
		[...new Set(paths)].sort().map(path => Object.freeze({
			role, revision, path
		}))
	));
};
