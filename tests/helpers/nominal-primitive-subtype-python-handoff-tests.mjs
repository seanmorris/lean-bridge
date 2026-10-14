/**
 * Exercise original-wheel reconciliation with inert ZIP fixtures, not installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { checkNominalPrimitiveSubtypePythonHandoff, nominalPrimitiveSubtypePythonHandoffRecords } from "./nominal-primitive-subtype-python-handoff.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const archivePath = "archives/nominalprimitivesubtypes-1.0.0-py3-none-manylinux_2_36_x86_64.whl";

test("primitive-base Python handoff refuses malformed archive descriptors before reading files", () => {
	const artifact = { path: archivePath, bytes: 1, sha256: "a".repeat(64) };
	assert.deepEqual(nominalPrimitiveSubtypePythonHandoffRecords({ archive: artifact }), [
		"handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, "handoff/" + archivePath]);
	for(const path of ["../outside.whl", "/outside.whl", "archives/../outside.whl", archivePath + "/", archivePath.replace(".whl", ".zip"), "bad\0.whl"])
		assert.throws(() => nominalPrimitiveSubtypePythonHandoffRecords({ archive: { ...artifact, path } }));
	for(const bytes of [0, -1, 1.5, "1", null])
		assert.throws(() => nominalPrimitiveSubtypePythonHandoffRecords({ archive: { ...artifact, bytes } }));
	for(const sha256 of ["", "a".repeat(63), "G".repeat(64), null])
		assert.throws(() => nominalPrimitiveSubtypePythonHandoffRecords({ archive: { ...artifact, sha256 } }));
	assert.throws(() => nominalPrimitiveSubtypePythonHandoffRecords({ archive: { ...artifact, extra: true } }));
});

test("primitive-base Python handoff matches native and text members to the original wheel", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-primitive-python-handoff-unit-"));
	t.after(() => rm(root, { recursive: true }));
	const native = "lean_nominalprimitivesubtypes/native/linux-x64/inert.so";
	const files = new Map([
		["lean_nominalprimitivesubtypes/__init__.py", Buffer.from("# inert handoff control\n")]
		, ["lean_nominalprimitivesubtypes/__init__.pyi", Buffer.from("# inert declaration control\n")]
		, [native, Buffer.from([0, 255, 0, 7])]
	]);
	for(const [path, bytes] of files)
	{
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), bytes);
	}
	const archive = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	const artifact = { path: archivePath, ...identity(archive) };
	const receipt = { schemaVersion: 1, kind: "lean-bridge-package-set-receipt"
		, component: { id: "nominalprimitivesubtypes@1.0.0", name: "nominalprimitivesubtypes", version: "1.0.0" }
		, source: { treeSha256: "a".repeat(64) }
		, profiles: [{ id: "native-library-v1", bindingIrSha256: "b".repeat(64), runtimeIdentity: "c".repeat(64) }]
		, packages: [{ target: "pypi", ecosystem: "pypi"
			, name: "nominalprimitivesubtypes", version: "1.0.0"
			, profile: "native-library-v1", role: "component"
			, runtimeIdentity: "c".repeat(64)
			, runtimeDelivery: "embedded", requires: [], artifacts: [artifact] }] };
	const wheel = { archive: artifact
		, files: Object.fromEntries([...files].map(([path, bytes]) => [path, identity(bytes)]))
		, retained: [...files.keys()].filter(path => path !== native).sort() };
	const receiptBytes = Buffer.from(canonicalJson(receipt));
	const originals = new Map([
		["handoff/package-set-receipt.json", receiptBytes]
		, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(receiptBytes)}  package-set-receipt.json\n`)]
		, ["handoff/" + archivePath, archive]
		, ...wheel.retained.map(path => ["package/" + path, files.get(path)])
	]);
	const snapshots = new Map([...originals].map(([path, bytes]) => [path, Buffer.from(bytes)]));
	const read = async (path, changes = new Map()) => {
		const bytes = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(bytes), "Missing original: " + path); return Buffer.from(bytes);
	};
	assert.deepEqual(await checkNominalPrimitiveSubtypePythonHandoff(read, { receipt, wheel }), {
		archivePath: "handoff/" + archivePath
		, archiveSha256: sha256(archive), members: 3 });
	let controls = 0;
	for(const [path, bytes] of originals) for(const replacement of [null, Buffer.concat([bytes, Buffer.from("changed")])])
	{
		await assert.rejects(checkNominalPrimitiveSubtypePythonHandoff(path_ => read(path_, new Map([[path, replacement]])), { receipt, wheel })); controls++;
	}
	for(const mutate of [
		value => { value.files[native].sha256 = "0".repeat(64); }
		, value => { value.files[native].bytes++; }
		, value => { delete value.files[native]; }
		, value => { value.files["extra.py"] = identity(Buffer.from("extra")); }
		, value => { value.retained.push(value.retained[0]); }
		, value => { value.retained.push("absent.py"); }
	]) {
		const changed = structuredClone(wheel); mutate(changed);
		await assert.rejects(checkNominalPrimitiveSubtypePythonHandoff(read, { receipt, wheel: changed })); controls++;
	}
	// Refreshing outer hashes cannot hide different native bytes inside the wheel.
	await writeFile(join(root, native), Buffer.from([1, 254, 1, 8]));
	const replaced = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	const changedReceipt = structuredClone(receipt), changedWheel = structuredClone(wheel);
	changedReceipt.packages[0].artifacts[0] = { path: archivePath, ...identity(replaced) };
	changedWheel.archive = changedReceipt.packages[0].artifacts[0];
	const changedReceiptBytes = Buffer.from(canonicalJson(changedReceipt));
	const changes = new Map([
		["handoff/package-set-receipt.json", changedReceiptBytes]
		, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(changedReceiptBytes)}  package-set-receipt.json\n`)]
		, ["handoff/" + archivePath, replaced]
	]);
	await assert.rejects(checkNominalPrimitiveSubtypePythonHandoff(path => read(path, changes), { receipt: changedReceipt, wheel: changedWheel })); controls++;
	assert.equal(controls, 17); assert.deepEqual(originals, snapshots);
	assert.deepEqual(await checkNominalPrimitiveSubtypePythonHandoff(read, { receipt, wheel }), {
		archivePath: "handoff/" + archivePath
		, archiveSha256: sha256(archive), members: 3 });
	t.diagnostic("17 original-record and coordinated native-content refusals against inert ZIP fixtures; no installed acceptance claimed.");
});
