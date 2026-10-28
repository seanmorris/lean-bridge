#!/usr/bin/env node
/**
 * Reconcile every same-run optional-parameter acceptance artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	buildOptionalParameterMatrixReceipt, validateOptionalParameterMatrixReceipt
} from "../tests/helpers/optional-parameter-matrix-receipt.mjs";

const values = Object.fromEntries(process.argv.slice(2).reduce(
	(items, item, index, all) => {
		if(index % 2 === 0)
		{
			assert.match(item
				, /^--(?:directory|output|producer|repository|run-id|run-attempt)$/u);
			assert.ok(all[index + 1] && !all[index + 1].startsWith("--"));
			items.push([item.slice(2), all[index + 1]]);
		}
		return items;
	}, []));
assert.deepEqual(Object.keys(values).sort(), [
	"directory", "output", "producer", "repository", "run-attempt", "run-id"
]);
const root = resolve(values.directory), output = resolve(values.output);
const receipt = await buildOptionalParameterMatrixReceipt(path => {
	assert.match(path
		, /^(?:[A-Za-z0-9_@.+-]+\/)*[A-Za-z0-9_@.+-]+$/u);
	assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
	return readFile(join(root, path));
}, {
	repository: values.repository, producerCommit: values.producer
	, runId: Number(values["run-id"])
	, runAttempt: Number(values["run-attempt"])
});
validateOptionalParameterMatrixReceipt(receipt);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, canonicalJson(receipt), { flag: "wx" });
process.stdout.write(canonicalJson({
	output, producerCommit: receipt.run.producerCommit
	, ...receipt.matrix, ...receipt.totals
}));
