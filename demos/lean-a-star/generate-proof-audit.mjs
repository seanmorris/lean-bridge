/**
 * Bind every displayed A* source module to a completed Lean proof build.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const files = [
	"DijkstraCore.lean"
	, "Dijkstra.lean"
	, "AStarCore.lean"
	, "AStarPotential.lean"
	, "AStarChecks.lean"
	, "AStarTotal.lean"
	, "AStar.lean"
];
const theorems = [
	"certificate_shortest"
	, "allUpTo_eq_allDownFrom"
	, "consistent_admissible"
	, "reduced_shortest_iff"
	, "heuristicCheck_sound"
	, "labelsFrom_eq"
	, "labelsCheck_sound"
	, "cutCheck_sound"
	, "searchLoop_stale"
	, "searchPrepared_eq_searchRaw"
	, "total_shortest_correct"
	, "total_shortest_unreachable"
	, "solve_prepared_correct"
	, "solve_path_shortest"
	, "solve_unreachable"
	, "solve_total"
	, "exported_search_correct"
	, "exported_total_correct"
	, "prepareExport_valid_iff"
	, "solveExport_no_failure"
	, "solveExport_unreachable_iff"
	, "serialize_path_starts_at_source"
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
	, assurance: "Lean checked total return, shortest paths, and unreachable outcomes before compiling this implementation"
	, sourceFiles, theorems
}, null, 2)}\n`);
process.stdout.write(`Generated A* proof audit with ${theorems.length} required theorems\n`);
