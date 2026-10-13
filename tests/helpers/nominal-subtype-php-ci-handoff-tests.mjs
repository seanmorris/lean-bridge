/**
 * Check complete Composer ZIP authentication with synthetic, unexecuted payloads.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { inspectNominalSubtypePhpCiHandoff } from "./nominal-subtype-php-ci-handoff.mjs";

test("nominal PHP CI authenticates every ZIP member and retained original byte", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-php-ci-handoff-"));
	t.after(() => rm(root, { recursive: true }));
	const metadata = { name: "example/synthetic", version: "1.0.0", type: "library"
		, require: { php: ">=8.2 <9", "ext-ffi": "*", "brick/math": "1.0.0" }
		, autoload: { files: ["src/Api.php"] } };
	const contents = new Map([["composer.json", Buffer.from(canonicalJson(metadata))]
		, ["src/Api.php", Buffer.from("<?php // synthetic source, never executed\n")]
		, ["native/linux-x64/synthetic.so", Buffer.from("synthetic native bytes, never executed")]]);
	const memberReceipt = { schemaVersion: 1
		, kind: "lean-bridge-ordinary-php-package"
		, ecosystem: "composer", name: metadata.name, version: metadata.version
		, files: Object.fromEntries([...contents].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }])) };
	contents.set("lean-bridge/package-receipt.json", Buffer.from(canonicalJson(memberReceipt)));
	for(const [path, bytes] of contents) await saveLakeFile(root, path, bytes);
	const archive = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	const artifact = { path: "archives/synthetic.zip", bytes: archive.length, sha256: sha256(archive) };
	const receipt = { packages: [{ target: "php-native", role: "component", artifacts: [artifact] }] };
	const packaged = { files: Object.fromEntries([...contents].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: sha256(bytes) }]))
		, retained: [...contents.keys()].filter(path => !path.startsWith("native/")) };
	const files = new Map([
		["handoff/package-set-receipt.json", Buffer.from(canonicalJson(receipt))]
		, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(receipt))}  package-set-receipt.json\n`)]
		, ["handoff/" + artifact.path, archive]
		, ["package.json", Buffer.from(canonicalJson(packaged))]
		, ...packaged.retained.map(path => ["package/" + path, contents.get(path)])]);
	const read = async path => { assert.ok(files.has(path), path); return files.get(path); };
	assert.deepEqual(await inspectNominalSubtypePhpCiHandoff(read), { archiveSha256: sha256(archive), archivePath: "handoff/" + artifact.path });
	let controls = 0;
	for(const target of files.keys())
	{
		await assert.rejects(inspectNominalSubtypePhpCiHandoff(async path => {
			if(path === target) throw new Error("missing original"); return read(path);
		})); controls++;
		await assert.rejects(inspectNominalSubtypePhpCiHandoff(async path => path === target
			? Buffer.concat([await read(path), Buffer.from("corrupted")]) : read(path))); controls++;
	}
	const mutations = [value => { value.packages.push(value.packages[0]); }
		, value => { value.packages[0].target = "npm"; }
		, value => { value.packages[0].role = "runtime"; }
		, value => { value.packages[0].artifacts.push(value.packages[0].artifacts[0]); }
		, value => { value.packages[0].artifacts[0].bytes++; }
		, value => { value.packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, value => { value.packages[0].artifacts[0].path = "../other.zip"; }];
	for(const mutate of mutations)
	{
		const changed = structuredClone(receipt); mutate(changed);
		const replacements = new Map([["handoff/package-set-receipt.json", Buffer.from(canonicalJson(changed))]
			, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(changed))}  package-set-receipt.json\n`)]]);
		await assert.rejects(inspectNominalSubtypePhpCiHandoff(path => replacements.get(path) ?? read(path))); controls++;
	}
	const packageMutations = [value => { delete value.files["native/linux-x64/synthetic.so"]; }
		, value => { value.files["src/Api.php"].sha256 = "0".repeat(64); }
		, value => { value.retained.push("not-in-the-archive"); }];
	for(const mutate of packageMutations)
	{
		const changed = structuredClone(packaged); mutate(changed);
		await assert.rejects(inspectNominalSubtypePhpCiHandoff(path => path === "package.json" ? Buffer.from(canonicalJson(changed)) : read(path))); controls++;
	}
	// Updating the outer ZIP digest must not hide drift from its member receipt.
	await saveLakeFile(root, "native/linux-x64/synthetic.so", "altered synthetic bytes");
	const altered = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	const changed = structuredClone(receipt);
	changed.packages[0].artifacts[0] = { ...artifact, bytes: altered.length, sha256: sha256(altered) };
	const replacements = new Map([["handoff/package-set-receipt.json", Buffer.from(canonicalJson(changed))]
		, ["handoff/package-set-receipt.json.sha256", Buffer.from(`${sha256(canonicalJson(changed))}  package-set-receipt.json\n`)]
		, ["handoff/" + artifact.path, altered]]);
	await assert.rejects(inspectNominalSubtypePhpCiHandoff(path => replacements.get(path) ?? read(path))); controls++;
	t.diagnostic(`${controls} missing, corrupt and coordinated ZIP controls; synthetic payloads never executed`);
});
