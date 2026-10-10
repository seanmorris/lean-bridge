/**
 * Preserve the remaining installed reviewed Subtype runs, including the failed PHP tool selection.
 * This one-time writer retains original bytes and refuses to replace any existing archive file.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertReviewedSubtypeRemainingHostRecords } from "../tests/helpers/reviewed-subtype-remaining-host-report.mjs";

const firstRevision = "033dc351633fb87f3cef2e072114c05c0c95a028";
const nextRevision = "a0f0ca4f390369a74477588dd96845a3d0f69f57";
const perlRevision = "135617ad60aebf10ecb12cb1589d521d8a5e24ef";
const destination = "docs/evidence/reviewed-subtype-remaining-hosts-20261010";
const git = args => execFileSync("git", args, { maxBuffer: 8 * 1024 ** 2 });
assert.equal(git(["rev-parse", "HEAD"]).toString().trim(), perlRevision);
assert.equal(git(["ls-tree", "HEAD", "--", destination]).length, 0, "Never rewrite committed observations");
await assert.rejects(access(destination), { code: "ENOENT" });
const definitions = [
	["rust", "rust", "rust-r1", firstRevision, 1]
	, ["dotnet", "dotnet", "dotnet-r1", firstRevision, 1]
	, ["php-native", "php-native", "php-native-r2", firstRevision, 2]
	, ["wit-wasi", "wit-wasi", "wit-wasi-r1", nextRevision, 1]
	, ...["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"].map(abi => ["perl-" + abi, "perl", "perl-" + abi.replaceAll(".", "-") + "-r5", perlRevision, 3])
];
const artifacts = [], sources = [], runs = [], staged = [];
const preserve = async (path, bytes, original) => {
	assert.ok(!artifacts.some(item => item.path === path));
	staged.push({ path, bytes });
	artifacts.push({ path, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes), original });
};
const original = async (path, source) => preserve(path, await readFile(source), source);
for(const [group, profile, label, revision, runnerVersion] of definitions)
{
	const prefix = `build/vo1444-host-${label}-${revision.slice(0, 7)}`, root = prefix + "-records";
	await assertReviewedSubtypeRemainingHostRecords({ profiles: [profile], read: path => readFile(join(root, path)) });
	const start = JSON.parse(await readFile(prefix + ".start.json")), end = JSON.parse(await readFile(prefix + ".end.json"));
	const runner = runnerVersion === 1 ? "build/run-reviewed-subtype-hosts.mjs" : `build/run-reviewed-subtype-hosts-v${runnerVersion}.mjs`;
	assert.equal(start.revision, revision); assert.equal(end.code, 0); assert.equal(end.signal, null);
	assert.equal(end.stoppedForDisk, false); assert.ok(start.initialFreeMiB >= 2048); assert.ok(end.minimumFreeMiB >= 768);
	assert.equal(start.runnerSha256, sha256(await readFile(runner)));
	for(const suffix of ["tap", "start.json", "end.json", "finished.json"])
		await original(`${group}/run.${suffix}`, prefix + "." + suffix);
	for(const name of ["report.json", profile + ".json", ...profile === "perl" ? ["archived-perl-xs.txt"] : []])
		await original(`${group}/${name}`, join(root, name));
	for(const attempt of [0, 1]) for(const name of await readdir(join(root, `build-${attempt}`)))
		await original(`${group}/build-${attempt}/${name}`, join(root, `build-${attempt}`, name));
	runs.push({ group, profile, revision, runner: `runner-v${runnerVersion}.mjs.txt` });
}
const failed = "build/vo1444-host-php-native-r1-033dc35";
for(const suffix of ["tap", "start.json", "end.json"]) await original(`php-failed/run.${suffix}`, failed + "." + suffix);
for(const attempt of [0, 1]) for(const name of await readdir(`${failed}-records/build-${attempt}`))
	await original(`php-failed/build-${attempt}/${name}`, `${failed}-records/build-${attempt}/${name}`);
const perlFailed = "build/vo1444-host-perl-5-36-3-threaded-r1-a0f0ca4";
for(const suffix of ["tap", "start.json", "end.json"]) await original(`perl-failed/run.${suffix}`, perlFailed + "." + suffix);
const countFailed = "build/vo1444-host-perl-5-36-3-threaded-r4-666dbf0";
for(const suffix of ["tap", "start.json", "end.json"]) await original(`perl-count-failed/run.${suffix}`, countFailed + "." + suffix);
await original("perl-count-failed/archived-perl-xs.txt", countFailed + "-records/archived-perl-xs.txt");
for(const attempt of [0, 1]) for(const name of await readdir(`${countFailed}-records/build-${attempt}`))
	await original(`perl-count-failed/build-${attempt}/${name}`, `${countFailed}-records/build-${attempt}/${name}`);
for(const [version, path] of [[1, "build/run-reviewed-subtype-hosts.mjs"], [2, "build/run-reviewed-subtype-hosts-v2.mjs"], [3, "build/run-reviewed-subtype-hosts-v3.mjs"]])
	await original(`runner-v${version}.mjs.txt`, path);
const sourcePaths = [
	"src/backends/perl/generate.mjs"
	, "tests/helpers/reviewed-subtype-host-installed-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-install.mjs"
	, "tests/helpers/reviewed-subtype-host-fixture.mjs"
	, "tests/helpers/reviewed-subtype-host-supplements.mjs"
	, "tests/helpers/reviewed-subtype-installed-fixture.mjs"
	, "tests/helpers/reviewed-subtype-fixture.mjs"
	, "tests/helpers/fin-container-edge-dotnet-closure.mjs"
	, "tests/helpers/fin-container-edge-php-closure.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/closed-package-zip.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/native-subtype-install.mjs"
	, "tests/helpers/perl-relocated-consumer.mjs"
	, "tests/helpers/type-corpus-rust.mjs"
	, "tests/helpers/brick-math.mjs", "src/backends/php/brick-math.mjs"
	, "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/helpers/type-corpus-reviewed-ir.mjs"
	, ...["rust.rs", "dotnet.cs", "php-native.php", "wit-wasi.c", "perl.pl"].map(path => "tests/fixtures/subtype-consumers/" + path)
	, "tests/fixtures/onboarding/native-subtype/Subtypes.lean"
];
for(const revision of [firstRevision, nextRevision, perlRevision]) for(const path of sourcePaths)
{
	const bytes = git(["show", `${revision}:${path}`]), archive = `sources/${revision.slice(0, 7)}/${path}.txt`;
	await preserve(archive, bytes, `git:${revision}:${path}`);
	sources.push({ path, revision, archive, sha256: sha256(bytes) });
}
const index = { schemaVersion: 1, runs, sources
	, scope: { sourcePath: "reviewed-source"
		, glibcFloor: "2.36", dispatch: "not measured"
		, packageBinariesRetained: false, completeToolchainClosure: false }
	, artifacts: artifacts.sort((a, b) => a.path.localeCompare(b.path)) };
// All installed runs and source snapshots must pass before creating the archive.
for(const { path, bytes } of staged)
{
	await mkdir(dirname(join(destination, path)), { recursive: true });
	await writeFile(join(destination, path), bytes, { flag: "wx" });
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(JSON.stringify({ destination, records: artifacts.length, indexSha256: sha256(canonicalJson(index)) }) + "\n");
