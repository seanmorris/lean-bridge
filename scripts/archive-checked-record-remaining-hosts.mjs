/**
 * Preserve four original checked-record routes for Rust, .NET, native PHP and WIT.
 * Every source and execution record must pass before this immutable archive is written.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertCheckedRecordRemainingHostRecords } from "../tests/helpers/checked-record-remaining-host-report.mjs";

const revision = "c9d11f7ac8fd76d13bcc48f6f679eb22fd86b722";
const destination = "docs/evidence/checked-record-remaining-hosts-20261010";
const profiles = ["dotnet", "php-native", "rust", "wit-wasi"];
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
	const label = `remaining-systemphp-${labels[index]}-r1`, archive = route;
	const prefix = `build/vo1446-host-${label}-c9d11f7`, root = `${prefix}-records/${route}`;
	await assertCheckedRecordRemainingHostRecords({ profiles, route, read: path => readFile(join(root, path)) });
	const start = JSON.parse(await readFile(prefix + ".start.json")), end = JSON.parse(await readFile(prefix + ".end.json"));
	const finished = JSON.parse(await readFile(prefix + ".finished.json")), tap = await readFile(prefix + ".tap");
	assert.equal(start.revision, revision); assert.equal(start.tree, git(["rev-parse", revision + "^{tree}"]).toString().trim());
	assert.equal(start.route, route); assert.equal(start.runnerSha256, sha256(runner));
	assert.equal(start.command, "/usr/bin/taskset");
	assert.deepEqual(start.args, ["-c", "3", "/usr/bin/node", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/checked-record-native-installed-tests.mjs"]);
	assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
	assert.equal(start.environment.LEAN_BRIDGE_PHP, "/usr/bin/php");
	assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS, "dotnet,php-native,rust,wit-wasi");
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
	assert.deepEqual((await readdir(root)).sort(), ["build-0", "build-1", "consumers", "dotnet.json", "php-native.json", "report.json", "rust.json", "wit-wasi.json"]);
	for(const name of ["report.json", "dotnet.json", "php-native.json", "rust.json", "wit-wasi.json", "consumers/dotnet.cs", "consumers/php-native.php", "consumers/rust.rs", "consumers/wit-wasi.c"])
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
	, "tests/helpers/fin-container-edge-dotnet-closure.mjs"
	, "tests/helpers/fin-container-edge-php-closure.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/closed-package-zip.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/type-corpus-rust.mjs"
	, "tests/fixtures/checked-record-consumers/dotnet.cs"
	, "tests/fixtures/checked-record-consumers/php-native.php"
	, "tests/fixtures/checked-record-consumers/rust.rs"
	, "tests/fixtures/checked-record-consumers/wit-wasi.c"
	, "tests/fixtures/onboarding/checked-records/CheckedRecords.lean"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-artifacts.mjs"
	, "src/build/native-rust-artifacts.mjs"
	, "src/build/native-rust-projection.mjs"
	, "src/build/native-dotnet-artifacts.mjs"
	, "src/build/native-dotnet-projection.mjs"
	, "src/build/native-php-artifacts.mjs"
	, "src/build/native-wit-artifacts.mjs"
	, "src/build/native-wit-projection.mjs"
	, "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/rust/copied-conversions.mjs"
	, "src/backends/dotnet/copied-conversions.mjs"
	, "src/backends/php/copied-conversions.mjs"
	, "src/backends/php/brick-math.mjs"
	, "src/backends/wit/copied-conversions.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/analyze/NativeExports.lean"
]) {
	const bytes = git(["show", `${revision}:${path}`]), archive = "sources/" + path + ".txt";
	preserve(archive, bytes); sources.push({ path, revision, archive, sha256: sha256(bytes) });
}
preserve("queue.mjs.txt", await readFile("build/queue-vo1446-native-group.mjs"));
preserve("queue.log", await readFile("build/vo1446-remaining-systemphp-queue-r1.log"));

const failureRevision = "aed50e1a6e16da3856931cf035d70d673fd2cb95";
const failurePrefix = "build/vo1446-host-remaining-ordinary-r1-aed50e1";
const failureStart = JSON.parse(await readFile(failurePrefix + ".start.json"));
const failureEnd = JSON.parse(await readFile(failurePrefix + ".end.json"));
const failureTap = await readFile(failurePrefix + ".tap");
assert.equal(failureStart.revision, failureRevision);
assert.equal(failureStart.tree, git(["rev-parse", failureRevision + "^{tree}"]).toString().trim());
assert.equal(failureStart.runnerSha256, sha256(runner));
assert.equal(failureStart.route, "ordinary-source");
assert.equal(failureStart.environment.LEAN_BRIDGE_CHECKED_RECORD_NATIVE_HOSTS, "dotnet,php-native,rust,wit-wasi");
assert.equal(failureStart.environment.LEAN_BRIDGE_PHP, "/app/.toolchains/php-8.5.10-ffi/bin/php");
assert.equal(failureEnd.code, 1); assert.equal(failureEnd.signal, null);
assert.equal(failureEnd.stoppedForDisk, false);
assert.equal(failureEnd.tapSha256, sha256(failureTap));
assert.match(failureTap.toString(), /ENOENT[^\n]*ctype\.so/u);
for(const [name, count] of [["tests", 1], ["pass", 0], ["fail", 1], ["skipped", 0]])
	assert.match(failureTap.toString(), new RegExp("^# " + name + " " + count + "$", "mu"));
await assert.rejects(access(failurePrefix + ".finished.json"), { code: "ENOENT" });
await assert.rejects(access(failurePrefix + "-records/ordinary-source/report.json"), { code: "ENOENT" });
for(const suffix of ["tap", "start.json", "end.json"])
	preserve("failed-php-tool/run." + suffix, await readFile(failurePrefix + "." + suffix));
const retainDirectory = async (directory, prefix) => {
	for(const entry of await readdir(directory, { withFileTypes: true }))
	{
		const original = join(directory, entry.name), path = prefix + "/" + entry.name;
		if(entry.isDirectory()) await retainDirectory(original, path);
		else
		{ assert.ok(entry.isFile()); preserve(path, await readFile(original)); }
	}
};
await retainDirectory(failurePrefix + "-records/ordinary-source", "failed-php-tool/partial");
preserve("failed-php-tool/queue.log", await readFile("build/vo1446-remaining-hosts-queue-r1.log"));
// The failed producer used these same selected sources. Preserve its revision, not a fabricated rerun.
for(const source of sources)
	assert.ok(git(["show", failureRevision + ":" + source.path]).equals(artifacts.get(source.archive)), source.path);

const index = { schemaVersion: 1, revision
	, tree: git(["rev-parse", revision + "^{tree}"]).toString().trim()
	, scope: { profiles, routes, glibcFloor: "2.36", dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false }
	, failedAttempts: [{ revision: failureRevision, archive: "failed-php-tool", route: "ordinary-source", reason: "PHP tool selection missing ctype.so; no completed combined report" }]
	, runs, sources
	, artifacts: [...artifacts].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })).sort((a, b) => a.path.localeCompare(b.path)) };
for(const [path, bytes] of artifacts)
{
	await mkdir(dirname(join(destination, path)), { recursive: true });
	await writeFile(join(destination, path), bytes, { flag: "wx" });
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(JSON.stringify({ destination, artifacts: artifacts.size, sources: sources.length, indexSha256: sha256(canonicalJson(index)) }) + "\n");
