/**
 * Verify standalone synchronous native handoffs and their public effect metadata.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { reconcileHostExports } from "../../src/analyze/host-export-model.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { readVerifiedPackageSetReceipt, validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const profiles = { c: "native-c-io-v1", pypi: "native-python-io-v1", cpp: "native-cpp-io-v1", cargo: "native-rust-io-v1" }, cap = "capability:native.filesystem";
const sample = { fixture: resolve("tests/fixtures/native-sync-io"), clients: resolve("tests/fixtures/native-sync-io-clients"), module: "Journal.lean", reviewFile: "journal.binding-ir.json" };
const checked = async (handoff, ordinary) => {
	const { receipt, result } = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await assertJsonSchema("package-set-receipt", receipt);
	const api = await json(join(handoff, "binding-ir.json")), evidence = await json(join(handoff, "host-export-evidence.json"));
	const component = receipt.packages.find(p => p.role === "component"), digest = hashBindingIr(api);
	const profile = profiles[component.target]; assert.ok(profile);
	assert.equal(component.profile, profile); assert.equal(receipt.profiles[0].bindingIrSha256, digest);
	assert.deepEqual(receipt.packages.map(p => p.role).sort(), ["pypi", "cargo"].includes(component.target) ? ["component", "runtime"] : ["component"]);
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
sample.inspectPackage = async (target, prefix, component) => {
	if(target === "cpp")
	{
		const metadata = await json(join(prefix, "lean-bridge-package.json"));
		assert.equal(metadata.cppSyncSupportAbi, 1); assert.equal(metadata.cppTaskSupportAbi, undefined);
		assert.deepEqual(await readdir(join(prefix, "include/lean_bridge")), ["sync_v1"]);
		const header = await readFile(join(prefix, "include/lbc_journal_cpp.hpp"), "utf8");
		assert.doesNotMatch(header, /async_v2|Future|run_one|<coroutine>/u);
		assert.doesNotMatch(await readFile(join(prefix, "lib/pkgconfig", component.name + ".pc"), "utf8"), /-pthread/u);
		return { publicSupport: "sync_v1", taskHeaders: false, dispatcher: false };
	}
	if(target === "cargo")
	{
		assert.match(await readFile(join(prefix, "Cargo.toml"), "utf8"), /lean-bridge-task-runtime = \{ version = "=[^"]+", default-features = false \}/u);
		assert.doesNotMatch(await readFile(join(prefix, "src/lib.rs"), "utf8"), /CallbackTask|\bStream\b|\bTask\b/u);
		assert.doesNotMatch(await readFile(join(prefix, "src/native.rs"), "utf8"), /struct Channel|BorrowedFd|impl.*Source</u);
		assert.doesNotMatch(await readFile(join(prefix, "Cargo.lock"), "utf8"), /name = "(async-io|futures-core|polling)"/u);
		return { callType: "CallError", channelDriver: false };
	}
};
sample.checkCargoGraph = (graph, runtime) => {
	const pkg = graph.packages.find(p => p.name === runtime.name && p.version === runtime.version);
	assert.ok(pkg); const node = graph.resolve.nodes.find(n => n.id === pkg.id);
	assert.deepEqual(node.features, []); assert.deepEqual(node.deps, []);
	const names = graph.packages.map(p => p.name);
	assert.ok(!["async-io", "futures-core", "polling"].some(n => names.includes(n)));
	return { runtimeFeatures: node.features, runtimeDependencies: node.deps, asyncReactor: false };
};
export { profiles, sample };
