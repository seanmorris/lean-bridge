/**
 * Build verifiable ordinary and reviewed handoffs from an unmodified source fixture.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

export const fixture = resolve("tests/fixtures/native-host-effects");
const json = async p => JSON.parse(await readFile(p, "utf8"));
const fsCap = "capability:native.filesystem", envCap = "capability:native.environment";
/**
 * Produce both release paths serially, using the ordinary interface as the review.
 *
 * @param root - Directory for original source snapshots and handoffs.
 * @param target - Native package target.
 * @param env - Pinned build tools.
 * @param sample - Optional source fixture and acceptance check for another native delivery profile.
 */
export const buildEffectHandoffs = async (root, target, env, sample = {}) => {
	let ordinary;
	await mkdir(join(root, target));
	for(const route of sample.routes ?? ["ordinary", "reviewed"])
	{
		const dir = join(root, target, route), src = join(dir, "source");
		await mkdir(src, { recursive: true });
		for(const f of [sample.module ?? "Effects.lean", "lakefile.toml", "lean-toolchain", "lean-bridge.exports.json"]) await copyFile(join(sample.fixture ?? fixture, f), join(src, f));
		if(ordinary) await writeFile(join(src, sample.reviewFile ?? "effects.binding-ir.json"), canonicalJson(ordinary), { flag: "wx" });
		const handoff = join(dir, "handoff");
		await buildCanonicalProject({ projectRoot: src, outputRoot: handoff, targets: [target], environment: env })
			.catch(e => { throw new Error(e.message + "\n" + JSON.stringify(e.details), { cause: e }); });
		const checked = await (sample.check ?? checkEffectHandoff)(handoff, ordinary);
		ordinary ??= checked.api;
	}
};
/**
 * Verify archive identity, compiled root coverage and refusal of a weakened review.
 *
 * @param handoff - Finished package directory.
 * @param ordinary - Previously verified ordinary interface when checking a review.
 */
export const checkEffectHandoff = async (handoff, ordinary) => {
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const api = await json(join(handoff, "binding-ir.json")), evidence = await json(join(handoff, "host-export-evidence.json"));
	const digest = hashBindingIr(api);
	assert.equal(receipt.profiles[0].bindingIrSha256, digest); assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256);
	assert.equal(evidence.reviewedSourceSha256, ordinary ? sha256(canonicalJson(ordinary)) : null);
	if(ordinary) assert.deepEqual(api, ordinary);
	assert.deepEqual(api.capabilities.map(c => c.id).sort(), [envCap, fsCap]);
	const phase = name => api.declarations.find(d => d.name === name).source.extensions["lean-bridge.dev/native-effects-v1"];
	assert.deepEqual(phase("walk"), { startup: [envCap], pull: [fsCap], close: [fsCap] });
	assert.deepEqual(phase("worker"), { startup: [envCap], call: [fsCap] });
	const roots = evidence.metadata.nativeEffectAudit.roots, leaves = n => roots.find(r => r.declaration === n).leaves.map(l => l.symbol);
	assert.ok(leaves("Effects.worker").includes("lean_io_metadata")); assert.ok(leaves("Effects.pull").includes("lean_io_prim_handle_read"));
	assert.ok(leaves("Effects.close").includes("lean_io_prim_handle_put_str"));
	assert.ok(evidence.metadata.nativeEffectAudit.initializers.some(n => leaves(n).includes("lean_io_getenv")));
	for(const mutate of [d => { d.capabilities = [fsCap]; }, d => { delete d.source.extensions["lean-bridge.dev/native-effects-v1"].close; }])
	{
		const changed = structuredClone(api); mutate(changed.declarations.find(d => d.name === "walk"));
		assert.throws(() => reconcileHostExports({ ...evidence, ir: null, component: api.component, review: { source: canonicalJson(changed) } }), /Reviewed API differs/u);
	}
	const report = { profile: receipt.profiles[0].id
		, receiptSha256: result.receiptSha256
		, sourceTreeSha256: receipt.source.treeSha256
		, bindingIrSha256: digest
		, compilerSha256: evidence.compilerSha256
		, extractorSha256: evidence.extractorSha256
		, archives: receipt.packages.flatMap(p => p.artifacts) };
	return { api, receipt, report };
};
