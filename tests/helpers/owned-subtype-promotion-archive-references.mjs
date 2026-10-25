/**
 * Bind complete replayed Subtype archives without duplicating their file lists.
 * The canonical index commits to every retained byte; full replay stays required.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertOwnedSubtypePromotionIndex, ownedSubtypePromotionArchiveRoot
} from "./owned-subtype-promotion-catalog.mjs";

const closedPath = path => {
	assert.equal(typeof path, "string");
	assert.ok(path.length > 0 && !/[\\\0\r\n]/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
};

/**
 * Bind a compact reference to the original index, API records and every ZIP
 * part. The full matrix verifier separately authenticates and replays all files.
 *
 * @param index - Fully replayed index, not an acceptance shortcut.
 * @param root - Selected immutable archive root.
 * @param bytes - Selected original canonical index bytes.
 */
export const ownedSubtypePromotionArchiveReferences = (index, root, bytes) => {
	assertOwnedSubtypePromotionIndex(index.lane, index);
	assert.equal(root, ownedSubtypePromotionArchiveRoot(index.lane));
	assert.ok(Buffer.isBuffer(bytes));
	assert.equal(bytes.toString(), canonicalJson(index), "Index changed after replay");
	const manifest = new Map();
	for(const file of index.files)
	{
		closedPath(file.path);
		assert.notEqual(file.path, "index.json");
		assert.ok(!manifest.has(file.path), `Duplicate archive file: ${file.path}`);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		manifest.set(file.path, file);
	}
	const bind = (path, record) => {
		const file = manifest.get(path);
		assert.ok(file, `Missing archive manifest binding: ${path}`);
		assert.equal(record.sha256, file.sha256, path);
		assert.equal(record.bytes, file.bytes, path);
		return { path: `${root}/${path}`, sha256: file.sha256 };
	};
	const { apiRecords, artifact } = index.hostedRun;
	assert.deepEqual(Object.keys(apiRecords).sort(), ["artifact", "job", "run"]);
	const files = [{ path: `${root}/index.json`, sha256: sha256(bytes) }
		, ...["artifact", "job", "run"].map(name =>
			bind(`hosted/api/${name}.json`, apiRecords[name]))];
	assert.ok(Array.isArray(artifact.parts) && artifact.parts.length > 0);
	let offset = 0;
	const artifacts = artifact.parts.map((part, number) => {
		assert.equal(part.path, `hosted/artifact.zip.parts/${String(number).padStart(4, "0")}.part`);
		assert.equal(part.offset, offset);
		assert.ok(Number.isSafeInteger(part.bytes) && part.bytes > 0);
		offset += part.bytes;
		assert.ok(Number.isSafeInteger(offset));
		return bind(part.path, part);
	});
	assert.equal(offset, artifact.bytes);
	return { files: [...files, ...artifacts], artifacts };
};
