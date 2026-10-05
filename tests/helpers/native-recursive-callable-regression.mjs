/**
 * Check the old copied graph ABI and the narrowly scoped public header repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedGraphPackage } from "../../src/backends/c/graph-package.mjs";
import { generateNativeCopiedGraphAdapters } from "../../src/backends/c/native-graph-adapters.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { recursiveCarrierAbi } from "./recursive-carriers.mjs";

export const nativeRecursiveCallableCodegenPath = "docs/evidence/native-recursive-callable-codegen-20260925.json";
export const nativeRecursiveCallableCodegenSources = ["src/backends/c/graph-package.mjs", "src/backends/c/native-graph-adapters.mjs"];
/**
 * Identify every complete generated file, including byte length.
 *
 * @param files - Repository-independent generated path/text pairs.
 */
export const generatedFileIdentities = files => Object.fromEntries(Object.entries(files)
	.map(([path, source]) => [path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }]));

/**
 * Compare complete generated files and reverse only the measured header changes.
 *
 * @param record - Baseline/current generation from the same independent fixture.
 */
export const assertNativeRecursiveCallableCodegen = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.baselineRevision, "136e4942ed32bd923cb721eb80aa038cfaa07f74");
	assert.deepEqual(Object.keys(record.predecessors), nativeRecursiveCallableCodegenSources);
	assert.deepEqual(Object.keys(record.sourceHashes), nativeRecursiveCallableCodegenSources);
	const ir = nativeRecursiveReviewedIr();
	assert.equal(record.bindingIrSha256, sha256(canonicalJson(ir)));
	assert.deepEqual(record.native.map(row => row.wordBits), [32, 64]);
	for(const row of record.native)
	{
		const native = generateNativeCopiedGraphAdapters(ir, recursiveCarrierAbi(ir), { wordBits: row.wordBits });
		const files = { "graph.h": native.header, "types.h": native.typesHeader, "graph.c": native.source };
		assert.deepEqual(row.files, generatedFileIdentities(files));
		assert.deepEqual(row.previousFiles, row.files);
	}
	assert.deepEqual(record.packages.map(row => row.targets), [["c"], ["cpp"], ["c", "cpp"]]);
	for(const row of record.packages)
	{
		const generated = generateCopiedGraphPackage(ir, row.targets);
		assert.equal(row.layoutSha256, generated.layoutSha256);
		assert.deepEqual(row.files, generatedFileIdentities(generated.files));
		assert.deepEqual(Object.keys(row.previousFiles), Object.keys(row.files));
		const changed = Object.keys(row.files).filter(path => row.files[path].sha256 !== row.previousFiles[path].sha256);
		assert.deepEqual(row.changes.map(change => change.path), changed);
		const allowed = ["include/detail/recursive-status.h"
			, ...row.targets.includes("c") ? ["gmp/include/detail/recursive-status.h"] : []
			, ...row.targets.includes("cpp") ? ["include/recursive.hpp"] : []];
		assert.deepEqual([...changed].sort(), allowed.sort());
		for(const change of row.changes)
		{
			assert.equal(sha256(change.previous), row.previousFiles[change.path].sha256);
			assert.equal(Buffer.byteLength(change.previous), row.previousFiles[change.path].bytes);
			const source = generated.files[change.path];
			if(change.path.endsWith("-status.h"))
				assert.equal(source, change.previous.replace("#pragma once", "#ifndef RECURSIVE_COPIED_GRAPH_STATUS_H\n#define RECURSIVE_COPIED_GRAPH_STATUS_H") + "#endif\n");
			else
			{
				const include = '#include "detail/recursive-graph.h"\n';
				assert.equal(change.previous.split(include).length, 2);
				const privateTypes = ["#include <stdbool.h>", "#include <string.h>"
					, "namespace lean_bridge::recursive::detail {"
					, ...generated.layout.nodes.filter(node => node.aggregate).map(node => `struct ${node.name};`)
					, include.trimEnd(), "}", ""].join("\n");
				let expected = change.previous.replace(include, privateTypes);
				for(const root of generated.layout.roots)
					expected = expected.replaceAll(`(${root.name}_graph`, `(detail::${root.name}_graph`);
				expected = expected.replaceAll("!recursive_graph_ready()", "!detail::recursive_graph_ready()")
					.replaceAll(") recursive_graph_retire()", ") detail::recursive_graph_retire()");
				assert.equal(source, expected, "Only private ABI qualification and forward declarations may change");
			}
		}
	}
};
