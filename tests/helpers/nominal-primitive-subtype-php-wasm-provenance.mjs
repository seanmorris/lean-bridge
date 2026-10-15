/**
 * Independent source, selection, resource and TAP policy for primitive-base nominal PHP-Wasm evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	nominalPrimitiveSubtypePhpWasmGeneratorClosure
	, nominalPrimitiveSubtypePhpWasmOriginal
} from "./nominal-primitive-subtype-php-wasm-sources.mjs";

export { nominalPrimitiveSubtypePhpWasmOriginal };

export const nominalPrimitiveSubtypePhpWasmProducer = "2e0536ea827698f413a16a984a4554589d721369";
export const nominalPrimitiveSubtypePhpWasmEvidence = "docs/evidence/nominal-primitive-subtype-php-wasm-20261015";
export const nominalPrimitiveSubtypePhpWasmLoadCeiling = 8;
export const nominalPrimitiveSubtypePhpWasmSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);

const closureEntries = Object.freeze([
	"tests/helpers/nominal-primitive-subtype-php-wasm-installed-tests.mjs"
]);
const extraSources = Object.freeze([
	"package.json", "package-lock.json", "docs/type-surface.v1.json"
	, ".github/workflows/checked-record-php-wasm.yml"
	, "tests/fixtures/nominal-primitive-subtype-consumers/php-native.php"
	, ...["LICENSE", "NominalPrimitiveSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/nominal-primitive-subtypes/${path}`)
]);

const historicalClosure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = nominalPrimitiveSubtypePhpWasmOriginal(revision, path).toString("utf8"); files.add(path);
		if(!path.endsWith(".mjs")) return;
		for(const specifier of moduleSpecifiers(source, path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...files].sort();
};

let selectedSources;

/** Reconstruct every static producer module and dynamic PHP generator input. */
export const nominalPrimitiveSubtypePhpWasmEvidenceSources = () => selectedSources ??= Object.freeze([
	...new Set([
		...historicalClosure(nominalPrimitiveSubtypePhpWasmProducer, closureEntries)
		, ...nominalPrimitiveSubtypePhpWasmGeneratorClosure(nominalPrimitiveSubtypePhpWasmProducer)
		, ...extraSources
	])
].sort());

/**
 * Require unchanged disk and memory floors plus the selected local load ceiling.
 *
 * @param resource - One guard call and every observation made while waiting.
 * @param maxLoad - Exclusive accepted host-load ceiling.
 */
export const assertNominalPrimitiveSubtypePhpWasmResources = (
	resource, maxLoad = nominalPrimitiveSubtypePhpWasmLoadCeiling
) => {
	assert.ok(Number.isFinite(maxLoad) && maxLoad > 0);
	assert.deepEqual(Object.keys(resource).sort(), ["observations", "waits"]);
	assert.ok(Number.isSafeInteger(resource.waits) && resource.waits >= 0 && resource.waits <= 20);
	assert.equal(resource.observations.length, resource.waits + 1);
	for(const [index, sample] of resource.observations.entries())
	{
		assert.deepEqual(Object.keys(sample).sort(), ["availableBytes", "freeBytes", "load"]);
		for(const key of ["availableBytes", "freeBytes"])
			assert.ok(Number.isSafeInteger(sample[key]) && sample[key] >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
		assert.equal(sample.load < maxLoad, index === resource.waits);
	}
};

/**
 * Reject skipped, partial, failed, duplicated or appended installed TAP.
 *
 * @param source - Complete original TAP.
 * @param route - Explicit ordinary or reviewed author route.
 * @param mode - Explicit full or result-only API mode.
 */
export const assertNominalPrimitiveSubtypePhpWasmTap = (source, route, mode) => {
	assert.ok(nominalPrimitiveSubtypePhpWasmSelections.some(item => item[0] === route && item[1] === mode));
	const name = `installed primitive-base nominal PHP-Wasm packages reproduce and relocate ${route} ${mode}`;
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};
