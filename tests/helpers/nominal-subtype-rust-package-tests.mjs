/**
 * Check Rust package identity and closure policies independently of installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCopiedRustPackage, copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeRustModes } from "./nominal-subtype-rust-fixture.mjs";
import { nominalSubtypeRustGenerator, nominalSubtypeRustOriginal } from "./nominal-subtype-rust-generators.mjs";
import { assertNominalSubtypeRustIdentity, nominalSubtypeRustNativeEvidence } from "./nominal-subtype-rust-package.mjs";
import { checkNominalSubtypeRustApiProbe, nominalSubtypeRustInputNames, verifyNominalSubtypeRustDependencies } from "./nominal-subtype-rust-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("nominal Rust package identity rejects coordinate, floor, source and runtime drift", () => {
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }, sourceIdentity: { fixture: true } };
	const pkg = { target: "cargo", ecosystem: "cargo", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "nominalsubtypes", version: "1.0.0", runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/nominalsubtypes-1.0.0.crate" }] };
	const receipt = { schemaVersion: 1, kind: "lean-bridge-ordinary-cargo-package"
		, ecosystem: "cargo", name: pkg.name, version: pkg.version
		, runtimeIdentity: pkg.runtimeIdentity
		, ...model
		, glibcMinimumVersion: "2.36", compiledProjectionSha256: "c".repeat(64) };
	assertNominalSubtypeRustIdentity(receipt, pkg, model, "2.36");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertNominalSubtypeRustIdentity({ ...receipt, [key]: "changed" }, pkg, model, "2.36"));
		const missing = { ...receipt }; delete missing[key];
		assert.throws(() => assertNominalSubtypeRustIdentity(missing, pkg, model, "2.36"));
	}
	for(const key of Object.keys(pkg))
		assert.throws(() => assertNominalSubtypeRustIdentity(receipt, { ...pkg, [key]: "changed" }, model, "2.36"));
	assert.throws(() => assertNominalSubtypeRustIdentity(receipt, { ...pkg, artifacts: [] }, model, "2.36"));
	assert.throws(() => assertNominalSubtypeRustIdentity(receipt, { ...pkg, artifacts: [...pkg.artifacts, ...pkg.artifacts] }, model, "2.36"));
	assert.throws(() => assertNominalSubtypeRustIdentity(receipt, pkg, model, "2.38"));
});

test("nominal Rust loader reconstruction preserves native identities and producer order", () => {
	const file = digit => ({ sha256: digit.repeat(64), bytes: 1 });
	const runtime = { files: { "include/runtime.h": file("1"), "lib/libruntime.so": file("2") } };
	const identity = { runtimeIdentity: sha256(canonicalJson(runtime)), bindingIrSha256: "3".repeat(64) };
	const component = { ...identity, library: "libcomponent.so", nativeLibrary: file("4") };
	const adapter = { ...identity, library: "libadapter.so"
		, componentReceiptSha256: sha256(canonicalJson(component))
		, files: { "lib/libadapter.so": file("5") } };
	const receipt = { ...identity, component: { id: "synthetic" }
		, files: { "native/linux-x64/libruntime.so": file("2")
			, "native/linux-x64/libcomponent.so": file("4")
			, "native/linux-x64/libadapter.so": file("5") } };
	const evidence = nominalSubtypeRustNativeEvidence(receipt, component, adapter, runtime);
	assert.deepEqual(Object.keys(evidence.libraries), ["libadapter.so", "libcomponent.so", "libruntime.so"]);
	const reordered = { ...receipt, files: Object.fromEntries(Object.entries(receipt.files).reverse()) };
	assert.equal(JSON.stringify(nominalSubtypeRustNativeEvidence(reordered, component, adapter, runtime)), JSON.stringify(evidence));
	const bad = structuredClone(receipt); bad.files["native/linux-x64/libcomponent.so"].sha256 = "0".repeat(64);
	assert.throws(() => nominalSubtypeRustNativeEvidence(bad, component, adapter, runtime));
	assert.throws(() => nominalSubtypeRustNativeEvidence(receipt, { ...component, runtimeIdentity: "0".repeat(64) }, adapter, runtime));
	assert.throws(() => nominalSubtypeRustNativeEvidence(receipt, component, { ...adapter, componentReceiptSha256: "0".repeat(64) }, runtime));
});

test("nominal Rust evidence freezes transitive generator modules and its dependency lock", async t => {
	const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const generator = await nominalSubtypeRustGenerator(revision);
	assert.ok(generator.paths.includes("src/backends/rust/copied-values.mjs"));
	assert.ok(generator.paths.includes("src/backends/rust/copied-conversions.mjs"));
	assert.ok(generator.paths.includes("src/backends/rust/dependencies.lock"));
	assert.equal(new Set(generator.paths).size, generator.paths.length);
	assert.equal(generator.lock, await copiedRustLock("nominalsubtypes", "1.0.0"));
	for(const mode of nominalSubtypeRustModes)
		assert.deepEqual(generator.generateCopiedRustPackage(nominalSubtypeInstalledReview(mode === "result-only")), generateCopiedRustPackage(nominalSubtypeInstalledReview(mode === "result-only")));
	const path = "src/backends/rust/dependencies.lock", original = nominalSubtypeRustOriginal(revision, path);
	original.fill(0); assert.notEqual(nominalSubtypeRustOriginal(revision, path)[0], 0);
	for(const invalid of ["HEAD", revision.slice(0, 7), "-".repeat(40)])
		assert.throws(() => nominalSubtypeRustOriginal(invalid, path));
	for(const invalid of ["/tmp/source", "src/../package.json", "build/model.json"])
		assert.throws(() => nominalSubtypeRustOriginal(revision, invalid));
	t.diagnostic(`${generator.paths.length - 1} frozen generator modules and one lock resource`);
});

test("nominal Rust API probes reject unrelated compiler failures and incomplete diagnostics", () => {
	const message = { reason: "compiler-message"
		, message: { level: "error", code: { code: "E0432" }
		, message: nominalSubtypeRustInputNames.map(name => `\`nominalsubtypes::${name}\``).join(", ")
		, spans: [{ is_primary: true, file_name: "src/bin/api-probe.rs" }] } };
	const failure = record => ({ code: 101, stderr: ""
		, stdout: [record, { reason: "build-finished", success: false }].map(JSON.stringify).join("\n") });
	assert.deepEqual(checkNominalSubtypeRustApiProbe(failure(message), "result-only").absent, nominalSubtypeRustInputNames);
	const good = { code: 0, stderr: "", stdout: JSON.stringify({ reason: "build-finished", success: true }) };
	assert.deepEqual(checkNominalSubtypeRustApiProbe(good, "full").present, nominalSubtypeRustInputNames);
	const mutations = [item => { item.message.code.code = "E0308"; }
		, item => { item.message.spans[0].file_name = "dependency.rs"; }
		, item => { item.message.spans = []; }
		, item => { item.message.level = "warning"; }
		, item => { item.message.message += ", `nominalsubtypes::unexpected`"; }
		, item => { item.message.message = item.message.message.replace("::first`", "::firstExtra`"); }];
	for(const change of mutations)
	{
		const bad = structuredClone(message); change(bad);
		assert.throws(() => checkNominalSubtypeRustApiProbe(failure(bad), "result-only"));
	}
	for(const mode of nominalSubtypeRustModes)
	{
		assert.throws(() => checkNominalSubtypeRustApiProbe({ ...good, code: 1 }, mode));
		assert.throws(() => checkNominalSubtypeRustApiProbe({ ...good, stdout: "{}" }, mode));
	}
	assert.throws(() => checkNominalSubtypeRustApiProbe(good, "unknown"));
});

test("nominal Rust vendored closure rejects missing, changed, extra and linked files", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-rust-dependencies-"));
	t.after(() => rm(root, { recursive: true }));
	const source = "// synthetic dependency\n", checksum = canonicalJson({ package: "a".repeat(64), files: { "lib.rs": sha256(source) } });
	const pkg = { directory: "fixture-1.0.0", checksum: "a".repeat(64), files: 1, manifestSha256: sha256(checksum) };
	const dependencies = { packages: [pkg] }, path = join(root, pkg.directory);
	await saveLakeFile(path, "lib.rs", source); await saveLakeFile(path, ".cargo-checksum.json", checksum);
	const original = await verifyNominalSubtypeRustDependencies(root, dependencies);
	for(const key of Object.keys(pkg))
		await assert.rejects(verifyNominalSubtypeRustDependencies(root, { packages: [{ ...pkg, [key]: "changed" }] }));
	await saveLakeFile(path, "lib.rs", "changed"); await assert.rejects(verifyNominalSubtypeRustDependencies(root, dependencies));
	await saveLakeFile(path, "lib.rs", source);
	await saveLakeFile(path, "extra.rs", source); await assert.rejects(verifyNominalSubtypeRustDependencies(root, dependencies));
	await rm(join(path, "extra.rs"));
	await rm(join(path, "lib.rs")); await assert.rejects(verifyNominalSubtypeRustDependencies(root, dependencies));
	await symlink(".cargo-checksum.json", join(path, "lib.rs")); await assert.rejects(verifyNominalSubtypeRustDependencies(root, dependencies));
	await rm(join(path, "lib.rs")); await saveLakeFile(path, "lib.rs", source);
	await saveLakeFile(path, ".cargo-checksum.json", checksum + " "); await assert.rejects(verifyNominalSubtypeRustDependencies(root, dependencies));
	await saveLakeFile(path, ".cargo-checksum.json", checksum);
	assert.deepEqual(await verifyNominalSubtypeRustDependencies(root, dependencies), original);
	assert.equal(await readFile(join(path, "lib.rs"), "utf8"), source);
});
