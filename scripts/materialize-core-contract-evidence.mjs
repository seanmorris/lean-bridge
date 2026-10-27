#!/usr/bin/env node
/**
 * Materialize the retained archive payloads required by one Core shard.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { coreContractShardLabels } from "./core-contract-shards.mjs";
import {
	collectCoreContractEvidencePlan, coreSparseCheckoutMode
} from "./core-contract-evidence.mjs";

const arguments_ = process.argv.slice(2);
if(![4, 6].includes(arguments_.length) || arguments_[0] !== "--shard"
	|| !coreContractShardLabels.includes(arguments_[1])
	|| arguments_[2] !== "--manifest" || !arguments_[3]
	|| /[\0\r\n]/u.test(arguments_[3])
	|| (arguments_.length === 6 && (arguments_[4] !== "--type-surface-receipt"
		|| !arguments_[5] || /[\0\r\n]/u.test(arguments_[5])))){
	process.stderr.write("Usage: materialize-core-contract-evidence.mjs --shard <k/12> --manifest <path> [--type-surface-receipt <path>]\n");
	process.exit(64);
		}
const label = arguments_[1], manifestPath = resolve(arguments_[3]);
const evidenceReceipt = arguments_.length === 6 ? resolve(arguments_[5]) : undefined;
const sparse = coreSparseCheckoutMode();
assert.equal(sparse.sparse, true
	, "Core evidence materialization requires a sparse checkout");
assert.equal(sparse.cone, false
	, "Core evidence materialization requires non-cone patterns");
const plan = await collectCoreContractEvidencePlan(
	label, resolve("."), { evidenceReceipt }
);
await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, canonicalJson(plan));
if(plan.evidence.patterns.length)
	execFileSync("git", ["sparse-checkout", "add", "--stdin"], {
		input: `${plan.evidence.patterns.join("\n")}\n`
		, stdio: ["pipe", "inherit", "inherit"]
	});
process.stderr.write(`core_evidence_shard=${label}\ncore_evidence_sources=${plan.sources.count}\ncore_evidence_directories=${plan.evidence.directoryCount}\n`);
