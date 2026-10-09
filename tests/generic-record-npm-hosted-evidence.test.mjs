/**
 * Keep the hosted ordinary npm generic-record acceptance (run 37736101772, #1433) tied to its job, original
 * log, artifact, both installed reports and the producer sources at f9d5ce9.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import "./helpers/generic-record-npm-closure-tests.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { assertGenericNpmArchive, assertGenericNpmExecution, assertGenericNpmReport, genericNpmArchivePaths, genericNpmDirectory, genericNpmRuns, writeGenericNpmArtifact } from "./helpers/generic-record-npm-hosted-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${genericNpmDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "9ad05e39944e6125c97c1568a99a5cf941c95fcdd7cc0fbd05468e794ec588dc");
	return JSON.parse(bytes);
};
const text = name => readFile(`${genericNpmDirectory}/${name}`, "utf8");

test("the hosted npm archive authenticates its job, log, artifact and both reports from its own paths", async () => {
	const record = await receipt(), observed = [];
	await assertGenericNpmArchive(record, path => {
		observed.push(path);
		return readFile(path);
	}, { currentSources: false });
	assert.deepEqual([...new Set(observed)].sort(), [...genericNpmArchivePaths].sort());
	assert.deepEqual([record.execution, record.scope.hostedCi, record.scope.binaryArchivesRetained, record.scope.dispatch], ["hosted", true, false, "not measured"]);
});

test("the current sources reach their exact hosted-revision digests", async () => {
	const record = await receipt(), observed = [];
	await assertGenericNpmArchive(record, path => {
		observed.push(path);
		return readFile(path);
	});
	assert.deepEqual([...new Set(observed)].sort(), [...genericNpmArchivePaths, ...record.sourceFiles.map(file => file.path)].sort());
});

test("the hosted execution refuses another job, a failed selection, a run enforcement, another artifact and failed or missing tests", async () => {
	const job = JSON.parse(await text("job-113176414840.json")), artifact = JSON.parse(await text("artifact-11536871810.json")), log = await text("job-113176414840.log");
	assertGenericNpmExecution(job, artifact, log);
	const changedJob = change => {
		const copy = structuredClone(job);
		change(copy);
		return [copy, artifact, log];
	};
	const changedArtifact = change => {
		const copy = structuredClone(artifact);
		change(copy);
		return [job, copy, log];
	};
	const step = number => copy => copy.steps.find(item => item.number === number);
	const refused = {
		"failed job": changedJob(copy => { copy.conclusion = "failure"; })
		, "other job": changedJob(copy => { copy.id += 1; })
		, "other revision": changedJob(copy => { copy.head_sha = "0".repeat(40); })
		, "failed selection": changedJob(copy => { step(11)(copy).conclusion = "failure"; })
		, "enforcement ran": changedJob(copy => { step(33)(copy).conclusion = "success"; })
		, "other artifact digest": changedArtifact(copy => { copy.digest = `sha256:${"0".repeat(64)}`; })
		, "other artifact run": changedArtifact(copy => { copy.workflow_run.id += 1; })
		, "other artifact size": changedArtifact(copy => { copy.size_in_bytes += 1; })
		, "direct test failed": [job, artifact, log.replace(`ok 62 - ${genericNpmRuns[0].test}`, `not ok 62 - ${genericNpmRuns[0].test}`)]
		, "specialized test skipped": [job, artifact, log.replace(`ok 63 - ${genericNpmRuns[1].test}`, `ok 63 - ${genericNpmRuns[1].test} # SKIP`)]
		, "report gate removed": [job, artifact, log.replace("test -s build/generic-records/specialized-npm.json", "true")]
		, "a failed sibling": [job, artifact, log.replace("ok 64 - ", "not ok 64 - ")]
		// The generic-records file's own summary, not an earlier file's.
		, "failed summary": [job, artifact, log.slice(0, log.indexOf("# tests 75")) + log.slice(log.indexOf("# tests 75")).replace("# fail 0", "# fail 1")]
		, "other image": [job, artifact, log.replace("Image: ubuntu-24.04", "Image: ubuntu-22.04")]
	};
	for(const [label, args] of Object.entries(refused))
		assert.throws(() => assertGenericNpmExecution(...args), assert.AssertionError, label);
});

test("both hosted reports keep ordinary isolation, reproduction, counts, caller, receipt relations and specializations", async () => {
	for(const run of genericNpmRuns)
	{
		const original = JSON.parse(await text(`${run.id}.json`));
		await assertGenericNpmReport(original, run);
		const report = change => {
			const copy = structuredClone(original);
			change(copy);
			return copy;
		};
		const refused = {
			"reviewed path": report(copy => { copy.path = "reviewed-source"; })
			, "source kept": report(copy => { copy.sourceRemovedBeforeInstallation = false; })
			, "online install": report(copy => { copy.offlineInstall = false; })
			, "compiler on the path": report(copy => { copy.compilerFreePath = false; })
			, "not reproducible": report(copy => { copy.reproducible = false; })
			, "one build": report(copy => { copy.independentBuilds = 1; })
			, "fewer checks": report(copy => { copy.checks -= 1; })
			, "fewer rejections": report(copy => { copy.rejections -= 1; })
			, "dispatch claimed": report(copy => { copy.dispatch = { observed: true }; })
			, "other caller": report(copy => { copy.consumerSha256 = "0".repeat(64); })
			, "loose TypeScript": report(copy => { copy.typescript.skipLibCheck = true; })
			, "non-strict TypeScript": report(copy => { copy.typescript.strict = false; })
			, "receipt digest": report(copy => { copy.receiptSha256 = "0".repeat(64); })
			, "receipt package": report(copy => { copy.receipt.package.sha256 = "0".repeat(64); })
			, "receipt policy": report(copy => { copy.receipt.policies.runtimeShared = false; })
			, "extra field": report(copy => { copy.note = "x"; })
			, ...run.id === "specialized"
				? { "dropped specialization": report(copy => { copy.specializations.pop(); }) }
				: { "added specialization": report(copy => { copy.specializations = []; }) }
		};
		for(const [label, changed] of Object.entries(refused))
			await assert.rejects(() => assertGenericNpmReport(changed, run), assert.AssertionError, `${run.id}: ${label}`);
	}
});

test("the hosted receipt refuses overclaims, unknown paths before reading and changed source bytes", async () => {
	const record = await receipt();
	const mutations = {
		"browser claim": changed => { changed.scope.profiles.push("browser-javascript"); }
		, "reviewed claim": changed => { changed.scope.sourcePath = "reviewed-source"; }
		, "local claim": changed => { changed.execution = "local"; }
		, "dispatch claim": changed => { changed.scope.dispatch = "measured"; }
		, "binaries claimed": changed => { changed.scope.binaryArchivesRetained = true; }
		, "revision": changed => { changed.revision = "0".repeat(40); }
		, "artifact digest": changed => { changed.artifacts[0].sha256 = "0".repeat(64); }
		, "artifact provenance": changed => { changed.artifacts[0].originalPath = "build/other.log"; }
		, "artifact size": changed => { changed.artifacts[3].bytes++; }
		, "duplicate path": changed => { changed.artifacts.push(changed.artifacts[0]); }
		, "dropped source": changed => { changed.sourceFiles.pop(); }
		, "fetch time": changed => { changed.hosted.jobMetadataFetchedAt = "yesterday"; }
	};
	for(const [label, mutate] of Object.entries(mutations))
	{
		const changed = structuredClone(record);
		mutate(changed);
		await assert.rejects(() => assertGenericNpmArchive(changed, path => readFile(path), { currentSources: false }), assert.AssertionError, label);
	}
	for(const path of ["/etc/hostname", `${genericNpmDirectory}/../../../package.json`, `${genericNpmDirectory}/extra.json`])
	{
		const changed = structuredClone(record);
		changed.artifacts[0].path = path;
		let reads = 0;
		await assert.rejects(() => assertGenericNpmArchive(changed, async () => {
			reads++;
			return Buffer.alloc(0);
		}), assert.AssertionError, path);
		assert.equal(reads, 0, `${path} reached the reader`);
	}
	// A changed packaging byte is not the hosted producer's, even with the archive intact.
	await assert.rejects(() => assertGenericNpmArchive(record, async path => {
		const bytes = await readFile(path);
		return path === "src/release/component-npm-package.mjs" ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
	}), error => error instanceof assert.AssertionError && error.message.startsWith("src/release/component-npm-package.mjs"));
});

test("the hosted npm archive writer keeps identical bytes and refuses any differing file or receipt", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-npm-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writeGenericNpmArtifact(path, Buffer.from("one\n"));
	await writeGenericNpmArtifact(path, Buffer.from("one\n"));
	await assert.rejects(() => writeGenericNpmArtifact(path, Buffer.from("two\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "one\n");
});
