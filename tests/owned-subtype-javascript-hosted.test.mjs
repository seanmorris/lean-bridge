/**
 * Refusal controls for original hosted npm evidence. All generated archives
 * and API records here are synthetic and establish no runtime acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedCheckedRecordNpmTagPrefix, ownedCheckedRecordNpmWorkflow } from "./helpers/owned-checked-record-npm-producer.mjs";
import { ownedSubtypeHostedContracts } from "./helpers/owned-subtype-hosted-contracts.mjs";
import {
	assertOwnedSubtypeHostedSteps, checkOwnedSubtypeHostedEvidence
	, writeOwnedSubtypeHostedEvidence
} from "./helpers/owned-subtype-hosted-evidence.mjs";
import { ownedSubtypeEvidenceSources } from "./helpers/owned-subtype-hosted-evidence-sources.mjs";
import { replayOwnedSubtypeHostedOutput } from "./helpers/owned-subtype-hosted-output.mjs";
import { verifyOwnedSubtypeJavaScriptEvidence } from "./helpers/owned-subtype-javascript-evidence.mjs";
import { writeSyntheticOwnedSubtypeJavaScriptEvidence } from "./helpers/owned-subtype-javascript-evidence-fixture.mjs";
import { ownedSubtypeJavaScriptInstalledTests } from "./helpers/owned-subtype-javascript-hosted-output.mjs";

const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const contract = ownedSubtypeHostedContracts.javascript;
const tap = names => ["TAP version 13"
	, ...names.map((name, index) => `ok ${index + 1} - ${name}`)
	, `1..${names.length}`, `# tests ${names.length}`, "# suites 0"
	, `# pass ${names.length}`, "# fail 0", "# cancelled 0", "# skipped 0"
	, "# todo 0", "# duration_ms 1", ""].join("\n");
const temporary = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-subtype-npm-hosted-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
};
const output = async t => {
	const root = await temporary(t);
	const value = await writeSyntheticOwnedSubtypeJavaScriptEvidence(root
		, `${contract.packaging}/${contract.report}`);
	await saveLakeFile(root, contract.tap, tap(ownedSubtypeJavaScriptInstalledTests));
	await saveLakeFile(root, `${contract.packaging}/verification.json`
		, canonicalJson(await verifyOwnedSubtypeJavaScriptEvidence(value.reportPath)));
	return value;
};

test("owned Subtype npm hosted output replays both retained routes and twelve browser cells", async t => {
	const { root } = await output(t);
	const result = await replayOwnedSubtypeHostedOutput("javascript", root, revision);
	assert.equal(result.tests, 12);
	assert.equal(result.producerCommit, revision);
	assert.deepEqual(result.profiles, contract.profiles);
	assert.deepEqual(result.accepted.routes.map(route => route.route), ["ordinary", "reviewed"]);
	assert.ok(result.accepted.routes.every(route => route.archives === 2 && route.browserExecutions === 12));
});

test("owned Subtype npm hosted output refuses incomplete or substituted installed logs", async t => {
	const source = tap(ownedSubtypeJavaScriptInstalledTests);
	for(const changed of [
		tap(ownedSubtypeJavaScriptInstalledTests.slice(0, -1))
		, tap([...ownedSubtypeJavaScriptInstalledTests.slice(0, -1), ownedSubtypeJavaScriptInstalledTests[10]])
		, source.replace("ok 12 -", "not ok 12 -")
		, source.replace("ok 11 -", "ok 11 - # SKIP ")
		, source.replace("# skipped 0", "# skipped 1")
		, source.replace("1..12", "1..11")
		, source + "TAP version 13\n"
		, source + "Bail out!\n"
		, "unexpected runner text\n" + source
	]) {
		const { root } = await output(t);
		await writeFile(join(root, contract.tap), changed);
		await assert.rejects(replayOwnedSubtypeHostedOutput("javascript", root, revision));
	}
});

test("owned Subtype npm hosted output refuses forged summaries and retained bytes", async t => {
	for(const change of ["summary", "noncanonical", "archive", "extra", "missing", "symlink"])
	{
		const { root, report } = await output(t);
		const packaging = join(root, contract.packaging);
		const verification = join(packaging, "verification.json");
		const archive = join(packaging, "evidence/ordinary/handoff"
			, report.reports[0].packageSetReceipt.packages[0].artifacts[0].path);
		if(change === "summary")
		{
			const forged = JSON.parse(await readFile(verification));
			forged.routes[0].browserExecutions--;
			await writeFile(verification, canonicalJson(forged));
		}
		else if(change === "noncanonical") await writeFile(verification
			, JSON.stringify(JSON.parse(await readFile(verification))));
		else if(change === "archive") await appendFile(archive, "changed");
		else if(change === "extra") await writeFile(join(packaging, "partial.json"), "{}\n");
		else if(change === "missing") await rm(archive);
		else
		{
			await rm(verification);
			await symlink(join(packaging, "report.json"), verification);
		}
		await assert.rejects(replayOwnedSubtypeHostedOutput("javascript", root, revision));
	}
});

const steps = () => [
	{ name: contract.acceptanceStep, status: "completed", conclusion: "success", number: 2 }
	, { name: contract.archiveStep, status: "completed", conclusion: "success", number: 3 }
];
test("owned Subtype npm hosted contract requires successful acceptance and upload", async () => {
	for(const path of [contract.workflow, ownedCheckedRecordNpmWorkflow])
	{
		const workflow = await readFile(path, "utf8");
		for(const text of [contract.job, contract.prefix, contract.acceptanceStep
			, contract.archiveStep
			, `build/${contract.packaging}/`, `build/${contract.tap}`
			, "LEAN_BRIDGE_OWNED_SUBTYPE_JS_TEST: \"1\""
			, "LEAN_BRIDGE_OWNED_SUBTYPE_BROWSER_TEST: \"1\""
			, "scripts/check-owned-subtype-javascript-ci.mjs"])
			assert.ok(workflow.includes(text), `${path}: ${text}`);
	}
	assertOwnedSubtypeHostedSteps(contract, JSON.stringify({ steps: steps() }));
	for(const mutate of [
		value => value.pop(), value => value.push(value[0])
		, value => { value[0].conclusion = "skipped"; }
		, value => { value[1].conclusion = "skipped"; }
		, value => { value[1].status = "in_progress"; }
		, value => { value[1].number = 1; }
		, value => value.push({ name: "Other", conclusion: "failure", number: 4 })
	]) {
		const value = steps(); mutate(value);
		assert.throws(() => assertOwnedSubtypeHostedSteps(contract, JSON.stringify({ steps: value })));
	}
});

const archiveInputs = async (t, scoped = false) => {
	const { root } = await output(t), inputs = await temporary(t);
	// The shared producer uploads other families too. They stay in the original
	// ZIP, without becoming selected Subtype output or acceptance claims.
	await saveLakeFile(root, "other-family/report.json", "{}\n");
	const zip = join(inputs, "artifact.zip");
	execFileSync("/usr/bin/zip", ["-qr", zip, "."], { cwd: root });
	const bytes = await readFile(zip);
	const run = { id: 2222, status: "completed", conclusion: "success"
		, head_sha: revision
		, path: scoped ? ownedCheckedRecordNpmWorkflow : contract.workflow
		, run_attempt: 1, event: scoped ? "create" : "workflow_dispatch"
		, head_branch: scoped ? ownedCheckedRecordNpmTagPrefix + revision : "fixture"
		, repository: { full_name: "seanmorris/lean-bridge" }
		, head_repository: { full_name: "seanmorris/lean-bridge" }
		, html_url: "https://github.com/seanmorris/lean-bridge/actions/runs/2222"
		, created_at: "2026-10-25T01:00:00Z", updated_at: "2026-10-25T02:00:00Z" };
	const job = { id: 3333, run_id: run.id, head_sha: revision, name: contract.job
		, status: "completed", conclusion: "success", labels: ["ubuntu-24.04"]
		, runner_name: "Synthetic fixture", runner_group_name: "GitHub Actions"
		, started_at: run.created_at, completed_at: run.updated_at, steps: steps() };
	const artifact = { id: 4444, name: `${contract.prefix}-${revision}`
		, expired: false, workflow_run: { id: run.id, head_sha: revision }
		, size_in_bytes: bytes.length
		, digest: `sha256:${sha256(bytes)}`, created_at: "2026-10-25T02:00:01Z"
		, expires_at: "2026-11-24T02:00:01Z" };
	const selected = { "artifact-zip": zip };
	for(const [name, value] of Object.entries({ run, job, artifact }))
	{
		selected[`${name}-json`] = join(inputs, `${name}.json`);
		await writeFile(selected[`${name}-json`], canonicalJson(value));
	}
	return { inputs, selected };
};

test("owned Subtype npm archive retains and replays the original scoped artifact", { timeout: 120_000 }, async t => {
	const { inputs, selected } = await archiveInputs(t, true);
	const destination = join(inputs, "evidence");
	const index = await writeOwnedSubtypeHostedEvidence({ lane: "javascript"
		, selected, destination, archiveCommit: revision });
	assert.deepEqual(await checkOwnedSubtypeHostedEvidence("javascript", destination), index);
	assert.equal(index.hostedRun.workflow, ownedCheckedRecordNpmWorkflow);
	assert.ok(index.hostedRun.artifact.members.includes("other-family/report.json"));
	assert.ok(!index.files.some(file => file.path.includes("other-family")));
	const source = (role, path) => index.selectedSources.some(item => item.role === role && item.path === path);
	for(const path of [contract.workflow, ownedCheckedRecordNpmWorkflow
		, contract.test, "tests/owned-javascript-cli.test.mjs"
		, "scripts/check-owned-subtype-javascript-ci.mjs"
		, "scripts/build-lean-runtime.sh", "poc/lean-link-spike/component_scalar.h"
		, "patches/lean4-4.32.2-emscripten-runtime-signatures.patch"])
		assert.ok(source("producer", path), path);
	assert.ok(source("consumer", "tests/helpers/owned-javascript-npm-browser.mjs"));
	assert.ok(source("checker", "tests/helpers/owned-subtype-javascript-hosted-output.mjs"));
	assert.ok(source("archiver", "scripts/archive-owned-subtype-evidence.mjs"));
	await assert.rejects(writeOwnedSubtypeHostedEvidence({ lane: "javascript"
		, selected, destination, archiveCommit: revision }), /must be new/u);
	const indexPath = join(destination, "index.json");
	const forged = structuredClone(index);
	forged.accepted.accepted.routes[0].browserExecutions--;
	await writeFile(indexPath, canonicalJson(forged));
	await assert.rejects(checkOwnedSubtypeHostedEvidence("javascript", destination));
	await writeFile(indexPath, canonicalJson(index));
	const archive = index.files.find(file => file.path.startsWith("hosted/output/") && file.path.endsWith(".tgz"));
	await appendFile(join(destination, archive.path), "changed");
	await assert.rejects(checkOwnedSubtypeHostedEvidence("javascript", destination));
});

test("owned Subtype npm archive rejects forged workflow, API and ZIP identities", async t => {
	const { selected, inputs } = await archiveInputs(t, true);
	for(const [name, mutations] of [
		["run", [{ head_branch: "master" }
			, { path: ".github/workflows/unrelated.yml" }, { event: "push" }
			, { status: "in_progress" }, { conclusion: "failure" }
			, { conclusion: "cancelled" }
			, { repository: { full_name: "other/repo" } }]]
		, ["job", [{ conclusion: "failure" }, { run_id: 9999 }
			, { head_sha: "0".repeat(40) }
			, { steps: [steps()[0]] }]]
		, ["artifact", [{ expired: true }, { digest: `sha256:${"0".repeat(64)}` }
			, { size_in_bytes: 1 }, { name: "unrelated" }]]
	]) {
		const path = selected[`${name}-json`], bytes = await readFile(path);
		for(const mutation of mutations)
		{
			await writeFile(path, canonicalJson({ ...JSON.parse(bytes), ...mutation }));
			const destination = join(inputs, "refused");
			await assert.rejects(writeOwnedSubtypeHostedEvidence({ lane: "javascript"
				, selected, destination, archiveCommit: revision }));
			await assert.rejects(readFile(join(destination, "index.json")), { code: "ENOENT" });
		}
		await writeFile(path, bytes);
	}
	await appendFile(selected["artifact-zip"], "changed");
	await assert.rejects(writeOwnedSubtypeHostedEvidence({ lane: "javascript"
		, selected, destination: join(inputs, "refused"), archiveCommit: revision }));
});

test("owned Subtype npm archive accepts a successful job in a failed recurring matrix", { timeout: 120_000 }, async t => {
	const { selected, inputs } = await archiveInputs(t);
	const path = selected["run-json"], run = JSON.parse(await readFile(path));
	await writeFile(path, canonicalJson({ ...run, conclusion: "failure" }));
	const destination = join(inputs, "evidence");
	const index = await writeOwnedSubtypeHostedEvidence({ lane: "javascript"
		, selected, destination, archiveCommit: revision });
	assert.deepEqual(index.hostedRun.conclusions, { run: "failure", job: "success" });
	assert.deepEqual(await checkOwnedSubtypeHostedEvidence("javascript", destination), index);
	await mkdir(join(destination, "unexpected"));
	await writeFile(join(destination, "unexpected/file"), "extra");
	await assert.rejects(checkOwnedSubtypeHostedEvidence("javascript", destination));
});

test("owned Subtype npm archive binds exact source roles and rejects other workflows", () => {
	const revisions = { producer: revision, consumer: revision, checker: revision, archiver: revision };
	const sources = ownedSubtypeEvidenceSources("javascript", revisions, ownedCheckedRecordNpmWorkflow);
	assert.deepEqual([...new Set(sources.map(source => source.role))], ["producer", "consumer", "checker", "archiver"]);
	assert.equal(new Set(sources.map(source => `${source.role}/${source.path}`)).size, sources.length);
	assert.throws(() => ownedSubtypeEvidenceSources("javascript", revisions, ".github/workflows/other.yml"));
	assert.throws(() => ownedSubtypeEvidenceSources("native", revisions, ownedCheckedRecordNpmWorkflow));
});

test("owned Subtype npm archive preserves historical native source selection", () => {
	const path = "docs/evidence/owned-subtype-native-hosted-20261023/index.json";
	const index = JSON.parse(execFileSync("git", ["show", `${revision}:${path}`]
		, { maxBuffer: 4 * 1024 ** 2 }));
	assert.deepEqual(ownedSubtypeEvidenceSources("native", {
		producer: index.producerCommit, consumer: index.consumerCommit
		, checker: index.checkerCommit, archiver: index.archiveCommit
	}, index.hostedRun.workflow), index.selectedSources);
});
