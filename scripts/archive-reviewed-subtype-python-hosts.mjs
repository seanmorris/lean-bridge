/**
 * Preserve original reviewed Python host observations and the rejected overload-identity attempt.
 * The archive does not contain package binaries or a complete toolchain/input closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertReviewedSubtypeHostRecords } from "../tests/helpers/reviewed-subtype-host-report.mjs";

const revision = "274b8685d25caebb422ac4d31be09c2948fef84c";
const failedRevision = "aa55d66542b4e173fc64ef0c0dee5aa6384ecb86";
const destination = "docs/evidence/reviewed-subtype-python-hosts-20261010";
const git = args => execFileSync("git", args, { maxBuffer: 8 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).toString().trim(), revision);
assert.equal(git(["ls-tree", "HEAD", "--", destination]).length, 0, "Never rewrite committed observations");
const artifacts = [], sources = [];
const preserve = async (path, bytes) => {
	assert.ok(!artifacts.some(item => item.path === path));
	await mkdir(dirname(join(destination, path)), { recursive: true });
	await writeFile(join(destination, path), bytes, { flag: "wx" });
	artifacts.push({ path, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
};
const snapshot = async (path, producer = revision, prefix = "sources/") => {
	const bytes = git(["show", `${producer}:${path}`]), archived = prefix + path + ".txt";
	await preserve(archived, bytes);
	sources.push({ path, revision: producer, archive: archived, sha256: sha256(bytes) });
};
for(const [floor, label, expectedVersion] of [["3.11", "python311-r2", "3.11.16"], ["3.12", "python312-r1", "3.12.14"]])
{
	const prefix = `build/vo1444-host-${label}-274b868`, root = prefix + "-records";
	const report = await assertReviewedSubtypeHostRecords({ profiles: ["python"], python: floor, read: path => readFile(join(root, path)) });
	assert.equal(report.reports[0].pythonEnvironment.python, expectedVersion);
	const start = JSON.parse(await readFile(prefix + ".start.json")), end = JSON.parse(await readFile(prefix + ".end.json"));
	assert.equal(start.revision, revision); assert.equal(end.code, 0); assert.equal(end.signal, null);
	assert.equal(end.stoppedForDisk, false); assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
	assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
	assert.equal(start.environment.LEAN_BRIDGE_REVIEWED_SUBTYPE_HOSTS, "python");
	const tap = await readFile(prefix + ".tap");
	assert.equal(sha256(tap), end.tapSha256);
	for(const [name, count] of [["tests", 1], ["pass", 1], ["fail", 0], ["skipped", 0]])
		assert.match(tap.toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
	for(const suffix of ["tap", "start.json", "end.json", "finished.json"])
		await preserve(`${floor}/run.${suffix}`, await readFile(prefix + "." + suffix));
	for(const name of ["report.json", "python.json"])
		await preserve(`${floor}/${name}`, await readFile(join(root, name)));
	for(const attempt of [0, 1])
	{
		const part = `build-${attempt}`;
		assert.deepEqual((await readdir(join(root, part))).sort(), ["Subtypes.lean", "lean-bridge.exports.json", "model.json", "package-set-receipt.json", "review.json"]);
		for(const name of await readdir(join(root, part)))
			await preserve(`${floor}/${part}/${name}`, await readFile(join(root, part, name)));
	}
}
const failed = "build/vo1444-host-python311-r1-aa55d66";
for(const suffix of ["tap", "start.json", "end.json"])
	await preserve(`failed-overload/run.${suffix}`, await readFile(failed + "." + suffix));
const failure = JSON.parse(await readFile(failed + ".end.json"));
assert.equal(failure.code, 1); assert.equal(failure.stoppedForDisk, false);
assert.equal(JSON.parse(await readFile(failed + ".start.json")).revision, failedRevision);
assert.match((await readFile(failed + ".tap")).toString(), /bindingIr\.declarations\[0\]\.overloadKey/u);
for(const name of ["api.binding-ir.json", "Subtypes.lean"])
	await preserve(`failed-overload/${name}`, await readFile(`/tmp/lean-bridge-reviewed-subtype-hosts-tp8xsV/author-0/project/${name}`));
for(const path of [
	"tests/helpers/reviewed-subtype-host-installed-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-install.mjs"
	, "tests/helpers/reviewed-subtype-host-fixture.mjs"
	, "tests/helpers/reviewed-subtype-host-supplements.mjs"
	, "tests/helpers/reviewed-subtype-installed-fixture.mjs"
	, "tests/helpers/reviewed-subtype-fixture.mjs"
	, "tests/helpers/fin-container-edge-python-closure.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/native-subtype-install.mjs"
	, "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/type-corpus-reviewed-ir.mjs"
	, "tests/fixtures/subtype-consumers/python.py"
	, "tests/fixtures/onboarding/native-subtype/Subtypes.lean"
]) await snapshot(path);
await snapshot("tests/helpers/reviewed-subtype-host-fixture.mjs", failedRevision, "failed-overload/sources/");
const runner = await readFile("build/run-reviewed-subtype-hosts.mjs");
for(const prefix of ["build/vo1444-host-python311-r2-274b868", "build/vo1444-host-python312-r1-274b868", failed])
	assert.equal(JSON.parse(await readFile(prefix + ".start.json")).runnerSha256, sha256(runner));
await preserve("runner.mjs.txt", runner);
const index = { schemaVersion: 1, revision, failedRevision
	, scope: { profiles: ["python"], python: ["3.11.16", "3.12.14"]
		, sourcePath: "reviewed-source", glibcFloor: "2.36"
		, dispatch: "not measured", packageBinariesRetained: false
		, completeToolchainClosure: false }
	, artifacts: artifacts.sort((a, b) => a.path.localeCompare(b.path)), sources };
await mkdir(destination, { recursive: true });
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(JSON.stringify({ destination, records: artifacts.length, indexSha256: sha256(canonicalJson(index)) }) + "\n");
