#!/usr/bin/env node
/**
 * Write the deterministic retained proof-erasure evidence ledger.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	auditProofErasureEvidence
	, proofErasureEvidenceAuditReport
	, proofErasureEvidenceAuditReportPath
} from "../tests/helpers/proof-erasure-evidence-audit.mjs";
import { readTypeSurfaceContracts } from "../tests/helpers/type-surface-contracts.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-proof-erasure-evidence-audit.mjs");
const inventory = JSON.parse(await readFile(
	"docs/type-surface.v1.json", "utf8"));
const report = proofErasureEvidenceAuditReport(
	auditProofErasureEvidence(inventory, await readTypeSurfaceContracts()));
await writeFile(proofErasureEvidenceAuditReportPath
	, canonicalJson(report), { flag: "wx" });
process.stdout.write(`${report.counts.exactBindings} exact bindings; `
	+ `${report.counts.residual} residual cells.\n`);
