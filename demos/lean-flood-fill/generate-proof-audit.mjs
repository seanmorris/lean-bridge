/**
 * Generates the browser receipt after Lean checks the flood-fill proofs.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(demoRoot, "../..");
const files = ["FloodFillCore.lean", "FloodFill.lean"];
const requiredTheorems = [
	"walk_rcons"
	, "closureFrom_adjacentFrom"
	, "closureCheck_edge"
	, "parentCheck_reachable"
	, "closureCheck_complete"
	, "floodCertificate_exact"
	, "floodFillCsr_correct"
	, "reachable_capabilities_mono"
	, "capabilityLoop_extends"
	, "capabilityLoop_closed"
	, "capabilityLoop_least"
	, "capabilityClosureCsr_reachable"
	, "capabilityClosureCsr_least"
	, "capabilityClosureCsr_correct"
];
const sources = await Promise.all(files.map(file => readFile(resolve(demoRoot, file), "utf8")));
const declarations = [...sources.join("\n").matchAll(/\btheorem\s+([A-Za-z][A-Za-z0-9_']*)/gu)]
	.map(match => match[1]);
for(const theorem of requiredTheorems)
{
	if(!declarations.includes(theorem)) throw new Error(`proof audit is missing theorem ${theorem}`);
}
if(sources.some(source => /\b(?:sorry|admit)\b/u.test(source)))
{
	throw new Error("proof audit refuses sources containing sorry or admit");
}
const sourceFiles = Object.fromEntries(files.map((file, index) => [file, {
	bytes: Buffer.byteLength(sources[index])
	, sha256: createHash("sha256").update(sources[index]).digest("hex")
}]));
const leanVersion = (await readFile(resolve(repositoryRoot, "lean-toolchain"), "utf8")).trim()
	.replace(/^leanprover\/lean4:/u, "");
await writeFile(resolve(demoRoot, "runtime/proof-audit.json"), `${JSON.stringify({
	schemaVersion: 1
	, checker: `Lean ${leanVersion}`
	, assurance: "Lean elaboration completed before this receipt was generated"
	, sourceFiles
	, theorems: requiredTheorems
}, null, 2)}\n`);
process.stdout.write(`Generated flood-fill proof audit with ${requiredTheorems.length} theorems\n`);
