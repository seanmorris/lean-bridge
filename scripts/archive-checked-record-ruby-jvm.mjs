/**
 * Preserve four original checked-record routes for Ruby, Java and Kotlin.
 * Every source and execution record must pass before this immutable archive is written.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertCheckedRecordRubyJvmRecords } from "../tests/helpers/checked-record-ruby-jvm-report.mjs";

const revision = "71ef6f081bfab86e9556545250a44bb04c420604";
const destination = "docs/evidence/checked-record-ruby-jvm-20261010";
const profiles = ["java", "kotlin", "ruby"];
const routes = ["ordinary-source", "reviewed-ir", "result-only-ordinary-source", "result-only-reviewed-ir"];
const labels = ["ordinary", "reviewed", "result-ordinary", "result-reviewed"];
const git = args => execFileSync("git", args, { maxBuffer: 16 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).toString().trim(), revision);
assert.equal(git(["ls-tree", "HEAD", "--", destination]).length, 0, "Never rewrite committed observations");
await assert.rejects(access(destination), { code: "ENOENT" });
const artifacts = new Map(), sources = [], runs = [];
const preserve = (path, bytes) => {
	assert.equal(artifacts.has(path), false, path);
	artifacts.set(path, Buffer.from(bytes));
};
const runner = await readFile("build/run-checked-record-native-hosts-v1.mjs");
preserve("runner.mjs.txt", runner);
for(const [index, route] of routes.entries())
{
	const label = `ruby-jvm-${labels[index]}-r1`, archive = route;
	const prefix = `build/vo1446-host-${label}-71ef6f0`, root = `${prefix}-records/${route}`;
	await assertCheckedRecordRubyJvmRecords({ profiles, route, read: path => readFile(join(root, path)) });
	const start = JSON.parse(await readFile(prefix + ".start.json")), end = JSON.parse(await readFile(prefix + ".end.json"));
	const finished = JSON.parse(await readFile(prefix + ".finished.json")), tap = await readFile(prefix + ".tap");
	assert.equal(start.revision, revision); assert.equal(start.tree, git(["rev-parse", revision + "^{tree}"]).toString().trim());
	assert.equal(start.route, route); assert.equal(start.runnerSha256, sha256(runner));
	assert.equal(start.command, "/usr/bin/taskset");
	assert.deepEqual(start.args, ["-c", "3", "/usr/bin/node", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/checked-record-native-installed-tests.mjs"]);
	assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
	assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS, "ruby,java,kotlin");
	assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_OUTPUT, start.output);
	assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
	assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
	assert.equal(end.tapSha256, sha256(tap));
	assert.equal(finished.revision, revision); assert.equal(finished.output, start.output);
	assert.equal(finished.reportSha256, sha256(await readFile(join(root, "report.json"))));
	for(const [name, count] of [["tests", 1], ["pass", 1], ["fail", 0], ["skipped", 0]])
		assert.match(tap.toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
	for(const suffix of ["tap", "start.json", "end.json", "finished.json"])
		preserve(`${archive}/run.${suffix}`, await readFile(prefix + "." + suffix));
	assert.deepEqual((await readdir(root)).sort(), ["build-0", "build-1", "consumers", "java.json", "kotlin.json", "report.json", "ruby.json"]);
	for(const name of ["report.json", "java.json", "kotlin.json", "ruby.json", "consumers/java.java", "consumers/kotlin.kt", "consumers/ruby.rb"])
		preserve(`${archive}/${name}`, await readFile(join(root, name)));
	for(const attempt of [0, 1])
	{
		const part = `build-${attempt}`;
		const expected = ["CheckedRecords.lean", "expected.json", "lean-bridge.exports.json", "model.json", "package-set-receipt.json"];
		if(route.endsWith("reviewed-ir")) expected.push("api.binding-ir.json");
		assert.deepEqual((await readdir(join(root, part))).sort(), expected.sort());
		for(const name of expected) preserve(`${archive}/${part}/${name}`, await readFile(join(root, part, name)));
	}
	runs.push({ route, archive, label });
}
for(const path of [
	"tests/helpers/checked-record-native-installed-tests.mjs"
	, "tests/helpers/checked-record-native-install.mjs"
	, "tests/helpers/checked-record-native-fixture.mjs"
	, "tests/helpers/checked-record-fixture.mjs"
	, "tests/helpers/fin-container-edge-ruby-closure.mjs"
	, "tests/helpers/fin-container-edge-jvm-closure.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/closed-package-zip.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/fixtures/checked-record-consumers/ruby.rb"
	, "tests/fixtures/checked-record-consumers/java.java"
	, "tests/fixtures/checked-record-consumers/kotlin.kt"
	, "tests/fixtures/onboarding/checked-records/CheckedRecords.lean"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-artifacts.mjs"
	, "src/build/native-ruby-artifacts.mjs"
	, "src/build/native-jvm-artifacts.mjs"
	, "src/build/native-jvm-projection.mjs"
	, "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/ruby/copied-conversions.mjs"
	, "src/backends/jvm/copied-conversions.mjs"
	, "src/backends/jvm/copied-kotlin.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/analyze/NativeExports.lean"
]) {
	const bytes = git(["show", `${revision}:${path}`]), archive = "sources/" + path + ".txt";
	preserve(archive, bytes); sources.push({ path, revision, archive, sha256: sha256(bytes) });
}
preserve("queue.mjs.txt", await readFile("build/queue-vo1446-native-group.mjs"));
preserve("queue.log", await readFile("build/vo1446-ruby-jvm-queue-r1.log"));
const index = { schemaVersion: 1, revision
	, tree: git(["rev-parse", revision + "^{tree}"]).toString().trim()
	, scope: { profiles, routes, glibcFloor: "2.36", dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false }
	, runs, sources
	, artifacts: [...artifacts].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })).sort((a, b) => a.path.localeCompare(b.path)) };
for(const [path, bytes] of artifacts)
{
	await mkdir(dirname(join(destination, path)), { recursive: true });
	await writeFile(join(destination, path), bytes, { flag: "wx" });
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(JSON.stringify({ destination, artifacts: artifacts.size, sources: sources.length, indexSha256: sha256(canonicalJson(index)) }) + "\n");
