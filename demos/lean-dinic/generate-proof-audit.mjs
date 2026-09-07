/**
 * Bind max-flow sources to the completed Lean proof build.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const files = [
	"FlowSpec.lean"
	, "FlowProofs.lean"
	, "FlowCertificate.lean"
	, "FlowPaths.lean"
	, "FlowAugment.lean"
	, "FlowDuality.lean"
	, "FlowReference.lean"
	, "DinicCore.lean"
	, "Dinic.lean"
];
const theorems = [
	"flow_cut_upper_bound"
	, "matching_flow_cut_optimal"
	, "feasibleCheck_iff"
	, "cutCheck_iff"
	, "certificateCheck_sound"
	, "referenceFlow_maximum"
	, "referenceCut_minimum"
	, "referenceSolve_correct"
	, "solve_prepared_correct"
	, "solve_maximum_flow"
	, "solve_minimum_cut"
	, "solve_total"
	, "word_roundtrip"
	, "serialize_size"
	, "solveExport_no_failure"
	, "findPath_fits"
	, "augmentArc_pair_sum"
	, "augmentArc_positive_progress"
	, "matching_cut_edges"
	, "exported_optimal"
	, "exported_total_optimal"
	, "maximumFlow_no_residual_path"
	, "maximumFlow_minimumCut_equal"
	, "referenceSolve_certificate"
	, "exported_flow_cut_equal"
	, "exported_certificate"
	, "findPath_saturates"
	, "solveExport_words_bounded"
	, "solveTotalExport_words_bounded"
	, "prepare_residual_shape"
	, "totalCapacity_javascript_exact"
];
const sourceFiles = {};
let combined = "";
for(const file of files)
{
	const source = await readFile(resolve(root, file), "utf8");
	combined += `\n${source}`;
	sourceFiles[file] = { bytes: Buffer.byteLength(source)
		, sha256: createHash("sha256").update(source).digest("hex") };
}
const declarations = [...combined.matchAll(/\btheorem\s+([A-Za-z][A-Za-z0-9_']*)/gu)].map(match => match[1]);
for(const theorem of theorems)
	if(!declarations.includes(theorem)) throw new Error(`Missing required theorem ${theorem}`);
if(/\b(?:sorry|admit|axiom)\b/u.test(combined)) throw new Error("Proof source contains an unchecked declaration");
const version = (await readFile(resolve(root, "../../lean-toolchain"), "utf8")).trim()
	.replace(/^leanprover\/lean4:/u, "");
await writeFile(resolve(root, "runtime/proof-audit.json"), `${JSON.stringify({
	schemaVersion: 1, checker: `Lean ${version}`
	, assurance: "Lean checked feasible maximum flow, minimum cut, and total return before compiling this implementation"
	, sourceFiles, theorems
}, null, 2)}\n`);
process.stdout.write(`Generated max-flow proof audit with ${theorems.length} required theorems\n`);
