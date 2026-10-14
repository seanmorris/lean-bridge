/**
 * Challenge archive authentication with explicit synthetic packages, never runtime evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { assertNominalSubtypeBrowserHandoff, nominalSubtypeBrowserHandoffRecords } from "./nominal-subtype-browser-package.mjs";

const json = value => Buffer.from(canonicalJson(value));
const pack = files => createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
	, files: [...files].map(([path, bytes]) => ({ path: "package/" + path, bytes, mode: 0o644 })) });
const fixture = async () => {
	const receipt = JSON.parse(await readFile("docs/evidence/nominal-subtype-npm-20261011/ordinary/full/records/build-0/component-package-receipt.json"));
	const runtime = new Map([["internal/main.wasm", Buffer.from("synthetic runtime control")]]);
	const basis = { schemaVersion: 1
		, packing: { collationLocale: new Intl.Collator().resolvedOptions().locale }
		, files: [...runtime].map(([path, bytes]) => ({ path, sha256: sha256(bytes) })) };
	const identity = sha256(json(basis)), version = "0.0.0-test." + identity;
	runtime.set("runtime-identity.json", json(basis));
	runtime.set("package.json", json({ name: "@lean-bridge/runtime", version, leanBridge: { runtimeIdentity: identity } }));
	const component = new Map([["package.json", json({ name: "nominalsubtypes", version: "1.0.0" })]
		, ["index.mjs", Buffer.from("// synthetic API control\n")]]);
	const verifier = await readFile("src/release/component-package-receipt.mjs");
	const records = new Map([["browser-javascript/installed-runtime-identity.json", json(basis)]
		, ["handoff/verify-component-package-receipt.mjs", verifier]]);
	const trees = {};
	for(const [item, files, name, coordinate] of [
		[receipt.runtime, runtime, "runtime.tgz", "@lean-bridge/runtime@" + version]
		, [receipt.package, component, "nominal.tgz", "nominalsubtypes@1.0.0"]
	]) {
		const bytes = await pack(files);
		item.archive = name; item.package = coordinate; item.sha256 = sha256(bytes);
		records.set("handoff/" + name, bytes);
		trees[JSON.parse(files.get("package.json")).name] = Object.fromEntries([...files].map(([path, bytes]) => [path, sha256(bytes)]));
	}
	records.set("handoff/component-package-receipt.json", json(receipt));
	return { records, npm: { receipt, trees }, verifier, runtime, component };
};
const reader = records => async path => {
	assert.ok(records.has(path), "Missing original " + path); return records.get(path);
};

test("nominal browser handoff authenticates complete package bytes and npm integrity", async () => {
	const { records, npm, verifier } = await fixture();
	const result = await assertNominalSubtypeBrowserHandoff(reader(records), npm, path => {
		assert.equal(path, "src/release/component-package-receipt.mjs"); return verifier;
	});
	assert.deepEqual(Object.keys(result), ["@lean-bridge/runtime", "nominalsubtypes"]);
	for(const [name, item] of [["@lean-bridge/runtime", npm.receipt.runtime], ["nominalsubtypes", npm.receipt.package]])
	{
		const bytes = records.get("handoff/" + item.archive);
		assert.deepEqual(result[name], { bytes: bytes.length, sha256: sha256(bytes)
			, integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64") });
	}
	assert.deepEqual(nominalSubtypeBrowserHandoffRecords(npm.receipt).sort(), [...records.keys()].filter(path => path.startsWith("handoff/")).sort());
});

test("nominal browser handoff refuses missing originals and forged installed closures", async t => {
	const { records, npm, verifier, component } = await fixture();
	const check = (changed, report = npm) => assertNominalSubtypeBrowserHandoff(reader(changed), report, () => verifier);
	let refused = 0;
	for(const path of records.keys())
	{
		const missing = new Map(records); missing.delete(path);
		await assert.rejects(check(missing)); refused++;
		const corrupt = new Map(records); corrupt.set(path, Buffer.concat([records.get(path), Buffer.from("changed")]));
		await assert.rejects(check(corrupt)); refused++;
	}
	for(const name of Object.keys(npm.trees)) for(const path of Object.keys(npm.trees[name]))
	{
		const changed = structuredClone(npm); changed.trees[name][path] = "0".repeat(64);
		await assert.rejects(check(records, changed)); refused++;
		delete changed.trees[name][path];
		await assert.rejects(check(records, changed)); refused++;
	}
	const changed = structuredClone(npm); changed.trees.nominalsubtypes["extra.mjs"] = "0".repeat(64);
	await assert.rejects(check(records, changed)); refused++;
	const alteredFiles = new Map(component); alteredFiles.set("index.mjs", Buffer.from("// substituted public API\n"));
	const bytes = await pack(alteredFiles), replaced = new Map(records), report = structuredClone(npm);
	report.receipt.package.sha256 = sha256(bytes);
	replaced.set("handoff/nominal.tgz", bytes);
	replaced.set("handoff/component-package-receipt.json", json(report.receipt));
	await assert.rejects(check(replaced, report)); refused++;
	assert.equal(refused, 22);
	t.diagnostic(`${refused} synthetic package substitutions refused; no installed execution claim`);
});
