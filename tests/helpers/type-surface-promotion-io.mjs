/**
 * Stream the maintainer inventory while retaining its semantic projection.
 * Full evidence entries are validated individually and preserved byte-for-byte
 * when new evidence and observations are staged. Never serialize the projection
 * as a replacement inventory: it intentionally omits redundant file lists.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, unlink } from "node:fs/promises";
import { validateTypeSurface } from "../../src/adoption/type-surface.mjs";

const pretty = value => JSON.stringify(value, null, 2);
const evidenceText = entry => pretty(entry).split("\n")
	.map(line => `    ${line}`).join("\n");
const hash = () => createHash("sha256");

/**
 * Decode bounded, newline-terminated UTF-8 while hashing the original bytes.
 *
 * @param input - Readable byte stream.
 * @param identity - Running byte count and digest.
 * @param limit - Maximum encoded line size.
 */
async function* lines(input, identity, limit)
{
	const decoder = new TextDecoder("utf-8", { fatal: true });
	let pending = "";
	for await(const chunk of input)
	{
		const bytes = Buffer.from(chunk);
		identity.digest.update(bytes);
		identity.bytes += bytes.length;
		pending += decoder.decode(bytes, { stream: true });
		let newline;
		while((newline = pending.indexOf("\n")) !== -1)
		{
			const line = pending.slice(0, newline);
			assert.ok(Buffer.byteLength(line) <= limit, "Inventory line limit exceeded");
			assert.ok(!line.includes("\r"), "Inventory must use canonical LF lines");
			yield line;
			pending = pending.slice(newline + 1);
		}
		assert.ok(Buffer.byteLength(pending) <= limit, "Inventory line limit exceeded");
	}
	pending += decoder.decode();
	assert.equal(pending, "", "Inventory must end with a newline");
}

/**
 * Validate every complete evidence entry. By default, retain only its metadata
 * and first file/archive; a bounded explicit selection can keep full references.
 * All original lists remain in the source file.
 *
 * @param input - Readable original inventory bytes.
 * @param contracts - Independent IR schema and consumer contract.
 * @param limits - Limits for canonical JSON sections and individual lines.
 * @param limits.section - Maximum bytes per evidence entry or semantic section.
 * @param limits.line - Maximum bytes per canonical JSON line.
 * @param limits.retainEvidence - Evidence IDs whose complete references are needed.
 */
export const readPromotionInventory = async (
	input, contracts, { section = 32 * 1024 * 1024, line = 1024 * 1024, retainEvidence = [] } = {}
) => {
	assert.ok(Array.isArray(retainEvidence) && retainEvidence.length <= 8);
	assert.ok(retainEvidence.every(id => typeof id === "string" && id.length > 0));
	const retained = new Set(retainEvidence);
	assert.equal(retained.size, retainEvidence.length, "Unique retained evidence IDs");
	const identity = { digest: hash(), bytes: 0 };
	let state = "prefix", prefix = "", suffix = "", entry = "";
	let prefixBytes = 0, entryBytes = 0, suffixBytes = 0;
	let skeleton, position = 0, appendAt, suffixAt, entryComma = false;
	const evidence = [];
	for await(const text of lines(input, identity, line))
	{
		const bytes = Buffer.byteLength(text) + 1;
		if(state === "prefix")
		{
			if(text === '  "evidence": [')
			{
				skeleton = JSON.parse(prefix + '  "evidence": [],\n  "observations": []\n}\n');
				state = "evidence";
			}
			else
			{
				prefix += text + "\n";
				prefixBytes += bytes;
				assert.ok(prefixBytes <= section, "Inventory prefix limit exceeded");
			}
		}
		else if(state === "evidence")
		{
			if(text === "  ],")
			{
				assert.equal(entry, "", "Unterminated evidence entry");
				assert.ok(evidence.length > 0 && !entryComma, "Invalid evidence array ending");
				suffixAt = position + bytes;
				state = "suffix";
			}
			else
			{
				if(entry === "")
				{
					assert.equal(text, "    {", "Expected a canonical evidence entry");
					assert.ok(evidence.length === 0 || entryComma, "Missing evidence separator");
				}
				entry += text + "\n";
				entryBytes += bytes;
				assert.ok(entryBytes <= section, "Inventory entry limit exceeded");
				if(text === "    }," || text === "    }")
				{
					entryComma = text.endsWith(",");
					const source = entry.slice(0, entryComma ? -2 : -1);
					const value = JSON.parse(source);
					assert.equal(source, evidenceText(value), "Noncanonical evidence entry");
					validateTypeSurface({ ...skeleton
						, baseline: { ...skeleton.baseline, exclusions: [] }
						, evidence: [value] }, contracts);
					evidence.push(retained.has(value.id) ? value : { ...value
						, files: value.files.slice(0, 1)
						, artifacts: value.artifacts.slice(0, 1) });
					appendAt = position + bytes - 1;
					entry = "";
					entryBytes = 0;
				}
			}
		}
		else
		{
			suffix += text + "\n";
			suffixBytes += bytes;
			assert.ok(suffixBytes <= section, "Inventory semantics limit exceeded");
		}
		position += bytes;
	}
	assert.equal(state, "suffix", "Incomplete inventory");
	assert.equal(position, identity.bytes, "Inventory byte accounting changed");
	const semanticSource = prefix + '  "evidence": [],\n' + suffix;
	const document = JSON.parse(semanticSource);
	assert.equal(pretty(document) + "\n", semanticSource, "Noncanonical inventory semantics");
	assert.deepEqual(Object.keys(document).slice(-2), ["evidence", "observations"]);
	document.evidence = evidence;
	assert.ok(retainEvidence.every(id => evidence.some(item => item.id === id))
		, "Retained evidence must exist");
	validateTypeSurface(document, contracts);
	return { document, contracts, appendAt, suffixAt
		, source: { bytes: identity.bytes, sha256: identity.digest.digest("hex") } };
};

