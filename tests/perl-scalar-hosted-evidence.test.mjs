/**
 * Keep the hosted Perl XS scalar Fin acceptance at 046ced0 bound to its original jobs, logs, artifact ZIPs and
 * producer sources on all four configurations and both routes (VO #1425).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPerlScalarArchive, assertPerlScalarExecution, assertPerlScalarReport, perlScalarConfigurations, perlScalarConsumer, perlScalarDirectory, perlScalarPaths, perlScalarSnapshot } from "./helpers/perl-scalar-hosted-evidence.mjs";

const receiptSha256 = "627c0ecfe938dd4608d05830da7f15499813bbec3c2bbb3b231e685194ae38fb";
const receipt = async () => {
	const bytes = await readFile(`${perlScalarDirectory}/receipt.json`);
	assert.equal(sha256(bytes), receiptSha256);
	return JSON.parse(bytes);
};
const get = (configuration, name) => readFile(`${perlScalarDirectory}/${configuration}/${name}`);
const json = async (configuration, name) => JSON.parse(await get(configuration, name));
const consumer = async () => perlScalarConsumer(await readFile(perlScalarSnapshot("tests/perl-fin.test.mjs"), "utf8"));
const execution = async ({ name }) => {
	const artifacts = { corpus: await json(name, "corpus-artifact.json"), abi: await json(name, "abi-artifact.json") };
	const zips = { corpus: await get(name, "corpus.zip"), abi: await get(name, "abi.zip") };
	return { capture: await json(name, "capture.json"), job: await json(name, "job.json"), artifacts, log: (await get(name, "job.log")).toString("utf8"), zips };
};

test("the hosted Perl scalar archive binds four configurations and both routes to original jobs, ZIPs and sources", async () => {
	const value = await receipt();
	const { runs } = await assertPerlScalarArchive(value);
	assert.deepEqual(runs, perlScalarConfigurations.flatMap(item => [[item.name, "ordinary-source", 2024], [item.name, "reviewed-ir", 2024]]));
	assert.deepEqual(value.files.map(item => item.path), perlScalarPaths);
	assert.deepEqual([value.execution, value.scope.supportPromotion, value.scope.binaryArchivesRetained, value.scope.artifactZipsRetained], ["hosted", false, false, true]);
	assert.match(value.scope.glibc, /No run on a minimum-libc machine is claimed/u);
});

test("archive bytes refuse a missing configuration or route, an altered member and a changed ZIP", async () => {
	const value = await receipt();
	const path = name => `${perlScalarDirectory}/${perlScalarConfigurations[0].name}/${name}`;
	const swap = (target, change) => async name => name === target ? change(await readFile(name)) : readFile(name);
	for(const read of [
		swap(path("reviewed.json"), bytes => Buffer.from(bytes.toString("utf8").replace("\"checks\": 2024", "\"checks\": 2023")))
		, swap(path("ordinary.json"), () => readFile(path("reviewed.json")))
		, swap(path("corpus.zip"), bytes => { const copy = Buffer.from(bytes); copy[copy.length - 40] ^= 1; return copy; })
		, swap(path("job.log"), bytes => Buffer.concat([bytes, Buffer.from("\n")]))])
		await assert.rejects(assertPerlScalarArchive(value, read));
	const without = route => ({ ...value, files: value.files.filter(item => item.path !== path(`${route}.json`)) });
	const missingConfiguration = { ...value, files: value.files.filter(item => !item.path.includes(`/${perlScalarConfigurations[2].name}/`)) };
	const changes = [without("ordinary"), without("reviewed"), missingConfiguration, { ...value, revision: "0".repeat(40) }, { ...value, scope: { ...value.scope, supportPromotion: true } }];
	for(const changed of changes) await assert.rejects(assertPerlScalarArchive(changed, readFile));
});

test("each execution refuses another job, revision, artifact, failed step and weakened TAP", async () => {
	const configuration = perlScalarConfigurations[3], original = await execution(configuration);
	assertPerlScalarExecution(configuration, original);
	const mutations = [
		value => { value.job.head_sha = "0".repeat(40); }
		, value => { value.job.conclusion = "failure"; }
		, value => { value.job.steps.find(step => step.number === 10).conclusion = "skipped"; }
		, value => { value.capture.run += 1; }
		, value => { value.artifacts.corpus.id += 1; }
		, value => { value.artifacts.abi.digest = `sha256:${"0".repeat(64)}`; }
		, value => { value.log = value.log.replaceAll("# tests 9", "# tests 8"); }
		, value => { value.log = value.log.replaceAll("# skipped 0", "# skipped 1"); }
		, value => { value.log = value.log.replace(/^(.*ok \d+ - independently reviewed Perl packages check scalar Fin through installed consumers)$/mu, "$1 # SKIP"); }
		, value => { value.log = value.log.replaceAll("LEAN_BRIDGE_PERL_FIN_TEST=1 node --test tests/perl-fin.test.mjs", "node --test tests/perl-fin.test.mjs"); }
		, value => { value.zips.corpus = Buffer.concat([value.zips.corpus, Buffer.from(" ")]); }];
	for(const [index, mutate] of mutations.entries())
	{
		const value = { ...structuredClone({ ...original, zips: undefined }), zips: { ...original.zips } }; mutate(value);
		assert.throws(() => assertPerlScalarExecution(configuration, value), assert.AssertionError, `mutation ${index}`);
	}
});

test("each report refuses false flags, changed counters, counts, consumers, routes and runtime relations", async () => {
	const configuration = perlScalarConfigurations[0], text = await consumer();
	for(const route of ["ordinary", "reviewed"])
	{
		const original = await json(configuration.name, `${route}.json`);
		assertPerlScalarReport(original, route, configuration, text);
		const mutations = [
			value => { value.reports[0].relocatedInstallation = false; }
			, value => { value.reports[0].repeatExecution = false; }
			, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
			, value => { value.reports[0].dispatch.observed[1][1][0] = 1; }
			, value => { value.reports[0].dispatch.observed.pop(); }
			, value => { value.reports[0].dispatch.interposer = "gdb"; }
			, value => { value.reports[0].checks = 2023; }
			, value => { value.reports[0].perl = "/usr/bin/perl"; }
			, value => { value.reports[0].path = route === "ordinary" ? "reviewed-ir" : "ordinary-source"; }
			, value => { value.reports[0].packages.find(item => item.role === "component").requires[0].version = "0.001"; }
			, value => { value.reports[0].packages.find(item => item.role === "runtime").runtimeIdentity = "0".repeat(64); }
			, value => { value.archives[Object.keys(value.archives)[0]] = "0".repeat(64); }
			, value => { value.reproducible = false; }];
		for(const [index, mutate] of mutations.entries())
		{
			const value = structuredClone(original); mutate(value);
			assert.throws(() => assertPerlScalarReport(value, route, configuration, text), assert.AssertionError, `${route} mutation ${index}`);
		}
		assert.throws(() => assertPerlScalarReport(original, route, configuration, `${text}\n`), assert.AssertionError, "another consumer");
		assert.throws(() => assertPerlScalarReport(original, route === "ordinary" ? "reviewed" : "ordinary", configuration, text), assert.AssertionError, "another route");
		assert.throws(() => assertPerlScalarReport(original, route, perlScalarConfigurations[1], text), assert.AssertionError, "another interpreter");
	}
	assert.throws(() => perlScalarConsumer("const perlFinConsumer = () => `${process.exit()}`;"), assert.AssertionError);
});
