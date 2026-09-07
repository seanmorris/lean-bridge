/**
 * Bind both token-bucket source modules to the completed Lean proof build.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const files = ["TokenBucketCore.lean", "TokenBucket.lean"];
const theorems = [
	"refill_eq"
	, "refill_bounded"
	, "refill_product_bounded"
	, "initial_valid"
	, "admitted_iff"
	, "request_valid"
	, "clock_regression_unchanged"
	, "request_time_monotone"
	, "rejected_unspent"
	, "request_conservation"
	, "trace_budget"
	, "trace_no_over_admission"
	, "trace_interval_bound"
	, "retryDelay_earliest"
	, "retryDelay_impossible"
	, "request_retry_earliest"
	, "exportedStep_admitted_iff"
	, "exportedStep_valid"
	, "exportedStep_word_bounds"
	, "exportedRun_valid"
	, "exportedRun_size"
	, "exportedRun_wire"
	, "exportedRun_no_over_admission"
	, "exportedRun_word_bounds"
	, "runCredits_eq"
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
	, assurance: "Lean checked exact admission, capacity bounds, refill, trace budgets, and optimized arithmetic before compiling this implementation"
	, sourceFiles, theorems
}, null, 2)}\n`);
process.stdout.write(`Generated token-bucket proof audit with ${theorems.length} required theorems\n`);
