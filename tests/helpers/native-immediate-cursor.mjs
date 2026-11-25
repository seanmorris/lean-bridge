/** @file Exercise synchronous cursors through the installed public headers. */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { runEffectConsumers } from "./native-effect-consumers.mjs";

const fixture = resolve("tests/fixtures/native-immediate-cursor");
const json = async file => JSON.parse(await readFile(file, "utf8"));
const check = async (handoff, ordinary) => {
	const {receipt, result} = await readVerifiedPackageSetReceipt({receiptPath: join(handoff, "package-set-receipt.json")});
	const api = await json(join(handoff, "binding-ir.json"));
	const evidence = await json(join(handoff, "host-export-evidence.json"));
	assert.equal(receipt.profiles[0].id, "native-c-io-v1");
	assert.equal(evidence.reviewedSourceSha256, ordinary ? sha256(canonicalJson(ordinary)) : null);
	assert.equal(evidence.selection.synchronousIO, true);
	assert.deepEqual(evidence.selection.taskExports, []);
	assert.deepEqual(evidence.selection.asyncIterators, []);
	if(ordinary) assert.deepEqual(api, ordinary);
	const cursors = api.declarations.filter(d => d.resultMode === "iterator");
	assert.equal(cursors.length, 3);
	for(const decl of cursors)
	{
		assert.ok(!decl.effects.includes("async"));
		assert.deepEqual(decl.source.extensions["lean-bridge.dev/native-effects-v1"], {close: ["capability:native.filesystem"]});
	}
	return {receipt, api, report: {receiptSha256: result.receiptSha256}};
};
test("C11 installs pull immediate Lean iterators without a poller", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-direct-c-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	let ordinary;
	for(const route of ["ordinary", "reviewed"])
	{
		const dir = join(root, "c", route), source = join(dir, "source"), output = join(dir, "handoff");
		await mkdir(dir, {recursive: true});
		await cp(fixture, source, {recursive: true, filter: path => !/\/consumer\.[^/]+$/u.test(path)});
		const config = join(source, "lean-bridge.exports.json");
		if(ordinary)
		{
			const cfg = await json(config); delete cfg.exports;
			await writeFile(config, canonicalJson(cfg));
			await writeFile(join(source, "dials.binding-ir.json"), canonicalJson(ordinary));
		}
		await buildCanonicalProject({projectRoot: source, targets: ["c"], outputRoot: output})
			.catch(e => { throw new Error(e.message + " " + JSON.stringify(e.details), {cause: e}); });
		const {api} = await check(output, ordinary); ordinary ??= api;
		await rm(source, {recursive: true});
	}
	const reports = await runEffectConsumers(root, root, "c", process.env, {clients: fixture, check,
		inspectPackage: async (_, prefix) => {
			const header = await readFile(join(prefix, "include/lbc_dials.h"), "utf8");
			assert.match(header, /lbc_dials_sequence_next\(/u);
			assert.doesNotMatch(header, /_poll\(|_take\(|_PENDING|lean_object/u);
		}});
	for(const {route, receiptSha256} of reports) t.diagnostic(route + ": " + receiptSha256);
});
