/**
 * Preserve successful hosted Fin observations and their original checkout sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { finHostedJobs, finHostedRevision, finHostedRoot, finHostedRun } from "../tests/helpers/fin-container-hosted-selections.mjs";
import { readFinHostedMembers } from "../tests/helpers/fin-container-hosted-zip.mjs";
import { assertFinHostedJob, assertFinHostedReports } from "../tests/helpers/fin-container-hosted.mjs";

assert.equal(process.argv.length, 2, "This archiver accepts only the fixed original hosted run");
await assert.rejects(access(finHostedRoot), { code: "ENOENT" });
const files = new Map(), originals = {}, selections = [];
const add = (path, bytes, original) => { assert.ok(!files.has(path)); files.set(path, bytes); originals[path] = original; };
for(const job of finHostedJobs)
{
	const names = {
		"artifact.json": `build/vo1454-hosted-${job.artifactId}.json`
		, "artifact.zip": `build/vo1454-hosted-${job.artifactId}.zip`
		, "job.json": `build/vo1454-hosted-job-originals/${job.lane}.json`
		, "job.log": `build/vo1454-hosted-job-originals/${job.lane}.log`
	};
	const values = new Map();
	for(const [name, path] of Object.entries(names))
	{ const bytes = await readFile(path); values.set(name, bytes); add(job.lane + "/" + name, bytes, path); }
	const members = readFinHostedMembers(values.get("artifact.zip"), JSON.parse(values.get("artifact.json")));
	const inventory = canonicalJson(Object.fromEntries([...members].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }])));
	values.set("members.json", Buffer.from(inventory));
	assertFinHostedJob(values, job.lane);
	const checked = await assertFinHostedReports(members, job.lane);
	selections.push({ lane: job.lane, ...checked });
	add(job.lane + "/members.json", Buffer.from(inventory), `derived:${job.artifactId}:complete-zip-members`);
}
const git = args => execFileSync("git", args, { maxBuffer: 32 * 1024 * 1024 });
const paths = git(["ls-tree", "-r", "--name-only", finHostedRevision]).toString().trim().split("\n");
const selected = paths.filter(path => /^(?:tests\/helpers\/fin-container-|tests\/fixtures\/fin-container-|tests\/fixtures\/onboarding\/native-fin-containers\/)/u.test(path)
	|| /^(?:scripts\/(?:check-fin-(?:late|container)|run-fin-late-)|tests\/fin-container-(?:edges|edge-report|foreign-carriers)\.test\.mjs$)/u.test(path));
for(const path of [".github/workflows/consumer-matrix.yml"
	, "package.json", "package-lock.json"
	, "src/analyze/NativeExports.lean", "src/analyze/native-metadata.mjs"
	, "src/analyze/native-types.mjs", "src/build/native-model.mjs"
	, "src/build/canonical-build.mjs", "src/build/elaborated-component.mjs"
	, "src/build/component-refinements.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/c/native-primitives.mjs", "src/backends/c/gmp-projection.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/native-host-installs.mjs"])
	if(paths.includes(path) && !selected.includes(path)) selected.push(path);
for(const path of selected.sort()) add(`sources/${path}.txt`, git(["show", `${finHostedRevision}:${path}`]), `git:${finHostedRevision}:${path}`);
const index = { schemaVersion: 1, kind: "native-fin-container-hosted-v1"
	, revision: finHostedRevision, runId: finHostedRun
	, jobs: finHostedJobs, selections
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({
		path, bytes: bytes.length, sha256: sha256(bytes), original: originals[path]
		, ...path.startsWith("sources/") ? { gitPath: path.slice(8, -4), gitRevision: finHostedRevision } : {}
	}))
	, scope: ["Eight successful jobs, nine selections, ten native profiles and both Python floors."
		, "The parent workflow has an unrelated documentation failure and is not claimed successful."
		, "Original ZIPs retain unrelated members without promoting their contents as coverage."
		, "Public-host, separate raw-adapter, foreign-carrier and late-input observations remain distinct."
		, "Four inlined identity sources are not measured; two surviving source functions are measured."
		, "Selected producer sources are retained, not package binaries or full toolchain closures."] };
await mkdir(finHostedRoot);
for(const [path, bytes] of files)
{
	const target = join(finHostedRoot, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
const indexBytes = canonicalJson(index);
await writeFile(join(finHostedRoot, "index.json"), indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({ root: finHostedRoot, files: files.size, sources: selected.length, indexSha256: sha256(indexBytes), selections }));
