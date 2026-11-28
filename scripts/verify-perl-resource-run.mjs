#!/usr/bin/env node
/**
 * Retain and verify one successful hosted four-ABI standalone resource run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkedRecordValueIndexHostedDigest as digestFile, extractCheckedRecordValueIndexHostedArtifact as extract } from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";

const execute = promisify(execFile);
const args = process.argv.slice(2), offline = args[0] === "--offline";
if(offline) args.shift();
const [id, commit, output] = args;
assert.ok(args.length === 3 && /^[1-9][0-9]*$/u.test(id) && /^[0-9a-f]{40}$/u.test(commit)
	&& isAbsolute(output) && resolve(output) === output, "Usage: verify-perl-resource-run.mjs [--offline] RUN_ID EXPECTED_COMMIT /absolute/output");
const project = "seanmorris/lean-bridge", apiPath = `repos/${project}/actions`;
const api = async (file, endpoint) => offline ? readFile(join(output, file), "utf8")
	: (await execute("gh", ["api", `${apiPath}/${endpoint}`], { maxBuffer: 4 * 1024 ** 2 })).stdout;
const runJson = await api("run.json", `runs/${id}`), run = JSON.parse(runJson);
assert.deepEqual([String(run.id), run.repository.full_name, run.head_repository.full_name, run.path, run.event, run.head_sha, run.status, run.conclusion],
	[id, project, project, ".github/workflows/perl-consumer.yml", "workflow_dispatch", commit, "completed", "success"]);
const jobsJson = await api("jobs.json", `runs/${id}/attempts/${run.run_attempt}/jobs?per_page=100`), jobs = JSON.parse(jobsJson);
const artifactsJson = await api("artifacts.json", `runs/${id}/artifacts?per_page=100`), artifacts = JSON.parse(artifactsJson);
assert.equal(jobs.jobs.length, jobs.total_count); assert.equal(artifacts.artifacts.length, artifacts.total_count);
const runnable = jobs.jobs.filter(job => job.conclusion !== "skipped");
assert.equal(runnable.length, 1);
const job = runnable[0];
assert.deepEqual([job.name, job.status, job.conclusion, job.head_sha, job.run_id, job.run_attempt],
	["Installed standalone resources and callables on four Perl ABIs", "completed", "success", commit, run.id, run.run_attempt]);
const named = artifacts.artifacts.filter(item => item.name === `standalone-resource-callables-perl-${commit}-${run.run_attempt}`);
assert.equal(named.length, 1);
const artifact = named[0];
assert.equal(artifact.expired, false);
assert.deepEqual([artifact.workflow_run.id, artifact.workflow_run.head_sha], [run.id, commit]);
assert.match(artifact.digest, /^sha256:[a-f0-9]{64}$/u);
assert.ok(artifact.size_in_bytes > 0 && artifact.size_in_bytes <= 128 * 1024 ** 2);

const zip = join(output, "original.zip");
if(!offline)
{
	await mkdir(output); // Do not overwrite an earlier observation, even if it failed.
	for(const [file, contents] of [["run.json", runJson], ["jobs.json", jobsJson], ["artifacts.json", artifactsJson]])
		await writeFile(join(output, file), contents, { flag: "wx" });
	const handle = await open(zip, "wx");
	try
	{
		await new Promise((done, fail) => {
			const child = spawn("gh", ["api", `${apiPath}/artifacts/${artifact.id}/zip`], { stdio: ["ignore", handle.fd, "inherit"] });
			child.once("error", fail);
			child.once("close", (code, signal) => code === 0 ? done() : fail(new Error(`Artifact download failed: ${code ?? signal}`)));
		});
	}
	finally
	{ await handle.close(); }
}
assert.equal((await stat(zip)).size, artifact.size_in_bytes);
assert.equal(`sha256:${await digestFile(zip)}`, artifact.digest);

const { root } = await extract(zip);
try
{
	const reportBytes = await readFile(join(root, "report.json"));
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString(), canonicalJson(report), "Expected the producer's canonical report bytes");
	assert.deepEqual([report.schemaVersion, report.family, report.commit, report.checks], [1, "standalone-resource-callbacks", commit, 400]);
	const source = async file => (await execute("git", ["show", `${commit}:tests/fixtures/perl/${file}`], { encoding: "buffer", cwd: import.meta.dirname })).stdout;
	assert.deepEqual(report.sources, { Workshop: sha256(Buffer.concat([await source("ordinary/Workshop.lean"), Buffer.from("\n"), await source("resource-callables.lean")]))
		, Other: sha256(await source("other/Other.lean")) });
	const files = new Set(["report.json"]), hashes = new Map(), components = new Set(), runtimes = new Set();
	const runtimeIdentities = new Set();
	assert.deepEqual(report.packages.map(p => `${p.module}:${p.route}`).sort(), ["Other:reviewed", "Workshop:ordinary", "Workshop:reviewed"]);
	for(const pkg of report.packages)
	{
		const { receipt } = pkg;
		validatePackageSetReceipt(receipt);
		assert.equal(receipt.component.id, `${pkg.module.toLowerCase()}@0.1.0`);
		assert.equal(receipt.profiles.length, 1);
		assert.deepEqual([receipt.profiles[0].id, receipt.profiles[0].bindingIrSha256], ["native-library-v1", pkg.bindingIrSha256]);
		runtimeIdentities.add(receipt.profiles[0].runtimeIdentity);
		if(pkg.route === "reviewed") assert.match(pkg.reviewedBindingIrSha256, /^[a-f0-9]{64}$/u);
		else assert.equal(pkg.reviewedBindingIrSha256, null);
		assert.deepEqual(receipt.packages.map(p => p.role).sort(), ["component", "runtime"]);
		const expected = [];
		for(const p of receipt.packages)
		{
			assert.equal(p.target, "cpan"); assert.equal(p.artifacts.length, 1);
			const original = p.artifacts[0], file = `archives/${original.sha256}.tar.gz`;
			assert.equal(original.path, `archives/${basename(original.path)}`);
			files.add(file);
			if(!hashes.has(file)) hashes.set(file, await digestFile(join(root, file)));
			assert.equal(hashes.get(file), original.sha256);
			assert.equal((await stat(join(root, file))).size, original.bytes);
			(p.role === "component" ? components : runtimes).add(original.sha256);
			expected.push({ archive: basename(original.path), sha256: original.sha256 });
		}
		const order = (a, b) => a.archive.localeCompare(b.archive, "en");
		assert.deepEqual(pkg.archives.toSorted(order), expected.sort(order));
	}
	assert.equal(components.size, 3); assert.equal(runtimes.size, 1); assert.equal(hashes.size, 4); assert.equal(runtimeIdentities.size, 1);
	const probes = { "reviewed-resources.t": 12, "resource-callables.t": 23, "resource-borrows.t": 15 };
	const remaining = new Set();
	for(const version of ["5.36.3", "5.38.2"]) for(const mode of ["threaded", "unthreaded"])
		for(const route of ["ordinary", "reviewed"]) for(const probe of Object.keys(probes)) remaining.add(`tap/${version}-${mode}/${route}/${probe}.tap`);
	for(const probe of Object.keys(probes))
	{
		files.add(`probes/${probe}`);
		assert.deepEqual(await readFile(join(root, "probes", probe)), await source(probe));
	}
	assert.equal(report.results.length, remaining.size);
	for(const result of report.results)
	{
		assert.ok(remaining.delete(result.tap), "Duplicate or unselected transcript"); files.add(result.tap);
		const { abi, route, probe, checks } = result;
		assert.equal(typeof abi.threaded, "boolean");
		assert.equal(abi.archname, abi.threaded ? "x86_64-linux-thread-multi" : "x86_64-linux");
		assert.equal(result.tap, `tap/${abi.version}-${abi.threaded ? "threaded" : "unthreaded"}/${route}/${probe}.tap`);
		assert.equal(result.probeSha256, sha256(await readFile(join(root, "probes", probe))));
		const bytes = await readFile(join(root, result.tap)), tap = bytes.toString();
		assert.equal(sha256(bytes), result.tapSha256); assert.equal(checks, probes[probe]);
		assert.doesNotMatch(tap, /^not ok|^Bail out!|#\s*(?:skip|todo)\b/imu);
		assert.match(tap, /^ok 1\b/u); assert.equal(tap.trimEnd().split("\n").at(-1), `1..${checks}`);
		assert.deepEqual([...tap.matchAll(/^ok (\d+)\b/gmu)].map(m => Number(m[1])), Array.from({ length: checks }, (_, i) => i + 1));
	}
	assert.equal(remaining.size, 0);
	assert.deepEqual(await nativeArtifactPaths(root), [...files].sort());
	const summary = {
		commit, run: run.html_url, job: job.html_url, artifactId: artifact.id
		, digest: artifact.digest, bytes: artifact.size_in_bytes
		, reportSha256: sha256(reportBytes), runtime: [...runtimes][0]
		, components: [...components].sort()
		, transcripts: report.results.length, checks: report.checks
	};
	const summaryPath = join(output, "verified.json");
	const bytes = canonicalJson(summary);
	if(offline) assert.equal(await readFile(summaryPath, "utf8"), bytes);
	else await writeFile(summaryPath, bytes, { flag: "wx" });
	console.log(canonicalJson(summary).trimEnd());
}
finally
{ await rm(root, { recursive: true, force: true }); }
