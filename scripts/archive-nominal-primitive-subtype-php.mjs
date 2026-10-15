#!/usr/bin/env node
/**
 * Retain four accepted primitive-base nominal native PHP selections.
 *
 * This one-shot script validates existing reports and never rebuilds a package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkNominalPrimitiveSubtypePhpControls } from "../tests/helpers/nominal-primitive-subtype-php-controls.mjs";
import { checkNominalPrimitiveSubtypePhpReport } from "../tests/helpers/nominal-primitive-subtype-php-report.mjs";
import {
	nominalPrimitiveSubtypePhpEvidence
	, nominalPrimitiveSubtypePhpEvidenceSources
	, nominalPrimitiveSubtypePhpLoadCeiling
	, nominalPrimitiveSubtypePhpOriginal
	, nominalPrimitiveSubtypePhpProducer
	, nominalPrimitiveSubtypePhpSelections
} from "../tests/helpers/nominal-primitive-subtype-php-provenance.mjs";

assert.equal(process.argv.length, 2, "The four frozen reports take no arguments");
await assert.rejects(access(nominalPrimitiveSubtypePhpEvidence), { code: "ENOENT" });
const origin = "/app/build/vo1496-native-php-b676333";
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" };
const floor = "2.36", phpVersion = "8.2.33", composerVersion = "2.5.5";
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2
	, executionControls: 40
	, toolControls: 12
	, resourceControls: 4
	, environmentControls: 10
	, packageControls: 4
	, modelControls: mode === "full" ? 6 : 5
});

const runs = [];
for(const [route, mode] of nominalPrimitiveSubtypePhpSelections)
{
	const label = `${route}-${mode}`, root = join(origin, route, mode);
	const read = path => readFile(join(root, path));
	const options = {
		route
		, mode
		, producerCommit: nominalPrimitiveSubtypePhpProducer
		, runtime, floor, phpVersion, composerVersion };
	const checked = await checkNominalPrimitiveSubtypePhpReport(read, options);
	const paths = await nativeArtifactPaths(root); assert.deepEqual(paths.sort(), checked.records);
	const controlled = await checkNominalPrimitiveSubtypePhpControls(read, options);
	const controls = expectedControls(checked.records.length, mode); assert.deepEqual(controlled, controls);
	for(const path of checked.records) put(`${label}/records/${path}`, await read(path));
	runs.push({
		label, route, mode
		, producerCommit: nominalPrimitiveSubtypePhpProducer
		, loadCeiling: nominalPrimitiveSubtypePhpLoadCeiling
		, runtime, floor, phpVersion, composerVersion
		, counts: checked.counts, executions: checked.executions
		, dispatchObserved: checked.dispatchObserved
		, generatorModules: checked.generatorPaths.length
		, records: checked.records.length
		, archiveSha256: checked.archiveSha256
		, reportSha256: checked.reportSha256
		, controls
	});
}

const selectedSources = await nominalPrimitiveSubtypePhpEvidenceSources();
for(const path of selectedSources)
	put("sources/" + path, nominalPrimitiveSubtypePhpOriginal(nominalPrimitiveSubtypePhpProducer, path));
const checkerPaths = [
	"tests/helpers/nominal-primitive-subtype-php-controls.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-environment-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-generators.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-model-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-package-records.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-provenance.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-report.mjs"
	, "tests/helpers/nominal-subtype-php-tool-records.mjs"
];
for(const path of checkerPaths) put("checkers/" + basename(path), await readFile(path));

const index = {
	schemaVersion: 1
	, kind: "nominal-primitive-subtype-php-installed-v1"
	, producerCommit: nominalPrimitiveSubtypePhpProducer
	, loadCeiling: nominalPrimitiveSubtypePhpLoadCeiling
	, runs, selectedSources, checkers: checkerPaths.map(path => basename(path))
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: [
		"Local Linux x64/glibc 2.36 acceptance with an explicit 2.36 package floor, not hosted release-floor acceptance."
		, "Four ordinary/reviewed full/result-only selections reproduce complete Composer packages from two author roots, install offline after author removal, and replay weak and strict callers before and after relocation."
		, "The full caller performs 1,821 checks with 283 expected Lean refusals per execution. The result-only caller performs 612 checks without input constructors. Both modes include eight host-side refusals and twelve immutable-input controls per execution."
		, "Accepted selections ran serially with a local load ceiling of 8. Disk and memory floors remained 2 GiB. Hosted CI refuses overrides and uses its default load ceiling."
		, "Complete original Composer archives, receipts, installed-file hashes, execution records, and the exact producer source closure are retained. External toolchain binaries are represented by version, size, and digest records rather than copied."
		, "The fixture covers all nineteen admitted primitive bases in acyclic records, variants, aliases, mixed Fin guards, and constructor-free results. It does not generalize to every nominal type."
		, "Constructor/source entry counts and memory are unmeasured. Consumer PHP source remains required at runtime. Refined callbacks, owned, recursive, dependent, and broader generic Subtypes remain separate work. This archive does not itself promote support or establish hosted acceptance."
	]
};

await mkdir(nominalPrimitiveSubtypePhpEvidence);
for(const [path, bytes] of files)
{
	const target = join(nominalPrimitiveSubtypePhpEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
	assert.deepEqual(await readFile(target), bytes);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(nominalPrimitiveSubtypePhpEvidence, "index.json"), indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: nominalPrimitiveSubtypePhpEvidence
	, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: nominalPrimitiveSubtypePhpProducer
	, indexSha256: sha256(indexBytes)
}) + "\n");
