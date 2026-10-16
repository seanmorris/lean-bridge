/**
 * Test coordinated archive controls with explicitly synthetic native payloads.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { nestedCheckedRecordRustReview } from "./nested-checked-record-rust-fixture.mjs";
import { nestedCheckedRecordRustGenerator } from "./nested-checked-record-rust-generators.mjs";
import { nestedCheckedRecordRustReceipt } from "./nested-checked-record-rust-package.mjs";
import { checkNestedCheckedRecordRustPackage } from "./nested-checked-record-rust-package-records.mjs";
import { checkNestedCheckedRecordRustPackageControls } from "./nested-checked-record-rust-package-controls.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const encoded = value => Buffer.from(canonicalJson(value));

test("nested checked-record Rust coordinated archive controls reach the frozen source checker", async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const generator = await nestedCheckedRecordRustGenerator(producerCommit);
	for(const mode of ["full", "result-only"])
	{
		// Small invented bytes exercise reconciliation only. They are not libraries
		// or a compiler result, and this fixture cannot establish installed acceptance.
		const native = new Map(["libadapter.so", "libcomponent.so", "libruntime.so"]
			.map(name => [name, Buffer.from("synthetic native bytes for " + name)]));
		const runtime = { files: { "lib/libruntime.so": identity(native.get("libruntime.so")) } };
		const runtimeIdentity = sha256(canonicalJson(runtime));
		const bindingIr = nestedCheckedRecordRustReview(mode);
		const componentId = { id: "nestedcheckedrecords@1.0.0", name: "nestedcheckedrecords", version: "1.0.0" };
		const model = { bindingIr
			, bindingIrSha256: hashBindingIr(bindingIr)
			, component: componentId
			, sourceIdentity: { exportConfigurationSource: canonicalJson({ package: {} }), synthetic: true } };
		const component = { runtimeIdentity, bindingIrSha256: model.bindingIrSha256
			, sourceIdentity: model.sourceIdentity, library: "libcomponent.so"
			, nativeLibrary: identity(native.get("libcomponent.so")) };
		const adapter = { runtimeIdentity, bindingIrSha256: model.bindingIrSha256
			, componentReceiptSha256: sha256(canonicalJson(component))
			, library: "libadapter.so"
			, files: { "lib/libadapter.so": identity(native.get("libadapter.so")) } };
		const evidence = { runtimeIdentity, componentId: componentId.id
			, componentReceiptSha256: sha256(canonicalJson(component))
			, library: adapter.library
			, libraries: Object.fromEntries([...native].map(([name, bytes]) => [name, sha256(bytes)])) };
		const generated = generator.generateCopiedRustPackage(bindingIr, evidence, { name: componentId.name, version: componentId.version, metadata: {} });
		const members = new Map(Object.entries({ ...generated, "Cargo.lock": generator.lock
			, "lean-bridge/licenses/LeanBridge-LICENSE": "synthetic license\n" }).map(([path, source]) => [path, Buffer.from(source)]));
		for(const [name, bytes] of native) members.set("native/linux-x64/" + name, bytes);
		const compiled = { schemaVersion: 1
			, profile: "native-library-v1"
			, name: componentId.name, version: componentId.version
			, bindingIrSha256: model.bindingIrSha256
			, evidence, rustc: "rustc 1.90.0 (synthetic)"
			, files: Object.fromEntries([...members].map(([path, bytes]) => [path, identity(bytes)])) };
		for(const [path, record] of Object.entries({ "component/model.json": model
			, "component/binding-ir.json": bindingIr
			, "component/native-component.json": component
			, "native-c-adapter.json": adapter
			, "runtime.json": runtime, "native-rust.json": compiled }))
			members.set("lean-bridge/" + path, encoded(record));
		const packageReceipt = { schemaVersion: 1
			, kind: "lean-bridge-ordinary-cargo-package", ecosystem: "cargo"
			, name: componentId.name, version: componentId.version, runtimeIdentity
			, bindingIrSha256: model.bindingIrSha256
			, component: componentId, sourceIdentity: model.sourceIdentity
			, glibcMinimumVersion: "2.36"
			, compiledProjectionSha256: sha256(canonicalJson(compiled))
			, files: Object.fromEntries([...members].map(([path, bytes]) => [path, identity(bytes)])) };
		const receiptBytes = encoded(packageReceipt); members.set(nestedCheckedRecordRustReceipt, receiptBytes);
		const archive = createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
			, files: [...members].map(([path, bytes]) => ({ path: "nestedcheckedrecords-1.0.0/" + path, bytes, mode: 0o644 })) });
		const artifact = { path: "archives/nestedcheckedrecords-1.0.0.crate", ...identity(archive) };
		const receipt = { packages: [{ target: "cargo"
			, ecosystem: "cargo", role: "component", profile: "native-library-v1"
			, runtimeDelivery: "embedded", requires: []
			, name: componentId.name, version: componentId.version
			, runtimeIdentity, artifacts: [artifact] }] };
		const files = Object.fromEntries([...members].map(([path, bytes]) => [path, identity(bytes)]));
		const crate = { archive: artifact
			, receiptSha256: sha256(receiptBytes), files, evidence
			, retained: [...members.keys()].filter(path => !path.startsWith("native/linux-x64/")).sort()
			, closure: { receiptSha256: sha256(receiptBytes), packageFileSetSha256: sha256(canonicalJson(Object.keys(files).sort())) } };
		const records = new Map(crate.retained.map(path => ["package/" + path, members.get(path)]));
		records.set("crate.json", encoded(crate)); records.set("handoff/" + artifact.path, archive);
		records.set("handoff/package-set-receipt.json", encoded(receipt));
		records.set("handoff/package-set-receipt.json.sha256", Buffer.from(sha256(canonicalJson(receipt)) + "  package-set-receipt.json\n"));
		const originals = new Map([...records].map(([path, bytes]) => [path, sha256(bytes)]));
		const read = async path => {
			assert.ok(records.has(path), path); return Buffer.from(records.get(path));
		};
		const options = { model, receipt, producerCommit, floor: "2.36" };
		const accepted = await checkNestedCheckedRecordRustPackage({ ...options, read, json: async path => JSON.parse(await read(path)) });
		assert.deepEqual(accepted.crate, crate);
		assert.equal(await checkNestedCheckedRecordRustPackageControls(read, options), 6);
		for(const [path, hash] of originals) assert.equal(sha256(records.get(path)), hash, path);
	}
	t.diagnostic("Two synthetic package baselines and twelve coordinated replacements; no compiler or installed Rust execution.");
});
