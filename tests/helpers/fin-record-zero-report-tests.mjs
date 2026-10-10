/**
 * Mutation controls for Fin 0 report validation. Synthetic reports are not execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finRecordZeroChecks, finRecordZeroRefinements, finRecordZeroReviewedIr, finRecordZeroTargets } from "./fin-record-zero-fixture.mjs";
import { assertFinRecordZeroReport, finRecordZeroReceipt } from "./fin-record-zero-report.mjs";

const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c", perl: "pl" };
const digest = "1".repeat(64);
const synthetic = async (profiles, route) => {
	const reports = await Promise.all([...profiles].sort().map(async profile => {
		const [target, identity] = finRecordZeroTargets[profile], name = identity.name ?? identity.module.replaceAll("::", "-");
		const reference = { ecosystem: "cpan", name: "LeanBridge-Runtime", version: "1.0.0" };
		const pkg = { target
			, ecosystem: target === "php-native" ? "composer" : target
			, name, version: identity.version
			, profile: "native-library-v1", role: "component", runtimeIdentity: digest
			, runtimeDelivery: profile === "perl" ? "dependency" : "embedded"
			, requires: profile === "perl" ? [reference] : []
			, artifacts: [{ path: `archives/${target}-component.pkg`, bytes: 10, sha256: digest }] };
		return { profile, path: route, checks: finRecordZeroChecks
			, packages: profile === "perl" ? [pkg, { ...pkg, ...reference, role: "runtime", runtimeDelivery: "provided", requires: [], artifacts: [{ path: "archives/cpan-runtime.pkg", bytes: 10, sha256: digest }] }] : [pkg]
			, refinements: structuredClone(finRecordZeroRefinements)
			, offlineInstall: true, compilerFreePath: true
			, sourceRemovedBeforeInstallation: true
			, bindingIrSha256: digest, modelSha256: digest, sourceTreeSha256: digest
			, consumerSha256: sha256(await readFile(`tests/fixtures/fin-record-zero-consumers/${profile}.${extensions[profile]}`))
			, ...(route === "reviewed-ir" ? { reviewedSourceSha256: sha256(canonicalJson(finRecordZeroReviewedIr())) } : {}) };
	}));
	const report = { schemaVersion: 1, reproducible: true, reports }, receipt = finRecordZeroReceipt(report);
	for(const row of reports) row.receiptSha256 = sha256(canonicalJson(receipt));
	return { ...report, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) };
};

test("Fin 0 report schema admits all eleven host profiles and shared JVM archives on both routes", async () => {
	for(const route of ["ordinary-source", "reviewed-ir"])
		for(const profiles of [...Object.keys(extensions).map(profile => [profile]), Object.keys(extensions)])
			await assertFinRecordZeroReport(await synthetic(profiles, route), profiles, route);
});

test("Fin 0 reports refuse incomplete selection, old bounds, changed callers and invented execution claims", async () => {
	const mutations = [
		report => { report.reports.pop(); }
		, report => { report.reproducible = false; }
		, report => { report.reports[0].checks--; }
		, report => { report.reports[0].path = "ordinary-source"; }
		, report => { report.reports[0].offlineInstall = false; }
		, report => { report.reports[0].compilerFreePath = false; }
		, report => { report.reports[0].sourceRemovedBeforeInstallation = false; }
		, report => { report.reports[0].consumerSha256 = digest; }
		, report => { report.reports[0].reviewedSourceSha256 = digest; }
		, report => { report.reports[0].modelSha256 = "2".repeat(64); }
		, report => { report.reports[0].refinements["FinRecordZero.arrayRecords"].parameters[0].arguments[0].arguments[0].bound = "1"; }
		, report => { delete report.reports[0].refinements["FinRecordZero.listFields"]; }
		, report => { report.reports[0].dispatch = { verified: true }; }
		, report => { report.hosted = true; }
		, report => { report.reports[0].packages[0].artifacts[0].sha256 = "2".repeat(64); }
		, report => { report.reports[0].packages[0].name = "unrelated"; }
		, report => { report.reports[0].packages[0].artifacts[0].path = "../outside"; }
		, report => { report.archives["archives/extra.pkg"] = digest; }
		, report => { report.reports[0].receiptSha256 = digest; }
	];
	for(const mutate of mutations)
	{
		const report = await synthetic(["c", "cpp"], "reviewed-ir"); mutate(report);
		await assert.rejects(() => assertFinRecordZeroReport(report, ["c", "cpp"], "reviewed-ir"));
	}
	const jvm = await synthetic(["java", "kotlin"], "reviewed-ir");
	jvm.reports[1].packages[0].artifacts[0].bytes++;
	await assert.rejects(() => assertFinRecordZeroReport(jvm, ["java", "kotlin"], "reviewed-ir"));
	const ordinary = await synthetic(["c"], "ordinary-source");
	for(const profiles of [[], ["c", "c"], ["unknown"]]) await assert.rejects(() => assertFinRecordZeroReport(ordinary, profiles, "ordinary-source"));
});

test("Fin 0 report CLI requires both routes and fails on a changed original report", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-zero-report-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ordinary = join(root, "ordinary.json"), reviewed = join(root, "reviewed.json");
	await writeFile(ordinary, canonicalJson(await synthetic(["c"], "ordinary-source")));
	const report = await synthetic(["c"], "reviewed-ir"); await writeFile(reviewed, canonicalJson(report));
	const run = args => spawnSync(process.execPath, ["scripts/check-fin-record-zero-report.mjs", ...args], { encoding: "utf8", timeout: 30_000 });
	const passed = run(["c", ordinary, reviewed]); assert.equal(passed.status, 0, passed.stderr);
	assert.match(passed.stdout, /both source routes/u);
	assert.notEqual(run(["c", ordinary]).status, 0);
	report.reports[0].checks = 1; await writeFile(reviewed, canonicalJson(report));
	assert.notEqual(run(["c", ordinary, reviewed]).status, 0);
});