/**
 * Stage an inventory by appending evidence and replacing only observations.
 * All old evidence bytes survive; the input digest and output size are checked
 * before a caller may install the staged file. A failed stage is removed.
 *
 * @param filename - Original complete inventory file.
 * @param destination - New staging file, created exclusively.
 * @param original - Validated projection and original byte coordinates.
 * @param promoted - Validated promoted semantic document.
 * @param maximumBytes - Maximum Git-compatible output size.
 */
export const stagePromotionInventory = async (
	filename, destination, original, promoted, maximumBytes = 100 * 1024 * 1024
) => {
	assert.ok(Number.isSafeInteger(maximumBytes) && maximumBytes > 0);
	validateTypeSurface(promoted, original.contracts);
	for(const key of Object.keys(original.document))
		if(!["evidence", "observations"].includes(key))
			assert.deepEqual(promoted[key], original.document[key], key);
	const count = original.document.evidence.length;
	assert.deepEqual(promoted.evidence.slice(0, count), original.document.evidence
		, "Existing evidence metadata must remain unchanged");
	assert.ok(promoted.evidence.length > count, "Promotion must append evidence");
	const edits = [
		{ at: original.appendAt, end: original.appendAt
			, text: ",\n" + promoted.evidence.slice(count).map(evidenceText).join(",\n") }
		, { at: original.suffixAt, end: original.source.bytes
			, text: pretty({ observations: promoted.observations }).slice(2) + "\n" }
	];
	assert.ok(edits[0].at < edits[1].at && edits[1].at < edits[1].end);
	const sourceHash = hash(), outputHash = hash();
	let outputBytes = 0, position = 0, next = 0, skipUntil = 0;
	const output = await open(destination, "wx");
	const write = async value => {
		const bytes = Buffer.from(value);
		outputBytes += bytes.length;
		assert.ok(outputBytes < maximumBytes, "Promoted inventory exceeds file size limit");
		outputHash.update(bytes);
		await output.writeFile(bytes);
	};
	try
	{
		for await(const chunk of createReadStream(filename))
		{
			sourceHash.update(chunk);
			let cursor = 0;
			while(cursor < chunk.length)
			{
				const at = position + cursor;
				if(edits[next]?.at === at)
				{
					await write(edits[next].text);
					skipUntil = edits[next].end;
					next++;
				}
				const boundary = at < skipUntil ? skipUntil
					: edits[next]?.at ?? Infinity;
				const end = Math.min(chunk.length, boundary - position);
				assert.ok(end > cursor, "Invalid inventory edit coordinates");
				if(at >= skipUntil) await write(chunk.subarray(cursor, end));
				cursor = end;
			}
			position += chunk.length;
		}
		assert.equal(position, original.source.bytes, "Inventory size changed after preflight");
		assert.equal(sourceHash.digest("hex"), original.source.sha256
			, "Inventory changed after preflight");
		assert.equal(next, edits.length, "Incomplete inventory edits");
		await output.sync();
		await output.close();
		return { bytes: outputBytes, sha256: outputHash.digest("hex") };
	}
	catch(error)
	{
		await output.close();
		await unlink(destination);
		throw error;
	}
};
