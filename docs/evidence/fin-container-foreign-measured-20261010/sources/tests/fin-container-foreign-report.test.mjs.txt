/**
 * Reject incomplete or falsely attributed foreign-carrier reports without rewriting old archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { finContainerEdgeProfiles } from "./helpers/fin-container-edges.mjs";
import { assertFinContainerEdgeReport } from "./helpers/fin-container-edge-report.mjs";
import { assertFinForeignBindingIr, assertFinForeignReport } from "./helpers/fin-container-foreign-report.mjs";
import { syntheticFinForeignReport } from "./helpers/fin-container-foreign-report-fixtures.mjs";
import { finContainerEdgeCompilerModel } from "./helpers/fin-container-edge-compiled-fixture.mjs";
import "./helpers/fin-container-foreign-history-tests.mjs";

test("synthetic foreign report formats cover all native profiles and both Python floors", async () => {
	await assertFinForeignReport(await syntheticFinForeignReport([...finContainerEdgeProfiles].sort()), [...finContainerEdgeProfiles].sort(), { python: "3.11" });
	const report = await syntheticFinForeignReport(["python"]), item = report.reports[0];
	item.python = item.dispatch.publicHost.python = "3.12.14";
	item.pythonEnvironment.python = item.dispatch.publicHost.pythonEnvironment.python = item.python;
	await assertFinForeignReport(report, ["python"], { python: "3.12" });
	await assert.rejects(assertFinForeignReport(report, ["python"], { python: "3.11" }), assert.AssertionError);
});

test("each host refuses missing foreign observations, false counters, stale probes and changed identities", async t => {
	let rejected = 0;
	for(const profile of finContainerEdgeProfiles)
	{
		const base = await syntheticFinForeignReport([profile]);
		for(const change of [
			item => { delete item.foreignCarriers; }
			, item => { item.foreignCarriers.packageProfile = "another-host"; }
			, item => { item.foreignCarriers.caller = item.dispatch.publicHost.caller; }
			, item => { item.foreignCarriers.observations[1][3][0]++; }
			, item => { item.foreignCarriers.observations.at(-1)[3][7]--; }
			, item => { item.foreignCarriers.observations.pop(); }
			, item => { item.foreignCarriers.recoveryPairsPerEntrypoint = 999; }
			, item => { item.foreignCarriers.measuredCalls--; }
			, item => { item.foreignCarriers.cases--; }
			, item => { delete item.foreignCarriers.definitions.fincontainers_option_nat_value_clear; }
			, item => { item.foreignCarriers.modelSha256 = "0".repeat(64); }
			, item => { item.foreignCarriers.headerSha256 = "0".repeat(64); }
			, item => { item.foreignCarriers.probeSha256 = "0".repeat(64); }
			, item => { item.foreignCarriers.missingInstrumentRefused = false; }
			, item => { item.foreignCarriers.runtimeDefinitionsChecked = false; }
			, item => { item.foreignCarriers.installedFilesUnchanged = false; }
			, item => { item.foreignCarriers.headerOrigin = "shipped header"; }
		]) {
			const report = structuredClone(base); change(report.reports[0]);
			await assert.rejects(assertFinForeignReport(report, [profile]), assert.AssertionError);
			rejected++;
		}
	}
	assert.equal(rejected, 170); t.diagnostic(`${rejected} weakened foreign-carrier claims refused`);
});

test("coordinated IR hashes cannot change fixture signatures or refinement bounds", () => {
	const original = finContainerEdgeCompilerModel().bindingIr;
	assertFinForeignBindingIr(original, hashBindingIr(original));
	for(const change of [
		ir => { ir.declarations[0].result.type = { kind: "primitive", name: "bool" }; }
		, ir => { ir.declarations.find(item => item.source.declaration === "FinContainers.emptyOption").source.extensions["lean-lang.org/refinements"].parameters[0].arguments[0].bound = "1"; }
		, ir => { ir.declarations.pop(); }
	]) {
		const ir = structuredClone(original); change(ir);
		assert.throws(() => assertFinForeignBindingIr(ir, hashBindingIr(ir)), assert.AssertionError);
	}
});

test("the original measured C archive still passes its gate but cannot claim foreign-carrier acceptance", async () => {
	const report = JSON.parse(await readFile("docs/evidence/fin-container-edges-measured-20261010/c-cpp/report.json", "utf8"));
	await assertFinContainerEdgeReport(report, ["c", "cpp"]);
	await assert.rejects(assertFinForeignReport(report, ["c", "cpp"]), /missing foreign-carrier observation/u);
});

test("the foreign report CLI requires the exact selected hosts and refuses missing observations", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-foreign-report-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "report.json"), report = await syntheticFinForeignReport(["c"]);
	await writeFile(path, JSON.stringify(report));
	const command = profiles => spawnSync(process.execPath, ["scripts/check-fin-container-foreign-report.mjs", profiles, path], { encoding: "utf8" });
	const accepted = command("c"); assert.equal(accepted.status, 0, accepted.stderr);
	assert.equal(accepted.stdout, "Fin container raw, public and foreign-carrier measurements verified for c.\n");
	assert.equal(command("cpp").status, 1);
	delete report.reports[0].foreignCarriers;
	await writeFile(path, JSON.stringify(report));
	assert.equal(command("c").status, 1);
});
