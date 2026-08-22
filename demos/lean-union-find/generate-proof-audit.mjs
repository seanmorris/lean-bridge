/**
 * Generates a source-bound receipt after Lean checks the union-find proof.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(demoRoot, "../..");
const files = ["UnionFindCore.lean", "UnionFind.lean"];
const requiredTheorems = [
	"edgeMatches_linkEdge"
	, "allFrom_get"
	, "certificate_parent_connected"
	, "certificate_edges_closed"
	, "partitionCertificate_exact"
	, "certifiedPartition_correct"
	, "connected_equivalence"
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
process.stdout.write(`Generated union-find proof audit with ${requiredTheorems.length} theorems\n`);
