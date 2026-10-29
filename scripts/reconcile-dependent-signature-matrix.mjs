#!/usr/bin/env node
/**
 * Reconcile every same-run dependent-signature acceptance artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	buildDependentSignatureMatrixReceipt
	, validateDependentSignatureMatrixReceipt
} from "../tests/helpers/dependent-signature-matrix-receipt.mjs";

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
const receipt = await buildDependentSignatureMatrixReceipt(path => {
	assert.match(path
		, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	return readFile(join(root, path));
}, {
	repository: values.repository, workflow: values.workflow
	, producerCommit: values.producer
	, runId: Number(values["run-id"])
	, runAttempt: Number(values["run-attempt"])
});
validateDependentSignatureMatrixReceipt(receipt);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, canonicalJson(receipt), { flag: "wx" });
process.stdout.write(canonicalJson({
	output, producerCommit: receipt.run.producerCommit, ...receipt.matrix
}));
