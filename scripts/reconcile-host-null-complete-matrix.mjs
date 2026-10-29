#!/usr/bin/env node
/**
 * Reconcile all seven same-run HostNull acceptance artifacts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	buildHostNullCompleteMatrixReceipt
	, validateHostNullCompleteMatrixReceipt
} from "../tests/helpers/host-null-complete-matrix-receipt.mjs";

const values = Object.fromEntries(process.argv.slice(2).reduce(
	(items, item, index, all) => {
		if(index % 2 === 0)
		{
			assert.match(item
				, /^--(?:directory|output|producer|repository|workflow|run-id|run-attempt)$/u);
			assert.ok(all[index + 1] && !all[index + 1].startsWith("--"));
			items.push([item.slice(2), all[index + 1]]);
		}
		return items;
	}, []));
assert.deepEqual(Object.keys(values).sort(), [
	"directory", "output", "producer", "repository", "run-attempt", "run-id"
	, "workflow"
]);
const root = resolve(values.directory), output = resolve(values.output);
const receipt = await buildHostNullCompleteMatrixReceipt(root, {
	repository: values.repository, workflow: values.workflow
	, producerCommit: values.producer
	, runId: Number(values["run-id"])
	, runAttempt: Number(values["run-attempt"])
});
validateHostNullCompleteMatrixReceipt(receipt);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, canonicalJson(receipt), { flag: "wx" });
process.stdout.write(canonicalJson({
	output, producerCommit: receipt.run.producerCommit, ...receipt.matrix
}));
