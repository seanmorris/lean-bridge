/**
 * Refuse incomplete, stale, relabelled and partially instrumented installed edge reports.
 * Positive mocks below test only the checker format, never installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { finContainerEdgeProfiles } from "./helpers/fin-container-edges.mjs";
import { assertFinContainerEdgeReport } from "./helpers/fin-container-edge-report.mjs";
import { syntheticFinContainerEdgeReport } from "./helpers/fin-container-edge-report-fixtures.mjs";

test("synthetic current-format reports cover ten native hosts and both Python floors", async () => {
	const profiles = [...finContainerEdgeProfiles].sort();
	await assertFinContainerEdgeReport(await syntheticFinContainerEdgeReport(profiles), profiles, { python: "3.11" });
	const python = await syntheticFinContainerEdgeReport(["python"]), item = python.reports[0];
	item.python = item.dispatch.publicHost.python = "3.12.14";
	item.pythonEnvironment.python = item.dispatch.publicHost.pythonEnvironment.python = item.python;
	await assertFinContainerEdgeReport(python, ["python"], { python: "3.12" });
	await assert.rejects(assertFinContainerEdgeReport(python, ["python"], { python: "3.11" }));
	await assert.rejects(assertFinContainerEdgeReport(python, ["python"], { python: "3.13" }));
});

test("every native report rejects missing public observations, stale sources and altered call rows", async t => {
	let rejected = 0;
	for(const profile of finContainerEdgeProfiles)
	{
		const base = await syntheticFinContainerEdgeReport([profile]);
		const changes = [
			report => { report.reproducible = false; }
			, report => { report.authorRoots = 1; }
			, report => { report.reports = []; }
			, report => { report.archives.extra = "0".repeat(64); }
			, report => { report.reports[0].checks--; }
			, report => { report.reports[0].consumerSha256 = "0".repeat(64); }
			, report => { report.reports[0].fixtureSha256 = "0".repeat(64); }
			, report => { report.reports[0].sourceRemovedBeforeInstallation = false; }
			, report => { report.reports[0].repeatExecution = false; }
			, report => { report.reports[0].path = "reviewed-ir"; }
			, report => { report.reports[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
			, report => { report.reports[0].dispatch.publicHost = { observed: false }; }
			, report => { report.reports[0].dispatch.publicHost.profile = "unmeasured"; }
			, report => { report.reports[0].dispatch.publicHost.caller = report.reports[0].dispatch.rawAdapter.caller; }
			, report => { report.reports[0].dispatch.publicHost.measuredCalls--; }
			, report => { report.reports[0].dispatch.publicHost.observations[1][3][0]++; }
			, report => { report.reports[0].dispatch.publicHost.observations.pop(); }
			, report => { report.reports[0].dispatch.rawAdapter.observed[1][2][0]++; }
			, report => { report.reports[0].dispatch.rawAdapter.probeSha256 = "0".repeat(64); }
			, report => { report.reports[0].dispatch.rawAdapter.missingInstrumentRefused = false; }
			, report => { report.reports[0].dispatch.publicHost.runtimeDefinitionsChecked = false; }
			, report => { report.reports[0].dispatch.publicHost.receiptSha256 = "0".repeat(64); }
			, report => { report.reports[0].dispatch.publicHost.columns.reverse(); }
		];
		for(const [index, change] of changes.entries())
		{
			const report = structuredClone(base); change(report);
			await assert.rejects(assertFinContainerEdgeReport(report, [profile]), assert.AssertionError, `${profile} mutation ${index}`);
			rejected++;
		}
	}
	t.diagnostic(`${rejected} cross-host false acceptance claims rejected`);
});

test("host-specific checks reject stale probes, broken debugger bindings and missing runtime policies", async t => {
	let rejected = 0;
	for(const profile of finContainerEdgeProfiles)
	{
		const base = await syntheticFinContainerEdgeReport([profile]);
		const mutations = [];
		if(["java", "kotlin"].includes(profile)) mutations.push(host => { host.probeFiles["EdgeCounter.java"] = "0".repeat(64); });
		else if(profile === "php-native") mutations.push(host => { host.modes[0].probeSha256 = "0".repeat(64); });
		else mutations.push(host => { host.probeSha256 = "0".repeat(64); });
		if(["ruby", "dotnet", "java", "kotlin", "php-native"].includes(profile))
		{
			const observation = host => profile === "php-native" ? host.modes[0] : host;
			mutations.push(
				host => { observation(host).configSha256 = "0".repeat(64); }
				, host => { observation(host).runs[1].nonce = observation(host).runs[0].nonce; }
				, host => { observation(host).runs[0].manifest.breakpoints[0].library = "runtime.so"; }
				, host => { observation(host).runs[0].manifest.breakpoints[0].address++; }
			);
		}
		else mutations.push(host => { host.interposerSha256 = "0".repeat(64); });
		if(["java", "kotlin"].includes(profile))
			mutations.push(host => { host.runs[0].manifest.jvmExtraction.afterExit["component.so"].linksAfterExit = 1; });
		if(profile === "python") mutations.push(host => { host.bytecodePolicy = "ambient"; });
		if(profile === "rust") mutations.push(host => { host.extractionCleanupUnchanged = false; });
		if(profile === "dotnet") mutations.push(host => { host.sameOriginalArchive = false; });
		if(profile === "php-native") mutations.push(host => { host.modes.pop(); });
		if(profile === "wit-wasi") mutations.push(host => { host.wasmtime = "43.0.0"; });
		if(["c", "cpp", "python", "rust", "ruby", "php-native"].includes(profile))
		{
			const property = ["c", "cpp"].includes(profile) ? "headerDigests" : "moduleDigests";
			mutations.push(host => { delete host[property][Object.keys(host[property])[0]]; });
		}
		if(["java", "kotlin"].includes(profile)) mutations.push(host => { host.toolDigests.java.sha256 = "0".repeat(64); });
		if(profile === "rust") mutations.push(host => { host.dependencies.packages = []; });
		if(profile === "dotnet") mutations.push(host => { delete host.probeEnvironment.deployedFilesSha256; });
		for(const [index, mutate] of mutations.entries())
		{
			const report = structuredClone(base); mutate(report.reports[0].dispatch.publicHost);
			await assert.rejects(assertFinContainerEdgeReport(report, [profile]), assert.AssertionError, `${profile} host mutation ${index}`);
			rejected++;
		}
	}
	t.diagnostic(`${rejected} host-specific false acceptance claims rejected`);
});

test("coordinated missing environment identities cannot pass by comparing two absent values", async () => {
	for(const [profile, key, field] of [
		["java", "jvmEnvironment", "classpathFilesSha256"]
		, ["kotlin", "jvmEnvironment", "interpreterSha256"]
		, ["dotnet", "dotnetEnvironment", "deployedFilesSha256"]
		, ["php-native", "phpEnvironment", "vendorFilesSha256"]
	]) {
		const base = await syntheticFinContainerEdgeReport([profile]);
		for(const remove of [false, true])
		{
			const report = structuredClone(base), item = report.reports[0];
			if(remove)
			{ delete item[key]; delete item.dispatch.publicHost[key]; }
			else
			{ delete item[key][field]; delete item.dispatch.publicHost[key][field]; }
			await assert.rejects(assertFinContainerEdgeReport(report, [profile]), assert.AssertionError);
		}
	}
});

test("historical uninstrumented reports cannot pass the current measured gate", async () => {
	const report = JSON.parse(await readFile("docs/evidence/fin-container-edges-20261009/edges-c-cpp.json", "utf8"));
	await assert.rejects(assertFinContainerEdgeReport(report, ["c", "cpp"]));
});

test("edge report CLI fails closed for omitted arguments, missing files, bad floors and unobserved hosts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-report-cli-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "report.json"), report = await syntheticFinContainerEdgeReport(["c"]);
	const source = JSON.stringify(report); await writeFile(path, source);
	const run = args => spawnSync(process.execPath, ["scripts/check-fin-container-edge-report.mjs", ...args], { encoding: "utf8", timeout: 30_000 });
	const valid = run(["c", path]); assert.equal(valid.status, 0, valid.stderr);
	assert.match(valid.stdout, /raw and public entry measurements verified for c/u);
	for(const args of [[], ["c", join(root, "missing.json")], ["c", path, "--python", "3.11"], ["cpp", path], ["c", path, "--skip-public"]])
		assert.notEqual(run(args).status, 0);
	report.reports[0].dispatch.publicHost.observed = false;
	await writeFile(path, JSON.stringify(report));
	assert.notEqual(run(["c", path]).status, 0);
	assert.equal(sha256(source), sha256(JSON.stringify(await syntheticFinContainerEdgeReport(["c"]))));
});
