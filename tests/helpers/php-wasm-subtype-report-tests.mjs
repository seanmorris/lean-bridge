/**
 * Reject incomplete or altered installed Subtype evidence and preserve the original producer.
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
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { assertPhpWasmSubtypeArchive, phpWasmSubtypeArchiveRoot } from "./php-wasm-subtype-archive.mjs";
import { assertPhpWasmSubtypeReport } from "./php-wasm-subtype-report.mjs";
import { phpWasmIsolationFlags } from "./type-corpus-php-wasm-evidence.mjs";

const digest = "fcad1416ce70d9ee17c619b8333bc18997561d44af6e188bb80de17d839aff8b";

test("installed PHP-Wasm Subtype originals retain both routes, 24 executions and the failed host-path attempt", async () => {
	await assertPhpWasmSubtypeArchive(digest);
});

test("installed PHP-Wasm Subtype archive refuses changed records and selected producer sources", async () => {
	const { index } = await assertPhpWasmSubtypeArchive(digest);
	for(const path of ["index.json", ...index.files.map(file => file.path)])
		await assert.rejects(() => assertPhpWasmSubtypeArchive(digest, async name => {
			const bytes = await readFile(name);
			return name === `${phpWasmSubtypeArchiveRoot}/${path}` ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), path);
});

test("installed PHP-Wasm Subtype reports reject lost constructors, execution modes and package identities", async () => {
	const { files, input } = await assertPhpWasmSubtypeArchive(digest);
	for(const [name, route] of [["ordinary.json", "ordinary-source"], ["reviewed.json", "reviewed-source"]])
	{
		const original = JSON.parse(files.get(name));
		const rejects = mutate => {
			const report = structuredClone(original); mutate(report);
			assert.throws(() => assertPhpWasmSubtypeReport(report, route, input));
		};
		for(const key of Object.keys(original)) rejects(report => { delete report[key]; });
		rejects(report => { report.unknown = true; });
		for(const badRoute of ["unknown", route === "ordinary-source" ? "reviewed-source" : "ordinary-source"])
			assert.throws(() => assertPhpWasmSubtypeReport(original, badRoute, input));
		for(const key of ["dispatch", "constructorDispatch"]) rejects(report => { report[key] = "measured"; });
		for(const flag of ["reproducible", "sourceRemovedBeforeInstallation"]) rejects(report => { report[flag] = false; });
		for(const flag of phpWasmIsolationFlags) rejects(report => { report.phpWasm[flag] = false; });
		for(const key of ["bindingIrSha256", "modelSha256", "receiptSha256"]) rejects(report => { report[key] = "0".repeat(64); });
		for(const key of ["leanSha256", "phpSha256"]) rejects(report => { report.fixtureSources[key] = "0".repeat(64); });
		rejects(report => { report.refinements["Subtypes.secondEven"].parameters[0].constructor = "Subtypes.checkedEven"; });
		rejects(report => { report.refinements["Subtypes.mix"].parameters[1].bound = "11"; });
		rejects(report => { report.refinements["Subtypes.zeroEven"].result = null; });
		rejects(report => { report.phpWasm.component.sourceIdentity.request.contracts["Subtypes.secondEven"].parameters[0].refinement.constructor = "Subtypes.checkedEven"; });
		rejects(report => { report.phpWasm.component.sourceIdentity.request.specializations.pop(); });
		rejects(report => { report.phpWasm.component.sourceIdentity.request.specializations[0].types[0] = "Nat"; });
		rejects(report => { report.phpWasm.component.sourceIdentity.request.exports.pop(); });
		rejects(report => { report.phpWasm.component.sourceIdentity.request.arities = [["Subtypes.half", 0]]; });
		rejects(report => { report.phpWasm.consumerSources.strict = report.phpWasm.consumerSources.weak; });
		rejects(report => { report.phpWasm.component.compiler.emsdkCommit = "0".repeat(40); });
		rejects(report => { report.phpWasm.component.pointerBits = 64; });
		rejects(report => { report.phpWasm.component.sourceIdentity.modules[0].source.sha256 = "0".repeat(64); });
		rejects(report => { report.packages[0].artifacts[0].bytes++; });
		rejects(report => { report.packages[0].requires = []; });
		rejects(report => { report.phpWasm.packageSet.componentIdentity = "0".repeat(64); });
		rejects(report => { report.phpWasm.npm.lockText += "\n"; });
		rejects(report => { report.phpWasm.composer.lockText += "\n"; });
		for(let execution = 0; execution < 12; execution++)
		{
			rejects(report => { report.phpWasm.executions.splice(execution, 1); });
			rejects(report => { report.phpWasm.executions[execution].observation.checks--; });
			rejects(report => { report.phpWasm.executions[execution].observation.word_bits = 64; });
			rejects(report => { report.phpWasm.executions[execution].phases.pop(); });
		}
		rejects(report => { report.phpWasm.executions[1] = report.phpWasm.executions[0]; });
		rejects(report => { report.phpWasm.executions.find(item => item.realm === "chromium").requests = []; });
		if(route === "reviewed-source")
		{
			for(const change of [
				review => { review.declarations.find(item => item.name === "secondEven").source.extensions["lean-lang.org/refinements"].parameters[0].constructor = "Subtypes.checkedEven"; }
				, review => { review.declarations.find(item => item.name === "mix").source.extensions["lean-lang.org/refinements"].parameters[1].bound = "11"; }
				, review => { review.declarations.find(item => item.name === "half").parameters[0].type.name = "int"; }
			]) rejects(report => {
				const identity = report.phpWasm.component.sourceIdentity.reviewedBindingIr;
				const review = JSON.parse(identity.source); change(review);
				identity.source = canonicalJson(review); identity.sourceSha256 = sha256(identity.source);
				identity.semanticSha256 = hashBindingIr(review); report.reviewedBindingIrSha256 = identity.semanticSha256;
			});
		}
	}
});

test("installed PHP-Wasm Subtype report CLI requires both routes and rejects truncated or unknown input", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-subtype-php-report-check-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const cli = args => spawnSync(process.execPath, ["scripts/check-php-wasm-subtype-reports.mjs", ...args], { encoding: "utf8" });
	for(const args of [[], ["--directory"], ["--unknown", root], ["--directory", root, "--extra"]])
	{
		const result = cli(args); assert.equal(result.status, 1); assert.match(result.stderr, /Usage:/u);
	}
	const args = ["--directory", root];
	assert.equal(cli(args).status, 1);
	await cp(`${phpWasmSubtypeArchiveRoot}/ordinary.json`, join(root, "ordinary.json"));
	assert.equal(cli(args).status, 1);
	await cp(`${phpWasmSubtypeArchiveRoot}/reviewed.json`, join(root, "reviewed.json"));
	const passed = cli(args); assert.equal(passed.status, 0, passed.stderr); assert.match(passed.stdout, /all 24 executions, 2024 checks each/u);
	const report = JSON.parse(await readFile(join(root, "reviewed.json"), "utf8"));
	report.phpWasm.executions.pop(); await saveLakeFile(root, "reviewed.json", canonicalJson(report));
	assert.equal(cli(args).status, 1);
});
