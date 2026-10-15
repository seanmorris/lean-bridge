/**
 * Independent selection and resource policy for primitive-base native PHP evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { extname, posix } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";
import {
	nominalPrimitiveSubtypePhpGenerator
	, nominalPrimitiveSubtypePhpOriginal
} from "./nominal-primitive-subtype-php-generators.mjs";

export { nominalPrimitiveSubtypePhpOriginal };

export const nominalPrimitiveSubtypePhpProducer = "b67633365357d760d21c54491eb63f9caad7ecb2";
export const nominalPrimitiveSubtypePhpEvidence = "docs/evidence/nominal-primitive-subtype-php-20261015";

export const nominalPrimitiveSubtypePhpSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);
export const nominalPrimitiveSubtypePhpLoadCeiling = 8;

const closureEntries = Object.freeze([
	"tests/helpers/nominal-primitive-subtype-php-installed-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-package.mjs"
]);
const extraSources = Object.freeze([
	"tests/fixtures/nominal-primitive-subtype-consumers/php-native.php"
	, ...["LICENSE", "NominalPrimitiveSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json"]
		.map(path => `tests/fixtures/onboarding/nominal-primitive-subtypes/${path}`)
]);

const historicalClosure = (revision, entries) => {
	const files = new Set();
	const visit = path => {
		if(files.has(path)) return;
		const source = nominalPrimitiveSubtypePhpOriginal(revision, path).toString("utf8"); files.add(path);
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
export const nominalPrimitiveSubtypePhpEvidenceSources = async () => selectedSources ??= Object.freeze([
	...new Set([
		...historicalClosure(nominalPrimitiveSubtypePhpProducer, closureEntries)
		, ...(await nominalPrimitiveSubtypePhpGenerator(nominalPrimitiveSubtypePhpProducer)).paths
		, ...extraSources
	])
].sort());

/**
 * Require unchanged disk and memory floors plus the recorded local load ceiling.
 *
 * @param resource - One guard call and every observation made while waiting.
 * @param maxLoad - Exclusive accepted host-load ceiling.
 */
export const assertNominalPrimitiveSubtypePhpResources = (resource, maxLoad = nominalPrimitiveSubtypePhpLoadCeiling) => {
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
