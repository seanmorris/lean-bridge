/**
 * Bind complete collision-pair guarantees to their checked Lean source files.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const files = ["SweepSpec.lean", "SweepProofs.lean", "SweepCore.lean", "Sweep.lean"];
const theorems = [
	"activeInvariant_step"
	, "keepActive_exact_overlap"
	, "expired_never_returns"
	, "sweepPairs_exact"
	, "sweepPairs_axis_exact"
	, "sweepPairs_axis_nodup"
	, "filtered_sweep_box_exact"
	, "sweepPairs_length_le"
	, "sweepPairs_length_choose"
	, "sortEntries_perm"
	, "sortEntries_sorted"
	, "sweepArray_refines"
	, "candidatePairs_refines"
	, "prepared_unique"
	, "prepared_valid_axis"
	, "prepared_lookup"
	, "prepare_exists_iff"
	, "parseEntries_lower"
	, "parseEntries_upper"
	, "overlapCheck_iff"
	, "solveFused_refines"
	, "pruneEmit_refines"
	, "sweepPruned_refines"
	, "sweepFused_eq_sweepPruned"
	, "solvePrepared_eq_solveFused"
	, "solve_total"
	, "solve_candidates_exact"
	, "solve_candidates_unique"
	, "solve_overlaps_exact"
	, "solve_overlaps_subset"
	, "solve_overlaps_unique"
	, "solve_pair_canonical_bounded"
	, "solve_candidate_count_choose"
	, "decode_serialize"
	, "exported_candidates_exact"
	, "exported_overlaps_exact"
	, "exported_candidates_unique"
	, "exported_overlaps_unique"
	, "solveExport_words_bounded"
	, "solveExport_capacity_bounded"
	, "solveExport_size_bounded"
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
if(/\b(?:sorry|admit|axiom|unsafe|native_decide|implemented_by|extern)\b/u.test(combined))
	throw new Error("Proof source contains an unchecked declaration or native replacement");
const version = (await readFile(resolve(root, "../../lean-toolchain"), "utf8")).trim()
	.replace(/^leanprover\/lean4:/u, "");
await writeFile(resolve(root, "runtime/proof-audit.json"), `${JSON.stringify({
	schemaVersion: 1, checker: `Lean ${version}`
	, assurance: "Lean checked complete unique projection candidates and exact AABB overlaps before compilation"
	, sourceFiles, theorems
}, null, 2)}\n`);
process.stdout.write(`Generated sweep-and-prune proof audit with ${theorems.length} required theorems\n`);
