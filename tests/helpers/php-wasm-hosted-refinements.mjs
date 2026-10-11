/**
 * Authenticate the original successful hosted PHP-Wasm refinement reports and entry probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readPhpWasmHostedMembers, phpWasmHostedArtifactSha256 } from "./php-wasm-hosted-artifact.mjs";
import { assertPhpWasmDirectFinReport, phpWasmDirectReportInputs } from "./php-wasm-fin-direct-report.mjs";
import { assertPhpWasmSubtypeReport, phpWasmSubtypeReportInput } from "./php-wasm-subtype-report.mjs";
import { assertPhpWasmSubtypeEntryReport, phpWasmSubtypeEntryReportInput } from "./php-wasm-subtype-entry-report.mjs";
import { assertPhpWasmSubtypeEntryTap } from "./php-wasm-subtype-entry-ci-tap.mjs";

export const phpWasmHostedRoot = "docs/evidence/php-wasm-hosted-refinements-20261011";
export const phpWasmHostedIndexSha256 = "10690926c4e39c4a6f98c49d8719b547f6e6cea9d46f3e0b3d0eb97be21e1e71";
export const phpWasmHostedRevision = "d177236cdc80b69ca2210b8fd19f59ba440d1dea";

/**
 * Recheck all six selected reports against independent fixtures and complete original probe inputs.
 *
 * @param members - Exact artifact member bytes; mutable only in negative tests.
 */
export const assertPhpWasmHostedReports = async members => {
	const json = path => { assert.ok(members.has(path), `Missing hosted member: ${path}`); return JSON.parse(members.get(path)); };
	const text = path => { assert.ok(members.has(path), `Missing hosted member: ${path}`); return members.get(path).toString(); };
	const direct = await phpWasmDirectReportInputs(), subtype = await phpWasmSubtypeReportInput(), entry = await phpWasmSubtypeEntryReportInput();
	assertPhpWasmSubtypeEntryTap(text("php-wasm-subtype-entry/run.tap"));
	for(const route of ["ordinary", "reviewed"])
	{
		assertPhpWasmDirectFinReport(json(`php-wasm-fin-direct/${route}.json`), `${route}-source`, direct);
		assertPhpWasmSubtypeReport(json(`php-wasm-subtype/${route}.json`), `${route}-source`, subtype);
		const prefix = `php-wasm-subtype-entry/${route}/`;
		const builds = [0, 1].map(index => {
			const base = `${prefix}build-${index}/`, observation = json(base + "observation.json");
			const units = observation.compiled.map(item => {
				assert.equal(basename(item.name), item.name); assert.match(item.name, /^[1-7]-[A-Za-z0-9_.]+\.c$/u);
				return { original: text(base + "c-inputs/" + item.name), probe: text(base + "c-probes/" + item.name) };
			});
			return { observation, units, model: json(base + "model.json"), sourceProbe: json(base + "source-probe.json"), commands: json(base + "commands.json") };
		});
		assertPhpWasmSubtypeEntryReport(json(prefix + "report.json"), route, entry, builds);
	}
	return { directFinExecutions: 48, subtypeExecutions: 24, instrumentedEntryConfigurations: 24 };
};

/**
 * Bind original GitHub metadata, logs, selected source snapshots and every ZIP member.
 *
 * @param read - Repository-relative byte reader, injectable for archive corruption controls.
 */
export const readPhpWasmHostedArchive = async (read = readFile) => {
	const indexBytes = await read(`${phpWasmHostedRoot}/index.json`);
	assert.equal(sha256(indexBytes), phpWasmHostedIndexSha256);
	const index = JSON.parse(indexBytes), files = new Map();
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "php-wasm-hosted-refinements-v1");
	assert.equal(index.revision, phpWasmHostedRevision); assert.equal(index.conclusion, "success");
	assert.deepEqual([index.runId, index.jobId, index.artifactId], [38071834965, 114270644073, 11685379051]);
	for(const item of index.files)
	{
		assert.ok(!item.path.startsWith("/") && !item.path.split("/").includes("..") && !files.has(item.path));
		const bytes = await read(`${phpWasmHostedRoot}/${item.path}`);
		assert.equal(bytes.length, item.bytes, item.path); assert.equal(sha256(bytes), item.sha256, item.path);
		files.set(item.path, bytes);
		if(item.gitPath)
		{
			assert.equal(item.gitRevision, index.revision);
			assert.equal(item.path, `sources/${item.gitPath}.txt`);
		}
	}
	const json = path => JSON.parse(files.get(path));
	const metadata = json("artifact.json"), job = json("job.json"), zip = files.get("artifact.zip");
	assert.equal(metadata.id, index.artifactId); assert.equal(metadata.workflow_run.id, index.runId);
	assert.equal(metadata.workflow_run.head_sha, index.revision);
	assert.equal(metadata.size_in_bytes, zip.length); assert.equal(metadata.digest, "sha256:" + phpWasmHostedArtifactSha256);
	assert.equal(job.id, index.jobId); assert.equal(job.run_id, index.runId); assert.equal(job.head_sha, index.revision);
	assert.equal(job.status, "completed"); assert.equal(job.conclusion, "success");
	const expectedSteps = [["Compare installed PHP-Wasm packages with the shared Lean corpus", "success"]
		, ["Enforce PHP support", "skipped"]];
	for(const [name, conclusion] of expectedSteps)
	{
		const steps = job.steps.filter(step => step.name === name);
		assert.equal(steps.length, 1); assert.equal(steps[0].conclusion, conclusion);
	}
	const log = files.get("job.log").toString();
	assert.doesNotMatch(log, /\bnot ok \d+ - /u);
	for(const line of ["Direct PHP-Wasm Fin reports verified: both fixtures, both source routes, all 48 executions. Dispatch is not measured."
		, "PHP-Wasm Subtype reports verified: both source routes, all 24 executions, 2024 checks each. Constructor and source dispatch are not measured."
		, "PHP-Wasm Subtype entry probes verified: ordinary/reviewed, 24 Node/Chromium configurations, 2024 assertions and 2030 measured calls each, plus unrefined controls. Separate instrumented packages; no unmodified-release entry claim."])
		assert.ok(log.includes(line), "Missing completed hosted report check");
	const members = readPhpWasmHostedMembers(zip);
	assert.equal(canonicalJson(Object.fromEntries([...members].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }]))), files.get("members.json").toString());
	return { index, files, members };
};
