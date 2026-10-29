/**
 * Prove the evidence-gated HostNull author documentation transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	hostNullCompleteDocumentationPaths
	, renderHostNullCompleteDocumentation
} from "./host-null-complete-documentation.mjs";

const readSource = async ([name, path]) => [name, await readFile(path, "utf8")];
const sourceEntries = await Promise.all(Object.entries(
	hostNullCompleteDocumentationPaths).map(readSource));
const sources = Object.fromEntries(sourceEntries);

test("complete HostNull author docs name the exact installed boundary", () => {
	const rendered = renderHostNullCompleteDocumentation(sources);
	assert.match(rendered.exportDecisions
		, /complete hosted HostNull[\s\S]*all seventeen consumer profiles/u);
	assert.match(rendered.exportDecisions
		, /copied\nparameters, results, fields and synchronous callback positions/u);
	assert.match(rendered.exportDecisions
		, /Owned or asynchronous values and generic or dependent\nHostNull combinations remain separate work/u);
	assert.doesNotMatch(rendered.exportDecisions
		, /JavaScript\/TypeScript and the PHP\nprofiles have installed/u);
	assert.match(rendered.existingPackage
		, /profile conversion tables.*every generated carrier/su);
	assert.match(rendered.existingPackage, /nested-null consumer example/u);
});

test("complete HostNull author docs reject missing and repeated markers", () => {
	const rendered = renderHostNullCompleteDocumentation(sources);
	assert.throws(() => renderHostNullCompleteDocumentation(rendered)
		, /Expected one HostNull documentation marker/u);
	for(const name of Object.keys(sources))
		assert.throws(() => renderHostNullCompleteDocumentation({
			...sources, [name]: "missing marker\n"
		}), /Expected one HostNull documentation marker/u);
});
