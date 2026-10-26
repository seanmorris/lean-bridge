/**
 * Closed controls for retaining hosted nominal Subtype entry measurements.
 * Synthetic job records test the archive contract; they are not measurements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertNominalSubtypeEntryHostedSteps
	, nominalSubtypeEntryHostedLanes
	, nominalSubtypeEntryHostedSources
} from "./nominal-subtype-entry-hosted-evidence.mjs";

const contracts = Object.freeze({
	native: Object.freeze({
		workflow: ".github/workflows/nominal-subtype-entry-native.yml"
		, job: "Constructor and source entry in C with explicit C++ classification"
		, artifact: "nominal-subtype-entry-native-${{ github.sha }}"
		, producer: "390ae18d3a2607bc73463767a33fea0cfb9350b0"
	})
	, browser: Object.freeze({
		workflow: ".github/workflows/nominal-subtype-entry-browser.yml"
		, job: "Constructor and source entry in Node and three browsers"
		, artifact: "nominal-subtype-entry-browser-${{ github.sha }}"
		, producer: "4a5f3ad87b829e6363cd655d8d39d252344ba8a5"
	})
});
const acceptance = "Measure both source routes and classify both API modes";
const archive = "Preserve original and partial measurement records";
const enforce = "Enforce installed entry measurement";
const escape = value => value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const job = () => ({ steps: [
	{ name: "Set up job", number: 1, status: "completed"
		, conclusion: "success" }
	, { name: acceptance, number: 8, status: "completed"
		, conclusion: "success" }
	, { name: archive, number: 9, status: "completed"
		, conclusion: "success" }
	, { name: enforce, number: 10, status: "completed"
		, conclusion: "skipped" }
	, { name: "Complete job", number: 20, status: "completed"
		, conclusion: "success" }
] });

test("nominal entry hosted workflows expose one closed archive identity", async () => {
	assert.deepEqual(nominalSubtypeEntryHostedLanes, ["native", "browser"]);
	for(const contract of Object.values(contracts))
	{
		const source = await readFile(contract.workflow, "utf8");
		const count = (prefix, value) => [...source.matchAll(new RegExp(
			`^${escape(prefix)}${escape(value)}$`, "gmu"))].length;
		assert.equal(count("    name: ", contract.job), 1);
		for(const step of [acceptance, archive, enforce])
			assert.equal(count("      - name: ", step), 1, step);
		assert.equal(count("          name: ", contract.artifact), 1);
		assert.match(source
			, /uses: actions\/checkout@v6\n\s+with:\n\s+fetch-depth: 0\n\s+persist-credentials: false/u);
		assert.doesNotMatch(source, /continue-on-error:/u);
	}
});

test("nominal entry hosted source roles are closed and resolve", async () => {
	const archiveRevision = execFileSync("git", ["rev-parse", "HEAD"]
		, { encoding: "utf8" }).trim();
	for(const lane of nominalSubtypeEntryHostedLanes)
	{
		const contract = contracts[lane];
		const sources = nominalSubtypeEntryHostedSources(lane, {
			producer: contract.producer, archive: archiveRevision
		});
		assert.equal(new Set(sources.map(source =>
			`${source.role}:${source.path}`)).size, sources.length);
		for(const role of ["producer", "checker", "archiver"])
			assert.ok(sources.some(source => source.role === role), role);
		assert.ok(!sources.some(source => source.path.startsWith("docs/evidence/")));
		for(const source of sources)
		{
			if(source.role === "producer")
				assert.doesNotThrow(() => execFileSync("git", ["cat-file", "-e"
					, `${source.revision}:${source.path}`]));
			else assert.ok((await readFile(source.path)).length > 0, source.path);
		}
	}
	assert.throws(() => nominalSubtypeEntryHostedSources("unknown", {
		producer: "a".repeat(40), archive: "b".repeat(40)
	}));
});

test("nominal entry hosted jobs require successful measurement and archive", () => {
	for(const lane of nominalSubtypeEntryHostedLanes)
	{
		assert.doesNotThrow(() => assertNominalSubtypeEntryHostedSteps(
			lane, Buffer.from(JSON.stringify(job()))));
		for(const mutate of [
			value => { value.steps[1].status = "in_progress"; }
			, value => { value.steps[1].conclusion = "failure"; }
			, value => { value.steps[2].conclusion = "failure"; }
			, value => { value.steps[3].conclusion = "success"; }
			, value => { value.steps[2].number = 11; }
			, value => { value.steps[0].conclusion = "failure"; }
			, value => { value.steps.push({ ...value.steps[1] }); }
		]) {
			const changed = structuredClone(job()); mutate(changed);
			assert.throws(() => assertNominalSubtypeEntryHostedSteps(
				lane, Buffer.from(JSON.stringify(changed))));
		}
	}
});

test("nominal entry hosted archiver refuses incomplete command lines", () => {
	const result = spawnSync(process.execPath
		, ["scripts/archive-nominal-subtype-entry-evidence.mjs"]
		, { encoding: "utf8" });
	assert.equal(result.status, 2);
	assert.match(result.stderr
		, /^Usage: archive-nominal-subtype-entry-evidence\.mjs/u);
});
