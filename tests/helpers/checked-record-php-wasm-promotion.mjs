/**
 * Bind PHP-Wasm checked-record support to four original installed package runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordPhpWasmRecords } from "./checked-record-php-wasm-report.mjs";
import { checkCheckedRecordPhpWasmCiRecords } from "./checked-record-php-wasm-ci-report.mjs";

export const checkedRecordPhpWasmArchiveRoot = "docs/evidence/checked-record-php-wasm-20261011";
export const checkedRecordPhpWasmArchiveIndex = "af276809d2a1a9eab267650a4e08ad0d7ba0bae3037a10722364502250b38e6b";
export const checkedRecordPhpWasmProfiles = Object.freeze(["php-wasm"]);
export const checkedRecordPhpWasmConversion = "Pass generated record objects with only payload fields: Interval {lo, hi}, Triple {data} for Sized 3, and Percent {value} for Bounded 0 101. Nat payloads use Brick\\Math\\BigInteger, including small values; data is a consecutive-key array of BigInteger values. Lean runs the constructor selected for each parameter, including normalization. Rejection names the parameter and constructor, preserves complete caller inputs, and permits later valid calls. Results contain copied payloads without proofs. Ordinary, independently reviewed and standalone result-only packages passed weak/strict and startup/lazy Node/Chromium checks on wasm32 PHP 8.4.1.";
export const checkedRecordPhpWasmLimit = "Only top-level Interval, Sized 3 and Bounded 0 101 inputs/results are established. Nested/refined/recursive/inherited checked records, other index kinds, general dependent or zero-payload records, callbacks and owned positions remain unreviewed. These local wasm32 PHP 8.4.1 Node/Chromium observations do not establish hosted acceptance or other PHP/browser versions. Internal dispatch counts and memory are unmeasured. The archive retains selected producer sources and package digests, not package binaries or a complete toolchain closure.";
const routes = ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"];
const validators = [
	"tests/helpers/checked-record-php-wasm-promotion.mjs"
	, "tests/helpers/checked-record-php-wasm-promotion-tests.mjs"
	, "tests/helpers/checked-record-php-wasm-report.mjs"
	, "tests/helpers/checked-record-php-wasm-fixture.mjs"
	, "tests/helpers/checked-record-php-wasm-ci-report.mjs"
	, "scripts/run-checked-record-php-wasm-ci.sh"
	, "scripts/check-checked-record-php-wasm-ci.mjs"
	, "scripts/check-checked-record-php-wasm-compiler-ci.mjs"
	, ".github/workflows/checked-record-php-wasm.yml"
];
const safePath = path => {
	assert.equal(typeof path, "string"); assert.ok(!/[\\:\0]/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
};
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Authenticate original runtime, compiler, package, caller and execution records.
 *
 * @param read - Repository byte reader, replaceable for missing/corruption controls.
 */
