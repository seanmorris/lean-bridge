/**
 * Refresh only the four publication pages' live source pins while staging.
 * Preserve archive references, evidence metadata and every other input byte.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { phpWasmEntryProbeDocumentationPaths } from "./php-wasm-refinement-entry-publication-docs.mjs";

/**
 * Stage exact documentation-pin replacements in a validated canonical ledger.
 * Authenticate the complete input, reject stale pins and remove failed output.
 * This operation does not establish archive acceptance or authorize promotion.
 *
 * @param input - Stream of the already staged inventory bytes.
 * @param destination - Fresh staging file, never an installed target.
 * @param original - Complete staged input byte count and SHA256.
 * @param updates - Exact previous/current hashes of all four changed pages.
 */
export const stagePhpWasmEntryProbePins = async (input, destination, original, updates) => {
	assert.ok(Number.isSafeInteger(original.bytes) && original.bytes > 0
		&& original.bytes < 100 * 1024 ** 2);
	assert.match(original.sha256, /^[a-f0-9]{64}$/u);
	assert.ok(Array.isArray(updates));
	assert.deepEqual(updates.map(update => update.path).sort()
		, Object.values(phpWasmEntryProbeDocumentationPaths).sort());
	const references = new Map(), counts = new Map();
	for(const update of updates)
	{
		assert.deepEqual(Object.keys(update).sort(), ["current", "path", "previous"]);
		for(const hash of [update.previous, update.current]) assert.match(hash, /^[a-f0-9]{64}$/u);
		assert.notEqual(update.previous, update.current, update.path);
		references.set('          "path": ' + JSON.stringify(update.path) + ",", update);
		counts.set(update.path, 0);
	}
	const decoder = new TextDecoder("utf-8", { fatal: true });
	const sourceHash = createHash("sha256"), outputHash = createHash("sha256");
	const output = await open(destination, "wx");
	let pending = "", files = false, selected, sourceBytes = 0, outputBytes = 0;
	const convert = line => {
		assert.ok(Buffer.byteLength(line) <= 1024 ** 2 && !line.includes("\r"), "Canonical bounded pin line");
		if(selected)
		{
			assert.equal(line, '          "sha256": "' + selected.previous + '"'
				, "Exact previous documentation pin: " + selected.path);
			counts.set(selected.path, counts.get(selected.path) + 1);
			line = '          "sha256": "' + selected.current + '"';
			selected = undefined;
		}
		else if(files) selected = references.get(line);
		if(line === '      "files": [') files = true;
		if(line === "      ]," || line === "      ]" || line === "  ],") files = false;
		return line + "\n";
	};
	try
	{
		for await(const chunk of input)
		{
			const bytes = Buffer.from(chunk); sourceHash.update(bytes); sourceBytes += bytes.length;
			assert.ok(sourceBytes <= original.bytes, "Staged pin input grew after preflight");
			pending += decoder.decode(bytes, { stream: true });
			const converted = [];
			let cursor = 0, newline;
			while((newline = pending.indexOf("\n", cursor)) !== -1)
			{
				converted.push(convert(pending.slice(cursor, newline))); cursor = newline + 1;
			}
			pending = pending.slice(cursor);
			assert.ok(Buffer.byteLength(pending) <= 1024 ** 2, "Canonical bounded pin line");
			const next = Buffer.from(converted.join(""));
			outputHash.update(next); outputBytes += next.length; await output.writeFile(next);
		}
		pending += decoder.decode();
		assert.equal(pending, "", "Staged pin input must end with a newline");
		assert.equal(selected, undefined, "Incomplete documentation pin");
		assert.equal(sourceBytes, original.bytes, "Staged pin input size changed");
		assert.equal(sourceHash.digest("hex"), original.sha256, "Staged pin input changed after preflight");
		assert.equal(outputBytes, original.bytes, "Only fixed-width source hashes may change");
		await output.sync(); await output.close();
		return { bytes: outputBytes, sha256: outputHash.digest("hex")
			, pins: updates.map(update => ({ ...update, count: counts.get(update.path) })) };
	}
	catch(error)
	{
		await output.close(); await unlink(destination); throw error;
	}
};
