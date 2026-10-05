/**
 * Freeze exact installed PHP-Wasm callback-result reports as compressed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";
import { assertOwnedPhpWasmCallbackResultEvidence, ownedPhpWasmCallbackResultCommand,
	ownedPhpWasmCallbackResultEvidencePath, ownedPhpWasmCallbackResultScope,
	ownedPhpWasmCallbackResultVariants, packOwnedPhpWasmCallbackResultReports } from "../tests/helpers/owned-php-wasm-callback-result-evidence.mjs";

const arguments_ = process.argv.slice(2);
assert.ok(arguments_.length === 0 || arguments_.length === 1, "Optionally supply the report directory.");
const directory = arguments_[0] ?? "build/owned-php-wasm-callback-results";
const reportNames = Object.keys(ownedPhpWasmCallbackResultVariants).map(name => `${name}-packages.json`);
const reports = Object.fromEntries(await Promise.all(reportNames.map(async name => [name, await readFile(`${directory}/${name}`)])));
const sourcePaths = [
	"package.json"
	, "src/analyze/export-configuration.mjs"
	, "src/backends/php/owned-zend-borrows.mjs"
	, "src/backends/php/owned-zend-callbacks.mjs"
	, "src/backends/php/owned-zend-extension.mjs"
	, "src/backends/php/owned-zend-model.mjs"
	, "src/backends/php/owned-zend-php.mjs"
	, "src/build/elaborated-component.mjs"
	, "src/build/multi-profile-project.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-owned-component.mjs"
	, "src/build/php-wasm-owned-model.mjs"
	, "src/build/php-wasm-project.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/owned-php-wasm-callback-results.test.mjs"
];
const sources = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, sha256(await readFile(path))])));
const record = { schemaVersion: 1
	, kind: "owned-php-wasm-callback-results"
	, planNode: 1219
	, acceptance: "passed"
	, recordedAt: "2026-10-03"
	, command: ownedPhpWasmCallbackResultCommand
	, scope: ownedPhpWasmCallbackResultScope
	, runtimeIdentity: JSON.parse(reports[reportNames[0]]).runtimeIdentity
	, sources
	, reports: packOwnedPhpWasmCallbackResultReports(reports) };
await assertOwnedPhpWasmCallbackResultEvidence(record);
await saveLakeFile(".", ownedPhpWasmCallbackResultEvidencePath, JSON.stringify(record, null, 2) + "\n");
process.stdout.write(`${ownedPhpWasmCallbackResultEvidencePath}: ${sha256(canonicalJson(record))}\n`);
