#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { derivePerformanceBudget } from "../src/performance/budgets.mjs";

const options = {
	baseline: null
	, baselinePath: null
	, output: null
	, previous: null
	, reviewedBy: null
	, rationale: null
};
for(let index = 2; index < process.argv.length; index += 1)
{
	const argument = process.argv[index];
	if(argument === "--baseline") options.baseline = resolve(process.argv[++index]);
	else if(argument === "--baseline-path") options.baselinePath = process.argv[++index];
  else if(argument === "--output") options.output = resolve(process.argv[++index]);
  else if(argument === "--previous") options.previous = resolve(process.argv[++index]);
  else if(argument === "--reviewed-by") options.reviewedBy = process.argv[++index];
  else if(argument === "--rationale") options.rationale = process.argv[++index];
  else throw new Error(`unknown performance budget option ${argument}`);
}
if(!options.baseline || !options.baselinePath || !options.output)
{
	throw new Error("--baseline, --baseline-path, and --output are required");
}
const baselineBytes = await readFile(options.baseline);
const baseline = JSON.parse(baselineBytes);
const previousBudget = options.previous
	? JSON.parse(await readFile(options.previous, "utf8"))
	: null;
const budget = derivePerformanceBudget({
	baseline
	, baselinePath: options.baselinePath
	, baselineSha256: createHash("sha256").update(baselineBytes).digest("hex")
	, reviewedBy: options.reviewedBy
	, rationale: options.rationale
	, previousBudget
});
await mkdir(dirname(options.output), { recursive: true });
await writeFile(options.output, `${JSON.stringify(budget, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
	accepted: true
	, budgetId: budget.id
	, thresholdCount: budget.thresholds.length
	, activeBaseline: budget.activeBaseline
	, output: options.output
}, null, 2)}\n`);
