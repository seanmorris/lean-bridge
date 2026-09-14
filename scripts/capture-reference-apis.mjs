#!/usr/bin/env node
/**
 * Check or refresh documentation API captures through the public compiler engine.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzeCompilerProject } from "../src/analyze/compiler-analysis.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Render API captures independently of JSON object-member insertion order.
 *
 * @param analysis - Fresh compiler analysis of the documented source project.
 */
export const renderReferenceApiCapture = analysis => {
	assert.equal(analysis.bindingIr?.origin, "lean-elaborated");
	assert.deepEqual(analysis.adapterHints.filter(hint => hint.required), []);
	const ir = structuredClone(analysis.bindingIr.document);
	// Documentation captures describe APIs, not artifact-bound proof evidence.
	delete ir.producers[0].extensions["lean-lang.org/elaboration-sha256"];
	for(const declaration of ir.declarations)
		delete declaration.source.extensions["lean-lang.org/source-position"];
	return canonicalJson({ schemaVersion: 1, inputs: analysis.inputs, ir });
};

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
{
	const args = process.argv.slice(2);
	if(args.length > 1 || (args.length && args[0] !== "--write")) throw new Error("Usage: node scripts/capture-reference-apis.mjs [--write]");
	for(const [name, path] of [["lean-author", "documentation/lean-author"], ["scalars", "onboarding/scalars"]])
	{
		const analysis = await analyzeCompilerProject(join(root, "tests/fixtures", path));
		const bytes = renderReferenceApiCapture(analysis);
		const output = join(root, "tests/fixtures/documentation/package-api", `${name}.json`);
		if(args[0] === "--write") await writeFile(output, bytes);
		else assert.equal(canonicalJson(JSON.parse(await readFile(output, "utf8"))), bytes, `Compiler reference drift: ${name}`);
		process.stdout.write(`${name}: compiler API ${args[0] === "--write" ? "captured" : "matches"}\n`);
	}
}
