/**
 * Generates a source-bound receipt after Lean checks the Aho–Corasick proof.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(root, "../..");
const files = ["AhoCorasickCore.lean", "AhoCorasick.lean"];
const sources = Object.fromEntries(await Promise.all(files.map(async file => [file, await readFile(resolve(root, file), "utf8")])));
const requiredTheorems = ["machineCheck_sound", "compile_machine_invariant", "compile_trie_invariant", "compile_failure_invariant", "resultCheck_sound", "scan_result_correct", "scan_matches_sound", "scan_matches_complete"];
const declarations = [...Object.values(sources).join("\n").matchAll(/\btheorem\s+([A-Za-z][A-Za-z0-9_']*)/gu)].map(match => match[1]);
for(const theorem of requiredTheorems) if(!declarations.includes(theorem)) throw new Error(`proof audit is missing theorem ${theorem}`);
if(Object.values(sources).some(source => /\b(?:sorry|admit)\b/u.test(source))) throw new Error("proof audit refuses sources containing sorry or admit");
const sourceFiles = {};
for(const [file, source] of Object.entries(sources))
{
	sourceFiles[file] = {
		bytes: Buffer.byteLength(source)
		, sha256: createHash("sha256").update(source).digest("hex")
	};
}
const leanVersion = (await readFile(resolve(repositoryRoot, "lean-toolchain"), "utf8")).trim().replace(/^leanprover\/lean4:/u, "");
await writeFile(resolve(root, "runtime/proof-audit.json"), `${JSON.stringify({
	schemaVersion: 1, checker: `Lean ${leanVersion}`
	, assurance: "Lean elaboration completed before this receipt was generated"
	, sourceFiles
	, theorems: requiredTheorems
}, null, 2)}\n`);
process.stdout.write(`Generated Aho–Corasick proof audit with ${requiredTheorems.length} theorems\n`);
