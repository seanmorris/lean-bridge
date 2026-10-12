/**
 * Corrupt synthetic NuGet handoffs without treating them as installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { inspectNominalSubtypeDotnetCiHandoff } from "./nominal-subtype-dotnet-ci-handoff.mjs";

test("nominal C# CI binds original archive bytes, every member and managed probe inputs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-dotnet-ci-handoff-"));
	t.after(() => rm(root, { recursive: true }));
	const identity = value => ({ bytes: Buffer.byteLength(value), sha256: sha256(value) });
	const assembly = "LeanBridge.Nominalsubtypes.dll", receiptPath = "lean-bridge/package-receipt.json";
	const contents = { "Nominalsubtypes.Api.nuspec": "<package><metadata><id>Nominalsubtypes.Api</id><version>1.0.0</version></metadata></package>"
		, [`lib/net8.0/${assembly}`]: "synthetic assembly, never executed"
		, "runtimes/linux-x64/native/libsynthetic.so": "synthetic native, never executed" };
	contents[receiptPath] = canonicalJson({ schemaVersion: 1
		, kind: "lean-bridge-ordinary-nuget-package", ecosystem: "nuget"
		, name: "Nominalsubtypes.Api", version: "1.0.0"
		, assembly: "LeanBridge.Nominalsubtypes"
		, files: Object.fromEntries(Object.entries(contents).map(([path, bytes]) => [path, identity(bytes)])) });
	for(const [path, bytes] of Object.entries(contents)) await saveLakeFile(root, path, bytes);
	const archive = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	const artifact = { path: "archives/Nominalsubtypes.Api.1.0.0.nupkg", ...identity(archive) };
	const receipt = { packages: [{ target: "nuget", artifacts: [artifact] }] };
	const retained = ["Nominalsubtypes.Api.nuspec", receiptPath];
	const nuget = { archive: artifact, retained
		, files: Object.fromEntries(Object.entries(contents).map(([path, bytes]) => [path, identity(bytes)])) };
	const files = new Map(Object.entries({ "report.json": canonicalJson({ receipt })
		, "nuget.json": canonicalJson(nuget)
		, "handoff/package-set-receipt.json": canonicalJson(receipt)
		, "handoff/package-set-receipt.json.sha256": `${sha256(canonicalJson(receipt))}  package-set-receipt.json\n`
		, ["handoff/" + artifact.path]: archive
		, [`api-probe/inputs/library/${assembly}`]: contents[`lib/net8.0/${assembly}`]
		, ...Object.fromEntries(retained.map(path => ["package/" + path, contents[path]]))
	}).map(([path, bytes]) => [path, Buffer.from(bytes)]));
	const read = async path => { assert.ok(files.has(path), path); return files.get(path); };
	const result = await inspectNominalSubtypeDotnetCiHandoff(read);
	assert.equal(result.archiveSha512, createHash("sha512").update(archive).digest("base64"));
	assert.equal(result.archiveSha256, sha256(archive));
	assert.deepEqual([...result.members.keys()].sort(), Object.keys(contents).sort());
	let controls = 0;
	for(const target of files.keys())
	{
		await assert.rejects(inspectNominalSubtypeDotnetCiHandoff(async path => {
			if(path === target) throw new Error("missing original");
			return read(path);
		})); controls++;
		await assert.rejects(inspectNominalSubtypeDotnetCiHandoff(async path => path === target
			? Buffer.concat([await read(path), Buffer.from("corrupted")]) : read(path))); controls++;
	}
	const mutations = [value => { value.packages.push(value.packages[0]); }
		, value => { value.packages[0].target = "npm"; }
		, value => { value.packages[0].artifacts.push(artifact); }
		, value => { value.packages[0].artifacts[0].path = "../other.nupkg"; }
		, value => { value.packages[0].artifacts[0].bytes++; }
		, value => { value.packages[0].artifacts[0].sha256 = "0".repeat(64); }];
	for(const change of mutations)
	{
		const changed = structuredClone(receipt); change(changed);
		const replacements = new Map([
			["report.json", Buffer.from(canonicalJson({ receipt: changed }))]
			, ["handoff/package-set-receipt.json", Buffer.from(canonicalJson(changed))]
			, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(changed))}  package-set-receipt.json\n`)]
		]);
		await assert.rejects(inspectNominalSubtypeDotnetCiHandoff(path => replacements.has(path) ? replacements.get(path) : read(path))); controls++;
	}
	t.diagnostic(`${controls} missing, corrupted and coordinated handoff controls; no compiled acceptance claimed`);
});
