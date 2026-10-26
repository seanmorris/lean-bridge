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
import { collectCoreContractEvidencePlan } from "./core-contract-evidence.mjs";

const arguments_ = process.argv.slice(2);
if(arguments_.length !== 4 || arguments_[0] !== "--shard"
	|| !coreContractShardLabels.includes(arguments_[1])
	|| arguments_[2] !== "--manifest" || !arguments_[3]
	|| /[\0\r\n]/u.test(arguments_[3])){
	process.stderr.write("Usage: materialize-core-contract-evidence.mjs --shard <k/12> --manifest <path>\n");
	process.exit(64);
	}
const label = arguments_[1], manifestPath = resolve(arguments_[3]);
assert.equal(execFileSync("git", ["config", "--bool", "core.sparseCheckout"], {
	encoding: "utf8"
}).trim(), "true", "Core evidence materialization requires a sparse checkout");
assert.notEqual(execFileSync("git", ["config", "--bool", "core.sparseCheckoutCone"], {
	encoding: "utf8"
}).trim(), "true", "Core evidence materialization requires non-cone patterns");
const plan = await collectCoreContractEvidencePlan(label);
await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, canonicalJson(plan));
if(plan.evidence.patterns.length)
	execFileSync("git", ["sparse-checkout", "add", "--stdin"], {
		input: `${plan.evidence.patterns.join("\n")}\n`
		, stdio: ["pipe", "inherit", "inherit"]
	});
process.stderr.write(`core_evidence_shard=${label}\ncore_evidence_sources=${plan.sources.count}\ncore_evidence_directories=${plan.evidence.directoryCount}\n`);
