/**
 * Reject incomplete installed reports and authenticate the retained original producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { assertPhpWasmDirectFinArchive, phpWasmDirectArchiveRoot } from "./php-wasm-fin-direct-archive.mjs";
import { assertPhpWasmDirectFinReport } from "./php-wasm-fin-direct-report.mjs";
import { phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const digest = "0584e1582db5f6afabf4f6509cc415ef1df0aa3bfca3581681a23ef67b1290ce";

test("direct PHP-Wasm Fin originals retain both source routes, all 48 executions and six fresh review refusals", async () => {
	await assertPhpWasmDirectFinArchive(digest);
});

test("direct PHP-Wasm Fin archive refuses altered original records and selected producer sources", async () => {
	const { index } = await assertPhpWasmDirectFinArchive(digest);
	for(const path of ["index.json", ...index.files.map(file => file.path)])
		await assert.rejects(() => assertPhpWasmDirectFinArchive(digest, async name => {
			const bytes = await readFile(name);
			return name === `${phpWasmDirectArchiveRoot}/${path}` ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), path);
});

test("direct PHP-Wasm reports reject missing routes, bounds, callers, loading phases and package identities", async () => {
	const { files, inputs } = await assertPhpWasmDirectFinArchive(digest);
	for(const [name, route] of [["ordinary.json", "ordinary-source"], ["reviewed.json", "reviewed-source"]])
	{
		const original = JSON.parse(files.get(name));
		const rejects = mutate => {
			const report = structuredClone(original); mutate(report);
			assert.throws(() => assertPhpWasmDirectFinReport(report, route, inputs));
		};
		for(const key of Object.keys(original)) rejects(report => { delete report[key]; });
		rejects(report => { report.reports.reverse(); });
		rejects(report => { report.reports.pop(); });
		rejects(report => { report.reports.push(report.reports[0]); });
		assert.throws(() => assertPhpWasmDirectFinReport(original, "unknown", inputs));
		assert.throws(() => assertPhpWasmDirectFinReport(original, route === "ordinary-source" ? "reviewed-source" : "ordinary-source", inputs));
		for(const index of [0, 1])
		{
			const rowRejects = mutate => rejects(report => mutate(report.reports[index]));
			for(const key of Object.keys(original.reports[index])) rowRejects(row => { delete row[key]; });
			for(const flag of ["reproducible", "sourceRemovedBeforeInstallation"]) rowRejects(row => { row[flag] = false; });
			for(const flag of phpWasmIsolationFlags) rowRejects(row => { row.phpWasm[flag] = false; });
			for(const key of ["bindingIrSha256", "modelSha256", "receiptSha256"]) rowRejects(row => { row[key] = "0".repeat(64); });
			rowRejects(row => { row.dispatch = "measured"; });
			rowRejects(row => { row.fixtureSources.leanSha256 = "0".repeat(64); });
			rowRejects(row => { row.fixtureSources.phpSha256 = "0".repeat(64); });
			rowRejects(row => { row.refinements = {}; });
			rowRejects(row => { row.phpWasm.consumerSources.strict = row.phpWasm.consumerSources.weak; });
			rowRejects(row => { row.phpWasm.component.compiler.emsdkCommit = "0".repeat(40); });
			rowRejects(row => { row.phpWasm.component.pointerBits = 64; });
			rowRejects(row => { row.phpWasm.component.sourceIdentity.modules[0].source.sha256 = "0".repeat(64); });
			rowRejects(row => { row.packages[0].artifacts[0].bytes++; });
			rowRejects(row => { row.packages[0].requires = []; });
			rowRejects(row => { row.phpWasm.packageSet.componentIdentity = "0".repeat(64); });
			rowRejects(row => { row.phpWasm.npm.lockText += "\n"; });
			rowRejects(row => { row.phpWasm.composer.lockText += "\n"; });
			for(let execution = 0; execution < 12; execution++)
			{
				rowRejects(row => { row.phpWasm.executions.splice(execution, 1); });
				rowRejects(row => { row.phpWasm.executions[execution].observation.checks--; });
				rowRejects(row => { row.phpWasm.executions[execution].observation.word_bits = 64; });
				rowRejects(row => { row.phpWasm.executions[execution].phases.pop(); });
			}
			rowRejects(row => { row.phpWasm.executions.find(item => item.realm === "chromium").requests = []; });
			if(route === "reviewed-source")
			{
				rowRejects(row => { row.reviewedBindingIrSha256 = "0".repeat(64); });
				// Rebind the source digest so refusal must compare the independently authored review.
				rowRejects(row => {
					const review = row.phpWasm.component.sourceIdentity.reviewedBindingIr;
					const value = JSON.parse(review.source); value.declarations.pop();
					review.source = canonicalJson(value); review.sourceSha256 = sha256(review.source);
				});
			}
		}
	}
});

test("direct PHP-Wasm report CLI requires both reports and rejects unknown arguments or truncated acceptance", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-direct-php-report-check-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const cli = args => spawnSync(process.execPath, ["scripts/check-php-wasm-direct-fin-reports.mjs", ...args], { encoding: "utf8" });
	for(const args of [[], ["--directory"], ["--unknown", root], ["--directory", root, "--extra"]])
	{
		const result = cli(args); assert.equal(result.status, 1); assert.match(result.stderr, /Usage:/u);
	}
	const args = ["--directory", root];
	assert.equal(cli(args).status, 1);
	await cp(`${phpWasmDirectArchiveRoot}/ordinary.json`, join(root, "ordinary.json"));
	assert.equal(cli(args).status, 1);
	await cp(`${phpWasmDirectArchiveRoot}/reviewed.json`, join(root, "reviewed.json"));
	const passed = cli(args); assert.equal(passed.status, 0, passed.stderr); assert.match(passed.stdout, /all 48 executions/u);
	const report = JSON.parse(await readFile(join(root, "reviewed.json"), "utf8"));
	report.reports.pop(); await saveLakeFile(root, "reviewed.json", canonicalJson(report));
	assert.equal(cli(args).status, 1);
});
