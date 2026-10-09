/**
 * Keep the four relocated Perl selections tied to their jobs, producer snapshots and original bf89eff acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import { perlRefinementCases, perlRefinementDirectory } from "./helpers/perl-refinement-hosted-evidence.mjs";
import { assertPerlRelocatedArchive, assertPerlRelocatedExecution, assertPerlRelocatedReport, perlRelocatedArchivePaths, perlRelocatedConfigurations, perlRelocatedDirectory, perlRelocatedOriginalReceipt, perlRelocatedReadPaths, perlRelocatedSourcePaths, writePerlRelocatedArtifact } from "./helpers/perl-relocated-hosted-evidence.mjs";

const read = name => readFile(`${perlRelocatedDirectory}/${name}`);
const json = async name => JSON.parse(await read(name));
const receipt = async () => {
	const bytes = await read("receipt.json");
	assert.equal(sha256(bytes), "c26fe20d9cf0b17349db42d33d1e11063a76e767dd378df3d0b3ed0b24f9a069");
	return JSON.parse(bytes);
};
const original = async name => JSON.parse(await readFile(`${perlRefinementDirectory}/${name}`));
const originalTrees = async () => JSON.parse(await readFile(perlRelocatedOriginalReceipt.path)).refinements;

test("four relocated hosted Perl configurations preserve 16 reports, their original acceptance and exact provenance", async () => {
	const record = await receipt(), observed = [];
	await assertPerlRelocatedArchive(record, path => { observed.push(path); return readFile(path); });
	assert.deepEqual(observed, perlRelocatedReadPaths);
	assert.equal(record.files.length, perlRelocatedArchivePaths.length);
	assert.equal(record.scope.supportPromotion, false);
	assert.equal(record.scope.binaryArchivesRetained, false);
	assert.deepEqual(record.configurations.map(item => item.conclusion), ["success", "success", "success", "success"]);
});

test("the relocated Perl source snapshots retain their exact current-source predecessors", async () => {
	const record = await receipt();
	for(const path of perlRelocatedSourcePaths)
	{
		const snapshot = record.files.find(item => item.path === `${perlRelocatedDirectory}/source/${path}.source`);
		const source = beforeFinRefinementSource(path, await readFile(path, "utf8"), snapshot.sha256);
		assert.equal(sha256(source), snapshot.sha256, path);
		assert.equal(source, await readFile(snapshot.path, "utf8"), path);
	}
});

test("relocated Perl execution refuses another configuration, failed steps, skipped tests and removed report gates", async () => {
	for(const configuration of perlRelocatedConfigurations)
	{
		const prefix = configuration.name;
		const job = await json(`${prefix}/job.json`), artifacts = { corpus: await json(`${prefix}/corpus-artifact.json`), abi: await json(`${prefix}/abi-artifact.json`) };
		const log = (await read(`${prefix}/job.log`)).toString();
		assertPerlRelocatedExecution(configuration, job, artifacts, log);
		for(const mutate of [
			changed => { changed.id++; }
			, changed => { changed.run_id++; }
			, changed => { changed.head_sha = "0".repeat(40); }
			, changed => { changed.conclusion = "cancelled"; }
			, ...[9, 10, 11].map(number => changed => { changed.steps.find(item => item.number === number).conclusion = "failure"; })
		]) {
			const changed = structuredClone(job); mutate(changed);
			assert.throws(() => assertPerlRelocatedExecution(configuration, changed, artifacts, log), assert.AssertionError);
		}
		for(const kind of ["corpus", "abi"])
		{
			const changed = structuredClone(artifacts); changed[kind].workflow_run.head_sha = "0".repeat(40);
			assert.throws(() => assertPerlRelocatedExecution(configuration, job, changed, log), assert.AssertionError);
		}
		for(const selected of perlRefinementCases)
		{
			// Replace only TAP result lines, not a preceding Subtest label.
			const line = log.split("\n").find(line => line.endsWith(` - ${selected.test}`) && /Z ok \d+ - /u.test(line));
			assert.ok(line);
			for(const changed of [log.replace(line, `${line} # SKIP`)
				, log.replace(line, line.replace("Z ok ", "Z not ok "))
				, log.replace(`test -s build/${selected.member}`, "true")])
				assert.throws(() => assertPerlRelocatedExecution(configuration, job, artifacts, changed), assert.AssertionError, selected.id);
		}
	}
});

test("each relocated report equals its original acceptance plus only the relocation fields", async () => {
	const trees = await originalTrees();
	for(const configuration of perlRelocatedConfigurations) for(const selected of perlRefinementCases)
	{
		const report = await json(`${configuration.name}/${selected.id}.json`), before = await original(`${configuration.name}/${selected.id}.json`);
		const tree = trees[selected.id === "reviewed-container" ? "container" : selected.id];
		const validate = value => assertPerlRelocatedReport(value, before, selected, configuration, tree);
		validate(report);
		const mutations = [
			changed => { delete changed.reports[0].relocatedInstallation; }
			, changed => { changed.reports[0].relocatedInstallation = false; }
			, changed => { delete changed.reports[0].repeatExecution; }
			, changed => { changed.reports[0].repeatExecution = false; }
			, changed => { changed.reproducible = false; }
			, changed => { changed.reports[0].checks--; }
			, changed => { changed.reports[0].consumerSha256 = "0".repeat(64); }
			, changed => { changed.reports[0].refinements = {}; }
			, changed => { changed.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
			, changed => { changed.archives[Object.keys(changed.archives)[0]] = "0".repeat(64); }
			, ...["bindingIrSha256", "modelSha256", "receiptSha256", "sourceTreeSha256"].map(field => changed => { changed.reports[0][field] = "0".repeat(64); })
			, ...["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"].map(flag => changed => { changed.reports[0][flag] = false; })
			, changed => { changed.reports[0].extra = true; }
			, changed => { changed.reports.push(changed.reports[0]); }
		];
		if(selected.id === "supplemental") mutations.push(changed => { changed.reports[0].perl = "/usr/bin/perl"; });
		else mutations.push(
			changed => { changed.reports[0].dispatch.columns.push("unmeasured"); }
			, changed => { changed.reports[0].dispatch.observed[0][1][0]++; });
		for(const mutate of mutations)
		{
			const changed = structuredClone(report); mutate(changed);
			assert.throws(() => validate(changed), assert.AssertionError, `${configuration.name}/${selected.id}`);
		}
		// Another configuration's original is a different acceptance, even with the relocation fields added.
		const other = perlRelocatedConfigurations.find(item => item.name !== configuration.name);
		const elsewhere = await original(`${other.name}/${selected.id}.json`);
		assert.throws(() => assertPerlRelocatedReport(report, elsewhere, selected, configuration, tree), assert.AssertionError);
	}
});

test("the relocated Perl receipt rejects scope expansion, unknown paths before reading and changed originals", async () => {
	const record = await receipt();
	for(const mutate of [
		changed => { changed.scope.supportPromotion = true; }
		, changed => { changed.scope.relocation = "the installed tree moved"; }
		, changed => { changed.scope.comparison = "equivalent"; }
		, changed => { changed.scope.scalar = "included"; }
		, changed => { changed.scope.reviewed.push("Subtype"); }
		, changed => { changed.original.receipt.sha256 = "0".repeat(64); }
		, changed => { changed.configurations[0].job++; }
		, changed => { changed.files[0].originalPath = "other"; }
		, changed => { changed.files[0].sha256 = "0".repeat(64); }
		, changed => { changed.files[0].bytes++; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertPerlRelocatedArchive(changed, path => readFile(path)), assert.AssertionError);
	}
	for(const path of ["/etc/hostname", `${perlRelocatedDirectory}/../../package.json`, `${perlRelocatedDirectory}/extra.json`])
	{
		const changed = structuredClone(record); changed.files[0].path = path;
		let reads = 0;
		await assert.rejects(() => assertPerlRelocatedArchive(changed, async () => { reads++; return Buffer.alloc(0); }), assert.AssertionError);
		assert.equal(reads, 0);
	}
	// A changed original acceptance, report, log or snapshot is refused, wherever it sits.
	for(const suffix of [perlRelocatedOriginalReceipt.path, `${perlRefinementDirectory}/5.36.3-threaded/container.json`, `${perlRelocatedDirectory}/5.38.2-threaded/supplemental.json`, "/job.log", "/source/tests/helpers/perl-relocated-consumer.mjs.source"])
		await assert.rejects(() => assertPerlRelocatedArchive(record, async path => {
			const bytes = await readFile(path);
			return path.endsWith(suffix) ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), assert.AssertionError, suffix);
});

test("relocated Perl archive writes preserve identical bytes and refuse changed files or receipts", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-relocated-writer-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writePerlRelocatedArtifact(path, Buffer.from("original\n"));
	await writePerlRelocatedArtifact(path, Buffer.from("original\n"));
	await assert.rejects(() => writePerlRelocatedArtifact(path, Buffer.from("different\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "original\n");
});
