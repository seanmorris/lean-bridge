/**
 * Freeze the nested checked-record PHP-Wasm producer, verifier and source closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	nestedCheckedRecordPhpWasmGeneratorClosure
	, nestedCheckedRecordPhpWasmOriginal
} from "./nested-checked-record-php-wasm-sources.mjs";
import { assertNestedCheckedRecordPhpWasmTap } from "./nested-checked-record-php-wasm-selections.mjs";

export { assertNestedCheckedRecordPhpWasmTap, nestedCheckedRecordPhpWasmOriginal };

export const nestedCheckedRecordPhpWasmProducer
	= "db479d8c8276952acb21bfa80486333799682b51";
export const nestedCheckedRecordPhpWasmVerifier
	= "4278b72043642f66901292da95052f4bef7b1705";
export const nestedCheckedRecordPhpWasmEvidence
	= "docs/evidence/nested-checked-record-php-wasm-20261016";
export const nestedCheckedRecordPhpWasmLoadCeiling = 20;
export const nestedCheckedRecordPhpWasmSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);

const closure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = nestedCheckedRecordPhpWasmOriginal(revision, path).toString("utf8");
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
export const nestedCheckedRecordPhpWasmEvidenceSources = () => {
	if(selectedSources) return selectedSources;
	const fixture = ["LICENSE", "NestedCheckedRecords.lean", "lakefile.toml"
		, "lean-toolchain", "package.json"].map(path =>
		`tests/fixtures/onboarding/nested-checked-records/${path}`);
	const producer = [
		...closure(nestedCheckedRecordPhpWasmProducer, [
			"tests/helpers/nested-checked-record-php-wasm-installed-tests.mjs"
			, "scripts/snapshot-nominal-subtype-php-wasm-ci.mjs"
		])
		, ...nestedCheckedRecordPhpWasmGeneratorClosure(
			nestedCheckedRecordPhpWasmProducer
		)
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/nested-checked-record-php-wasm.yml"
		, "scripts/bootstrap-php-wasm-ci.sh", "scripts/bootstrap-toolchains.sh"
		, "scripts/env.sh", "scripts/install-playwright-browsers.sh"
		, "scripts/check-nested-checked-record-php-wasm-ci.mjs"
		, "scripts/run-nested-checked-record-php-wasm-ci.sh"
		, "tests/fixtures/nested-checked-record-consumers/php-native.php"
		, ...fixture, "package.json", "package-lock.json", "lean-toolchain"
	];
	const verifier = closure(nestedCheckedRecordPhpWasmVerifier, [
		"tests/helpers/nested-checked-record-php-wasm-controls.mjs"
		, "tests/helpers/nested-checked-record-php-wasm-ci-report.mjs"
	]);
	const producerPaths = new Set(producer), verifierPaths = new Set(verifier);
	const sharedPaths = [...producerPaths].filter(path => verifierPaths.has(path));
	for(const path of sharedPaths) assert.deepEqual(
		nestedCheckedRecordPhpWasmOriginal(nestedCheckedRecordPhpWasmProducer, path)
		, nestedCheckedRecordPhpWasmOriginal(nestedCheckedRecordPhpWasmVerifier, path)
		, path
	);
	const source = (role, revision, path) => Object.freeze({ role, revision, path });
	selectedSources = Object.freeze([
		...[...producerPaths].filter(path => !verifierPaths.has(path)).sort()
			.map(path => source("producer", nestedCheckedRecordPhpWasmProducer, path))
		, ...[...verifierPaths].filter(path => !producerPaths.has(path)).sort()
			.map(path => source("verifier", nestedCheckedRecordPhpWasmVerifier, path))
		, ...sharedPaths.sort()
			.map(path => source("shared", nestedCheckedRecordPhpWasmProducer, path))
	]);
	return selectedSources;
};
