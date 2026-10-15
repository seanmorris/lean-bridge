#!/usr/bin/env node
/**
 * Freeze the accepted recursive checked-Subtype PHP-Wasm package runs once.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";

const producerCommit = "a54f8c653af24440754ff274df9095b54680f547";
const evidence = "docs/evidence/recursive-subtype-php-wasm-20261015";
const buildRoot = "build/recursive-subtypes/php-wasm";
const routes = Object.freeze([
	{ route: "ordinary", sourcePath: "ordinary-source" }
	, { route: "reviewed", sourcePath: "reviewed-ir" }
]);
const selectedSources = Object.freeze([
	".github/workflows/recursive-subtype-php-wasm.yml"
	, "scripts/run-recursive-subtype-php-wasm-ci.sh"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/php/copied-graph-zend.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/fixtures/onboarding/recursive-subtypes/RecursiveSubtypes.lean"
	, "tests/fixtures/recursive-subtype-consumers/php-wasm.php"
	, "tests/helpers/recursive-subtype-fixture.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-tests.mjs"
	, "tests/recursive-subtype-php-wasm.test.mjs"
]);

assert.equal(process.argv.length, 2, "The frozen archive takes no arguments");
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
	producerCommit, "The evidence archive is draft-only at its exact producer commit");
await assert.rejects(access(evidence), { code: "ENOENT" });

const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path);
	files.set(path, Buffer.from(bytes));
};
for(const path of selectedSources) put("sources/" + path, await readFile(path));

const runs = [];
for(const { route, sourcePath } of routes)
{
	const reportSource = join(buildRoot, `${route}.json`);
	const handoffSource = join(buildRoot, "handoff", route);
	const reportBytes = await readFile(reportSource);
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString(), canonicalJson(report));
	assert.equal(report.route, route); assert.equal(report.profile, "php-wasm");
	assert.deepEqual(report.observation, { checks: 24, php: "8.4.1", word_bits: 32 });
	assert.equal(report.phpWasm.executions.length, 12);
	const reportPath = `${route}/report.json`; put(reportPath, reportBytes);

	const receiptBytes = await readFile(join(handoffSource, "package-set-receipt.json"));
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.equal(sha256(receiptBytes), report.receiptSha256);
	const receiptPath = `${route}/package-set-receipt.json`; put(receiptPath, receiptBytes);
	const checksumBytes = await readFile(join(handoffSource, "package-set-receipt.json.sha256"));
	assert.equal(checksumBytes.toString(), `${report.receiptSha256}  package-set-receipt.json\n`);
	const checksumPath = `${route}/package-set-receipt.json.sha256`; put(checksumPath, checksumBytes);

	const archives = [];
	for(const artifact of receipt.packages.flatMap(item => item.artifacts))
	{
		const bytes = await readFile(join(handoffSource, artifact.path));
		assert.equal(bytes.length, artifact.bytes); assert.equal(sha256(bytes), artifact.sha256);
		assert.equal(report.archives[artifact.path], artifact.sha256);
		const path = `${route}/${artifact.path}`; put(path, bytes);
		archives.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
	}
	runs.push({
		route, sourcePath, reportPath, reportSha256: sha256(reportBytes)
		, receiptPath, receiptSha256: sha256(receiptBytes), checksumPath
		, executions: report.phpWasm.executions.length
		, checks: report.observation.checks
		, archives
	});
}

const index = {
	schemaVersion: 1
	, kind: "recursive-subtype-php-wasm-installed-v1"
	, producerCommit
	, loadCeiling: 8
	, diskFloorBytes: 2 * 1024 * 1024 * 1024
	, runs
	, selectedSources
	, limitations: [
		"The fixture covers selected checked Subtype constructors and Fin bounds in a recursive variant, its alias, and nested Array and Option carriers."
		, "Recursive checked records, generic record instantiations, owned values, callbacks, and dependent types remain separate work."
		, "The runs reject cycles and values deeper than 128 copied levels. They do not claim support for cyclic Lean values."
		, "The evidence records twelve Node and Chromium execution arrangements for each author route on wasm32 PHP 8.4.1."
		, "Dispatch counts and peak memory were not measured."
		, "External compiler, browser, Node, PHP, and Composer binaries are represented by recorded identities rather than copied."
		, "Absolute temporary paths inside the reports describe the original runs and are not CI prerequisites."
	]
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
};

await mkdir(evidence);
for(const [path, bytes] of files)
{
	const target = join(evidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(evidence, "index.json"), indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: evidence, files: files.size + 1
	, bytes: [...files.values()].reduce((total, bytes) => total + bytes.length, indexBytes.length)
	, producerCommit, indexSha256: sha256(indexBytes)
}));
