/**
 * Keep fresh native refusal CI mandatory and its exact source-history transition authenticated.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { nativeCiCommands, nativeCiRecordScript, nativeCiSteps } from "./native-ci-isolation.mjs";
import { beforeReviewedFinRefusalCiSource, reviewedFinRefusalCiChangedPaths, reviewedFinRefusalCiHistoryPath, reviewedFinRefusalCiPredecessor, reverseReviewedFinRefusalCiUpdate } from "./reviewed-fin-refusal-ci-source-history.mjs";

const command = "LEAN_BRIDGE_REVIEWED_FIN_REFUSALS=native-fin,fin-containers LEAN_BRIDGE_REVIEWED_FIN_REFUSAL_REPORT_DIR=build/reviewed-fin-refusals node --test --test-reporter=tap --test-concurrency=1 tests/reviewed-fin-refusals.test.mjs";
const transcript = "build/reviewed-fin-refusals/acceptance.tap";
const fresh = ["native-fin", "fin-containers"].map(fixture => `changed ${fixture} reviews are refused against fresh Lean beside a publishing control`);
const patterns = [...fresh.map(name => `^ok [0-9]+ - ${name}$`), ...["tests 23", "pass 23", "fail 0", "cancelled 0", "skipped 0", "todo 0"].map(summary => `^# ${summary}$`)];
const assertions = patterns.map(pattern => `          rg '${pattern}' ${transcript}\n`);
const reports = ["native-fin", "fin-containers"].map(fixture => `build/reviewed-fin-refusals/${fixture}.json`);
const block = ["          mkdir -p build/reviewed-fin-refusals\n"
	, "          set -o pipefail\n"
	, `          ${command} 2>&1 | tee ${transcript}\n`
	, ...assertions
	, ...reports.map(report => `          test -s ${report}\n`)].join("");

const validate = workflow => {
	const steps = nativeCiSteps(workflow), gate = steps.find(step => step.id === "type_corpus_c_family");
	assert.equal(gate.condition, "matrix.profile == 'c-family'");
	assert.ok(nativeCiCommands(gate).includes(block));
	const upload = steps.find(step => step.name === "Upload installed C and C++ corpus observations");
	assert.equal(upload.condition, "always() && matrix.profile == 'c-family'");
	assert.match(upload.text, /^ {12}build\/reviewed-fin-refusals\/$/mu);
	assert.match(upload.text, /^ {10}if-no-files-found: error$/mu);
	assert.ok(nativeCiRecordScript(workflow, "c-family").includes(`consumer_command="$consumer_command && ${command}"`));
	const enforce = steps.find(step => step.name === "Enforce native consumer support");
	assert.ok(enforce.condition.startsWith("always() && "));
	assert.ok(enforce.condition.includes("matrix.profile == 'c-family' && (steps.ordinary_c.outcome != 'success' || steps.type_corpus_c_family.outcome != 'success')"));
	assert.match(enforce.text, /^ {8}run: exit 1$/mu);
	return patterns.map(pattern => new RegExp(pattern, "mu"));
};

test("C-family CI requires both fresh-Lean refusal fixtures, full unskipped TAP and retained reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const checks = validate(workflow);
	const original = await readFile("docs/evidence/reviewed-fin-native-refusals-20261009/run.tap", "utf8");
	assert.ok(checks.every(check => check.test(original)), "the actual accepted compiler transcript passes these CI checks");
});

test("native refusal CI refuses disabled selections, lost reports, ignored errors and weakened enforcement", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const mutations = [
		...["LEAN_BRIDGE_REVIEWED_FIN_REFUSALS=native-fin,fin-containers ", "LEAN_BRIDGE_REVIEWED_FIN_REFUSAL_REPORT_DIR=build/reviewed-fin-refusals ", "--test-reporter=tap ", "--test-concurrency=1 "].map(text => [command, command.replace(text, "")])
		, ...assertions.map(line => [line, ""])
		, [`          set -o pipefail\n          ${command}`, `          ${command}`]
		, [` 2>&1 | tee ${transcript}\n`, "\n"]
		, ...reports.map(report => [`          test -s ${report}\n`, ""])
		, ["            build/reviewed-fin-refusals/\n", ""]
		, [`              consumer_command="$consumer_command && ${command}"\n`, ""]
		, ["steps.type_corpus_c_family.outcome != 'success'", "steps.type_corpus_c_family.outcome == 'success'"]
		, ["id: type_corpus_c_family\n        if: matrix.profile == 'c-family'", "id: type_corpus_c_family\n        if: false"]
		, ["Upload installed C and C++ corpus observations\n        if: always()", "Upload installed C and C++ corpus observations\n        if: success()"]
	];
	for(const [before, after] of mutations)
	{
		const changed = workflow.replace(before, after); assert.notEqual(changed, workflow, before);
		assert.throws(() => validate(changed), undefined, before);
	}
});

test("native refusal transcript checks reject skipped or missing fixtures and incomplete terminal summaries", async () => {
	const checks = validate(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
	const tap = [...fresh.map((name, index) => `ok ${index + 3} - ${name}`), "# tests 23", "# pass 23", "# fail 0", "# cancelled 0", "# skipped 0", "# todo 0"].join("\n");
	assert.ok(checks.every(check => check.test(tap)));
	for(const line of tap.split("\n")) for(const changed of [
		tap.replace(line, "")
		, tap.replace(line, line + " # SKIP")
		, tap.replace(line, line.startsWith("ok ") ? "not " + line : line.replace(/\d+$/u, "99"))
	]) assert.ok(!checks.every(check => check.test(changed)));
});

test("native refusal CI history authenticates exact predecessors and rejects unrecorded edits", async () => {
	const record = JSON.parse(await readFile(reviewedFinRefusalCiHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "reviewed-fin-refusal-ci-v1");
	assert.equal(record.predecessorCommit, reviewedFinRefusalCiPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), reviewedFinRefusalCiChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8"), previous = reverseReviewedFinRefusalCiUpdate(source, update);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeReviewedFinRefusalCiSource(update.path, source), previous);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeReviewedFinRefusalCiSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source), beforeFinRefinementSource(update.path, previous));
		const changed = source + "\n// unknown edit\n";
		assert.equal(beforeReviewedFinRefusalCiSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedFinRefusalCiUpdate(changed, update));
		assert.throws(() => reverseReviewedFinRefusalCiUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseReviewedFinRefusalCiUpdate(source, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseReviewedFinRefusalCiUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("native refusal CI refreshes source pins without changing any observation or support claim", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeReviewedFinRefusalCiSource(path, source));
	const history = JSON.parse(await readFile(reviewedFinRefusalCiHistoryPath));
	let pins = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = history.updates.find(update => update.path === file.path && update.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.equal(pins, 117); assert.deepEqual(current, previous);
	for(const evidence of current.evidence) for(const file of evidence.files)
		assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
});

test("native refusal CI history updater refuses another HEAD before writing", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-native-refusal-ci-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-reviewed-fin-refusal-ci-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1); assert.match(result.stderr, /Reviewed Fin refusal CI history is draft-only/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
