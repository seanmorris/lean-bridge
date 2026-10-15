/**
 * Exercise complete crate and dependency integrity without compiling a package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { checkNominalPrimitiveSubtypeRustArchive } from "./nominal-primitive-subtype-rust-package-records.mjs";
import { nominalPrimitiveSubtypeRustReceipt } from "./nominal-primitive-subtype-rust-package.mjs";
import { checkNominalPrimitiveSubtypeRustDependencyRecords, nominalPrimitiveSubtypeRustConsumerLock, nominalPrimitiveSubtypeRustDependencyManifests, nominalPrimitiveSubtypeRustLockedPackages } from "./nominal-primitive-subtype-rust-dependency-records.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });

test("primitive-base Rust archive policy checks every source, receipt and native byte", () => {
	// Deliberately synthetic payloads test integrity policy, not Rust acceptance.
	const payload = new Map([["src/lib.rs", Buffer.from("synthetic source\n")]
		, ["native/linux-x64/libsynthetic.so", Buffer.from([0, 127, 69, 76, 70, 255])]]);
	const receiptBytes = Buffer.from(canonicalJson({ files: Object.fromEntries([...payload].map(([path, bytes]) => [path, identity(bytes)])) }));
	payload.set(nominalPrimitiveSubtypeRustReceipt, receiptBytes);
	const pack = values => createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
		, files: [...values].map(([path, bytes]) => ({ path: "nominalprimitivesubtypes-1.0.0/" + path, bytes, mode: 0o644 })) });
	const archive = pack(payload), files = Object.fromEntries([...payload].map(([path, bytes]) => [path, identity(bytes)]));
	const pkg = { name: "nominalprimitivesubtypes", version: "1.0.0", artifacts: [{ ...identity(archive), path: "archives/nominalprimitivesubtypes-1.0.0.crate" }] };
	const original = { archive, receiptBytes, files, pkg };
	assert.deepEqual(checkNominalPrimitiveSubtypeRustArchive(original), new Map([...payload].sort(([a], [b]) => a.localeCompare(b))));
	const changes = [
		value => { value.archive = Buffer.concat([value.archive, Buffer.from([0])]); }
		, value => { value.pkg.artifacts[0].bytes++; }
		, value => { value.pkg.artifacts[0].sha256 = "0".repeat(64); }
		, value => { value.files.extra = identity(Buffer.from("extra")); }
		, value => { delete value.files["src/lib.rs"]; }
		, value => { value.files["src/lib.rs"].bytes++; }
		, value => { value.files["native/linux-x64/libsynthetic.so"].sha256 = "0".repeat(64); }
		, value => { value.receiptBytes = Buffer.from("different receipt"); }
		, value => { value.pkg.name = "substituted"; }
		, value => { value.pkg.version = "2.0.0"; }
	];
	for(const change of changes)
	{
		const value = { archive: Buffer.from(archive), receiptBytes: Buffer.from(receiptBytes), files: structuredClone(files), pkg: structuredClone(pkg) };
		change(value); assert.throws(() => checkNominalPrimitiveSubtypeRustArchive(value));
	}
	for(const path of ["src/lib.rs", "native/linux-x64/libsynthetic.so", nominalPrimitiveSubtypeRustReceipt, "extra.rs"])
	{
		const replaced = new Map(payload); replaced.set(path, Buffer.from("coordinated archive replacement"));
		const changedArchive = pack(replaced), changedPackage = structuredClone(pkg);
		Object.assign(changedPackage.artifacts[0], identity(changedArchive));
		assert.throws(() => checkNominalPrimitiveSubtypeRustArchive({ ...original, archive: changedArchive, pkg: changedPackage }));
	}
});

test("primitive-base Rust lock policy keeps all fourteen original registry dependencies", async () => {
	const root = "docs/evidence/nominal-subtype-rust-20261012/ordinary-full/records/";
	const dependencies = JSON.parse(await readFile(root + "dependencies.json"));
	const lock = await copiedRustLock("nominalprimitivesubtypes", "1.0.0");
	// Only the synthetic fixture name changes. Original dependency bytes remain fixed.
	dependencies.lockSha256 = sha256(lock);
	const read = path => readFile(root + path);
	const closure = await checkNominalPrimitiveSubtypeRustDependencyRecords({ dependencies, lock, read });
	assert.equal(closure.length, 14);
	assert.equal(nominalPrimitiveSubtypeRustLockedPackages(lock).length, 15);
	assert.match(nominalPrimitiveSubtypeRustConsumerLock(lock), /name = "nominal-consumer"\nversion = "0\.0\.0"\ndependencies = \[\n "nominalprimitivesubtypes",\n\]/u);
	for(const change of [
		value => { value.lockSha256 = "0".repeat(64); }
		, value => { value.packages.pop(); }
		, value => { value.packages.push(structuredClone(value.packages[0])); }
		, value => { value.packages[0].checksum = "0".repeat(64); }
		, value => { value.packages[0].files++; }
		, value => { value.packages[0].manifestSha256 = "0".repeat(64); }
		, value => { value.packages[0].directory = "wrong-1.0.0"; }
		, value => { value.extra = true; }
	]) {
		const changed = structuredClone(dependencies); change(changed);
		await assert.rejects(checkNominalPrimitiveSubtypeRustDependencyRecords({ dependencies: changed, lock, read }));
	}
	for(const changed of [lock.replace("nominalprimitivesubtypes", "nominalsubtypes"), lock + "extra", lock.replace("https://github.com/rust-lang", "https://example.com/rust-lang")])
		assert.throws(() => nominalPrimitiveSubtypeRustLockedPackages(changed));
});

test("primitive-base Rust dependency archive policy refuses altered and unrecorded files", () => {
	const source = Buffer.from('[package]\nname = "synthetic"\nversion = "1.0.0"\n');
	const checksum = sha256("synthetic registry package");
	const manifest = Buffer.from(canonicalJson({ files: { "Cargo.toml": sha256(source) }, package: checksum }));
	const files = [["Cargo.toml", source], [".cargo-checksum.json", manifest]].map(([path, bytes]) => ({
		path: "dependencies/synthetic-1.0.0/" + path, bytes, mode: 0o644
	}));
	const archive = createDeterministicTarGzFromFiles({ files, sourceDateEpoch: 1 });
	const dependencies = { sha256: sha256(archive), packages: [{ directory: "synthetic-1.0.0", checksum, files: 1, manifestSha256: sha256(manifest) }] };
	assert.deepEqual(nominalPrimitiveSubtypeRustDependencyManifests(archive, dependencies), new Map([["dependency-manifests/synthetic-1.0.0.json", manifest]]));
	for(const changed of [{ ...dependencies, sha256: "0".repeat(64) }, { ...dependencies, packages: [] }])
		assert.throws(() => nominalPrimitiveSubtypeRustDependencyManifests(archive, changed));
	for(const change of [
		value => { value.packages[0].files++; }
		, value => { value.packages[0].manifestSha256 = "0".repeat(64); }
		, value => { value.packages[0].checksum = "0".repeat(64); }
		, value => { value.packages[0].directory = "wrong-1.0.0"; }
	]) {
		const changed = structuredClone(dependencies); change(changed);
		assert.throws(() => nominalPrimitiveSubtypeRustDependencyManifests(archive, changed));
	}
	for(const changed of [
		[...files, { path: "dependencies/synthetic-1.0.0/extra.rs", bytes: Buffer.from("extra"), mode: 0o644 }]
		, files.slice(0, 1)
		, files.map(file => file.path.endsWith("Cargo.toml") ? { ...file, bytes: Buffer.from("changed") } : file)
	]) {
		const replaced = createDeterministicTarGzFromFiles({ files: changed, sourceDateEpoch: 1 });
		assert.throws(() => nominalPrimitiveSubtypeRustDependencyManifests(replaced, { ...dependencies, sha256: sha256(replaced) }));
	}
});
