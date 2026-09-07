/**
 * Bind the displayed SCC sources to a completed Lean proof build.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const files = [
	"TarjanCore.lean"
	, "TarjanReachability.lean"
	, "TarjanCertificate.lean"
	, "TarjanChecks.lean"
	, "TarjanTotal.lean"
	, "Tarjan.lean"
];
const theorems = [
	"certificate_partition"
	, "partition_maximal"
	, "condensation_acyclic"
	, "condensation_edge_projects"
	, "condensation_walk_reachable"
	, "edgeWitness_sound"
	, "descendingFrom_sound"
	, "certificateCheck_sound"
	, "transitiveClosure_correct"
	, "totalLabels_correct"
	, "discover_assigns"
	, "discover_preserves_existing_index"
	, "discover_preserves_stack_uniqueness"
	, "lowerLink_nonincreasing"
	, "lowerLink_preserves_index_bound"
	, "lowerLink_preserves_reachable_witness"
	, "popThrough_partition"
	, "popThrough_contains_root"
	, "popThrough_preserves_uniqueness"
	, "solve_prepared_correct"
	, "solve_same_iff"
	, "solve_maximal"
	, "solve_total"
	, "prepareExport_valid_iff"
	, "serialize_label"
	, "solveExport_no_failure"
	, "exported_same_iff"
	, "exported_total_same_iff"
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
	, assurance: "Lean checked total return, exact strongly connected components, and acyclic condensation before compiling this implementation"
	, sourceFiles, theorems
}, null, 2)}\n`);
process.stdout.write(`Generated SCC proof audit with ${theorems.length} required theorems\n`);
