/**
 * Bind checked-record coverage to the six immutable C/C++ and npm selections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertCheckedRecordEvidenceExecution, assertCheckedRecordEvidenceReport, checkedRecordEvidenceDirectory, checkedRecordEvidenceRevision } from "./checked-record-evidence.mjs";

export const checkedRecordReceiptPath = `${checkedRecordEvidenceDirectory}/receipt.json`;
export const checkedRecordPromotionEnvironment = {
	"c-cpp": "Local runner measured Node 22.23.3, Lean 4.32.2, cc 12.2.0 and host glibc 2.36. The package declares the default glibc minimum 2.38 because the floor override was unset; this is not execution on a measured 2.38 host. C/C++ callers still compile with the system compiler after removal of Lean and producer tools from PATH."
	, npm: "Local runner measured Node 22.23.3, Lean 4.32.2, npm 10.9.9 and TypeScript 5.9.3. Installation and Node execution use a Node-only PATH; TypeScript compilation uses the checkout's tsc with strict true and skipLibCheck false. No browser or hosted CI execution is inferred."
};
const original = async file => {
	const bytes = await readFile(file.path);
	assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
	return bytes.toString();
};

/** Return exact commands, artifacts, execution scopes and provenance for the archived selections. */
export const checkedRecordPromotionReferences = async () => {
	const bytes = await readFile(checkedRecordReceiptPath);
	assert.equal(sha256(bytes), "ddbd22ea869ab7f82c40ed6fa4c158a68f262449a865e12dae900a227dec736f");
	const receipt = JSON.parse(bytes);
	assert.equal(receipt.revision, checkedRecordEvidenceRevision);
	for(const file of receipt.sourceFiles)
		assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)), file.sha256, file.path);
	const originals = new Map();
	for(const file of receipt.artifacts) originals.set(file.path, await original(file));
	const references = [];
	for(const host of receipt.hosts)
	{
		const queue = originals.get(host.queue.path);
		const taps = Object.fromEntries(Object.entries(host.taps).map(([route, file]) => [route, originals.get(file.path)]));
		assertCheckedRecordEvidenceExecution(host.id, queue, taps);
		for(const run of receipt.runs.filter(item => item.host === host.id))
		{
			const report = JSON.parse(originals.get(run.report.path));
			assertCheckedRecordEvidenceReport(report, run);
			const prefix = `${run.route} command: `;
			const command = queue.split("\n").find(line => line.startsWith(prefix)).slice(prefix.length);
			const artifacts = host.id === "c-cpp" ? Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 }))
				: [report.receipt.package, report.receipt.runtime].map(item => ({ path: item.archive, sha256: item.sha256 }));
			references.push({ id: `checked-record-${run.id}-installed`
				, host: host.id, route: run.route
				, sourcePath: run.route === "reviewed" ? "reviewed-ir" : "ordinary-source"
				, profiles: host.id === "c-cpp" ? ["c", "cpp"] : ["node-javascript", "node-typescript"]
				, positions: run.route === "result-only" ? ["result"] : ["parameter", "result"]
				, revision: receipt.revision, report: run.report
				, receiptPath: checkedRecordReceiptPath
				, executionFiles: [host.queue, ...Object.values(host.taps)]
				, command, artifacts
				, checks: report.reports ? Object.fromEntries(report.reports.map(item => [item.profile, item.checks])) : { npm: report.checks }
				, rejections: report.rejections ?? null
				, environment: checkedRecordPromotionEnvironment[host.id]
				, dispatch: host.id === "c-cpp" && run.route !== "result-only"
					? "Nine C interposer rows measure public entry, pre-validator, constructor, adapter and source separately. C++ dispatch and resident memory are unmeasured."
					: "Dispatch is unmeasured in this selection." });
		}
	}
	assert.equal(references.length, 6);
	return references;
};
