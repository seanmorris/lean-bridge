/**
 * Negative controls for owned-Subtype retained npm and browser acceptance.
 * Synthetic archives below are inert verifier fixtures, never runtime evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFile, cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { verifyOwnedSubtypeJavaScriptEvidence } from "./helpers/owned-subtype-javascript-evidence.mjs";
import { writeSyntheticOwnedSubtypeJavaScriptEvidence } from "./helpers/owned-subtype-javascript-evidence-fixture.mjs";

const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-subtype-npm-evidence-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	return writeSyntheticOwnedSubtypeJavaScriptEvidence(root);
};

test("owned Subtype npm verifier binds retained packages, rebuilds and all browser cells", async t => {
	const { reportPath } = await fixture(t);
	const verified = await verifyOwnedSubtypeJavaScriptEvidence(reportPath);
	assert.deepEqual(verified.routes.map(route => route.route), ["ordinary", "reviewed"]);
	assert.ok(verified.routes.every(route => route.archives === 2
		&& route.archiveBytes > 0 && route.browserExecutions === 12));
	const child = spawnSync(process.execPath, ["scripts/check-owned-subtype-javascript-ci.mjs"
		, "--report", reportPath], { encoding: "utf8", timeout: 20_000 });
	assert.equal(child.status, 0, child.stderr);
	assert.deepEqual(JSON.parse(child.stdout), verified);
});

test("owned Subtype npm verifier rejects incomplete and duplicated browser matrices", async t => {
	for(const mutate of [
		entry => { entry.browser.executions.pop(); }
		, entry => { entry.browser.executions = Array(12).fill(entry.browser.executions[0]); }
		, entry => { entry.browser.executions.find(cell => cell.variant === "strict").variant = "production"; }
		, entry => { entry.browser.executions.find(cell => cell.profile === "react" && cell.variant === "production").variant = "strict"; }
		, entry => { delete entry.browser.executions[0].variant; }
		, entry => { entry.browser.executions[0].version = ""; }
		, entry => { entry.browser.executions[0].checks--; }
		, entry => { entry.browser.executions[0].reruns--; }
		, entry => { entry.browser.executions[0].assets[0] = "0".repeat(64); }
		, entry => { entry.browser.externalNetworkBlocked = false; }
		, entry => { entry.browser.installedSourcesRemoved = false; }
	]) {
		const { report, reportPath } = await fixture(t);
		mutate(report.reports[0]);
		await writeFile(reportPath, canonicalJson(report));
		await assert.rejects(verifyOwnedSubtypeJavaScriptEvidence(reportPath), assert.AssertionError);
	}
});

test("owned Subtype npm verifier requires both authors and independent reproductions", async t => {
	for(const mutate of [
		report => { report.schemaVersion = 1; }
		, report => { report.reports.pop(); }
		, report => { report.reports[1].reviewed = false; }
		, report => { report.reports[0].observed.transferRejected = false; }
		, report => { report.reports[0].sourceRemovedBeforeInstall = false; }
		, report => { report.reports[0].independentBuilds.pop(); }
		, report => { report.reports[0].independentBuilds[1].authorRoot = "author-0"; }
		, report => { report.reports[0].independentBuilds[1].archives.component = "0".repeat(64); }
		, report => { report.reports[0].independentBuilds[1].removedBeforeInstall = false; }
	]) {
		const { report, reportPath } = await fixture(t);
		mutate(report);
		await writeFile(reportPath, canonicalJson(report));
		await assert.rejects(verifyOwnedSubtypeJavaScriptEvidence(reportPath), assert.AssertionError);
	}
});

test("owned Subtype npm verifier binds report identities to actual compiled packages", async t => {
	for(const [key, value, pattern] of [
		["componentIdentity", "0".repeat(64), /Compiled component identity/u]
		, ["bindingIrSha256", "0".repeat(64), /Compiled binding IR identity/u]
		, ["sourceIdentity", { sourceTreeSha256: "0".repeat(64) }, /Report source identity/u]
	]) {
		const { report, reportPath } = await fixture(t);
		const entry = report.reports[0];
		entry[key] = value;
		for(const build of entry.independentBuilds) build[key] = value;
		await writeFile(reportPath, canonicalJson(report));
		await assert.rejects(verifyOwnedSubtypeJavaScriptEvidence(reportPath), pattern);
	}
});

test("owned Subtype npm verifier rejects missing, changed and unreceipted archives", async t => {
	for(const action of ["missing", "changed", "extra", "missing-record", "noncanonical"])
	{
		const { root, report, reportPath } = await fixture(t);
		const handoff = join(root, "acceptance/evidence/ordinary/handoff");
		const archive = join(handoff, report.reports[0].packageSetReceipt.packages[0].artifacts[0].path);
		if(action === "missing") await rm(archive);
		else if(action === "changed") await appendFile(archive, "changed");
		else if(action === "extra") await saveLakeFile(handoff, "unreceipted", "extra");
		else if(action === "missing-record") await rm(join(root, "acceptance/retained-packages.json"));
		else await writeFile(reportPath, JSON.stringify(report));
		await assert.rejects(verifyOwnedSubtypeJavaScriptEvidence(reportPath));
	}
});

test("historical owned Subtype promotion refuses duplicate cells without rewriting evidence", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-subtype-browser-control-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const reportPath = "docs/evidence/owned-subtype-javascript-transfer-acceptance-20261020.json";
	const historyPath = "docs/evidence/owned-subtype-javascript-transfer-source-history-20261020.json";
	const original = await readFile(reportPath);
	await saveLakeFile(root, reportPath, original);
	await cp(historyPath, join(root, historyPath));
	const moduleUrl = pathToFileURL(resolve("tests/helpers/owned-subtype-promotion.mjs")).href;
	const invoke = () => spawnSync(process.execPath, ["--input-type=module", "-e"
		, `import {ownedSubtypeJavaScriptPromotionReference as verify} from ${JSON.stringify(moduleUrl)}; await verify();`]
	, { cwd: root, encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024 });
	assert.equal(invoke().status, 0);
	const forged = JSON.parse(original);
	for(const entry of forged.reports) entry.browser.executions = Array(9).fill(entry.browser.executions[0]);
	await writeFile(join(root, reportPath), canonicalJson(forged));
	const rejected = invoke();
	assert.notEqual(rejected.status, 0);
	assert.match(rejected.stderr, /Browser cells must include/u);
	assert.deepEqual(await readFile(reportPath), original);
});

test("owned Subtype acceptance source retains receipts and executes the complete browser contract", async () => {
	const source = await readFile("tests/owned-subtype-javascript-packaging.test.mjs", "utf8");
	assert.match(source, /for\(const attempt of \[0, 1\]\)/u);
	assert.match(source, /await retainOwnedSubtypeRoute\(\{/u);
	assert.match(source, /await writeOwnedSubtypeRetainedPackages\(/u);
	assert.match(source, /productionReact: true/u);
	assert.ok(source.indexOf("await retainOwnedSubtypeRoute") < source.indexOf("await rm(build.author"));
	assert.ok(source.indexOf("await rm(build.author") < source.indexOf('await run("npm"'));
	assert.doesNotMatch(source, /handoff\/runtime\.tgz|handoff\/component\.tgz/u);
});