export const checkedRecordPhpWasmReferences = async (read = readFile) => {
	const root = checkedRecordPhpWasmArchiveRoot, bytes = await read(`${root}/index.json`);
	assert.equal(sha256(bytes), checkedRecordPhpWasmArchiveIndex);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index)); assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "checked-record-php-wasm-installed-v1"); assert.equal(index.files.length, 228);
	assert.deepEqual(index.runs.map(run => run.route), routes);
	assert.deepEqual(index.producerCommits, [...new Set(index.runs.map(run => run.producerCommit))]);
	for(const file of index.files)
	{
		safePath(file.path); assert.ok(!files.has(file.path));
		const value = await read(`${root}/${file.path}`);
		assert.equal(value.length, file.bytes, file.path); assert.equal(sha256(value), file.sha256, file.path);
		files.set(file.path, value);
	}
	assert.equal(index.selectedSources.length, 38);
	for(const revision of index.producerCommits) for(const path of index.selectedSources)
	{
		safePath(path); assert.match(revision, /^[a-f0-9]{40}$/u);
		assert.deepEqual(files.get(`sources/${revision}/${path}`), execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 }));
	}
	const references = []; let previousEnd = 0;
	for(const run of index.runs)
	{
		assert.equal(run.label, run.route);
		const original = path => { safePath(path); assert.ok(files.has(path), path); return files.get(path); };
		const start = JSON.parse(original(`${run.route}/start.json`)), end = JSON.parse(original(`${run.route}/end.json`));
		const tap = original(`${run.route}/run.tap`).toString(), runtime = original(`${run.route}/runtime.json`);
		const prefix = `${run.route}/records/`;
		assert.equal(start.route, run.route); assert.equal(start.revision, run.producerCommit);
		assert.equal(start.runnerSha256, sha256(original("runner.mjs")));
		assert.equal(start.runtimeSha256, sha256(runtime));
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
		assert.ok(Date.parse(start.started) >= previousEnd && Date.parse(end.finished) > Date.parse(start.started));
		previousEnd = Date.parse(end.finished);
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_ROUTES, run.route);
		assert.equal(start.command, "/usr/bin/taskset"); assert.deepEqual(start.args.slice(0, 2), ["-c", "3"]);
		assert.deepEqual(start.args.slice(3), ["--test", "--test-reporter=tap", "--test-concurrency=1", "tests/helpers/checked-record-php-wasm-installed-tests.mjs"]);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), checkedRecordPhpWasmRecords(run.route).sort());
		const counts = await checkCheckedRecordPhpWasmCiRecords({ route: run.route, producer: run.producerCommit, directory: "retained", tap: "original" }, { tap, read: async path => original(prefix + path) });
		assert.deepEqual(counts, Object.fromEntries(Object.entries(run).filter(([key]) => !["label", "tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(original(prefix + "report.json")));
		const report = JSON.parse(original(prefix + "report.json"));
		assert.deepEqual(report.phpWasm.runtime, JSON.parse(runtime));
		const resultOnly = run.route.startsWith("result-only-");
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.route + "/")
			|| file.path.startsWith(`sources/${run.producerCommit}/`) || ["runner.mjs", "checker.mjs"].includes(file.path));
		references.push({
			id: `checked-record-php-wasm-${run.route}-installed`
			, profiles: [...checkedRecordPhpWasmProfiles]
			, sourcePath: run.route.replace(/^result-only-/u, "")
			, positions: resultOnly ? ["result"] : ["parameter", "result"]
			, resultOnly, revision: run.producerCommit, command, counts
			, scope: `Two reproduced author builds, source-free offline npm/Composer installation, physical installed-tree relocation and unchanged replay. Eight Node embedded/Composer and four Chromium bundled executions cover weak/strict callers and startup/lazy loading on wasm32 PHP 8.4.1. ${resultOnly ? "Standalone result-only packages check 2007 assertions and 1004 calls/snapshots per context, including exact 2^80+1 and 2^100 results without checked-input metadata." : "Full packages check 18048 assertions, 4009 constructor rejections and 9023 calls/snapshots per context, including per-site constructor selection, normalization, unchanged inputs and recovery."} ${checkedRecordPhpWasmLimit}`
			, files: [{ path: `${root}/index.json`, sha256: checkedRecordPhpWasmArchiveIndex }, ...selected.map(file => ({ path: `${root}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: report.phpWasm.packageSet.archives.map(item => ({ path: item.archive, sha256: item.sha256 }))
		});
	}
	return references;
};

/**
 * Add only four PHP-Wasm parameter/result cells, retaining every existing claim.
 *
 * @param original - Exact inventory before promotion.
 * @param references - Complete authenticated original selections.
 */
export const promoteCheckedRecordPhpWasm = async (original, references) => {
	assert.deepEqual(references, await checkedRecordPhpWasmReferences());
	const inventory = structuredClone(original);
	const sources = await Promise.all(validators.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision, command: reference.command
			, scope: reference.scope, files: [...sources, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const path of ["ordinary-source", "reviewed-ir"]) for(const position of ["parameter", "result"])
	{
		const matches = references.filter(item => item.sourcePath === path && item.positions.includes(position));
		assert.equal(matches.length, position === "result" ? 2 : 1);
		assert.equal(inventory.observations.filter(item => item.profiles.includes("php-wasm") && item.path === path && item.shapes.includes("checked-record") && item.positions.includes(position)).length, 0, "Overlapping checked-record PHP-Wasm cell");
		const scope = matches.map(item => item.scope).join(" ");
		const notes = {
			analysis: "Fresh Lean reconciles erased proofs, closed Nat indices and exact per-site constructors on both author routes."
			, generation: "Generated PHP records contain only BigInteger payloads or consecutive-key arrays of BigInteger values."
			, compilation: "Compiled wasm32 Lean constructs checked inputs through the selected constructor and projects result payloads."
			, packaging: "Two author roots reproduce npm/Composer archives before source removal, offline installation and physical installed-tree relocation."
			, installedExecution: scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({ id: `checked-record-php-wasm-${path}-${position}`
			, profiles: ["php-wasm"], shapes: ["checked-record"]
			, positions: [position], path, scope
			, hostTypes: { "checked-record": { [position]: "Generated record with BigInteger payloads and list<BigInteger> fields" } }
			, conversionNotes: { "checked-record": checkedRecordPhpWasmConversion }
			, limitations: [checkedRecordPhpWasmLimit]
			, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: matches.map(item => item.id), note: notes[stage] }])) });
	}
	return inventory;
};
