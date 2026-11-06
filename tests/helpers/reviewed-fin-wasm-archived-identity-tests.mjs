/**
 * The archived structural Wasm refusal identities stay byte-identical. This
 * retained contract opens the original npm archive, so sparse consumer lanes
 * register it only through the retained-contract loaders.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedFinWasmPreFieldMismatches }
	from "./reviewed-fin-wasm-mismatches.mjs";

const archivedStructural
	= "docs/evidence/reviewed-fin-npm-20261007/reviewed-structural.json";

test("the eight earlier structural Wasm refusal inputs remain byte-identical to their archived identities", async () => {
	const bytes = await readFile(archivedStructural);
	assert.equal(sha256(bytes)
		, "eb908163d52e8dfc3d24a7327eec6e7e9c366715030ab6284fe33b7c22d4af19");
	const report = JSON.parse(bytes);
	assert.deepEqual(reviewedFinWasmPreFieldMismatches("structural")
		.map(({ label, ir }) => ({ label
			, reviewedSourceSha256: sha256(canonicalJson(ir)) }))
	, report.mismatches.map(({ label, reviewedSourceSha256 }) =>
		({ label, reviewedSourceSha256 })));
});
