/**
 * Authenticate the four original browser runs before promoting their exact public positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordBrowserRoutes } from "./checked-record-browser-fixture.mjs";
import { checkedRecordBrowserRecords } from "./checked-record-browser-report.mjs";
import { checkCheckedRecordBrowserCiRecords } from "./checked-record-browser-ci-report.mjs";

export const checkedRecordBrowserArchiveRoot = "docs/evidence/checked-record-browser-20261011";
export const checkedRecordBrowserArchiveIndex = "8a7284d2dbb30071f44a972c3c0726007ca59181864ed81ea2916938f1a5d518";
export const checkedRecordBrowserProfiles = Object.freeze(["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]);
export const checkedRecordBrowserConversion = "Pass only payload fields: Interval {lo, hi}, Triple {data} for Sized 3, and Percent {value} for Bounded 0 101, using bigint and bigint[] values. The selected Lean constructor checks or normalizes each input; constructor rejection identifies the parameter and constructor. Calls preserve complete caller inputs, and later valid calls recover. Results contain copied payloads without proofs. Ordinary and independently reviewed packages, including standalone result-only packages, passed Node, page, React and worker checks in all three browser engines.";
export const checkedRecordBrowserLimit = "Only top-level Interval, Sized 3 and Bounded 0 101 inputs/results are established. Nested/refined/recursive/inherited checked records, other index kinds, general dependent or zero-payload records, callbacks and owned positions remain unreviewed. These local Node/Chromium/Firefox/WebKit observations do not establish hosted or PHP-Wasm acceptance. Internal dispatch counts and memory are unmeasured. The archive retains selected producer sources and package digests, not package binaries or a complete toolchain closure.";
const validators = [
	"tests/helpers/checked-record-browser-promotion.mjs"
	, "tests/helpers/checked-record-browser-promotion-tests.mjs"
	, "tests/helpers/checked-record-browser-npm-report.mjs"
	, "tests/helpers/checked-record-browser-report.mjs"
	, "tests/helpers/checked-record-browser-fixture.mjs"
	, "tests/helpers/checked-record-browser-ci-report.mjs"
	, "scripts/run-checked-record-browser-ci.sh"
	, "scripts/check-checked-record-browser-ci.mjs"
	, ".github/workflows/checked-record-browser.yml"
];
const safePath = path => {
	assert.equal(typeof path, "string"); assert.ok(!/[\\:\0]/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
};
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

/**
 * Read immutable originals and compare selected sources with each actual Git producer.
 *
 * @param read - Repository byte reader, replaceable for missing/corruption controls.
 */
