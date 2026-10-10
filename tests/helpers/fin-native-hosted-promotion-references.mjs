/**
 * Select exact hosted Fin product and field reports without borrowing host or runtime coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinHostedArchive, finHostedDirectory, finHostedFamilies, finHostedReceiptSha256, finHostedRevision } from "./fin-native-hosted-evidence.mjs";
import { hostedArrayDirectory } from "./generic-record-array-hosted-evidence.mjs";

export const finHostedPromotionReceipt = finHostedDirectory + "/receipt.json";

/**
 * Authenticate all 78 reports before producing references for either source route.
 * Package archive bytes are not retained in the hosted ZIPs; their original digests are.
 */
export const finHostedPromotionReferences = async () => {
	const bytes = await readFile(finHostedPromotionReceipt);
	assert.equal(sha256(bytes), finHostedReceiptSha256);
	const receipt = JSON.parse(bytes);
	assert.deepEqual(await assertFinHostedArchive(receipt), { reports: 78, observations: 90, sources: 75 });
	const references = [];
	for(const item of receipt.reports)
	{
		const { group, family, route, suffix } = item.selection;
		const reportBytes = await readFile(item.path);
		assert.equal(sha256(reportBytes), item.sha256);
		const report = JSON.parse(reportBytes);
		const profiles = report.reports.map(row => row.profile), fixture = finHostedFamilies[family];
		const python = group === "python" ? suffix === "python312" ? "3.12.15" : "3.11.17" : null;
		const perlAbi = group.startsWith("perl-") ? group.slice("perl-".length) : null;
		const id = ["fin-hosted", group, suffix, family, route, "installed"].join("-").replaceAll(".", "-");
		const invocation = "LEAN_BRIDGE_FIN_" + fixture.variable + "_PROFILES=" + profiles.join(",")
			+ " LEAN_BRIDGE_REVIEWED_FIN_" + fixture.variable + "_PROFILES=" + profiles.join(",")
			+ " node --test tests/" + fixture.directory + ".test.mjs";
		const command = suffix === "python312"
			? 'LEAN_BRIDGE_PYTHON="/opt/hostedtoolcache/Python/3.12.15/x64/bin/python" LEAN_BRIDGE_FIN_'
				+ fixture.variable + "_REPORT=build/" + fixture.directory + "/python312.json LEAN_BRIDGE_REVIEWED_FIN_"
				+ fixture.variable + "_REPORT=build/" + fixture.directory + "/reviewed-python312.json " + invocation
			: invocation;
		const logPath = hostedArrayDirectory + "/job-" + item.jobId + ".log";
		assert.ok((await readFile(logPath, "utf8")).includes(command));
		const environment = "Hosted ubuntu-24.04 job " + item.jobId + " in successful run 37969725049. "
			+ "Configured native package glibc floor 2.38, without a local override; host glibc was not measured."
			+ (python ? " Python " + python + " has its own ordered command and unskipped execution." : "")
			+ (perlAbi ? " Perl ABI " + perlAbi + " is selected by the job's CORPUS_PERL_CONFIGURATION and LEAN_BRIDGE_CORPUS_PERL." : "")
			+ " Source-free excludes Lean and producer tools; consumers may still use their own language compiler.";
		const executionPaths = [
			finHostedPromotionReceipt, receipt.archive.path, item.path, logPath
			, hostedArrayDirectory + "/" + group + ".zip"
			, hostedArrayDirectory + "/jobs.json"
			, hostedArrayDirectory + "/artifacts.json"
			, hostedArrayDirectory + "/run-37969725049.json"
		];
		references.push({
			id, profiles, family
			, sourcePath: route === "reviewed" ? "reviewed-ir" : "ordinary-source"
			, revision: finHostedRevision, selection: item.selection
			, python, perlAbi, environment, command
			, checks: item.checks, report: { path: item.path, sha256: item.sha256 }
			, dispatch: Object.fromEntries(report.reports.map(row =>
				[row.profile, Object.hasOwn(row, "dispatch") ? "measured" : "unmeasured"]))
			, executionFiles: await Promise.all(executionPaths.map(async path =>
				({ path, sha256: sha256(await readFile(path)) })))
			, artifacts: Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 }))
		});
	}
	assert.equal(references.length, 78);
	assert.equal(new Set(references.map(item => item.id)).size, 78);
	return references;
};
