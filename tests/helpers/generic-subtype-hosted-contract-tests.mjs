/**
 * Fail closed when a generic-Subtype producer drifts from the archive contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	genericSubtypeHostedContracts, genericSubtypeHostedLaneNames
} from "./generic-subtype-hosted-contracts.mjs";
import {
	assertGenericSubtypeHostedTap, genericSubtypeHostedSafePath
	, replayGenericSubtypeHostedOutput
} from "./generic-subtype-hosted-output.mjs";
import {
	assertGenericSubtypeHostedSteps
} from "./generic-subtype-hosted-evidence.mjs";
import {
	genericSubtypeEvidenceSources
} from "./generic-subtype-hosted-evidence-sources.mjs";

const escape = value => value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");

test("generic Subtype hosted contracts partition every non-PHP-Wasm profile", () => {
	assert.equal(genericSubtypeHostedLaneNames.length, 12);
	const installed = genericSubtypeHostedLaneNames.filter(lane =>
		lane !== "foundation").flatMap(lane =>
		genericSubtypeHostedContracts[lane].profiles);
	assert.equal(installed.length, 21);
	assert.deepEqual([...new Set(installed)].sort(), [
		"browser-javascript", "browser-react", "browser-worker", "c", "cpp"
		, "dotnet", "java", "kotlin", "node-javascript", "node-typescript"
		, "perl", "php-native", "python", "ruby", "rust", "wit-wasi"
	]);
	assert.equal(genericSubtypeHostedContracts["npm-ordinary"].profiles.length, 5);
	assert.deepEqual(genericSubtypeHostedContracts.foundation.profiles, []);
});

test("every generic Subtype archive identity is present exactly once in its workflow", async () => {
	const sources = new Map();
	for(const contract of Object.values(genericSubtypeHostedContracts))
	{
		if(!sources.has(contract.workflow))
			sources.set(contract.workflow, await readFile(contract.workflow, "utf8"));
		const source = sources.get(contract.workflow);
		const exactLine = (prefix, value) => [...source.matchAll(new RegExp(
			`^${escape(prefix)}${escape(value)}$`, "gmu"))].length;
		const job = contract.workflowJob ?? contract.job;
		assert.equal(exactLine("    name: ", job), 1, `${contract.lane}: ${job}`);
		for(const step of [contract.acceptanceStep, contract.enforceStep])
			assert.equal(exactLine("      - name: ", step), 1
				, `${contract.lane}: ${step}`);
		const artifactName = `${contract.workflowArtifactPrefix
			?? contract.artifactPrefix}-\${{ github.sha }}`;
		assert.equal(exactLine("          name: ", artifactName)
			, 1, `${contract.lane}: ${artifactName}`);
		assert.match(source, /uses: actions\/checkout@v6\n\s+with:\n\s+fetch-depth: 0\n\s+persist-credentials: false/u);
		assert.doesNotMatch(source, /continue-on-error:/u);
	}
});

test("generic Subtype hosted replay rejects unsafe paths and incomplete TAP", () => {
	for(const path of ["../report.json", "/report.json", "a//b", "a/./b"
		, "a\\b", "a b", ""])
		assert.throws(() => genericSubtypeHostedSafePath(path), undefined, path);
	assert.equal(genericSubtypeHostedSafePath("records/ordinary/report.json")
		, "records/ordinary/report.json");
	const label = "installed native generic Subtype compositions reproduce and relocate ordinary full";
	const complete = `TAP version 13\n# Subtest: ${label}\nok 1 - ${label}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1.5\n`;
	assert.doesNotThrow(() => assertGenericSubtypeHostedTap(complete, label));
	assert.throws(() => assertGenericSubtypeHostedTap(
		complete.replace("# pass 1", "# pass 0"), label));
	assert.throws(() => assertGenericSubtypeHostedTap(
		complete.replace("ok 1", "not ok 1"), label));
});

test("generic Subtype hosted source roles resolve at the exact current revision", () => {
	const revision = execFileSync("git", ["rev-parse", "HEAD"]
		, { encoding: "utf8" }).trim();
	for(const lane of genericSubtypeHostedLaneNames)
	{
		const sources = genericSubtypeEvidenceSources(lane, {
			producer: revision, consumer: revision
			, checker: revision, archiver: revision
		});
		assert.ok(sources.length > 20, lane);
		assert.equal(new Set(sources.map(source =>
			`${source.role}:${source.path}`)).size, sources.length);
		for(const role of ["producer", "checker", "archiver"])
			assert.ok(sources.some(source => source.role === role)
				, `${lane}: ${role}`);
		assert.ok(!sources.some(source => source.path
			=== "tests/fixtures/onboarding/nominal-subtypes/lean-bridge.exports.json")
		, `${lane}: generated configuration is not repository source`);
		assert.ok(!sources.some(source => source.path.startsWith("docs/evidence/")));
	}
});

test("generic Subtype hosted jobs require success and a skipped enforcer", () => {
	const contract = genericSubtypeHostedContracts.native;
	const job = { steps: [
		{ name: contract.acceptanceStep, number: 8, status: "completed"
			, conclusion: "success" }
		, { name: contract.enforceStep, number: 10, status: "completed"
			, conclusion: "skipped" }
	] };
	assert.doesNotThrow(() => assertGenericSubtypeHostedSteps(contract
		, Buffer.from(JSON.stringify(job))));
	for(const mutate of [
		value => { value.steps[0].conclusion = "failure"; }
		, value => { value.steps[1].conclusion = "success"; }
		, value => { value.steps[1].number = 7; }
	]) {
		const changed = structuredClone(job); mutate(changed);
		assert.throws(() => assertGenericSubtypeHostedSteps(contract
			, Buffer.from(JSON.stringify(changed))));
	}
});

test("generic Subtype archiver refuses incomplete command lines", () => {
	const result = spawnSync(process.execPath
		, ["scripts/archive-generic-subtype-evidence.mjs"], { encoding: "utf8" });
	assert.equal(result.status, 2);
	assert.match(result.stderr, /^Usage: archive-generic-subtype-evidence\.mjs/u);
});

test("generic Subtype foundation replay binds the exact producer revision", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-generic-subtype-foundation-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const labels = [
		"nominal selection syntax names every field and case in source order"
		, "nominal native admission preserves callback direction, generic Fin and nested-site gates"
		, "dependent generic Subtype history restores every source"
	];
	const first = labels.map((label, index) =>
		`# Subtest: ${label}\nok ${index + 1} - ${label}`).join("\n");
	const fresh = "fresh Lean preserves nominal constructor selections and rejects false source decisions";
	const tap = `TAP version 13\n${first}\n1..3\n# tests 3\n# suites 0\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\nTAP version 13\n# Subtest: ${fresh}\nok 1 - ${fresh}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 3\n`;
	await writeFile(join(root, "dependent-generic-subtype.tap"), tap);
	await writeFile(join(root, "dependent-generic-subtype-toolchain.log"), "Lean 4\n");
	const revision = "a".repeat(40);
	const replay = await replayGenericSubtypeHostedOutput(
		"foundation", root, revision);
	assert.equal(replay.accepted[0].producerCommit, revision);
	assert.equal(replay.accepted[0].tests, 4);
});
