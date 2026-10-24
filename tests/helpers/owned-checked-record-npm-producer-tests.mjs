/**
 * Keep the scoped producer complete and prevent it from becoming a matrix gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
	assertOwnedCheckedRecordNpmProducer, ownedCheckedRecordNpmGuard
	, ownedCheckedRecordNpmTagPrefix, ownedCheckedRecordNpmWorkflow
	, selectOwnedCheckedRecordWorkflow
} from "./owned-checked-record-npm-producer.mjs";
import { ownedCheckedRecordHostedLanes } from "./owned-checked-record-hosted-contracts.mjs";
import { ownedCheckedRecordHostedWorkflowContract } from "./owned-checked-record-hosted-evidence.mjs";
import { ownedCheckedRecordEvidenceSources } from "./owned-checked-record-hosted-evidence-sources.mjs";
import { assertOwnedJavaScriptWasmCi } from "./owned-javascript-wasm-ci.mjs";

const read = async () => ({
	scoped: await readFile(ownedCheckedRecordNpmWorkflow, "utf8")
	, recurring: await readFile(".github/workflows/consumer-matrix.yml", "utf8")
});

const ownedJob = source => source.match(/^ {2}owned-javascript-wasm:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n|(?![\s\S]))/mu)?.[0];
const historyStepName = "Require source history before owned JavaScript builds";
const borrowProducer = "3701d0880be3195b249ed17caac6975dea7283f6";
const borrowSource = "src/backends/native/owned-value-adapters.mjs";

test("both npm producers require original Git history before toolchain work", async () => {
	const sources = await read();
	for(const source of Object.values(sources))
	{
		const job = ownedJob(source);
		assert.ok(job);
		assert.match(job, /uses: actions\/checkout@v6\n {8}with:\n {10}fetch-depth: 0\n {10}persist-credentials: false/u);
		assert.ok(job.indexOf(historyStepName) > job.indexOf("Check out the exact revision"));
		assert.ok(job.indexOf(historyStepName) < job.indexOf("Install Node.js"));
		assert.ok(job.includes(`git cat-file -e ${borrowProducer}:${borrowSource}`));
	}
	const testSource = await readFile("tests/owned-javascript-borrow-package.test.mjs", "utf8");
	assert.ok(testSource.includes(`const javaScriptBorrowAdmissionProducer = "${borrowProducer}";`));
});

test("live npm policy rejects missing, shallow or bypassed history prerequisites", async () => {
	const { recurring } = await read();
	const job = ownedJob(recurring);
	const step = job.split(`      - name: ${historyStepName}\n`)[1]?.split("      - name: ")[0];
	assert.ok(step);
	const completeStep = `      - name: ${historyStepName}\n${step}`;
	for(const [before, after] of [
		["          fetch-depth: 0\n", ""]
		, ["          fetch-depth: 0\n", "          fetch-depth: 1\n"]
		, [completeStep, ""]
		, [completeStep, completeStep.replace("        shell: bash", "        if: false\n        shell: bash")]
		, [completeStep, completeStep.replace("        shell: bash", "        continue-on-error: true\n        shell: bash")]
		, ['--is-shallow-repository)" = false', '--is-shallow-repository)" = true']
		, [`git cat-file -e ${borrowProducer}:${borrowSource}`, "true"]
		, [`git cat-file -e ${borrowProducer}:${borrowSource}`, `git cat-file -e ${borrowProducer}:${borrowSource} || true`]
	]) {
		const changed = job.replace(before, after);
		assert.notEqual(changed, job);
		assert.throws(() => assertOwnedJavaScriptWasmCi(recurring.replace(job, changed)));
	}
	const moved = job.replace(completeStep, "").replace("      - name: Build the production runtime", completeStep + "      - name: Build the production runtime");
	assert.throws(() => assertOwnedJavaScriptWasmCi(recurring.replace(job, moved)));
});

test("shallow Git checkout reproduces absent producer and full history restores exact bytes", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-npm-history-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const original = join(directory, "original"), checkout = join(directory, "checkout");
	await mkdir(join(original, "src/backends/native"), { recursive: true });
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = (cwd, args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: "pipe" });
	git(original, ["init", "--quiet"]);
	const bytes = "export const immutableProducer = true;\n";
	await writeFile(join(original, borrowSource), bytes);
	const commit = () => {
		git(original, ["add", "."]);
		git(original, ["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
			, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture"]);
		return git(original, ["rev-parse", "HEAD"]).trim();
	};
	const producer = commit();
	await writeFile(join(original, "current.txt"), "Current checkout still contains the file.\n");
	commit();
	git(directory, ["clone", "--quiet", "--no-local", "--depth=1", pathToFileURL(original).href, checkout]);
	assert.equal(git(checkout, ["rev-parse", "--is-shallow-repository"]).trim(), "true");
	assert.equal(await readFile(join(checkout, borrowSource), "utf8"), bytes);
	const absent = spawnSync("git", ["show", `${producer}:${borrowSource}`], { cwd: checkout, env, encoding: "utf8" });
	assert.notEqual(absent.status, 0);
	assert.match(absent.stderr, /exists on disk, but not in/u);
	git(checkout, ["fetch", "--quiet", "--unshallow", "origin"]);
	assert.equal(git(checkout, ["rev-parse", "--is-shallow-repository"]).trim(), "false");
	assert.equal(git(checkout, ["show", `${producer}:${borrowSource}`]), bytes);
});

test("scoped npm producer retains the complete recurring job", async () => {
	const { scoped, recurring } = await read();
	assertOwnedJavaScriptWasmCi(recurring);
	assert.deepEqual(assertOwnedCheckedRecordNpmProducer(scoped, recurring), {
		jobs: 1, workflow: ownedCheckedRecordNpmWorkflow
		, recurring: ".github/workflows/consumer-matrix.yml"
	});
	assert.doesNotMatch(scoped, /^ {2}(?:push|pull_request|support-summary):/mu);
	assert.match(recurring, /^ {2}support-summary:\n {4}name: Publish consumer support summary\n {4}if: always\(\)/mu);
});

test("scoped npm trigger admits only dispatch or its exact commit tag", () => {
	const sha = "a".repeat(40), ref = ownedCheckedRecordNpmTagPrefix + sha;
	for(const [eventName, type, name, expected] of [
		["workflow_dispatch", undefined, undefined, true]
		, ["create", "tag", ref, true]
		, ["create", "branch", ref, false]
		, ["create", "tag", ownedCheckedRecordNpmTagPrefix + "b".repeat(40), false]
		, ["create", "tag", "v1.0.0", false]
		, ["push", "tag", ref, false]
		, ["pull_request", "tag", ref, false]
		, ["create", "tag", ref + "/extra", false]
	]) {
		const accepted = runInNewContext(ownedCheckedRecordNpmGuard.slice(3, -2), {
			github: { event_name: eventName, sha, event: { ref_type: type, ref: name } }
			, format: (pattern, value) => pattern.replace("{0}", value)
		}, { timeout: 1000 });
		assert.equal(accepted, expected, eventName + "/" + type + "/" + name);
	}
});

test("scoped npm producer rejects narrowed execution and widened triggers", async () => {
	const { scoped, recurring } = await read();
	assertOwnedCheckedRecordNpmProducer(scoped, recurring);
	for(const [before, after] of [
		["  create:\n", "  push:\n"]
		, ["  contents: read", "  contents: write"]
		, ["  cancel-in-progress: false", "  cancel-in-progress: true"]
		, [ownedCheckedRecordNpmGuard, "true"]
		, ["    timeout-minutes: 90", "    timeout-minutes: 1"]
		, ['      LEAN_BRIDGE_OWNED_CHECKED_RECORD_BROWSER_TEST: "1"'
			, '      LEAN_BRIDGE_OWNED_CHECKED_RECORD_BROWSER_TEST: "0"']
		, ["chromium firefox webkit", "chromium"]
		, ["tests/owned-checked-record-javascript-packaging.test.mjs", "tests/unrelated.test.mjs"]
		, ["ordinary-full ordinary-result-only reviewed-full reviewed-result-only", "ordinary-full"]
		, ['tee "$checked_record_log" || checked_record_status=$?'
			, 'tee "$checked_record_log" || true']
		, ["            build/owned-checked-record-javascript-packaging/\n", ""]
	]) {
		const changed = scoped.replace(before, after);
		assert.notEqual(changed, scoped);
		assert.throws(() => assertOwnedCheckedRecordNpmProducer(changed, recurring));
	}
	assert.throws(() => assertOwnedCheckedRecordNpmProducer(scoped
		+ "\n  extra:\n    runs-on: ubuntu-24.04\n", recurring));
	assert.throws(() => assertOwnedCheckedRecordNpmProducer(scoped, recurring.replace(
		"  owned-javascript-wasm:\n", "  owned-javascript-wasm:\n    if: false\n"
	)));
});

test("owned hosted workflow selection remains closed for every lane", () => {
	for(const lane of Object.values(ownedCheckedRecordHostedLanes))
	{
		assert.equal(selectOwnedCheckedRecordWorkflow(lane), lane.workflow);
		assert.equal(selectOwnedCheckedRecordWorkflow(lane, lane.workflow), lane.workflow);
		if(lane.kind === "javascript")
			assert.equal(selectOwnedCheckedRecordWorkflow(lane, ownedCheckedRecordNpmWorkflow), ownedCheckedRecordNpmWorkflow);
		else assert.throws(() => selectOwnedCheckedRecordWorkflow(lane, ownedCheckedRecordNpmWorkflow));
		for(const workflow of [".github/workflows/unrelated.yml", "../consumer-matrix.yml", null, 1])
			assert.throws(() => selectOwnedCheckedRecordWorkflow(lane, workflow));
	}
});

test("scoped npm evidence requires a terminal successful run", () => {
	const lane = ownedCheckedRecordHostedLanes.javascript;
	const run = { path: ownedCheckedRecordNpmWorkflow, status: "completed", conclusion: "success" };
	const contract = ownedCheckedRecordHostedWorkflowContract(lane, run);
	assert.equal(contract.workflow, run.path);
	assert.equal(contract.jobName, lane.job);
	assert.deepEqual(contract.conclusions, { run: "success", job: "success" });
	for(const change of [{ path: undefined }
		, { path: ".github/workflows/other.yml" }
		, { status: "in_progress" }, { conclusion: "failure" }
		, { conclusion: "cancelled" }, { conclusion: "skipped" }])
		assert.throws(() => ownedCheckedRecordHostedWorkflowContract(lane, { ...run, ...change }));
	for(const conclusions of [{ run: "success", job: "failure" }
		, { run: "failure", job: "success" }
		, { run: "success", job: "success", forged: true }])
		assert.throws(() => ownedCheckedRecordHostedWorkflowContract(lane, run, conclusions));
	const old = ownedCheckedRecordHostedWorkflowContract(lane
		, { ...run, path: lane.workflow, conclusion: "failure" });
	assert.deepEqual(old.conclusions, { run: "failure", job: "success" }
		, "A successful recurring job may coexist with unrelated failed jobs");
});

test("scoped npm source selection refuses unknown workflow before Git reads", () => {
	const revisions = Object.fromEntries(["producer", "consumer", "checker", "archiver"]
		.map(role => [role, "0".repeat(40)]));
	assert.throws(() => ownedCheckedRecordEvidenceSources("javascript", revisions
		, ".github/workflows/unknown.yml"), /Unknown owned checked-record producer workflow/u);
});

test("committed scoped npm sources retain both exact workflows", () => {
	const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const revisions = Object.fromEntries(["producer", "consumer", "checker", "archiver"]
		.map(role => [role, revision]));
	const recurring = ownedCheckedRecordEvidenceSources("javascript", revisions);
	const scoped = ownedCheckedRecordEvidenceSources("javascript", revisions, ownedCheckedRecordNpmWorkflow);
	const extra = { role: "producer", revision, path: ownedCheckedRecordNpmWorkflow };
	assert.ok(scoped.some(item => item.role === extra.role && item.path === extra.path));
	assert.deepEqual(scoped.filter(item => !(item.role === extra.role && item.path === extra.path)), recurring);
});
