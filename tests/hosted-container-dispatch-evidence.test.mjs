/**
 * Preserve actual installed Python/Rust container entry measurements and their hosted provenance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertHostedContainerArchive, assertHostedContainerJob, assertHostedContainerReport, hostedContainerDirectory, writeHostedContainerArtifact } from "./helpers/hosted-container-dispatch-evidence.mjs";
import { assertHostedContainerMembership, hostedContainerMembership, hostedContainerMembershipPath, readHostedContainerMembers } from "./helpers/hosted-container-artifact-membership.mjs";

const json = async name => {
	const bytes = await readFile(`${hostedContainerDirectory}/${name}`);
	if(name === "receipt.json") assert.equal(sha256(bytes), "4b943a755f29af54ccef6fb59d4973f88470db78c08b520928734bbb998882e1");
	return JSON.parse(bytes);
};

test("hosted container counters authenticate all four installed reports and exact current source predecessors", async () => {
	const receipt = await json("receipt.json");
	await assertHostedContainerArchive(receipt);
	assert.equal(receipt.artifacts.length, 32); assert.equal(receipt.sources.length, 22);
	assert.equal(receipt.scope.installedTreeRelocation, false); assert.equal(receipt.scope.overallWorkflowSucceeded, false);
});

test("hosted container reports refuse fabricated counts, shapes, ownership flags and widened host attribution", async () => {
	for(const profile of ["python", "rust"]) for(const [index, route] of [[0, "ordinary-source"], [1, "reviewed-ir"]])
	{
		const original = await json(`${profile}-container-${index}.json`);
		assertHostedContainerReport(original, profile, route);
		for(const mutate of [
			value => { value.reproducible = false; }
			, value => { value.reports[0].profile = "cpp"; }
			, value => { value.reports[0].path = route === "ordinary-source" ? "reviewed-ir" : "ordinary-source"; }
			, value => { value.reports[0].checks--; }
			, value => { value.reports[0].sourceRemovedBeforeInstallation = false; }
			, value => { value.reports[0].offlineInstall = false; }
			, value => { value.reports[0].consumerSha256 = "0".repeat(64); }
			, value => { value.reports[0].refinements["FinContainers.mirrorAll"].parameters[0].arguments[0].bound = "11"; }
			, value => { value.reports[0].dispatch.observed[2][2][0]++; }
			, value => { value.reports[0].dispatch.observed[1][2] = [0, 0, 0, 0]; }
			, value => { value.reports[0].dispatch.observed.pop(); }
			, value => { value.reports[0].dispatch.columns.reverse(); }
			, value => { value.reports[0].dispatch.missingInterposerRejected = false; }
			, value => { value.reports[0].dispatch.installedFilesUnchanged = false; }
			, value => { value.reports[0].dispatch.interposerSha256 = "0".repeat(64); }
			, value => { value.reports[0].dispatch.probeSha256 = "0".repeat(64); }
			, value => { value.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
		]) {
			const value = structuredClone(original); mutate(value);
			assert.throws(() => assertHostedContainerReport(value, profile, route), assert.AssertionError);
		}
	}
});

test("hosted container provenance refuses foreign jobs, failed steps, artifacts and skipped executions", async () => {
	for(const profile of ["python", "rust"])
	{
		const original = { job: await json(`${profile}.job.json`), artifact: await json(`${profile}.artifact.json`), log: await readFile(`${hostedContainerDirectory}/${profile}.job.log`, "utf8") };
		const check = value => assertHostedContainerJob(profile, value.job, value.artifact, value.log);
		check(original);
		for(const mutate of [
			value => { value.job.id++; }
			, value => { value.job.head_sha = "0".repeat(40); }
			, value => { value.job.conclusion = "cancelled"; }
			, value => { value.job.labels = ["local"]; }
			, value => { value.job.steps.find(step => step.name.startsWith("Compare") && step.conclusion === "success").conclusion = "skipped"; }
			, value => { value.artifact.id++; }
			, value => { value.artifact.digest = "sha256:" + "0".repeat(64); }
			, value => { value.artifact.workflow_run.head_sha = "0".repeat(40); }
			, value => { value.log = value.log.replace(/Z ok ([0-9]+) - relocated source-free native packages check Fin inside arrays/u, "Z not ok $1 - relocated source-free native packages check Fin inside arrays"); }
		]) {
			const value = structuredClone(original); mutate(value);
			assert.notDeepEqual(value, original); assert.throws(() => check(value), assert.AssertionError);
		}
	}
});

test("hosted container archive refuses foreign paths and scope changes before opening any artifact", async () => {
	const original = await json("receipt.json");
	for(const mutate of [
		value => { value.artifacts[0].path = "../../foreign.json"; }
		, value => { value.artifacts[0].path = "/tmp/foreign.json"; }
		, value => { value.artifacts.pop(); }
		, value => { value.artifacts.push(value.artifacts[0]); }
		, value => { value.artifacts.reverse(); }
		, value => { value.scope.installedTreeRelocation = true; }
		, value => { value.scope.overallWorkflowSucceeded = true; }
		, value => { value.scope.measuredEntrypoints.push("FinContainers.countNone"); }
		, value => { value.sources.pop(); }
	]) {
		const value = structuredClone(original); mutate(value); let reads = 0;
		await assert.rejects(() => assertHostedContainerArchive(value, async path => { reads++; return readFile(path); }));
		assert.equal(reads, 0);
	}
});

test("hosted container archive refuses modified and rehashed report, log and source bytes", async () => {
	const original = await json("receipt.json");
	for(const selected of [original.artifacts[0], original.artifacts[4], original.artifacts.at(-1)])
	{
		const changed = Buffer.from(await readFile(selected.path)); changed[0] ^= 1;
		const read = path => path === selected.path ? Promise.resolve(changed) : readFile(path);
		await assert.rejects(() => assertHostedContainerArchive(original, read));
		const value = structuredClone(original); value.artifacts.find(file => file.path === selected.path).sha256 = sha256(changed);
		await assert.rejects(() => assertHostedContainerArchive(value, read));
	}
});

test("hosted container writer preserves every original and refuses changed replacement bytes", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-hosted-container-writer-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "receipt.json"), bytes = Buffer.from("original\n");
	await writeHostedContainerArtifact(path, bytes); await writeHostedContainerArtifact(path, bytes);
	await assert.rejects(() => writeHostedContainerArtifact(path, Buffer.from("changed\n")), /Refusing to replace/u);
	assert.deepEqual(await readFile(path), bytes);
});

test("hosted container membership compares all four reports with their exact original ZIP members", async () => {
	const supplement = JSON.parse(await readFile(hostedContainerMembershipPath));
	await assertHostedContainerMembership(supplement);
	for(const descriptor of supplement.artifacts.slice(0, 2))
	{
		const members = supplement.members.filter(member => member.archive === descriptor.path);
		const actual = readHostedContainerMembers(await readFile(descriptor.path), descriptor, members.map(member => member.member));
		for(const member of members) assert.deepEqual(actual.get(member.member), await readFile(member.report));
	}
});

test("hosted container membership rejects altered paths, identities and associations before opening files", async () => {
	for(const mutate of [
		value => { value.receipt.path = "../../foreign.json"; }
		, value => { value.receipt.sha256 = "0".repeat(64); }
		, value => { value.artifacts[0].path = "/tmp/foreign.zip"; }
		, value => { value.artifacts[0].originalPath = "foreign.zip"; }
		, value => { value.artifacts[0].bytes++; }
		, value => { value.artifacts[0].sha256 = "0".repeat(64); }
		, value => { value.artifacts.pop(); }
		, value => { value.artifacts.push(value.artifacts[0]); }
		, value => { value.members[0].member = "../foreign.json"; }
		, value => { value.members[0].archive = value.members[2].archive; }
		, value => { value.members[0].report = value.members[1].report; }
		, value => { value.members.pop(); }
		, value => { value.members.push(value.members[0]); }
	]) {
		const supplement = structuredClone(hostedContainerMembership); mutate(supplement); let reads = 0;
		await assert.rejects(() => assertHostedContainerMembership(supplement, async path => { reads++; return readFile(path); }));
		assert.equal(reads, 0);
	}
});

test("hosted container membership refuses damaged, truncated, swapped and rehashed originals", async () => {
	const supplement = structuredClone(hostedContainerMembership);
	const paths = [supplement.receipt.path, ...supplement.artifacts.map(file => file.path), ...supplement.members.map(member => member.report)];
	for(const selected of paths)
	{
		const original = await readFile(selected), changed = Buffer.from(original); changed[0] ^= 1;
		const read = path => path === selected ? Promise.resolve(changed) : readFile(path);
		await assert.rejects(() => assertHostedContainerMembership(supplement, read));
		const forged = structuredClone(supplement);
		const descriptor = forged.artifacts.find(file => file.path === selected) ?? forged.receipt;
		descriptor.sha256 = sha256(changed);
		await assert.rejects(() => assertHostedContainerMembership(forged, read));
	}
	for(const descriptor of supplement.artifacts.slice(0, 2))
	{
		const original = await readFile(descriptor.path), selected = supplement.members.filter(member => member.archive === descriptor.path).map(member => member.member);
		assert.throws(() => readHostedContainerMembers(original.subarray(0, original.length - 1), descriptor, selected));
		const foreign = supplement.artifacts.find(file => file.path.endsWith(".zip") && file.path !== descriptor.path);
		assert.throws(() => readHostedContainerMembers(original, foreign, selected));
		assert.throws(() => readHostedContainerMembers(original, descriptor, [selected[0], selected[0]]));
		assert.throws(() => readHostedContainerMembers(original, descriptor, ["../foreign.json"]));
	}
});
