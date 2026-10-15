#!/usr/bin/env node
/**
 * Retain four accepted primitive-base nominal PHP-Wasm selections and the first rejected 32-bit caller.
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
import { checkNominalPrimitiveSubtypePhpWasmControls } from "../tests/helpers/nominal-primitive-subtype-php-wasm-controls.mjs";
import { checkNominalPrimitiveSubtypePhpWasmReport } from "../tests/helpers/nominal-primitive-subtype-php-wasm-report.mjs";
import {
	assertNominalPrimitiveSubtypePhpWasmTap
	, nominalPrimitiveSubtypePhpWasmEvidence
	, nominalPrimitiveSubtypePhpWasmEvidenceSources
	, nominalPrimitiveSubtypePhpWasmLoadCeiling
	, nominalPrimitiveSubtypePhpWasmOriginal
	, nominalPrimitiveSubtypePhpWasmProducer
	, nominalPrimitiveSubtypePhpWasmSelections
} from "../tests/helpers/nominal-primitive-subtype-php-wasm-provenance.mjs";

assert.equal(process.argv.length, 2, "The five frozen attempts take no arguments");
await assert.rejects(access(nominalPrimitiveSubtypePhpWasmEvidence), { code: "ENOENT" });
const attempts = Object.freeze({
	"ordinary-full": "build/vo1497-php-wasm-installed-ordinary-full-r2"
	, "ordinary-result-only": "build/vo1497-php-wasm-installed-ordinary-result-only-r1"
	, "reviewed-full": "build/vo1497-php-wasm-installed-reviewed-full-r1"
	, "reviewed-result-only": "build/vo1497-php-wasm-installed-reviewed-result-only-r1"
});
const failedRoot = "build/vo1497-php-wasm-installed-ordinary-full-r1";
const failedProducer = "d1974b22c9ea4bb19da90817d9a08d6a6d880a28";
const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const expectedControls = (records, mode) => ({
	recordControls: records * 2, semanticControls: mode === "full" ? 55 : 53
});

const runs = [];
for(const [route, mode] of nominalPrimitiveSubtypePhpWasmSelections)
{
	const label = `${route}-${mode}`, root = attempts[label], records = join(root, "records", route, mode);
	const originals = new Map();
	for(const path of await nativeArtifactPaths(records)) originals.set(path, await readFile(join(records, path)));
	const options = { route, mode, producerCommit: nominalPrimitiveSubtypePhpWasmProducer };
	const checked = await checkNominalPrimitiveSubtypePhpWasmReport(path => Promise.resolve(originals.get(path)), options);
	assert.deepEqual([...originals.keys()].sort(), checked.records);
	const controlled = await checkNominalPrimitiveSubtypePhpWasmControls(originals, options);
	const controls = expectedControls(checked.records.length, mode); assert.deepEqual(controlled, controls);
	for(const [path, bytes] of originals) put(`${label}/records/${path}`, bytes);
	const tap = await readFile(root + ".tap"); assertNominalPrimitiveSubtypePhpWasmTap(tap.toString(), route, mode);
	put(`${label}/run.tap`, tap);
	runs.push({
		label, route, mode, attempt: basename(root)
		, producerCommit: nominalPrimitiveSubtypePhpWasmProducer
		, loadCeiling: nominalPrimitiveSubtypePhpWasmLoadCeiling
		, records: checked.records.length, executions: checked.executions
		, counts: checked.counts, packageFiles: checked.packageFiles
		, dispatchObserved: checked.dispatchObserved, controls
		, reportSha256: sha256(originals.get("report.json")), tapSha256: sha256(tap)
	});
}

const failureRecords = join(failedRoot, "records/ordinary/full");
const failurePaths = await nativeArtifactPaths(failureRecords);
for(const path of failurePaths) put(`rejected-ordinary-full-r1/records/${path}`, await readFile(join(failureRecords, path)));
const failedTap = await readFile(failedRoot + ".tap");
assert.equal(sha256(failedTap), "f3c1ac1c3e2aacd255891bccb06f852d5405e86bc301e2919d3a17d7d472f436");
assert.match(failedTap.toString(), /^not ok 1 - installed primitive-base nominal PHP-Wasm packages reproduce and relocate ordinary full$/mu);
assert.match(failedTap.toString(), /Expected an int without numeric coercion/u);
assert.match(failedTap.toString(), /Packet->__construct\(NULL, true, 44, 44,[^\n]*-2147483648\.0/u);
assert.match(failedTap.toString(), /# pass 0\n# fail 1/u);
put("rejected-ordinary-full-r1/run.tap", failedTap);
const changedSources = [
	"tests/helpers/nominal-primitive-subtype-php-wasm-fixture.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-tests.mjs"
];
for(const path of changedSources)
	put(`rejected-ordinary-full-r1/sources/${path}`, nominalPrimitiveSubtypePhpWasmOriginal(failedProducer, path));

const selectedSources = nominalPrimitiveSubtypePhpWasmEvidenceSources();
for(const path of selectedSources)
	put("sources/" + path, nominalPrimitiveSubtypePhpWasmOriginal(nominalPrimitiveSubtypePhpWasmProducer, path));
const checkerPaths = [
	"tests/helpers/nominal-primitive-subtype-php-wasm-controls.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-directory.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-provenance.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-report.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-sources.mjs"
];
for(const path of checkerPaths) put("checkers/" + basename(path), await readFile(path));

const rejected = {
	label: "ordinary-full-r1", producerCommit: failedProducer
	, loadCeiling: nominalPrimitiveSubtypePhpWasmLoadCeiling
	, records: failurePaths.length, tapSha256: sha256(failedTap), changedSources
	, classification: "rejected before Lean dispatch because the decimal -2147483648 literal became a float in 32-bit PHP; the accepted caller uses PHP_INT_MIN"
};
const index = {
	schemaVersion: 1, kind: "nominal-primitive-subtype-php-wasm-installed-v1"
	, producerCommit: nominalPrimitiveSubtypePhpWasmProducer
	, loadCeiling: nominalPrimitiveSubtypePhpWasmLoadCeiling
	, runs, rejected, selectedSources
	, checkers: checkerPaths.map(path => basename(path))
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: [
		"Local Linux x64 acceptance in wasm32 PHP 8.4.1 under Node 22.23.2 and Chromium 152.0.7977.75, not final current-revision hosted acceptance."
		, "Four ordinary/reviewed full/result-only selections reproduce complete Composer API, npm runtime, and npm component packages from two author roots, install offline after author removal, and replay after relocation."
		, "Each selection covers Node embedded and Composer arrangements plus Chromium bundled execution, startup and lazy loading, weak and strict PHP, twelve execution tuples, and two unchanged-deployment passes per tuple."
		, "The full caller performs 1,821 checks with 283 expected Lean refusals per execution. The result-only caller performs 612 checks without input constructors. Both modes include eight host-side refusals and twelve immutable-input controls per execution."
		, "Accepted selections ran serially with a local load ceiling of 8. Disk and memory floors remained 2 GiB. A higher ceiling was neither needed nor used."
		, "Complete original package archives, receipts, installed-file hashes, execution records, TAP, the first rejected 32-bit caller, and the exact producer source closure are retained. External toolchain binaries are represented by identities rather than copied."
		, "The fixture covers all nineteen admitted primitive bases in acyclic records, variants, aliases, mixed Fin guards, and constructor-free results. Consumer PHP source remains required at runtime. Refined callbacks, owned, recursive, dependent, dispatch, and broader generic Subtypes remain separate work."
	]
};

await mkdir(nominalPrimitiveSubtypePhpWasmEvidence);
for(const [path, bytes] of files)
{
	const target = join(nominalPrimitiveSubtypePhpWasmEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(nominalPrimitiveSubtypePhpWasmEvidence, "index.json"), indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: nominalPrimitiveSubtypePhpWasmEvidence
	, files: files.size + 1
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, indexBytes.length)
	, producerCommit: nominalPrimitiveSubtypePhpWasmProducer
	, indexSha256: sha256(indexBytes)
}) + "\n");
