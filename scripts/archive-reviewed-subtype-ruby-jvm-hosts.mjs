/**
 * Preserve complete original Ruby/Java/Kotlin reviewed Subtype selections and selected source snapshots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertReviewedSubtypeRubyJvmRecords } from "../tests/helpers/reviewed-subtype-ruby-jvm-report.mjs";

const revision = "274b8685d25caebb422ac4d31be09c2948fef84c";
const destination = "docs/evidence/reviewed-subtype-ruby-jvm-hosts-20261010";
const git = args => execFileSync("git", args, { maxBuffer: 8 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).toString().trim(), "033dc351633fb87f3cef2e072114c05c0c95a028");
assert.equal(git(["ls-tree", "HEAD", "--", destination]).length, 0, "Never rewrite committed observations");
const artifacts = [], sources = [];
const preserve = async (path, bytes) => {
	assert.ok(!artifacts.some(item => item.path === path));
	await mkdir(dirname(join(destination, path)), { recursive: true });
	await writeFile(join(destination, path), bytes, { flag: "wx" });
	artifacts.push({ path, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
};
const runner = await readFile("build/run-reviewed-subtype-hosts.mjs");
for(const [group, profiles] of [["ruby", ["ruby"]], ["jvm", ["java", "kotlin"]]])
{
	const prefix = `build/vo1444-host-${group}-r1-274b868`, root = prefix + "-records";
	await assertReviewedSubtypeRubyJvmRecords({ profiles, read: path => readFile(join(root, path)) });
	const start = JSON.parse(await readFile(prefix + ".start.json")), end = JSON.parse(await readFile(prefix + ".end.json"));
	assert.equal(start.revision, revision); assert.equal(end.code, 0); assert.equal(end.signal, null);
	assert.equal(end.stoppedForDisk, false); assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
	assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
	assert.equal(start.environment.LEAN_BRIDGE_REVIEWED_SUBTYPE_HOSTS, profiles.join(","));
	assert.equal(start.runnerSha256, sha256(runner));
	const tap = await readFile(prefix + ".tap");
	assert.equal(sha256(tap), end.tapSha256);
	for(const [name, count] of [["tests", 1], ["pass", 1], ["fail", 0], ["skipped", 0]])
		assert.match(tap.toString(), new RegExp(`^# ${name} ${count}$`, "mu"));
	for(const suffix of ["tap", "start.json", "end.json", "finished.json"])
		await preserve(`${group}/run.${suffix}`, await readFile(prefix + "." + suffix));
	for(const name of ["report.json", ...profiles.map(profile => profile + ".json")])
		await preserve(`${group}/${name}`, await readFile(join(root, name)));
	for(const attempt of [0, 1])
	{
		const part = `build-${attempt}`;
		assert.deepEqual((await readdir(join(root, part))).sort(), ["Subtypes.lean", "lean-bridge.exports.json", "model.json", "package-set-receipt.json", "review.json"]);
		for(const name of await readdir(join(root, part)))
			await preserve(`${group}/${part}/${name}`, await readFile(join(root, part, name)));
	}
}
for(const path of [
	"tests/helpers/reviewed-subtype-host-installed-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-install.mjs"
	, "tests/helpers/reviewed-subtype-host-fixture.mjs"
	, "tests/helpers/reviewed-subtype-host-supplements.mjs"
	, "tests/helpers/reviewed-subtype-installed-fixture.mjs"
	, "tests/helpers/reviewed-subtype-fixture.mjs"
	, "tests/helpers/fin-container-edge-ruby-closure.mjs"
	, "tests/helpers/fin-container-edge-jvm-closure.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/closed-package-zip.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/native-subtype-install.mjs"
	, "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/type-corpus-reviewed-ir.mjs"
	, "tests/fixtures/subtype-consumers/ruby.rb"
	, "tests/fixtures/subtype-consumers/java.java"
	, "tests/fixtures/subtype-consumers/kotlin.kt"
	, "tests/fixtures/onboarding/native-subtype/Subtypes.lean"
]) {
	const bytes = git(["show", `${revision}:${path}`]), archive = "sources/" + path + ".txt";
	await preserve(archive, bytes);
	sources.push({ path, revision, archive, sha256: sha256(bytes) });
}
await preserve("runner.mjs.txt", runner);
const index = { schemaVersion: 1, revision
	, scope: { profiles: ["ruby", "java", "kotlin"], sourcePath: "reviewed-source"
		, glibcFloor: "2.36", dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false }
	, artifacts: artifacts.sort((a, b) => a.path.localeCompare(b.path)), sources };
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(JSON.stringify({ destination, records: artifacts.length, indexSha256: sha256(canonicalJson(index)) }) + "\n");
