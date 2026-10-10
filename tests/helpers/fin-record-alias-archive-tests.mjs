/**
 * Retain both installed alias routes and reject changed evidence or weakened reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertFinRecordAliasArchive, finRecordAliasArchiveRoot } from "./fin-record-alias-archive.mjs";
import { assertFinRecordAliasReport } from "./fin-record-alias-report.mjs";

const digest = "aa5edf80c2ef174184ce41e9185192b429d8560ae4462fe7d24f54b943d8a76a";

test("installed record alias originals preserve both source routes and exact package receipts", async () => {
	await assertFinRecordAliasArchive(digest);
});

test("record alias archive rejects changed original records and selected source bytes", async () => {
	const { index } = await assertFinRecordAliasArchive(digest);
	for(const path of ["index.json", ...index.files.map(file => file.path)])
		await assert.rejects(() => assertFinRecordAliasArchive(digest, async filename => {
			const bytes = await readFile(filename);
			return filename === `${finRecordAliasArchiveRoot}/${path}` ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}), path);
});

test("record alias reports reject lost hosts, bounds, caller identities, package identities and isolation", async () => {
	const { files, start } = await assertFinRecordAliasArchive(digest);
	for(const [name, route] of [["ordinary.json", "ordinary-source"], ["reviewed.json", "reviewed-ir"]])
	{
		const original = JSON.parse(files.get(name));
		const rejects = change => {
			const report = structuredClone(original); change(report);
			assert.throws(() => assertFinRecordAliasReport(report, route, start.sources));
		};
		for(const key of Object.keys(original)) rejects(report => { delete report[key]; });
		for(const index of [0, 1])
		{
			for(const key of Object.keys(original.reports[index])) rejects(report => { delete report.reports[index][key]; });
			for(const key of ["bindingIrSha256", "consumerSha256", "modelSha256", "receiptSha256", "sourceTreeSha256"])
				rejects(report => { report.reports[index][key] = "0".repeat(64); });
			for(const key of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation"])
				rejects(report => { report.reports[index][key] = false; });
			rejects(report => { report.reports[index].checks--; });
			rejects(report => { report.reports[index].dispatch = "measured"; });
			rejects(report => { report.reports[index].refinements["FinRecords.bump"].result.arguments[0].bound = "6"; });
			rejects(report => { report.reports[index].packages[0].artifacts[0].bytes++; });
			rejects(report => { report.reports[index].packages[0].runtimeIdentity = "0".repeat(64); });
			if(route === "reviewed-ir") rejects(report => { report.reports[index].reviewedSourceSha256 = "0".repeat(64); });
		}
		rejects(report => { report.reproducible = false; });
		rejects(report => { report.reports.pop(); });
		rejects(report => { report.reports[1] = structuredClone(report.reports[0]); });
		rejects(report => { report.archives = {}; });
		assert.throws(() => assertFinRecordAliasReport(original, "unrecognized-route", start.sources));
	}
});
