/**
 * Keep all four Perl refinement selections tied to their original reports, jobs and producer snapshots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import "./helpers/perl-refinement-hosted-source-history-tests.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { assertPerlRefinementArchive, assertPerlRefinementExecution, assertPerlRefinementReport, perlRefinementArchivePaths, perlRefinementConfigurations, perlRefinementCases, perlRefinementDirectory, perlRefinementSourcePaths, writePerlRefinementArtifact } from "./helpers/perl-refinement-hosted-evidence.mjs";

const read = name => readFile(`${perlRefinementDirectory}/${name}`);
const json = async name => JSON.parse(await read(name));
const receipt = async () => {
	const bytes = await read("receipt.json");
	assert.equal(sha256(bytes), "e8c7408fdb4430554c2e59c81bcc4303d874ab082a97a183d285f00d23a2639c");
	return JSON.parse(bytes);
};

test("four hosted Perl configurations preserve 16 reports and exact original provenance", async () => {
	const record = await receipt(), observed = [];
	await assertPerlRefinementArchive(record, path => { observed.push(path); return readFile(path); });
	assert.deepEqual(observed, perlRefinementArchivePaths);
	assert.equal(record.files.length, 79);
	assert.equal(record.scope.supportPromotion, false);
	assert.equal(record.scope.binaryArchivesRetained, false);
	assert.deepEqual(record.configurations.map(item => item.conclusion), ["success", "cancelled", "cancelled", "cancelled"]);
});

test("the hosted Perl source snapshots retain their exact current-source predecessors", async () => {
	const record = await receipt();
	for(const path of perlRefinementSourcePaths)
	{
		const snapshot = record.files.find(item => item.path === `${perlRefinementDirectory}/source/${path}.source`);
		const source = beforeFinRefinementSource(path, await readFile(path, "utf8"), snapshot.sha256);
		assert.equal(sha256(source), snapshot.sha256, path);
		assert.equal(source, await readFile(snapshot.path, "utf8"), path);
	}
});

test("Perl execution refuses another configuration, failed selection, skipped tests and removed report gates", async () => {
	for(const configuration of perlRefinementConfigurations)
	{
		const prefix = configuration.name;
		const job = await json(`${prefix}/job.json`), artifacts = { corpus: await json(`${prefix}/corpus-artifact.json`), abi: await json(`${prefix}/abi-artifact.json`) };
		const log = (await read(`${prefix}/job.log`)).toString();
		assertPerlRefinementExecution(configuration, job, artifacts, log);
		for(const mutate of [
			changed => { changed.id++; }
			, changed => { changed.head_sha = "0".repeat(40); }
			, changed => { changed.conclusion = configuration.conclusion === "success" ? "cancelled" : "success"; }
			, changed => { changed.steps.find(item => item.number === 10).conclusion = "failure"; }
		]) {
			const changed = structuredClone(job); mutate(changed);
			assert.throws(() => assertPerlRefinementExecution(configuration, changed, artifacts, log), assert.AssertionError);
		}
		for(const kind of ["corpus", "abi"])
		{
			const changed = structuredClone(artifacts); changed[kind].workflow_run.head_sha = "0".repeat(40);
			assert.throws(() => assertPerlRefinementExecution(configuration, job, changed, log), assert.AssertionError);
		}
		for(const selected of perlRefinementCases)
		{
			// Replace only TAP result lines, not a preceding Subtest label.
			const line = log.split("\n").find(line => line.endsWith(` - ${selected.test}`) && /Z ok \d+ - /u.test(line));
			assert.ok(line);
			for(const changed of [log.replace(line, `${line} # SKIP`)
				, log.replace(line, line.replace("Z ok ", "Z not ok "))
				, log.replace(`test -s build/${selected.member}`, "true")])
				assert.throws(() => assertPerlRefinementExecution(configuration, job, artifacts, changed), assert.AssertionError, selected.id);
		}
	}
});

test("all Perl reports refuse weakened isolation, false repeats, altered bounds and counter results", async () => {
	const record = await receipt();
	for(const configuration of perlRefinementConfigurations) for(const selected of perlRefinementCases)
	{
		const original = await json(`${configuration.name}/${selected.id}.json`), trees = record.refinements[selected.id === "reviewed-container" ? "container" : selected.id];
		const validate = value => assertPerlRefinementReport(value, selected, configuration, trees);
		validate(original);
		const mutations = [
			changed => { changed.reproducible = false; }
			, changed => { changed.reports[0].checks--; }
			, changed => { changed.reports[0].profile = "python"; }
			, changed => { changed.reports[0].path = "other"; }
			, changed => { changed.reports[0].consumerSha256 = "0".repeat(64); }
			, changed => { changed.reports[0].refinements = {}; }
			, changed => { changed.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
			, changed => { changed.reports[0].packages[0].runtimeIdentity = "0".repeat(64); }
			, changed => { changed.reports[0].extra = true; }
			, ...["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"].map(flag => changed => { changed.reports[0][flag] = false; })
		];
		if(selected.id === "supplemental") mutations.push(
			changed => { changed.reports[0].repeatExecution = false; }
			, changed => { changed.reports[0].perl = "/usr/bin/perl"; }
			, changed => { changed.reports[0].dispatch = { observed: true }; });
		else mutations.push(
			changed => { changed.reports[0].repeatExecution = true; }
			, changed => { changed.reports[0].dispatch.columns.push("unmeasured"); }
			, changed => { changed.reports[0].dispatch.observed[0][1][0] = 0; }
			, changed => { changed.reports[0].dispatch.observed[1][1][0] = 1; }
			, changed => { changed.reports[0].dispatch.observed.pop(); });
		for(const mutate of mutations)
		{
			const changed = structuredClone(original); mutate(changed);
			assert.throws(() => validate(changed), assert.AssertionError, `${configuration.name}/${selected.id}`);
		}
	}
});

test("the Perl receipt rejects scope expansion, unknown paths before reading and changed originals", async () => {
	const record = await receipt();
	for(const mutate of [
		changed => { changed.scope.supportPromotion = true; }
		, changed => { changed.scope.wholeRun = "passed"; }
		, changed => { changed.scope.repetition = "every consumer ran twice"; }
		, changed => { changed.scope.reviewed.push("Subtype"); }
		, changed => { changed.configurations[0].job++; }
		, changed => { changed.refinements.subtype = {}; }
		, changed => { changed.files[0].originalPath = "other"; }
		, changed => { changed.files[0].sha256 = "0".repeat(64); }
		, changed => { changed.files[0].bytes++; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertPerlRefinementArchive(changed, path => readFile(path)), assert.AssertionError);
	}
	for(const path of ["/etc/hostname", `${perlRefinementDirectory}/../../package.json`, `${perlRefinementDirectory}/extra.json`])
	{
		const changed = structuredClone(record); changed.files[0].path = path;
		let reads = 0;
		await assert.rejects(() => assertPerlRefinementArchive(changed, async () => { reads++; return Buffer.alloc(0); }), assert.AssertionError);
		assert.equal(reads, 0);
	}
	for(const suffix of ["/subtype.json", "/job.log", "/source/scripts/build-perl-toolchains.mjs.source"])
		await assert.rejects(() => assertPerlRefinementArchive(record, async path => {
			const bytes = await readFile(path);
			return path.endsWith(suffix) ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), assert.AssertionError);
});

test("Perl archive writes preserve identical bytes and refuse changed files or receipts", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-evidence-writer-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writePerlRefinementArtifact(path, Buffer.from("original\n"));
	await writePerlRefinementArtifact(path, Buffer.from("original\n"));
	await assert.rejects(() => writePerlRefinementArtifact(path, Buffer.from("different\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "original\n");
});
