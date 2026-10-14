/**
 * Read immutable nominal browser producer sources and authenticate its whole launch snapshot.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { posix } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

const sources = new Map(), snapshots = new Map();
const roots = ["src", "scripts", "tests", "package.json", "package-lock.json", ".github/workflows/consumer-matrix.yml", ".github/workflows/checked-record-browser.yml", "docs/type-surface.v1.json"];
const entries = ["src/backends/javascript/generate.mjs", "src/build/compiler-adapters.mjs", "src/build/component-callable-adapters.mjs", "src/release/component-npm-package.mjs", "src/analyze/elaborated-metadata.mjs"];
const sourceKey = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(/^(?:src|scripts|tests|schema)\//u.test(path) || roots.slice(3).includes(path));
	assert.equal(posix.normalize(path), path); assert.ok(!/[\0\n\r]/u.test(path));
	return `${revision}:${path}`;
};

/**
 * Retrieve a complete file from its frozen Git object, never from historical machine paths.
 *
 * @param revision - Immutable producer revision.
 * @param path - Repository-relative source path.
 */
export const nominalSubtypeBrowserOriginal = (revision, path) => {
	const key = sourceKey(revision, path);
	if(!sources.has(key)) sources.set(key, execFileSync("git", ["cat-file", "blob", key], { maxBuffer: 32 * 1024 ** 2 }));
	return Buffer.from(sources.get(key));
};

/**
 * Recompute all selected launch inputs in bounded Git batches.
 *
 * @param revision - Immutable producer revision.
 */
export const nominalSubtypeBrowserSnapshot = revision => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	if(!snapshots.has(revision))
	{
		const paths = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", revision, "--", ...roots], { encoding: "utf8", maxBuffer: 16 * 1024 ** 2 }).split("\0").filter(Boolean).sort();
		assert.ok(paths.length > 0); const hashes = {};
		for(let offset = 0; offset < paths.length; offset += 64)
		{
			const selected = paths.slice(offset, offset + 64);
			const input = selected.map(path => sourceKey(revision, path)).join("\n") + "\n";
			const batch = execFileSync("git", ["cat-file", "--batch"], { input, maxBuffer: 32 * 1024 ** 2 });
			let cursor = 0;
			for(const path of selected)
			{
				const newline = batch.indexOf(10, cursor); assert.ok(newline > cursor);
				const header = batch.subarray(cursor, newline).toString();
				assert.match(header, /^[a-f0-9]{40} blob [0-9]+$/u);
				const size = Number(header.split(" ")[2]); assert.ok(Number.isSafeInteger(size));
				const end = newline + 1 + size; assert.equal(batch[end], 10);
				const bytes = Buffer.from(batch.subarray(newline + 1, end));
				hashes[path] = sha256(bytes); sources.set(sourceKey(revision, path), bytes); cursor = end + 1;
			}
			assert.equal(cursor, batch.length);
		}
		snapshots.set(revision, Object.freeze(hashes));
	}
	return snapshots.get(revision);
};

/**
 * Capture the complete relative module closure of the selected compiler and JavaScript generators.
 * Dynamic filesystem inputs remain covered by the producer snapshot and explicit archive sources.
 *
 * @param revision - Immutable producer revision.
 */
export const nominalSubtypeBrowserGeneratorClosure = revision => {
	const paths = new Set();
	const visit = path => {
		assert.ok(path.startsWith("src/") && /\.(?:mjs|json)$/u.test(path));
		if(paths.has(path)) return;
		paths.add(path);
		const bytes = nominalSubtypeBrowserOriginal(revision, path);
		if(path.endsWith(".json"))
		{ JSON.parse(bytes); return; }
		for(const specifier of moduleSpecifiers(bytes.toString(), path)) visit(posix.normalize(posix.join(posix.dirname(path), specifier)));
	};
	for(const path of entries) visit(path);
	return [...paths].sort();
};
