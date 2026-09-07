/**
 * Bind the displayed LRU source to a successful Lean proof build.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const files = ["LruCore.lean", "Lru.lean"];
const sources = Object.fromEntries(await Promise.all(files.map(async file => [file
	, await readFile(resolve(root, file), "utf8")])));
const theorems = [
	"get_refines", "put_refines", "get_valid", "put_valid", "get_preserves_values"
	, "put_lookup_written", "put_existing_no_eviction", "put_full_evicts_oldest"
	, "get_preserves_other_order", "exported_run_valid"
	, "fastGet_eq_get", "exported_get_correct", "exported_put_correct"
	, "exported_run_refines", "exported_batch_refines", "put_preserves_other_order"
];
const combined = Object.values(sources).join("\n");
const declarations = [...combined.matchAll(/\btheorem\s+([A-Za-z][A-Za-z0-9_']*)/gu)].map(match => match[1]);
for(const theorem of theorems)
	if(!declarations.includes(theorem)) throw new Error(`Missing required theorem ${theorem}`);
if(/\b(?:sorry|admit|axiom)\b/u.test(combined)) throw new Error("Proof source contains an unchecked declaration");
const sourceFiles = {};
for(const [file, source] of Object.entries(sources))
{
	sourceFiles[file] = {
		bytes: Buffer.byteLength(source)
		, sha256: createHash("sha256").update(source).digest("hex")
	};
}
const version = (await readFile(resolve(root, "../../lean-toolchain"), "utf8")).trim()
	.replace(/^leanprover\/lean4:/u, "");
await writeFile(resolve(root, "runtime/proof-audit.json"), `${JSON.stringify({
	schemaVersion: 1, checker: `Lean ${version}`
	, assurance: "Lean elaboration completed before this receipt was generated; transition proofs erase before compilation"
	, sourceFiles, theorems
}, null, 2)}\n`);
process.stdout.write(`Generated LRU proof audit with ${theorems.length} required theorems\n`);
