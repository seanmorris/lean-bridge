/**
 * Verify complete recursive checked-record WIT archive authentication with synthetic, unexecuted members.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { inspectRecursiveCheckedRecordWitHandoff, recursiveCheckedRecordWitComponentRecord } from "./recursive-checked-record-wit-handoff.mjs";
import { recursiveCheckedRecordWitLayout } from "./recursive-checked-record-wit-package.mjs";

const signed = receipt => [["handoff/package-set-receipt.json", Buffer.from(canonicalJson(receipt))]
	, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(receipt))}  package-set-receipt.json\n`)]];

test("recursive checked-record WIT CI authenticates complete archives before exposing component supplements", async t => {
	let controls = 0;
	for(const fixture of ["recursive", "mutual"])
	{
		const { directory, component, adapterLibrary } = recursiveCheckedRecordWitLayout(fixture), library = `lib/${adapterLibrary}`;
		const contents = new Map([["src/host.c", Buffer.from("synthetic source, never compiled\n")]
			, [component, Buffer.from("synthetic component, never executed")]
			, [library, Buffer.from("synthetic native library, never executed")]]);
		const pack = values => createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
			, files: [...values].map(([path, bytes]) => ({ path: `${directory}/${path}`, bytes, mode: 0o644 })) });
		const archive = pack(contents);
		const artifact = { path: `archives/${directory}.tar.gz`, bytes: archive.length, sha256: sha256(archive) };
		const receipt = { packages: [{ target: "wit-wasi", role: "component", artifacts: [artifact] }] };
		const packaged = { retained: ["src/host.c"]
			, files: Object.fromEntries([...contents].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }])) };
		const files = new Map([...signed(receipt)
			, ["handoff/" + artifact.path, archive]
			, ["package.json", Buffer.from(canonicalJson(packaged))]
			, ["package/src/host.c", contents.get("src/host.c")]]);
		const read = async path => { assert.ok(files.has(path), path); return files.get(path); };
		const record = recursiveCheckedRecordWitComponentRecord(fixture);
		assert.equal(record, `package/component/${fixture}checkedrecords.wasm`);
		assert.deepEqual(await inspectRecursiveCheckedRecordWitHandoff(read, fixture), { archivePath: "handoff/" + artifact.path
			, archiveSha256: artifact.sha256
			, supplements: new Map([[record, contents.get(component)]]) });
		// The other module's coordinates never authenticate this archive.
		await assert.rejects(inspectRecursiveCheckedRecordWitHandoff(read, fixture === "recursive" ? "mutual" : "recursive")); controls++;
		for(const target of files.keys())
		{
			await assert.rejects(inspectRecursiveCheckedRecordWitHandoff(async path => {
				if(path === target) throw new Error("missing original"); return read(path);
			}, fixture)); controls++;
			await assert.rejects(inspectRecursiveCheckedRecordWitHandoff(async path => path === target
				? Buffer.concat([await read(path), Buffer.from("corrupted")]) : read(path), fixture)); controls++;
		}
		for(const mutate of [value => { value.packages.push(value.packages[0]); }
			, value => { value.packages[0].target = "npm"; }
			, value => { value.packages[0].role = "runtime"; }
			, value => { value.packages[0].artifacts.push(value.packages[0].artifacts[0]); }
			, value => { value.packages[0].artifacts[0].bytes++; }
			, value => { value.packages[0].artifacts[0].sha256 = "0".repeat(64); }
			, value => { value.packages[0].artifacts[0].path = "../other.tar.gz"; }
		]) {
			const changed = structuredClone(receipt); mutate(changed);
			const replacements = new Map(signed(changed));
			await assert.rejects(inspectRecursiveCheckedRecordWitHandoff(path => replacements.get(path) ?? read(path), fixture)); controls++;
		}
		for(const mutate of [value => { delete value.files[library]; }
			, value => { value.files["src/host.c"].sha256 = "0".repeat(64); }
			, value => { value.retained.push("not-in-the-archive"); }
		]) {
			const changed = structuredClone(packaged); mutate(changed);
			const altered = path => path === "package.json" ? Buffer.from(canonicalJson(changed)) : read(path);
			await assert.rejects(inspectRecursiveCheckedRecordWitHandoff(altered, fixture)); controls++;
		}
		// Updating the outer digest must not hide changed components or native libraries.
		for(const path of [component, library])
		{
			const altered = pack(new Map([...contents].map(([name, bytes]) => [name, name === path ? Buffer.from("altered bytes") : bytes])));
			const changed = structuredClone(receipt);
			changed.packages[0].artifacts[0] = { ...artifact, bytes: altered.length, sha256: sha256(altered) };
			const replacements = new Map([...signed(changed), ["handoff/" + artifact.path, altered]]);
			await assert.rejects(inspectRecursiveCheckedRecordWitHandoff(path => replacements.get(path) ?? read(path), fixture)); controls++;
		}
	}
	assert.equal(controls, 46); t.diagnostic(`${controls} missing, corrupt, coordinated and cross-module archive controls; synthetic members never executed`);
});
