/**
 * Refuse ambiguous Perl acceptance selections before an expensive build starts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlExecutables, checkedRecordPerlInstalledFiles, assertCheckedRecordPerlIdentity, assertCheckedRecordPerlPackageIdentity } from "./checked-record-perl-install.mjs";
import { assertCheckedRecordPerlRecords } from "./checked-record-perl-records.mjs";

test("installed Perl checked-record selection cannot silently drop or alias an ABI", () => {
	const selected = checkedRecordPerlExecutables();
	assert.deepEqual(Object.keys(selected), checkedRecordPerlConfigurations);
	assert.deepEqual(checkedRecordPerlExecutables(JSON.stringify(selected)), selected);
	for(const mutate of [value => { delete value[checkedRecordPerlConfigurations[0]]; }
		, value => { value.extra = "/foreign/perl"; }
		, value => { value[checkedRecordPerlConfigurations[0]] = value[checkedRecordPerlConfigurations[1]]; }
		, value => { value[checkedRecordPerlConfigurations[0]] = "relative/perl"; }
		, value => { value[checkedRecordPerlConfigurations[0]] = null; }]) {
		const changed = structuredClone(selected); mutate(changed);
		assert.throws(() => checkedRecordPerlExecutables(JSON.stringify(changed)));
		}
	for(const value of ["null", "[]", "{}", "not-json"]) assert.throws(() => checkedRecordPerlExecutables(value));
});

test("Perl identity validation checks actual Config instead of trusting a configuration label", () => {
	for(const configuration of checkedRecordPerlConfigurations)
	{
		const threaded = configuration.endsWith("-threaded");
		const identity = {
			version: configuration.split("-")[0], archname: "x86_64-linux"
			, useithreads: threaded ? "define" : null
			, usemultiplicity: threaded ? "define" : null
			, ivsize: "8", ptrsize: "8" };
		assertCheckedRecordPerlIdentity(configuration, identity);
		for(const [key, value] of [["version", "5.40.0"], ["archname", "aarch64-linux"], ["ivsize", "4"], ["ptrsize", "4"], ["useithreads", threaded ? null : "define"], ["usemultiplicity", threaded ? null : "define"]])
			assert.throws(() => assertCheckedRecordPerlIdentity(configuration, { ...identity, [key]: value }));
	}
});

test("installed Perl snapshot detects changed bytes and rejects symlinks", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-perl-snapshot-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, "payload"), "original");
	const before = await checkedRecordPerlInstalledFiles(root);
	await writeFile(join(root, "payload"), "changed");
	assert.notDeepEqual(await checkedRecordPerlInstalledFiles(root), before);
	await symlink("payload", join(root, "alias"));
	await assert.rejects(() => checkedRecordPerlInstalledFiles(root), /unsupported native artifact/u);
});

test("Perl package identities distinguish the native runtime from its CPAN binding and reject mixed dependencies", () => {
	const native = "a".repeat(64), binding = "b".repeat(64);
	const runtime = {
		module: "LeanBridge::Runtime", distribution: "LeanBridge-Runtime"
		, version: "0.0021231", runtimeVersion: "0.0021231"
		, nativeRuntimeIdentity: native, runtimeIdentity: binding
		, files: { "lib/LeanBridge/Runtime/runtime.json": native, "lib/LeanBridge/Runtime/binding.json": binding }
	};
	for(const role of ["runtime", "component"])
	{
		const manifest = role === "runtime" ? runtime : { ...runtime
			, module: "LeanBridge::CheckedRecords"
			, distribution: "LeanBridge-CheckedRecords", version: "1.000" };
		const pkg = {
			target: "cpan", ecosystem: "cpan", profile: "native-library-v1", role
			, name: manifest.distribution, version: manifest.version
			, runtimeIdentity: native
			, requires: role === "runtime" ? [] : [{ ecosystem: "cpan", name: runtime.distribution, version: runtime.version }]
		};
		assertCheckedRecordPerlPackageIdentity(manifest, pkg, runtime);
		for(const [field, value] of [["nativeRuntimeIdentity", binding], ["runtimeIdentity", native], ["runtimeVersion", "0.001"], ["module", "LeanBridge::Foreign"], ["distribution", "LeanBridge-Foreign"], ["version", "9.000"]])
			assert.throws(() => assertCheckedRecordPerlPackageIdentity({ ...manifest, [field]: value }, pkg, runtime));
		for(const [field, value] of [["runtimeIdentity", binding], ["target", "npm"], ["ecosystem", "npm"], ["profile", "other"], ["role", "other"], ["name", "LeanBridge-Foreign"], ["version", "9.000"], ["requires", [{}]]])
			assert.throws(() => assertCheckedRecordPerlPackageIdentity(manifest, { ...pkg, [field]: value }, runtime));
		for(const field of ["nativeRuntimeIdentity", "runtimeIdentity", "version"])
			assert.throws(() => assertCheckedRecordPerlPackageIdentity(manifest, pkg, { ...runtime, [field]: "c".repeat(64) }));
		for(const path of Object.keys(runtime.files))
			assert.throws(() => assertCheckedRecordPerlPackageIdentity(manifest, pkg, { ...runtime, files: { ...runtime.files, [path]: "c".repeat(64) } }));
	}
});

test("installed Perl gates reject typos, duplicate routes and absent complete reports", async () => {
	const variables = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_CHECKED_RECORD_PERL") && !key.startsWith("NODE_TEST_")));
	for(const values of [
		{ LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST: "yes" }
		, { LEAN_BRIDGE_CHECKED_RECORD_PERL_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST: "1", LEAN_BRIDGE_CHECKED_RECORD_PERL_ROUTES: "unknown" }
		, { LEAN_BRIDGE_CHECKED_RECORD_PERL_TEST: "1", LEAN_BRIDGE_CHECKED_RECORD_PERL_ROUTES: "ordinary-source,ordinary-source" }
	]) {
		const result = spawnSync(process.execPath, ["--test", "tests/helpers/checked-record-perl-installed-tests.mjs"], { env: { ...variables, ...values }, encoding: "utf8" });
		assert.equal(result.status, 1); assert.match(result.stdout, /not ok/u);
	}
	await assert.rejects(() => assertCheckedRecordPerlRecords({ route: "ordinary-source", read: async () => "{}\n" }));
	const producer = await readFile("tests/helpers/checked-record-perl-installed-tests.mjs", "utf8");
	assert.ok(producer.includes("for(const attempt of [0, 1])"));
	assert.ok(producer.includes("assert.deepEqual(builds[1], builds[0]"));
	assert.ok(producer.includes("await rm(author, { recursive: true })"));
	assert.ok(producer.includes("await assertCheckedRecordPerlRecords"));
});

test("Perl runtime-identity repair preserves the failed producer and both diagnostic install modes", async () => {
	const root = "docs/evidence/checked-record-perl-identity-repair-20261011";
	const bytes = await readFile(join(root, "index.json"));
	assert.equal(sha256(bytes), "a8113b27f2e921938cbd9552bbd9f7083e08a214cc071efc20cffc5b084f8424");
	const index = JSON.parse(bytes);
	assert.equal(index.failedProducer, "64a015549e71af6cec1d9d8e8ad947466b6842a9");
	assert.equal(Object.keys(index.files).length, 36);
	for(const [path, expected] of Object.entries(index.files))
	{
		const artifact = await readFile(join(root, path));
		assert.equal(artifact.length, expected.bytes, path);
		assert.equal(sha256(artifact), expected.sha256, path);
	}
	assert.equal(index.files["original-failed.tap"].sha256, "1a300531b82441d6fdd26e0c46cb18bbaf69fb8f22ff91373cc567c9b32ee5d5");
	const original = await readFile(join(root, "original-failed.tap"), "utf8");
	assert.match(original, /^# pass 0$/mu); assert.match(original, /^# fail 1$/mu);
	for(const mode of ["prebuilt-only", "build-xs"])
	{
		const prefix = join(root, "diagnostic", mode);
		const report = JSON.parse(await readFile(join(prefix, "report.json")));
		assert.equal(report.configuration, "5.36.3-threaded"); assert.equal(report.mode, mode);
		assert.equal(report.checks, 9024); assert.equal(report.dispatch.observed, false);
		for(const name of ["first.stdout", "repeated.stdout"])
			assert.equal(await readFile(join(prefix, name), "utf8"), "checked-record-ok:9024\n");
	}
});
