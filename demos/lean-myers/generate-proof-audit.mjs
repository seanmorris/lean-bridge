/**
 * Bind shortest-edit sources and required guarantees to the completed Lean build.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const files = ["EditSpec.lean", "EditProofs.lean", "EditReference.lean"
	, "ArrayScriptCheck.lean", "ScoreCertificate.lean", "MyersCore.lean"
	, "EditCertificate.lean", "Myers.lean"];
const theorems = [
	"scriptCheck_iff"
	, "replay_reconstructs"
	, "valid_operation_codes"
	, "valid_script_length"
	, "valid_consumption"
	, "valid_cost_counts"
	, "potential_script_bound"
	, "potential_lower_bound"
	, "potential_certifies_optimal"
	, "referenceScript_optimal"
	, "referenceSolve_correct"
	, "referenceSolve_reconstructs"
	, "snake_monotone"
	, "snake_bounded"
	, "bandCheck_bounds"
	, "certificateCheck_sound"
	, "solve_total"
	, "solve_shortest"
	, "solve_reconstructs"
	, "serialize_size"
	, "decode_serialize"
	, "exported_shortest"
	, "exported_total_shortest"
	, "exported_reconstructs"
	, "exported_patch_reconstructs"
	, "exported_zero_iff"
	, "solveExport_words_bounded"
	, "solveTotalExport_words_bounded"
	, "solveExport_size_bounded"
	, "optimal_distance_symmetric"
	, "valid_length_difference"
	, "score_lower_bound"
	, "score_certifies_optimal"
	, "fastScoreCheck_sound"
	, "arrayScriptCheck_equivalent"
	, "arrayScriptCost_eq"
	, "reconstructed_array_eq"
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
	, assurance: "Lean checked exact script reconstruction and minimum insertion/deletion cost before compilation"
	, sourceFiles, theorems
}, null, 2)}\n`);
process.stdout.write(`Generated shortest-edit proof audit with ${theorems.length} required theorems\n`);
