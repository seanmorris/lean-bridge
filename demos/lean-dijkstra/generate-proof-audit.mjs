/**
 * Generates the browser-visible receipt after Lean has checked the proof module.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const demoRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(demoRoot, "../..");
const files = ["DijkstraCore.lean", "Dijkstra.lean"];
const requiredTheorems = [
	"costOfPath_cons"
	, "costOfPath_increase"
	, "costOfPath_rcons"
	, "feasibleLabels_lowerBound"
	, "certificate_shortest"
	, "feasibleLabelsCheck_sound"
	, "csrFeasibleFrom_eq"
	, "csrFeasibleLabelsCheck_eq"
	, "csrFeasibleLabelsCheck_sound"
	, "dijkstraRec_correct"
	, "dijkstra_correct"
	, "dijkstraCsr_correct"
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
const receipt = {
	schemaVersion: 1
	, checker: `Lean ${leanVersion}`
	, assurance: "Lean elaboration completed before this receipt was generated"
	, sourceFiles
	, theorems: requiredTheorems
};

await writeFile(
	resolve(demoRoot, "runtime/proof-audit.json"),
	`${JSON.stringify(receipt, null, 2)}\n`,
);
process.stdout.write(`Generated proof audit for ${files.map(file => basename(file)).join(", ")}\n`);
