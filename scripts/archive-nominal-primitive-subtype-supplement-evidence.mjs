#!/usr/bin/env node
/**
 * Permanently retain one successful hosted supplemental primitive-base replay.
 * The GitHub API metadata, original artifact ZIP, extracted records and exact
 * producer/archiver sources are all frozen together.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, mkdir, readFile, realpath, writeFile
} from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import {
	assertNominalPrimitiveSupplementHostedCapture
	, checkNominalPrimitiveSupplementArtifact
	, nominalPrimitiveSupplementChecker
	, nominalPrimitiveSupplementEvidence
	, nominalPrimitiveSupplementHosted
	, nominalPrimitiveSupplementOriginal
	, nominalPrimitiveSupplementProducer
	, nominalPrimitiveSupplementSelectedSources
	, nominalPrimitiveSupplementZipMembers
} from "../tests/helpers/nominal-primitive-subtype-supplement-evidence.mjs";

const usage = "Usage: archive-nominal-primitive-subtype-supplement-evidence.mjs --root /absolute/artifact/root";
const parse = args => {
	assert.deepEqual(args.length, 2, usage); assert.equal(args[0], "--root", usage);
	assert.ok(isAbsolute(args[1]) && !/[\0\r\n]/u.test(args[1]), usage);
	return args[1];
};
let root;
try
{ root = parse(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

await assert.rejects(access(nominalPrimitiveSupplementEvidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
assert.equal(await realpath(root), root);
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const revisions = {
	producer: nominalPrimitiveSupplementProducer
	, checker: nominalPrimitiveSupplementChecker, archiver: archiveCommit
};

const files = new Map();
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const artifactFiles = new Map();
for(const path of await nativeArtifactPaths(root))
{
	const bytes = await readFile(join(root, path));
	artifactFiles.set(path, bytes); put(`artifact/${path}`, bytes);
}
const producerSource = path => nominalPrimitiveSupplementOriginal(
	revisions.producer, path);
const records = checkNominalPrimitiveSupplementArtifact(
	artifactFiles, producerSource);

const api = path => execFileSync("gh", ["api", path], {
	maxBuffer: 16 * 1024 * 1024
});
const base = `repos/${nominalPrimitiveSupplementHosted.repository}`;
const runBytes = api(`${base}/actions/runs/${nominalPrimitiveSupplementHosted.runId}`);
const jobBytes = api(`${base}/actions/jobs/${nominalPrimitiveSupplementHosted.jobId}`);
const artifactBytes = api(`${base}/actions/artifacts/${nominalPrimitiveSupplementHosted.artifactId}`);
const zipBytes = api(`${base}/actions/artifacts/${nominalPrimitiveSupplementHosted.artifactId}/zip`);
const logBytes = api(`${base}/actions/jobs/${nominalPrimitiveSupplementHosted.jobId}/logs`);
put("api/run.json", runBytes); put("api/job.json", jobBytes);
put("api/artifact.json", artifactBytes); put("api/artifact.zip", zipBytes);
put("api/job.log", logBytes);
const zipped = nominalPrimitiveSupplementZipMembers(zipBytes);
assert.deepEqual([...zipped.keys()].sort(), [...artifactFiles.keys()].sort());
for(const [path, bytes] of zipped) assert.deepEqual(artifactFiles.get(path), bytes, path);

const selectedSources = nominalPrimitiveSupplementSelectedSources(revisions);
for(const source of selectedSources)
	put(`sources/${source.role}/${source.path}`
		, nominalPrimitiveSupplementOriginal(source.revision, source.path));

const hostedRun = {
	repository: nominalPrimitiveSupplementHosted.repository
	, runId: nominalPrimitiveSupplementHosted.runId
	, jobId: nominalPrimitiveSupplementHosted.jobId
	, url: `https://github.com/${nominalPrimitiveSupplementHosted.repository}/actions/runs/${nominalPrimitiveSupplementHosted.runId}`
	, artifact: {
		id: nominalPrimitiveSupplementHosted.artifactId
		, name: nominalPrimitiveSupplementHosted.artifactName
		, bytes: nominalPrimitiveSupplementHosted.artifactBytes
		, digest: nominalPrimitiveSupplementHosted.artifactDigest
	}
};
const index = {
	schemaVersion: 1
	, kind: "nominal-primitive-subtype-supplement-hosted-v1"
	, producerCommit: revisions.producer, checkerCommit: revisions.checker
	, archiveCommit, hostedRun, records, selectedSources
	, limitations: [
		"The supplemental caller covers seventeen values accepted by each Subtype predicate but refused by the stricter input constructor, plus six nested variant refusal paths."
		, "The original npm package is replayed through Node, a plain browser page, React production and strict lifecycles, and a dedicated worker in Chromium, Firefox, and WebKit."
		, "The original Python wheel is replayed on Python 3.11 and 3.12 through ordinary and independently reviewed APIs."
		, "Every package is taken from an earlier authenticated archive, installed offline without a Lean build, and Node and Python installations execute again after relocation."
		, "The GitHub run, job, log, artifact metadata, original artifact ZIP, extracted records, and selected exact source snapshots are retained."
		, "Operating systems, browser engines, Node, npm, Python, pip, React, Vite, GitHub Actions, and their distributions remain trusted inputs."
		, "This is a targeted supplement to the primitive-base nominal Subtype matrix; it does not widen the represented type surface or replace the full per-language evidence archives."
	]
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({
			path, bytes: bytes.length, sha256: sha256(bytes)
		}))
};
assertNominalPrimitiveSupplementHostedCapture(index, files);

await mkdir(nominalPrimitiveSupplementEvidence);
for(const [path, bytes] of files)
{
	const target = join(nominalPrimitiveSupplementEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(nominalPrimitiveSupplementEvidence, "index.json")
	, indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: nominalPrimitiveSupplementEvidence
	, files: files.size + 1
	, bytes: [...files.values()].reduce((sum, bytes) => sum + bytes.length
		, indexBytes.length)
	, ...revisions
	, runId: nominalPrimitiveSupplementHosted.runId
	, jobId: nominalPrimitiveSupplementHosted.jobId
	, artifactId: nominalPrimitiveSupplementHosted.artifactId
	, indexSha256: sha256(indexBytes)
}));
