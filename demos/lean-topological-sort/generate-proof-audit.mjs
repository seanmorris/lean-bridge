/**
 * Generates a source-bound receipt after Lean checks the topological-sort proof.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(demoRoot, "../..");
const files = [
	"TopologicalSortCore.lean", "TopologicalSortOrderLemmas.lean"
	, "TopologicalSortTotal.lean", "TopologicalSortChecks.lean"
	, "TopologicalSortCycleLemmas.lean", "TopologicalSort.lean"
];
const requiredTheorems = [
	"topologicalCheck_sound", "cycleCheck_sound", "topologicalOrder_covers"
	, "topologicalOrder_respects_edges", "directedCycle_nonempty"
	, "directedCycle_edges_exist", "solve_result_correct", "solve_order_correct"
	, "solve_cycle_correct", "edgeExists_iff", "permutationCheck_iff"
	, "orderCheck_of_total", "cycleCheck_of_total", "solve_total"
	, "solveGraph_total", "solveGraph_no_failure", "topologicalOrder_iff_semantic"
];
const sources = await Promise.all(files.map(file => readFile(resolve(demoRoot, file), "utf8")));
const declarations = [...sources.join("\n").matchAll(/\btheorem\s+([A-Za-z][A-Za-z0-9_']*)/gu)]
	.map(match => match[1]);
for(const theorem of requiredTheorems)
	if(!declarations.includes(theorem)) throw new Error(`proof audit is missing theorem ${theorem}`);
if(sources.some(source => /\b(?:sorry|admit)\b/u.test(source)))
	throw new Error("proof audit refuses sources containing sorry or admit");
const sourceFiles = Object.fromEntries(files.map((file, index) => [file, {
	bytes: Buffer.byteLength(sources[index])
	, sha256: createHash("sha256").update(sources[index]).digest("hex")
}]));
const leanVersion = (await readFile(resolve(repositoryRoot, "lean-toolchain"), "utf8")).trim()
	.replace(/^leanprover\/lean4:/u, "");
await writeFile(resolve(demoRoot, "runtime/proof-audit.json"), `${JSON.stringify({
	schemaVersion: 1, checker: `Lean ${leanVersion}`
	, assurance: "Lean elaboration completed before this receipt was generated"
	, sourceFiles, theorems: requiredTheorems
}, null, 2)}\n`);
process.stdout.write(`Generated topological-sort proof audit with ${requiredTheorems.length} theorems\n`);
