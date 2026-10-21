/**
 * Verify complete dependent checked-record checked-record WIT archive authentication with synthetic, unexecuted members.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { inspectDependentCheckedRecordWitHandoff, dependentCheckedRecordWitComponentRecord } from "./dependent-checked-record-wit-handoff.mjs";
import {
	dependentCheckedRecordWitComponent, dependentCheckedRecordWitDirectory
	, dependentCheckedRecordWitLibrary
} from "./dependent-checked-record-wit-package.mjs";

test("dependent checked-record checked-record WIT CI authenticates complete archives before exposing component supplements", async t => {
	const contents = new Map([["src/host.c", Buffer.from("synthetic source, never compiled\n")]
		, [dependentCheckedRecordWitComponent, Buffer.from("synthetic component, never executed")]
		, [`lib/${dependentCheckedRecordWitLibrary}`, Buffer.from("synthetic native library, never executed")]]);
	const pack = values => createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
		, files: [...values].map(([path, bytes]) => ({ path: `${dependentCheckedRecordWitDirectory}/${path}`, bytes, mode: 0o644 })) });
	const archive = pack(contents), artifact = { path: `archives/${dependentCheckedRecordWitDirectory}.tar.gz`, bytes: archive.length, sha256: sha256(archive) };
	const receipt = { packages: [{ target: "wit-wasi", role: "component", artifacts: [artifact] }] };
	const packaged = { files: Object.fromEntries([...contents].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }]))
		, retained: ["src/host.c"] };
	const files = new Map([["handoff/package-set-receipt.json", Buffer.from(canonicalJson(receipt))]
		, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(receipt))}  package-set-receipt.json\n`)]
		, ["handoff/" + artifact.path, archive]
		, ["package.json", Buffer.from(canonicalJson(packaged))]
		, ["package/src/host.c", contents.get("src/host.c")]]);
	const read = async path => { assert.ok(files.has(path), path); return files.get(path); };
	const checked = await inspectDependentCheckedRecordWitHandoff(read);
	assert.equal(dependentCheckedRecordWitComponentRecord
		, "package/component/dependentrecords.wasm");
	assert.deepEqual(checked, { archivePath: "handoff/" + artifact.path
		, archiveSha256: artifact.sha256
		, supplements: new Map([[dependentCheckedRecordWitComponentRecord, contents.get(dependentCheckedRecordWitComponent)]]) });
	let controls = 0;
	for(const target of files.keys())
	{
		await assert.rejects(inspectDependentCheckedRecordWitHandoff(async path => {
			if(path === target) throw new Error("missing original"); return read(path);
		})); controls++;
		await assert.rejects(inspectDependentCheckedRecordWitHandoff(async path => path === target
			? Buffer.concat([await read(path), Buffer.from("corrupted")]) : read(path))); controls++;
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
		const replacements = new Map([["handoff/package-set-receipt.json", Buffer.from(canonicalJson(changed))]
			, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(changed))}  package-set-receipt.json\n`)]]);
		await assert.rejects(inspectDependentCheckedRecordWitHandoff(path => replacements.get(path) ?? read(path))); controls++;
	}
	for(const mutate of [value => { delete value.files[`lib/${dependentCheckedRecordWitLibrary}`]; }
		, value => { value.files["src/host.c"].sha256 = "0".repeat(64); }
		, value => { value.retained.push("not-in-the-archive"); }
	]) {
		const changed = structuredClone(packaged); mutate(changed);
		await assert.rejects(inspectDependentCheckedRecordWitHandoff(path => path === "package.json" ? Buffer.from(canonicalJson(changed)) : read(path))); controls++;
	}
	// Updating the outer digest must not hide changed components or native libraries.
	for(const path of [dependentCheckedRecordWitComponent, `lib/${dependentCheckedRecordWitLibrary}`])
	{
		const altered = pack(new Map([...contents].map(([name, bytes]) => [name, name === path ? Buffer.from("altered bytes") : bytes])));
		const changed = structuredClone(receipt);
		changed.packages[0].artifacts[0] = { ...artifact, bytes: altered.length, sha256: sha256(altered) };
		const replacements = new Map([["handoff/package-set-receipt.json", Buffer.from(canonicalJson(changed))]
			, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(changed))}  package-set-receipt.json\n`)]
			, ["handoff/" + artifact.path, altered]]);
		await assert.rejects(inspectDependentCheckedRecordWitHandoff(path => replacements.get(path) ?? read(path))); controls++;
	}
	assert.equal(controls, 22); t.diagnostic(`${controls} missing, corrupt and coordinated archive controls; synthetic members never executed`);
});
