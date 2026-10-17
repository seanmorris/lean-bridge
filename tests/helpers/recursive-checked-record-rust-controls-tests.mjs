/**
 * Exercise recursive Rust corruption-control entry points without producing packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkRecursiveCheckedRecordRustControls } from "./recursive-checked-record-rust-controls.mjs";
import {
	recursiveCheckedRecordRustModelMutations
} from "./recursive-checked-record-rust-model-controls.mjs";
import {
	checkRecursiveCheckedRecordRustPackageControls
} from "./recursive-checked-record-rust-package-controls.mjs";

const fin = () => ({ kind: "fin", bound: "3" });
const subtype = constructor => ({ kind: "subtype", constructor });
const checked = (definition, constructor, word) => ({
	kind: "checked-record", definition, constructor
	, fields: ["digit", "word"]
	, arguments: [fin(), subtype(word)]
});
const model = fixture => {
	const prefix = fixture === "recursive"
		? "RecursiveCheckedRecords" : "MutualCheckedRecords";
	const record = fixture === "recursive" ? "Packet" : "Envelope";
	return {
		pointerBits: 64
		, sourceIdentity: { extractorSha256: "a".repeat(64) }
		, copiedGraph: { exports: [{ symbol: "lean_bridge_graph_entry" }] }
		, exports: [{
			name: "roundTrip"
			, refinements: {
				parameters: [checked(`${prefix}.${record}`
					, `${prefix}.normalize${record}`, `${prefix}.mkWord`)]
				, result: {
					kind: "option"
					, arguments: [checked(`${prefix}.${record}`, null, null)]
				}
			}
		}]
	};
};

test("recursive Rust corruption controls expose one full verifier path", () => {
	assert.equal(typeof checkRecursiveCheckedRecordRustControls, "function");
	assert.equal(typeof checkRecursiveCheckedRecordRustPackageControls, "function");
});

test("installed recursive Rust acceptance cannot bypass the corruption controls", async () => {
	const source = await readFile(
		"tests/helpers/recursive-checked-record-rust-installed-tests.mjs", "utf8");
	assert.equal(source.split("checkRecursiveCheckedRecordRustControls").length, 3);
	assert.match(source, /import \{\n\tcheckRecursiveCheckedRecordRustControls\n\} from "\.\/recursive-checked-record-rust-controls\.mjs";/u);
	assert.match(source, /await checkRecursiveCheckedRecordRustControls\(path => readFile\(join\(output, path\)\), \{/u);
	assert.doesNotMatch(source, /checkRecursiveCheckedRecordRustReport/u);
});

test("recursive Rust model controls mutate both graph families without vacuous passes", () => {
	for(const fixture of ["recursive", "mutual"])
	{
		const mutations = recursiveCheckedRecordRustModelMutations(fixture);
		assert.equal(mutations.length, 8);
		for(const [index, [label, mutate]] of mutations.entries())
		{
			const original = model(fixture), changed = structuredClone(original);
			mutate(changed);
			assert.notDeepEqual(changed, original, `mutation ${index} ${label} ${fixture}`);
		}
		const prefix = fixture === "recursive"
			? "RecursiveCheckedRecords" : "MutualCheckedRecords";
		const record = fixture === "recursive" ? "Packet" : "Envelope";
		const changed = model(fixture);
		mutations[5][1](changed);
		assert.equal(changed.exports[0].refinements.result.arguments[0].constructor
			, `${prefix}.mk${record}`);
		mutations[7][1](changed);
		assert.equal(changed.exports[0].refinements.parameters[0].constructor
			, `${prefix}.mk${record}`);
	}
	const unrefined = {
		pointerBits: 64, sourceIdentity: { extractorSha256: "a".repeat(64) }
		, copiedGraph: { exports: [{ symbol: "lean_bridge_graph_entry" }] }
		, exports: [{ name: "roundTrip" }]
	};
	for(const [, mutate] of recursiveCheckedRecordRustModelMutations("recursive").slice(4))
		assert.throws(() => mutate(structuredClone(unrefined)), { name: "AssertionError" });
	assert.throws(() => recursiveCheckedRecordRustModelMutations("unknown"));
});
