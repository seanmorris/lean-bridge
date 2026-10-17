/**
 * Freeze the recursive checked-record PHP-Wasm producer, verifier, selections and source closure.
 * The producer and verifier are pinned only after the serial four-cell producer has run; until
 * then every archive and evidence check refuses.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	recursiveCheckedRecordPhpWasmGeneratorClosure, recursiveCheckedRecordPhpWasmOriginal
} from "./recursive-checked-record-php-wasm-sources.mjs";

export { recursiveCheckedRecordPhpWasmOriginal };

/** Full producer revision; pinned to the commit that ran the four cells. */
export const recursiveCheckedRecordPhpWasmProducer
	= "a6d16eadd27aa8d9461a9fe3406e324028ac9beb";
/** Full checker revision; pinned with the producer. */
export const recursiveCheckedRecordPhpWasmVerifier = recursiveCheckedRecordPhpWasmProducer;
export const recursiveCheckedRecordPhpWasmEvidence
	= "docs/evidence/recursive-checked-record-php-wasm-20261017";
export const recursiveCheckedRecordPhpWasmEvidenceLoadCeiling = 8;
/** Serial producer order: modules outer, routes inner, matching the hosted runner. */
export const recursiveCheckedRecordPhpWasmSelections = Object.freeze([
	["ordinary", "recursive"], ["reviewed", "recursive"]
	, ["ordinary", "mutual"], ["reviewed", "mutual"]
]);
/**
 * Fixed per-selection controls; record controls scale with the retained records.
 *
 * @param records - Number of retained records in one selection.
 */
export const recursiveCheckedRecordPhpWasmExpectedControls = records => ({
	recordControls: records * 2 + 6, semanticControls: 63
});

/**
 * Require both frozen revisions before any archive or evidence check opens records.
 */
export const recursiveCheckedRecordPhpWasmPinnedRevisions = () => {
	for(const revision of [recursiveCheckedRecordPhpWasmProducer, recursiveCheckedRecordPhpWasmVerifier])
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u, "Pin the recursive PHP-Wasm producer and verifier revisions first");
	return { producer: recursiveCheckedRecordPhpWasmProducer, verifier: recursiveCheckedRecordPhpWasmVerifier };
};

const closure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = recursiveCheckedRecordPhpWasmOriginal(revision, path).toString("utf8");
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

/** Reconstruct every static producer/verifier module, generator input and caller byte. */
export const recursiveCheckedRecordPhpWasmEvidenceSources = () => {
	if(selectedSources) return selectedSources;
	const { producer: producerRevision, verifier: verifierRevision } = recursiveCheckedRecordPhpWasmPinnedRevisions();
	const fixtures = ["recursive", "mutual"].flatMap(fixture => {
		const module = { recursive: "RecursiveCheckedRecords", mutual: "MutualCheckedRecords" }[fixture];
		return ["LICENSE", `${module}.lean`, "lakefile.toml", "lean-toolchain", "package.json"]
			.map(path => `tests/fixtures/onboarding/${fixture}-checked-records/${path}`);
	});
	const producer = [
		...closure(producerRevision, [
			"tests/helpers/recursive-checked-record-php-wasm-installed-tests.mjs"
			, "scripts/snapshot-nominal-subtype-php-wasm-ci.mjs"
		])
		, ...recursiveCheckedRecordPhpWasmGeneratorClosure(producerRevision)
		, "src/analyze/NativeExports.lean"
		, "tests/fixtures/recursive-checked-record-consumers/php-native.php"
		, "tests/helpers/recursive-checked-record-php-model.php"
		, ...fixtures, "package.json", "package-lock.json", "lean-toolchain"
	];
	const verifier = [
		...closure(verifierRevision, [
			"tests/helpers/recursive-checked-record-php-wasm-controls.mjs"
			, "tests/helpers/recursive-checked-record-php-wasm-ci-report.mjs"
			, "scripts/check-recursive-checked-record-php-wasm-ci.mjs"
		])
		, ".github/actions/bounded-apt/action.yml"
		, ".github/workflows/recursive-checked-record-php-wasm.yml"
		, "scripts/bootstrap-php-wasm-ci.sh", "scripts/bootstrap-toolchains.sh"
		, "scripts/env.sh", "scripts/install-playwright-browsers.sh"
		, "scripts/run-recursive-checked-record-php-wasm-ci.sh"
	];
	selectedSources = Object.freeze([...new Set(producer)].sort().map(path => Object.freeze({
		role: "producer", revision: producerRevision, path
	})).concat([...new Set(verifier)].sort().map(path => Object.freeze({
		role: "verifier", revision: verifierRevision, path
	}))));
	return selectedSources;
};
