/**
 * Exercise dependency handoff validation without substituting for installed runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { nominalSubtypeRustCiReader } from "./nominal-subtype-rust-ci-report.mjs";

const fixture = () => {
	const files = new Map(), packages = [];
	for(const name of ["alpha", "beta"])
	{
		const directory = `${name}-1.0.0`, members = {
			"Cargo.toml": Buffer.from(`[package]\nname = "${name}"\nversion = "1.0.0"\n`)
			, "src/lib.rs": Buffer.from("pub fn present() -> bool { true }\n") };
		const checksum = sha256(name), manifest = Buffer.from(canonicalJson({ package: checksum
			, files: Object.fromEntries(Object.entries(members).map(([path, bytes]) => [path, sha256(bytes)])) }));
		for(const [path, bytes] of Object.entries(members)) files.set(`dependencies/${directory}/${path}`, bytes);
		files.set(`dependencies/${directory}/.cargo-checksum.json`, manifest);
		packages.push({ directory, checksum, files: 2, manifestSha256: sha256(manifest) });
	}
	return { files, packages };
};
const packed = files => createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
	, files: [...files].map(([path, bytes]) => ({ path, bytes, mode: 0o644 })) });
const records = (files, packages) => {
	const archive = packed(files), dependencies = { archive: "rust-dependencies.tar.gz"
		, sha256: sha256(archive), lockSha256: "a".repeat(64), packages };
	return new Map([["dependencies.json", Buffer.from(canonicalJson(dependencies))]
		, ["dependency-handoff/rust-dependencies.tar.gz", archive]
		, ["untouched.txt", Buffer.from("original record")]]);
};
const reader = originals => async path => { assert.ok(originals.has(path), path); return Buffer.from(originals.get(path)); };

test("nominal Rust CI derives supplements only from the complete original dependency handoff", async t => {
	const { files, packages } = fixture(), originals = records(files, packages);
	const read = await nominalSubtypeRustCiReader(reader(originals));
	for(const pkg of packages)
	{
		const path = `dependency-manifests/${pkg.directory}.json`;
		const expected = files.get(`dependencies/${pkg.directory}/.cargo-checksum.json`);
		assert.deepEqual(await read(path), expected);
		(await read(path)).fill(0); assert.deepEqual(await read(path), expected);
	}
	assert.deepEqual(await read("untouched.txt"), originals.get("untouched.txt"));
	let controls = 0;
	for(const path of ["dependencies.json", "dependency-handoff/rust-dependencies.tar.gz"])
	{
		const missing = new Map(originals); missing.delete(path);
		await assert.rejects(nominalSubtypeRustCiReader(reader(missing))); controls++;
		const altered = new Map(originals); altered.set(path, Buffer.from("changed"));
		await assert.rejects(nominalSubtypeRustCiReader(reader(altered))); controls++;
	}
	for(const path of files.keys())
	{
		const missing = new Map(files); missing.delete(path);
		await assert.rejects(nominalSubtypeRustCiReader(reader(records(missing, packages)))); controls++;
		const altered = new Map(files); altered.set(path, Buffer.from("changed"));
		await assert.rejects(nominalSubtypeRustCiReader(reader(records(altered, packages)))); controls++;
	}
	const extra = new Map(files); extra.set("dependencies/alpha-1.0.0/unreported.rs", Buffer.from("extra"));
	await assert.rejects(nominalSubtypeRustCiReader(reader(records(extra, packages)))); controls++;
	const changes = [selected => { selected.pop(); }
		, selected => { selected.push(structuredClone(selected[0])); }
		, selected => { selected[0].files++; }
		, selected => { selected[0].checksum = "b".repeat(64); }
		, selected => { selected[0].manifestSha256 = "b".repeat(64); }];
	for(const alter of changes)
	{
		const selected = structuredClone(packages); alter(selected);
		await assert.rejects(nominalSubtypeRustCiReader(reader(records(files, selected)))); controls++;
	}
	assert.equal(controls, 22);
	t.diagnostic(`${controls} missing, changed, extra or coordinated dependency controls; synthetic archives are not installed acceptance.`);
});
