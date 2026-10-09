/**
 * Attach accepted scalar entry counts to the exact existing inventory observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { finDispatchReferences } from "../tests/helpers/fin-dispatch-references.mjs";
import { supplementFinScalarDispatchInventory } from "../tests/helpers/fin-scalar-dispatch-inventory.mjs";

const predecessor = "e9f44187e1e11ac4cd42c2a8fa096e746b787bfd";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), predecessor, "Scalar dispatch inventory is draft-only at its exact predecessor");
assert.ok(!git(["ls-tree", "--name-only", "HEAD", "--", "docs/evidence/fin-scalar-dispatch-inventory-source-history-20261009.json"]).trim(), "Never rewrite a committed scalar dispatch inventory milestone");
const path = "docs/type-surface.v1.json", previous = JSON.parse(await readFile(path, "utf8"));
const references = await finDispatchReferences();
const inventory = await supplementFinScalarDispatchInventory(previous, references);
await writeFile(path, JSON.stringify(inventory, null, 2) + "\n");
process.stdout.write("Appended twelve scalar counter selections and supplemented eleven existing observations; no new support cells.\n");
