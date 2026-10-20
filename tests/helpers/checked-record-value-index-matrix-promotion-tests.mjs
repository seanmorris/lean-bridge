/** Authenticate the final native/managed value-index route references. */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkedRecordValueIndexMatrixLimit
	, checkedRecordValueIndexMatrixProfiles
	, checkedRecordValueIndexMatrixPromotionReferences
	, assertCheckedRecordValueIndexMatrixPromotionReferences
} from "./checked-record-value-index-matrix-promotion.mjs";

test("final value-index matrix authenticates twelve exact routes", {
	timeout: 900_000
}, async () => {
	const references = await checkedRecordValueIndexMatrixPromotionReferences();
	assert.deepEqual(references.map(item => item.lane), [
		...Array(4).fill("native"), ...Array(4).fill("dotnet")
		, ...Array(4).fill("jvm")
	]);
	assert.deepEqual([...new Set(references.flatMap(item => item.profiles))]
		, checkedRecordValueIndexMatrixProfiles);
	assert.deepEqual([...new Set(references.map(item => item.hostedRun))]
		, [39287533848, 39134609046, 39213054169]);
	assert.deepEqual([...new Set(references.map(item => item.artifact))]
		, [12205716190, 12139408925, 12169642246]);
	for(const reference of references)
	{
		assert.ok(reference.files.length > 0);
		assert.ok(reference.artifacts.length > 0);
		assert.ok(reference.scope.includes(checkedRecordValueIndexMatrixLimit));
	}
	for(const changedReferences of [
		references.slice(1), references.slice().reverse()
		, [...references, references[0]]
	]) assert.throws(() =>
		assertCheckedRecordValueIndexMatrixPromotionReferences(changedReferences));
	const forgedArtifact = references.slice();
	forgedArtifact[0] = { ...forgedArtifact[0], artifact: 1 };
	assert.throws(() =>
		assertCheckedRecordValueIndexMatrixPromotionReferences(forgedArtifact));
	const forgedFiles = references.slice();
	forgedFiles[0] = { ...forgedFiles[0], files: forgedFiles[0].files.slice() };
	forgedFiles[0].files[0] = {
		...forgedFiles[0].files[0], sha256: "0".repeat(64)
	};
	assert.throws(() =>
		assertCheckedRecordValueIndexMatrixPromotionReferences(forgedFiles));
});
