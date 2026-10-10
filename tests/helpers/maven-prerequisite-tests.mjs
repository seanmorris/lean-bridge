/**
 * Keep Maven prerequisite recovery separate from compiler and offline acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./maven-prerequisite-history-tests.mjs";
import { isMavenPrerequisiteResolutionFailure, mavenPrerequisiteGoals, runMavenPrerequisite } from "../../scripts/maven-prerequisite.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { beforeMavenPrerequisiteSource } from "./maven-prerequisite-history.mjs";

const failure = (goal, change = {}) => Object.assign(new Error("Maven exited with status 1"), {
	code: "build-command-failed"
	, details: {
		stdout: `[ERROR] Plugin ${goal.slice(0, goal.lastIndexOf(":"))} or one of its dependencies could not be resolved: Could not find artifact in central (https://repo.maven.apache.org/maven2) -> [Help 1]\n`
		, stderr: ""
	}, ...change
});

test("Maven bootstrap retries only the selected plugin resolution once and retains both failures", async () => {
	for(const goal of mavenPrerequisiteGoals)
	{
		const original = failure(goal), calls = [], diagnostics = []; let pauses = 0;
		const options = { diagnostic: value => diagnostics.push(value), pause: async () => { pauses++; } };
		const args = ["--batch-mode", "--quiet", "-Dmaven.repo.local=/private/cache", goal, "-Dfile=/private/package.jar"];
		const saved = [...args], result = { code: 0, stdout: "BUILD SUCCESS" };
		assert.equal(await runMavenPrerequisite(args, async selected => {
			calls.push(selected); if(calls.length === 1) throw original; return result;
		}, options), result);
		assert.deepEqual(args, saved); assert.equal(calls.length, 2); assert.equal(pauses, 1);
		assert.deepEqual(calls[1], [...calls[0], "--update-snapshots"]);
		assert.ok(calls[0].includes("--errors")); assert.ok(calls[0].includes("--no-transfer-progress"));
		assert.ok(!calls[0].includes("--quiet")); assert.ok(!calls[0].includes("--update-snapshots"));
		assert.equal(diagnostics.length, 1); assert.equal(diagnostics[0].stdout, original.details.stdout);
		assert.equal(diagnostics[0].retry, true);
		calls.length = 0; diagnostics.length = 0; pauses = 0;
		const terminal = failure(goal);
		await assert.rejects(runMavenPrerequisite(args, async selected => {
			calls.push(selected); throw calls.length === 1 ? original : terminal;
		}, options), error => error === terminal);
		assert.equal(calls.length, 2); assert.equal(pauses, 1);
		assert.deepEqual(diagnostics.map(value => [value.attempt, value.retry]), [[1, true], [2, false]]);
	}
});

test("Maven bootstrap refuses unrelated failures, timeouts, cancellation and offline consumers", async () => {
	const goal = mavenPrerequisiteGoals[0], original = failure(goal);
	const errors = [failure(goal, { code: "build-timeout" })
		, failure(goal, { code: "build-cancelled" })
		, failure(goal, { code: "build-output-limit" })
		, failure(goal, { killed: true })
		, failure(goal, { signal: "SIGTERM" }), new Error("compiler assertion failed")
		, failure(goal, { details: { stdout: original.details.stdout.replace("maven-install-plugin:3.1.4", "maven-install-plugin:0.0.0") } })
		, failure(goal, { details: { stdout: original.details.stdout.replace("repo.maven.apache.org/maven2", "untrusted.invalid/maven2") } })
		, failure(goal, { details: { stdout: "[ERROR] Failed to execute goal: invalid input package" } })];
	for(const error of errors)
	{
		let calls = 0;
		await assert.rejects(runMavenPrerequisite([goal], async () => { calls++; throw error; }, {
			diagnostic: () => {}, pause: async () => assert.fail("Unexpected retry")
		}), actual => actual === error);
		assert.equal(calls, 1);
	}
	for(const args of [[goal, "--offline"]
		, ["-o", goal]
		, [goal, "--fail-never"]
		, [goal, "-fn"]
		, []
		, ["compile"]
		, [goal, "compile"]
		, [goal.replace("3.1.4", "0.0.0")]
		, [goal, goal]])
		await assert.rejects(runMavenPrerequisite(args, async () => assert.fail("Invalid invocation reached Maven")));
	assert.equal(isMavenPrerequisiteResolutionFailure(original, "compile"), false);
	const direct = Object.assign(new Error("execFile failed"), { code: 1, stdout: original.details.stdout, stderr: "" });
	assert.equal(isMavenPrerequisiteResolutionFailure(direct, goal), true);
	assert.equal(isMavenPrerequisiteResolutionFailure(new Error("wrapped", { cause: direct }), goal), true);
	assert.equal(isMavenPrerequisiteResolutionFailure(Object.assign(new Error("cancelled", { cause: direct }), { code: "build-cancelled" }), goal), false);
	const tail = "Caused by: ArtifactNotFoundException: Could not find artifact org.apache.maven.plugins:maven-install-plugin:jar:3.1.4 in central (https://repo.maven.apache.org/maven2)";
	assert.equal(isMavenPrerequisiteResolutionFailure(failure(goal, { details: { stderr: tail } }), goal), true);
	assert.equal(isMavenPrerequisiteResolutionFailure(failure(goal, { details: { stderr: tail.replace("3.1.4", "3.1.40") } }), goal), false);
});

test("Maven prerequisite diagnostics preserve actual process errors without retrying general tool failures", async () => {
	const goal = mavenPrerequisiteGoals[0], diagnostics = []; let calls = 0;
	const output = failure(goal).details.stdout;
	await assert.rejects(runMavenPrerequisite([goal], async () => {
		calls++;
		return processBuildRunner.capture({ command: process.execPath
			, args: ["-e", "process.stdout.write(process.argv[1]); process.stderr.write('original stderr'); process.exit(1)", output]
			, cwd: process.cwd(), env: {}, timeoutMs: 5000 });
	}, { diagnostic: row => diagnostics.push(row), pause: async () => {} }), error => {
		assert.equal(error.code, "build-command-failed");
		assert.equal(error.details.stdout, output); assert.equal(error.details.stderr, "original stderr");
		return true;
	});
	assert.equal(calls, 2); assert.equal(diagnostics.length, 2);
	for(const row of diagnostics)
	{ assert.equal(row.stdout, output); assert.equal(row.stderr, "original stderr"); }
});

test("JVM recovery changes online prerequisites while preserving offline installation and hashed closure code", async () => {
	const path = "tests/helpers/type-corpus-jvm-tools.mjs", current = await readFile(path, "utf8");
	const previous = beforeMavenPrerequisiteSource(path, current);
	assert.notEqual(current, previous);
	const offline = source => source.slice(source.indexOf("export const jvmMaven ="), source.indexOf("/**\n * Download build-tool plugins"));
	assert.equal(offline(current), offline(previous));
	assert.ok(offline(current).includes('offline = true'));
	assert.ok(offline(current).includes('...offline ? ["--offline"] : []'));
	const closure = source => source.slice(source.indexOf('const vendor = join(directory, "maven-plugin-closure")'));
	assert.equal(closure(current), closure(previous));
	assert.ok(current.includes("runMavenPrerequisite(args, selected => jvmMaven(tools, root, selected, clean, false))"));
	const native = await readFile("tests/native-jvm.test.mjs", "utf8");
	assert.ok(native.includes('import "./helpers/maven-prerequisite-tests.mjs";'));
	assert.ok(native.includes("env: environment, timeoutMs: 180_000"));
	const managed = await readFile("scripts/test-managed-registry-consumers.mjs", "utf8");
	assert.ok(managed.includes("args => run(maven, args, { timeout: 180_000 })"));
});

test("successful Maven bootstrap runs once and keeps the caller's cache and package selections", async () => {
	const goal = mavenPrerequisiteGoals[2], args = ["--errors", "--no-transfer-progress", goal, "-Dtransitive=false"];
	let calls = 0;
	const result = { code: 0, stdout: "original output", stderr: "" };
	assert.equal(await runMavenPrerequisite(args, async selected => {
		calls++; assert.deepEqual(selected, args); return result;
	}, { diagnostic: () => assert.fail("Unexpected failure"), pause: () => assert.fail("Unexpected retry") }), result);
	assert.equal(calls, 1);
});