export const checkedRecordBrowserReferences = async (read = readFile) => {
	const root = checkedRecordBrowserArchiveRoot, bytes = await read(`${root}/index.json`);
	assert.equal(sha256(bytes), checkedRecordBrowserArchiveIndex);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index)); assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "checked-record-browser-installed-v1"); assert.equal(index.files.length, 425);
	assert.deepEqual(index.runs.map(run => run.route), checkedRecordBrowserRoutes);
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
		const original = path => { safePath(path); assert.ok(files.has(path), path); return files.get(path); };
		const start = JSON.parse(original(`${run.route}/start.json`)), end = JSON.parse(original(`${run.route}/end.json`));
		const tap = original(`${run.route}/run.tap`).toString(), prefix = `${run.route}/records/`;
		assert.equal(start.route, run.route); assert.equal(start.revision, run.producerCommit);
		assert.equal(start.runnerSha256, sha256(original("runner.mjs")));
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
		assert.ok(Date.parse(start.started) >= previousEnd && Date.parse(end.finished) > Date.parse(start.started));
		previousEnd = Date.parse(end.finished);
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, "chromium,firefox,webkit");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_ROUTES, run.route);
		assert.equal(start.command, "/usr/bin/taskset"); assert.deepEqual(start.args.slice(0, 2), ["-c", "3"]);
		assert.deepEqual(start.args.slice(3), ["--test", "--test-reporter=tap", "--test-concurrency=1", "tests/helpers/checked-record-browser-installed-tests.mjs"]);
		assert.deepEqual([...files.keys()].filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length)).sort(), [...checkedRecordBrowserRecords].sort());
		const counts = await checkCheckedRecordBrowserCiRecords({ route: run.route, producer: run.producerCommit, directory: "retained", tap: "original" }, { tap, read: async path => original(prefix + path) });
		assert.deepEqual(counts, Object.fromEntries(Object.entries(run).filter(([key]) => !["tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(original(prefix + "report.json")));
		const report = JSON.parse(original(prefix + "report.json"));
		const resultOnly = run.route.startsWith("result-only-");
		const command = [...Object.entries(start.environment).map(([key, value]) => {
			assert.match(key, /^[A-Z_][A-Z0-9_]*$/u); assert.equal(typeof value, "string");
			return key + "=" + quote(value);
		})
		, quote(start.command), ...start.args.map(quote)].join(" ");
		const selected = index.files.filter(file => file.path.startsWith(run.route + "/")
			|| file.path.startsWith(`sources/${run.producerCommit}/`) || file.path === "runner.mjs" || file.path.startsWith("checkers/"));
		references.push({ id: `checked-record-browser-${run.route}-installed`
			, profiles: [...checkedRecordBrowserProfiles]
			, sourcePath: run.route.replace(/^result-only-/u, "")
			, positions: resultOnly ? ["result"] : ["parameter", "result"], resultOnly
			, revision: run.producerCommit, command, counts
			, scope: `Two reproduced author builds, source-free offline installation, strict TypeScript and two Node executions including physical installed-tree relocation. Twelve Chromium/Firefox/WebKit page, React production/Strict Mode and worker executions cover 51 lifecycle observations. ${resultOnly ? "Standalone result-only packages check 2011 assertions and 1002 calls/snapshots, including exact 2^80 and 2^80+1 results without checked-input metadata." : "Full packages check 16176 assertions, 3031 expected rejections, 8088 calls/snapshots and 3031 recoveries per observation, including constructor selection and normalization."} ${checkedRecordBrowserLimit}`
			, files: [{ path: `${root}/index.json`, sha256: checkedRecordBrowserArchiveIndex }, ...selected.map(file => ({ path: `${root}/${file.path}`, sha256: file.sha256 }))]
			, artifacts: [report.receipt.package, report.receipt.runtime].map(item => ({ path: item.archive, sha256: item.sha256 })) });
	}
	return references;
};

/**
 * Supplement eight Node cells and add twelve browser cells, preserving all other claims.
 *
 * @param original - Exact inventory before promotion.
 * @param references - Complete independently authenticated original selections.
 */
export const promoteCheckedRecordBrowsers = async (original, references) => {
	assert.deepEqual(references, await checkedRecordBrowserReferences());
	const inventory = structuredClone(original);
	const sources = await Promise.all(validators.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...sources, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({ ...item, path: reference.id + "/" + item.path })) });
	}
	for(const profile of checkedRecordBrowserProfiles) for(const path of ["ordinary-source", "reviewed-ir"])
		for(const position of ["parameter", "result"])
		{
			const matches = references.filter(item => item.sourcePath === path && item.positions.includes(position));
			assert.equal(matches.length, position === "result" ? 2 : 1);
			const scope = matches.map(item => item.scope).join(" ");
			const existing = inventory.observations.filter(item => item.profiles.includes(profile) && item.path === path && item.shapes.includes("checked-record") && item.positions.includes(position));
			assert.equal(existing.length, profile.startsWith("node-") ? 1 : 0, "Missing or overlapping checked-record cell: " + profile);
			const notes = {
				analysis: "Fresh Lean reconciles erased proofs, closed Nat indices and exact per-site constructors on both author routes."
				, generation: "Payload-only structural records retain bigint and bigint[] types without proof fields."
				, compilation: "Compiled Lean constructs checked inputs through the selected constructor and projects result payloads."
				, packaging: "Two author roots reproduce archives before source removal, offline installation and physical installed Node-tree relocation. Browser bundles run source-free with external networking blocked."
				, installedExecution: scope
			};
			assert.deepEqual(Object.keys(notes), inventory.stages);
			if(existing.length)
			{
				const observation = existing[0];
				assert.deepEqual(observation.profiles, [profile]); assert.deepEqual(observation.shapes, ["checked-record"]); assert.deepEqual(observation.positions, [position]);
				observation.scope += " Additional installed browser-package acceptance: " + scope;
				observation.limitations.push(checkedRecordBrowserLimit);
				for(const [stage, value] of Object.entries(observation.stages))
				{
					assert.equal(value.state, "passed"); value.evidence.push(...matches.map(item => item.id));
					assert.equal(new Set(value.evidence).size, value.evidence.length);
					value.note += " Additional installed browser-package acceptance: " + notes[stage];
				}
			}
			else inventory.observations.push({ id: `checked-record-browser-${profile}-${path}-${position}`
				, profiles: [profile], shapes: ["checked-record"]
				, positions: [position], path, scope
				, hostTypes: { "checked-record": { [position]: position === "parameter" ? "Object with bigint and bigint[] payload fields" : "Copied object with bigint and bigint[] payload fields" } }
				, conversionNotes: { "checked-record": checkedRecordBrowserConversion }
				, limitations: [checkedRecordBrowserLimit]
				, stages: Object.fromEntries(inventory.stages.map(stage => [stage, { state: "passed", evidence: matches.map(item => item.id), note: notes[stage] }])) });
		}
	return inventory;
};
