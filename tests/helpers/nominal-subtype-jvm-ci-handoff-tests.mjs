/**
 * Exercise closed JAR validation with synthetic native bytes, never executed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { inspectNominalSubtypeJvmPackage } from "./nominal-subtype-jvm-package.mjs";
import { inspectNominalSubtypeJvmCiHandoff } from "./nominal-subtype-jvm-ci-handoff.mjs";

test("nominal JVM CI derives its supplement from every original JAR member", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-jvm-ci-handoff-"));
	t.after(() => rm(root, { recursive: true }));
	const archiveRoot = "docs/evidence/nominal-subtype-jvm-20261013";
	const indexBytes = await readFile(`${archiveRoot}/index.json`);
	assert.equal(sha256(indexBytes), "ee5dfe4809453595b3d662d2624a0c50c4e93c908d63195176bbd0f9dc56e0e1");
	const index = JSON.parse(indexBytes), prefix = "ordinary-full/records/";
	const original = async path => {
		const file = index.files.find(file => file.path === prefix + path); assert.ok(file, path);
		const bytes = await readFile(`${archiveRoot}/${file.path}`);
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256); return bytes;
	};
	const modelBytes = await original("build-0/model.json"), compiledBytes = await original("build-0/native-jvm.json");
	const model = JSON.parse(modelBytes), compiled = JSON.parse(compiledBytes);
	const receiptPath = "META-INF/lean-bridge/package-receipt.json";
	const memberReceipt = JSON.parse(await original("package/" + receiptPath));
	const contents = new Map();
	for(const path of Object.keys(memberReceipt.files))
	{
		const native = path.startsWith("META-INF/lean-bridge/native/linux-x64/");
		const bytes = native ? Buffer.from(`Synthetic native ${path}, never executed`) : await original("package/" + path);
		if(native) memberReceipt.files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		contents.set(path, bytes);
	}
	contents.set(receiptPath, Buffer.from(canonicalJson(memberReceipt)));
	for(const [path, bytes] of contents) await saveLakeFile(root, path, bytes);
	const archive = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	const receipt = JSON.parse(await original("handoff/package-set-receipt.json"));
	const artifact = receipt.packages[0].artifacts.find(item => item.path.endsWith(".jar"));
	artifact.bytes = archive.length; artifact.sha256 = sha256(archive);
	const options = { floor: "2.36", mode: "full" };
	const installation = inspectNominalSubtypeJvmPackage(archive, { pkg: receipt.packages[0], model, compiled, ...options });
	const files = new Map(Object.entries({
		"report.json": canonicalJson({ receipt })
		, "build-0/model.json": modelBytes
		, "build-0/native-jvm.json": compiledBytes
		, "installation.json": canonicalJson(installation)
		, "handoff/package-set-receipt.json": canonicalJson(receipt)
		, "handoff/package-set-receipt.json.sha256": `${sha256(canonicalJson(receipt))}  package-set-receipt.json\n`
		, ["handoff/" + artifact.path]: archive
	}).map(([path, bytes]) => [path, Buffer.from(bytes)]));
	const read = async path => { assert.ok(files.has(path), path); return files.get(path); };
	const checked = await inspectNominalSubtypeJvmCiHandoff(read, options);
	assert.equal(checked.archiveSha256, sha256(archive));
	for(const [path, bytes] of contents) if(!path.startsWith("META-INF/lean-bridge/native/"))
		assert.deepEqual(await checked.read("package/" + path), bytes);
	assert.deepEqual(await checked.read("report.json"), files.get("report.json"));
	let controls = 0;
	for(const target of files.keys())
	{
		await assert.rejects(inspectNominalSubtypeJvmCiHandoff(async path => {
			if(path === target) throw new Error("missing original"); return read(path);
		}, options)); controls++;
		await assert.rejects(inspectNominalSubtypeJvmCiHandoff(async path => path === target
			? Buffer.concat([await read(path), Buffer.from("corrupted")]) : read(path), options)); controls++;
	}
	for(const changed of [{ floor: "2.38" }, { mode: "result-only" }])
	{ await assert.rejects(inspectNominalSubtypeJvmCiHandoff(read, { ...options, ...changed })); controls++; }
	const mutations = [value => { value.packages.push(value.packages[0]); }
		, value => { value.packages[0].target = "npm"; }
		, value => { value.packages[0].role = "runtime"; }
		, value => { value.packages[0].artifacts[0].bytes++; }
		, value => { value.packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, value => { value.packages[0].artifacts[0].path = "../other.jar"; }];
	for(const mutate of mutations)
	{
		const changed = structuredClone(receipt); mutate(changed);
		const replacements = new Map([
			["report.json", Buffer.from(canonicalJson({ receipt: changed }))]
			, ["handoff/package-set-receipt.json", Buffer.from(canonicalJson(changed))]
			, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(changed))}  package-set-receipt.json\n`)]
		]);
		await assert.rejects(inspectNominalSubtypeJvmCiHandoff(path => replacements.has(path) ? replacements.get(path) : read(path), options)); controls++;
	}
	// Even a coordinated outer checksum cannot hide an altered native JAR member.
	const native = [...contents.keys()].find(path => path.startsWith("META-INF/lean-bridge/native/"));
	await saveLakeFile(root, native, "changed native bytes");
	const altered = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	const changed = structuredClone(receipt), target = changed.packages[0].artifacts.find(item => item.path.endsWith(".jar"));
	target.bytes = altered.length; target.sha256 = sha256(altered);
	const replacements = new Map([["report.json", Buffer.from(canonicalJson({ receipt: changed }))]
		, ["handoff/package-set-receipt.json", Buffer.from(canonicalJson(changed))]
		, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(changed))}  package-set-receipt.json\n`)]
		, ["handoff/" + artifact.path, altered]]);
	await assert.rejects(inspectNominalSubtypeJvmCiHandoff(path => replacements.has(path) ? replacements.get(path) : read(path), options)); controls++;
	t.diagnostic(`${controls} missing, corrupt and coordinated JAR controls; synthetic native bytes never executed`);
});
