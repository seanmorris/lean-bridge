/**
 * Original installed probe acceptance and adversarial report/archive controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { join } from "node:path";
import { assertPhpWasmSubtypeEntryReport, phpWasmSubtypeEntryReportInput, readPhpWasmSubtypeEntryBuilds } from "./php-wasm-subtype-entry-report.mjs";
import { phpWasmSubtypeEntryInstalledArchive, readPhpWasmSubtypeEntryInstalledArchive } from "./php-wasm-subtype-entry-installed-archive.mjs";

let data;
/** Load only authenticated original evidence and independently constructed expectations. */
const fixture = () => data ??= (async () => {
	const { index, records } = await readPhpWasmSubtypeEntryInstalledArchive(), input = await phpWasmSubtypeEntryReportInput();
	const routes = {};
	for(const route of ["ordinary", "reviewed"])
		routes[route] = { report: JSON.parse(records.get(`r1/${route}/report.json`)), builds: await readPhpWasmSubtypeEntryBuilds(join(phpWasmSubtypeEntryInstalledArchive, "r1", route)) };
	return { index, records, input, routes };
})();

test("original installed Subtype probes authenticate all ordinary and reviewed executions", async () => {
	const { input, routes } = await fixture();
	for(const [route, { report, builds }] of Object.entries(routes)) assert.equal(assertPhpWasmSubtypeEntryReport(report, route, input, builds), true);
});

test("installed Subtype probe reports reject missing modes, forged entries and compiler-sidecar changes", async () => {
	const { input, routes } = await fixture();
	const changes = [
		["scope", report => { report.scope = "unmodified-release"; }]
		, ["route", report => { report.route = "unknown"; }]
		, ["source", report => { report.source.probeSha256 = "0".repeat(64); }]
		, ["one build", (report, builds) => { report.builds.pop(); builds.pop(); }]
		, ["not reproducible", report => { report.reproducible = false; }]
		, ["source remains", report => { report.sourceRemovedBeforeInstallation = false; }]
		, ["online install", report => { report.phpWasm.offlineInstall = false; }]
		, ["compiler available", report => { report.phpWasm.compilerFreeExecution = false; }]
		, ["runtime", report => { report.phpWasm.component.runtimeIdentity = "0".repeat(64); }]
		, ["wasm", report => { report.phpWasm.component.wasmLibrary.sha256 = "0".repeat(64); }]
		, ["driver", report => { report.phpWasm.driverSha256 = "0".repeat(64); }]
		, ["caller", report => { report.phpWasm.consumerSources.weak = "0".repeat(64); }]
		, ["lock", report => { report.phpWasm.npm.lockText += "\n"; }]
		, ["no browser", report => { report.phpWasm.executions = report.phpWasm.executions.filter(item => item.realm !== "chromium"); }]
		, ["duplicate execution", report => { report.phpWasm.executions.push(report.phpWasm.executions[0]); }]
		, ["lazy loaded early", report => { report.phpWasm.executions.find(item => item.loading === "lazy").phases[0].libraries.push("fake.so"); }]
		, ["library not requested", report => { report.phpWasm.executions.find(item => item.realm === "chromium").requests = []; }]
		, ["short corpus", report => { report.phpWasm.executions[0].observation.checks--; }]
		, ["call count", report => { report.phpWasm.executions[0].entryProbe.calls--; }]
		, ["constructor count", report => { report.phpWasm.executions[0].entryProbe.counts.constructor--; }]
		, ["no trace", report => { report.phpWasm.executions[0].entryProbe.trace = ""; }]
		, ["source missing", report => { report.phpWasm.executions[0].entryProbe.trace = report.phpWasm.executions[0].entryProbe.trace.replace("LB_SUBTYPE_ENTRY_V1 enter source Subtypes.echo\n", ""); }]
		, ["unexpected stderr", report => { report.phpWasm.executions[0].entryProbe.trace += "unexpected\n"; }]
		, ["missing control", report => { report.phpWasm.executions[0].entryProbe.controlTrace = ""; }]
		, ["truncated original C", (report, builds) => { builds[0].units[0].original = builds[0].units[0].original.slice(1); }]
		, ["instrumentation changed", (report, builds) => { builds[0].units[0].probe += "\n"; }]
		, ["source annotation changed", (report, builds) => { builds[0].sourceProbe.source += "\n"; }]
		, ["different constructor", (report, builds) => { builds[0].model.exports.find(item => item.name === "Subtypes.half").refinements.parameters[0].constructor = "Subtypes.normalizedEven"; }]
		, ["source mislabeled", (report, builds) => { builds[0].observation.selected.find(item => item.kind === "source").kind = "adapter"; report.builds[0] = structuredClone(builds[0].observation); }]
		, ["missing definition", (report, builds) => { builds[0].observation.definitionCounts.lb_probe_constructor_checkedEven = 0; report.builds[0] = structuredClone(builds[0].observation); }]
		, ["altered compile flags", (report, builds) => {
			builds[0].observation.commands[0].probeArgs.push("-DUNKNOWN=1");
			report.builds[0] = structuredClone(builds[0].observation); builds[0].commands.commands = structuredClone(builds[0].observation.commands);
		}]
	];
	for(const [route, original] of Object.entries(routes)) for(const [label, mutate] of changes)
	{
		const { report, builds } = structuredClone(original); mutate(report, builds);
		assert.throws(() => assertPhpWasmSubtypeEntryReport(report, route, input, builds), undefined, `${route}: ${label}`);
	}
	assert.throws(() => assertPhpWasmSubtypeEntryReport(routes.ordinary.report, "unknown", input, routes.ordinary.builds));
});

test("installed Subtype archive rejects changed indexes and both length and same-length record corruption", async () => {
	const { records } = await fixture();
	for(const [path, original] of records)
	{
		const appended = Buffer.concat([original, Buffer.from("x")]);
		await assert.rejects(() => readPhpWasmSubtypeEntryInstalledArchive(name => name === path ? appended : records.get(name)), undefined, path);
		if(original.length === 0) continue;
		const changed = Buffer.from(original); changed[0] ^= 1;
		await assert.rejects(() => readPhpWasmSubtypeEntryInstalledArchive(name => name === path ? changed : records.get(name)), undefined, path);
	}
});

test("installed Subtype entry CLI requires both complete source routes and refuses ambiguous flags", async () => {
	const command = "scripts/check-php-wasm-subtype-entry-reports.mjs", directory = join(phpWasmSubtypeEntryInstalledArchive, "r1");
	const result = spawnSync(process.execPath, [command, "--directory", directory], { encoding: "utf8" });
	assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /24 Node\/Chromium configurations/u); assert.equal(result.stderr, "");
	for(const args of [[], ["--directory"], ["--unknown", directory], ["--directory", directory, "--extra"], ["--directory", join(directory, "ordinary")]])
	{
		const refused = spawnSync(process.execPath, [command, ...args], { encoding: "utf8" });
		assert.notEqual(refused.status, 0); assert.equal(refused.stdout, "");
	}
});
