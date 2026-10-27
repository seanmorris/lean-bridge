#!/usr/bin/env node
/**
 * Materialize and authenticate the type-surface corpus once for a Core run.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface } from "../src/adoption/type-surface.mjs";
import {
	createTypeSurfaceEvidenceReceipt, typeSurfaceEvidenceSourcePaths
} from "../src/adoption/type-surface-evidence-receipt.mjs";
import {
	collectCoreTypeSurfaceEvidencePlan, coreSparseCheckoutMode
} from "./core-contract-evidence.mjs";

const arguments_ = process.argv.slice(2);
if(arguments_.length !== 6 || arguments_[0] !== "--receipt"
	|| !arguments_[1] || arguments_[2] !== "--manifest" || !arguments_[3]
	|| arguments_[4] !== "--commit" || !/^[a-f0-9]{40}$/u.test(arguments_[5])
	|| /[\0\r\n]/u.test(arguments_[1]) || /[\0\r\n]/u.test(arguments_[3])){
	process.stderr.write("Usage: create-core-type-surface-evidence-receipt.mjs --receipt <path> --manifest <path> --commit <sha>\n");
	process.exit(64);
	}

const root = resolve(".");
const receiptPath = resolve(arguments_[1]);
const manifestPath = resolve(arguments_[3]);
const commit = arguments_[5];
assert.equal(execFileSync("git", ["-C", root, "rev-parse", "HEAD"])
	.toString().trim(), commit, "Receipt revision must equal the checked-out HEAD");
const sparse = coreSparseCheckoutMode(root);
assert.deepEqual(sparse, { sparse: true, cone: false }
	, "Type-surface evidence materialization requires non-cone sparse checkout");
const plan = await collectCoreTypeSurfaceEvidencePlan(root);
if(plan.evidence.patterns.length)
	execFileSync("git", ["sparse-checkout", "add", "--stdin"], {
		input: `${plan.evidence.patterns.join("\n")}\n`
		, stdio: ["pipe", "inherit", "inherit"]
	});
const { document } = await readTypeSurface({
	repository: root, evidenceReceipt: null
});
const sourceSha256 = Object.fromEntries(await Promise.all(
	typeSurfaceEvidenceSourcePaths.map(async path => [
		path, sha256(await readFile(resolve(root, path)))
	])
));
const receipt = createTypeSurfaceEvidenceReceipt({
	commit, document, sourceSha256
});
await Promise.all([
	mkdir(dirname(receiptPath), { recursive: true })
	, mkdir(dirname(manifestPath), { recursive: true })
]);
await Promise.all([
	writeFile(receiptPath, canonicalJson(receipt), { flag: "wx" })
	, writeFile(manifestPath, canonicalJson(plan), { flag: "wx" })
]);
process.stderr.write(`core_type_surface_evidence_files=${receipt.evidence.count}\n`
	+ `core_type_surface_evidence_directories=${plan.evidence.directoryCount}\n`);
