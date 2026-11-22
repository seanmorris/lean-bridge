/**
 * Verify standalone synchronous native handoffs and their public effect metadata.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt, validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const profiles = { c: "native-c-io-v1", pypi: "native-python-io-v1" }, cap = "capability:native.filesystem";
const sample = { fixture: resolve("tests/fixtures/native-sync-io"), clients: resolve("tests/fixtures/native-sync-io-clients"), module: "Journal.lean", reviewFile: "journal.binding-ir.json" };
const checked = async (handoff, ordinary) => {
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await assertJsonSchema("package-set-receipt", receipt);
	const api = await json(join(handoff, "binding-ir.json")), evidence = await json(join(handoff, "host-export-evidence.json"));
	const component = receipt.packages.find(p => p.role === "component"), digest = hashBindingIr(api);
	const profile = profiles[component.target]; assert.ok(profile);
	assert.equal(component.profile, profile); assert.equal(receipt.profiles[0].bindingIrSha256, digest);
	assert.deepEqual(receipt.packages.map(p => p.role).sort(), component.target === "pypi" ? ["component", "runtime"] : ["component"]);
	const wrong = structuredClone(receipt); wrong.packages[0].profile = component.target === "c" ? profiles.pypi : profiles.c;
	assert.throws(() => validatePackageSetReceipt(wrong), { code: "invalid-package-set-receipt" });
	assert.equal(evidence.sourceTreeSha256, receipt.source.treeSha256); assert.equal(evidence.selection.synchronousIO, true);
	assert.deepEqual(evidence.selection.taskExports, []); assert.deepEqual(evidence.selection.asyncIterators, []);
	assert.equal(evidence.reviewedSourceSha256, ordinary ? sha256(canonicalJson(ordinary)) : null);
	if(ordinary) assert.deepEqual(api, ordinary);
	const by = Object.fromEntries(api.declarations.map(d => [d.name, d]));
	assert.deepEqual(Object.keys(by).sort(), ["bump", "choose", "count", "echo", "read", "store"]);
	for(const d of api.declarations)
	{
		assert.equal(d.resultMode, "value"); assert.ok(!d.effects.includes("async"));
		assert.equal(d.source.extensions["lean-lang.org/delivery"], undefined);
		assert.deepEqual(d.capabilities, ["read", "store"].includes(d.name) ? [cap] : []);
	}
	assert.deepEqual(by.choose.failure.errors, ["error:EIO.Journal.choose"]);
	assert.deepEqual(by.read.failure.errors, ["error:IO.Error"]); assert.deepEqual(by.bump.failure.errors, []);
	assert.equal(by.choose.result.type.constructor, "result");
	assert.deepEqual(api.errors.find(e => e.id === by.choose.failure.errors[0]).payload, by.choose.result.type);
	const changed = structuredClone(api); changed.declarations.find(d => d.name === "read").capabilities = [];
	assert.throws(() => reconcileHostExports({ ...evidence, component: api.component, review: { source: canonicalJson(changed) } }), /Reviewed API differs/u);
	const report = { profile
		, receiptSha256: result.receiptSha256
		, sourceTreeSha256: receipt.source.treeSha256
		, bindingIrSha256: digest
		, compilerSha256: evidence.compilerSha256
		, extractorSha256: evidence.extractorSha256
		, archives: receipt.packages.flatMap(p => p.artifacts) };
	return { api, receipt, report };
};
sample.check = checked;
export { profiles, sample };
