/**
 * Keep every file cited by the published type-surface inside the repository.
 *
 * A local ignored build artifact can satisfy readTypeSurface while remaining
 * absent from a fresh checkout. Checking Git's index closes that gap.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const trackedFiles = () => new Set(execFileSync("git", ["ls-files", "--cached", "-z"], {
	encoding: "utf8", maxBuffer: 32 * 1024 * 1024
}).split("\0").filter(Boolean));

test("published type-surface evidence is tracked by Git", async () => {
	const document = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
	const tracked = trackedFiles();
	const evidence = [...new Set(document.evidence.flatMap(entry => entry.files.map(file => file.path)))].sort();
	assert.deepEqual(evidence.filter(file => !tracked.has(file)), []);
});

test("archived evidence indexes cite only tracked files", async () => {
	const tracked = trackedFiles();
	const indexes = [...tracked].filter(file => /^docs\/evidence\/[^/]+\/index\.json$/u.test(file)).sort();
	const missing = [];
	for(const [filename, source] of await Promise.all(indexes.map(async filename => [
		filename, await readFile(filename, "utf8")
	]))) {
		const root = filename.slice(0, -"/index.json".length);
		const index = JSON.parse(source);
		const files = Array.isArray(index.files) ? index.files.map(file => file.path)
			: Object.keys(index.files ?? {});
		for(const file of files)
			if(!tracked.has(`${root}/${file}`)) missing.push(`${root}/${file}`);
	}
	assert.deepEqual([...new Set(missing)].sort(), []);
});
