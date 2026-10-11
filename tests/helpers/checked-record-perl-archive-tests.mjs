/**
 * Check complete original Perl installed evidence and refuse missing or altered records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { checkedRecordPerlArchiveRoot, readCheckedRecordPerlArchive } from "./checked-record-perl-archive.mjs";
import { assertCheckedRecordPerlRecords } from "./checked-record-perl-records.mjs";
import { assertCheckedRecordPerlCiRecords, assertCheckedRecordPerlCiTap, parseCheckedRecordPerlCiArgs } from "./checked-record-perl-ci-report.mjs";

test("Perl checked-record archive retains all four installed routes, four ABIs and both modes", async () => {
	const { index, files, reports } = await readCheckedRecordPerlArchive();
	assert.equal(index.artifacts.length, 489); assert.equal(files.size, 489);
	assert.deepEqual(reports.map(report => report.reports.map(item => item.checks)),
		[9024, 9024, 1002, 1002].map(checks => Array(8).fill(checks)));
	for(const report of reports) for(const item of report.reports)
	{
		assert.equal(item.dispatch.observed, false); assert.equal(item.repeatedRuns, 2);
		assert.equal(item.relocatedInstallation, true);
	}
});

test("Perl installed archive refuses every missing, resized and same-size corrupted original", async t => {
	const { files } = await readCheckedRecordPerlArchive();
	const originals = new Map([...files].map(([path, bytes]) => [`${checkedRecordPerlArchiveRoot}/${path}`, bytes]));
	originals.set(`${checkedRecordPerlArchiveRoot}/index.json`, await readFile(`${checkedRecordPerlArchiveRoot}/index.json`));
	let rejected = 0;
	for(const [path, bytes] of originals)
	{
		await assert.rejects(readCheckedRecordPerlArchive(async candidate => {
			if(candidate === path) throw Object.assign(new Error(`Missing ${path}`), { code: "ENOENT" });
			return originals.get(candidate);
		}), { code: "ENOENT" });
		rejected++;
		assert.ok(bytes.length); const sameSize = Buffer.from(bytes); sameSize[0] ^= 1;
		for(const changed of [Buffer.concat([bytes, Buffer.from("\n")]), sameSize])
		{
			await assert.rejects(() => readCheckedRecordPerlArchive(candidate => candidate === path ? changed : originals.get(candidate)), undefined, path);
			rejected++;
		}
	}
	assert.equal(rejected, 1470); t.diagnostic(`${rejected} original-file controls rejected`);
});

test("Perl installed report validation independently rejects coordinated false acceptance claims", async t => {
	const { files, index } = await readCheckedRecordPerlArchive();
	let rejected = 0;
	for(const run of index.runs)
	{
		const prefix = run.route + "/";
		const originals = new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
		const refuse = async mutate => {
			const changed = new Map(originals); mutate(changed);
			await assert.rejects(() => assertCheckedRecordPerlRecords({ route: run.route, read: path => changed.get(path) }));
			rejected++;
		};
		const json = (map, path, mutate) => {
			const value = JSON.parse(map.get(path)); mutate(value);
			map.set(path, Buffer.from(canonicalJson(value)));
		};
		for(const mutate of [
			r => { r.configurations.pop(); }, r => { r.modes.pop(); }
			, r => { r.reports.pop(); }, r => { r.builds.pop(); }
			, r => { r.reproducible = false; }
			, r => { r.sourceRemovedBeforeInstallation = false; }
			, r => { r.glibcMinimumVersion = "2.99"; }
			, r => { r.interpreters[0].identity.version = "5.40.0"; }
			, r => { r.interpreters[0].identity.useithreads = null; }
			, r => { r.interpreters[0].executableSha256 = "wrong"; }
			, r => { r.builds[1].receiptSha256 = "0".repeat(64); }
		]) await refuse(map => json(map, "report.json", mutate));
		const base = "5.36.3-threaded/prebuilt-only/";
		const mutations = [r => { r.checks--; }
			, r => { r.dispatch.observed = true; }
			, r => { r.repeatedRuns = 1; }
			, r => { r.installationCCompilerAvailable = true; }];
		for(const field of ["offlineInstall", "compilerFreeExecution", "leanCompilerUnavailable", "extractedDistributionsRemoved", "nativePayloadUnchanged", "installedBytesUnchanged", "relocatedInstallation", "compilerFreeReplay", "sourceUnchangedAfterReplay"])
			mutations.push(r => { r[field] = false; });
		for(const mutate of mutations) await refuse(map => {
			json(map, "report.json", r => mutate(r.reports[0]));
			json(map, base + "report.json", mutate);
		});
		for(const path of ["consumer.pl", base + "first.stdout", base + "repeated.stdout", base + "runtime-source.xs", base + "component-source.xs"])
			await refuse(map => map.set(path, Buffer.concat([map.get(path), Buffer.from("\nchanged\n")])));
		for(const path of ["build-0/model.json", "build-0/expected.json", "build-0/lean-bridge.exports.json", base + "runtime-manifest.json", base + "component-manifest.json", base + "runtime-install-receipt.json", base + "component-install-receipt.json", base + "installed-files.json"])
			await refuse(map => map.delete(path));
	}
	assert.equal(rejected, 148); t.diagnostic(`${rejected} semantic controls rejected`);
});

test("Perl CI checker refuses skipped or substituted TAP and cannot relabel the recorded package floor", async () => {
	const { files, index } = await readCheckedRecordPerlArchive();
	for(const { route } of index.runs)
	{
		const tap = files.get(`${route}/run.tap`).toString();
		assertCheckedRecordPerlCiTap(tap, route);
		for(const changed of [tap.replace("# fail 0", "# fail 1")
			, tap.replace("# skipped 0", "# skipped 1")
			, tap.replace("# cancelled 0", "# cancelled 1"), tap + "# tests 1\n"
			, tap.replace("ok 1 - ", "not ok 1 - ")
			, tap.replace("1..1", "1..0")
			, tap.replace("# todo 0", "# todo 1")
			, tap.replaceAll(route, "invented-route")
			, tap + "Bail out!\n", tap + "# SKIP\n"
			, tap.replace("TAP version 13\n", "")])
			assert.throws(() => assertCheckedRecordPerlCiTap(changed, route));
		await assert.rejects(() => assertCheckedRecordPerlCiRecords({ route, tap
			, glibc: "2.38"
			, read: path => files.get(`${route}/${path}`) }));
		const args = ["--route", route, "--directory", "records", "--tap", "run.tap", "--glibc", "2.36"];
		assert.deepEqual(parseCheckedRecordPerlCiArgs(args), { route, directory: "records", tap: "run.tap", glibc: "2.36" });
		for(const changed of [[], args.slice(0, -2), [...args, "--unknown", "x"]
			, args.map(value => value === "--tap" ? "--directory" : value)
			, args.map(value => value === "2.36" ? "2.99" : value)
			, args.map(value => value === route ? "unknown" : value)
			, args.map(value => value === "records" ? "" : value)])
			assert.throws(() => parseCheckedRecordPerlCiArgs(changed));
	}
});
