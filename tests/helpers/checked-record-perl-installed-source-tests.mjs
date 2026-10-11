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
import { checkedRecordPerlConfigurations, checkedRecordPerlExecutables, checkedRecordPerlInstalledFiles, assertCheckedRecordPerlIdentity } from "./checked-record-perl-install.mjs";
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
