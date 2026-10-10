/**
 * Preserve original reviewed C/C++ and npm records from the frozen retention milestone.
 * This one-time writer never replaces a prior archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertReviewedSubtypePackageTap } from "../tests/helpers/reviewed-subtype-package-ci-common.mjs";
import { assertReviewedSubtypeCFamilyRecords } from "../tests/helpers/reviewed-subtype-c-family-report.mjs";
import { assertReviewedSubtypeNpmRecords } from "../tests/helpers/reviewed-subtype-npm-report.mjs";

const revision = "5b3f2efaeba2ea8257a6e62b0c6c3722a7713601";
const destination = "docs/evidence/reviewed-subtype-package-runs-20261010";
const git = args => execFileSync("git", args, { maxBuffer: 8 * 1024 ** 2 });
assert.equal(git(["rev-parse", "HEAD"]).toString().trim(), revision);
assert.equal(git(["status", "--porcelain", "--untracked-files=no"]).length, 0);
assert.equal(git(["ls-tree", "HEAD", "--", destination]).length, 0);
await assert.rejects(access(destination), { code: "ENOENT" });
const staged = [], artifacts = [], runs = [], sources = [];
const preserve = (path, bytes, original) => {
	assert.ok(!artifacts.some(item => item.path === path)); staged.push({ path, bytes });
	artifacts.push({ path, original, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
};
const original = async (path, source) => preserve(path, await readFile(source), source);
for(const [lane, version, check] of [["c-cpp", 1, assertReviewedSubtypeCFamilyRecords], ["npm", 2, assertReviewedSubtypeNpmRecords]])
{
	const prefix = `build/vo1444-package-${lane}-r1-${revision.slice(0, 7)}`, records = prefix + "-records";
	const tap = await readFile(prefix + ".tap"), start = JSON.parse(await readFile(prefix + ".start.json")), end = JSON.parse(await readFile(prefix + ".end.json"));
	assertReviewedSubtypePackageTap(lane, tap.toString());
	await check(path => readFile(join(records, path)));
	assert.equal(start.revision, revision); assert.equal(start.lane, lane);
	assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
	assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
	assert.equal(end.tapSha256, sha256(tap));
	assert.equal(start.runnerSha256, sha256(await readFile(`build/run-reviewed-subtype-packages-v${version}.mjs`)));
	for(const suffix of ["tap", "start.json", "end.json", ...lane === "npm" ? ["finished.json"] : []])
		await original(`${lane}/run.${suffix}`, prefix + "." + suffix);
	for(const entry of await readdir(records, { recursive: true, withFileTypes: true }))
	{
		if(!entry.isFile()) continue;
		const path = join(entry.parentPath, entry.name), relative = path.slice(records.length + 1);
		assert.ok(!relative.startsWith("/") && !relative.split("/").includes(".."));
		await original(`${lane}/${relative}`, path);
	}
	runs.push({ lane, revision, runner: `runner-v${version}.mjs.txt`
		, producerExit: 0
		, controllerPostcheck: lane === "c-cpp" ? "failed: expected four caller rows instead of the producer's two; original producer passed; independent checker accepts both original builds" : "passed" });
}
for(const version of [1, 2]) await original(`runner-v${version}.mjs.txt`, `build/run-reviewed-subtype-packages-v${version}.mjs`);
const paths = [
	"tests/reviewed-subtype-installed.test.mjs"
	, "tests/helpers/reviewed-subtype-npm-tests.mjs"
	, "tests/helpers/reviewed-subtype-installed-fixture.mjs"
	, "tests/helpers/reviewed-subtype-fixture.mjs"
	, "tests/helpers/reviewed-subtype-package-fixture.mjs"
	, "tests/helpers/reviewed-subtype-package-records.mjs"
	, "tests/helpers/refinement-engine.mjs"
	, "tests/helpers/native-subtype-install.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/package-set.mjs", "tests/helpers/lake-workspace.mjs"
	, "tests/fixtures/reviewed-subtype-consumers/javascript.mjs"
	, "tests/fixtures/subtype-consumers/c.c"
	, "tests/fixtures/subtype-consumers/cpp.cpp"
	, ...["Subtypes.lean", "lean-toolchain", "lakefile.toml", "package.json", "LICENSE"].map(name => "tests/fixtures/onboarding/native-subtype/" + name)
];
for(const path of paths)
{
	const bytes = git(["show", `${revision}:${path}`]), archive = `sources/${path}.txt`;
	assert.deepEqual(await readFile(path), bytes);
	preserve(archive, bytes, `git:${revision}:${path}`); sources.push({ path, revision, archive, sha256: sha256(bytes) });
}
const index = { schemaVersion: 1, runs, sources
	, scope: { sourcePath: "reviewed-source", independentBuilds: 2
		, installedBuilds: 1, nativeGlibcFloor: "2.36"
		, npmEngine: "frozen local engine", dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false
		, relocatedReplay: false }
	, artifacts: artifacts.sort((a, b) => a.path.localeCompare(b.path)) };
for(const { path, bytes } of staged)
{
	await mkdir(dirname(join(destination, path)), { recursive: true });
	await writeFile(join(destination, path), bytes, { flag: "wx" });
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(JSON.stringify({ destination, records: artifacts.length, indexSha256: sha256(canonicalJson(index)) }) + "\n");
