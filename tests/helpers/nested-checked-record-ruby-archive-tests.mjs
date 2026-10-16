/**
 * Test inert RubyGem decoding and complete receipt reconciliation without Ruby.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { checkNestedCheckedRecordRubyArchive } from "./nested-checked-record-ruby-archive.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const tar = entries => Buffer.concat([...entries.map(([path, bytes]) => gunzipSync(createDeterministicTarGzFromFiles({
	files: [{ path, bytes, mode: 0o644 }], sourceDateEpoch: 1
})).subarray(0, -1024))
, Buffer.alloc(1024)]);
const pack = (payload, metadata = Buffer.from("synthetic inert gem metadata\n")) => {
	const members = [["metadata.gz", gzipSync(metadata)], ["data.tar.gz", gzipSync(payload)]];
	const checksums = "---\n" + ["SHA256", "SHA512"].map(algorithm => algorithm + ":\n"
		+ members.map(([name, bytes]) => "  " + name + ": " + createHash(algorithm.toLowerCase()).update(bytes).digest("hex") + "\n").join("")).join("");
	members.push(["checksums.yaml.gz", gzipSync(Buffer.from(checksums))]); return { archive: tar(members), members };
};
const fixture = () => {
	const entries = [["lib/example.rb", Buffer.from("synthetic Ruby source\n")]
		, ["lib/native/library.so", Buffer.from([127, 69, 76, 70, 0, 255])]];
	const receiptBytes = Buffer.from(canonicalJson({ files: Object.fromEntries(entries.map(([path, bytes]) => [path, identity(bytes)])) }));
	entries.push(["lean-bridge/package-receipt.json", receiptBytes]);
	const payload = tar(entries), { archive, members } = pack(payload);
	const files = Object.fromEntries(entries.map(([path, bytes]) => [path, identity(bytes)]));
	return { entries, payload, members, options: { archive, artifact: identity(archive), files, receiptBytes } };
};
const changeHeader = (input, change) => {
	const bytes = Buffer.from(input), header = bytes.subarray(0, 512); change(header);
	header.fill(32, 148, 156);
	header.write(header.reduce((sum, value) => sum + value, 0).toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
	return bytes;
};

test("nested checked-record Ruby archives reconcile every retained source, receipt and native byte", () => {
	const { entries, options } = fixture();
	assert.deepEqual(checkNestedCheckedRecordRubyArchive(options), new Map(entries));
	for(const change of [
		value => { value.artifact.bytes++; }
		, value => { value.artifact.sha256 = "0".repeat(64); }
		, value => { value.files.extra = identity(Buffer.from("extra")); }
		, value => { delete value.files["lib/example.rb"]; }
		, value => { value.files["lib/native/library.so"].sha256 = "0".repeat(64); }
		, value => { value.files["lib/example.rb"].bytes++; }
		, value => { value.receiptBytes = Buffer.from("changed"); }
	]) {
		const changed = { ...options, artifact: { ...options.artifact }, files: structuredClone(options.files) };
		change(changed); assert.throws(() => checkNestedCheckedRecordRubyArchive(changed));
	}
	for(const target of entries.map(([path]) => path))
	{
		const changed = entries.map(([path, bytes]) => [path, path === target ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes]);
		const { archive } = pack(tar(changed));
		assert.throws(() => checkNestedCheckedRecordRubyArchive({ ...options, archive, artifact: identity(archive) }));
	}
});

test("nested checked-record Ruby archives reject unsafe members and rehashed malformed containers", t => {
	const { payload, entries, members, options } = fixture(); let controls = 0;
	const refuses = archive => {
		assert.throws(() => checkNestedCheckedRecordRubyArchive({ ...options, archive, artifact: identity(archive) })); controls++;
	};
	for(const changed of [members.slice(1), members.slice(0, 2), [...members, ["extra", Buffer.from("extra")]], [...members, members[0]], [...members].reverse()])
		refuses(tar(changed));
	for(const data of [
		Buffer.concat([options.archive, Buffer.alloc(512)])
		, options.archive.subarray(0, -1)
		, changeHeader(options.archive, header => { header[156] = 50; })
		, changeHeader(options.archive, header => { header.fill(0, 0, 100); header.write("../escape", 0); })
	]) refuses(data);
	const badChecksum = Buffer.from(options.archive); badChecksum[148] = 56; refuses(badChecksum);
	const replacedChecksum = members.map(([name, bytes]) => [name, name === "checksums.yaml.gz" ? gzipSync(Buffer.from("---\n")) : bytes]);
	refuses(tar(replacedChecksum));
	for(const changed of [
		tar(entries.slice(1)), tar([...entries, entries[0]])
		, tar([...entries, ["unrecorded.rb", Buffer.from("extra")]])
		, payload.subarray(0, -512)
		, Buffer.concat([payload, Buffer.from("trailing")])
		, changeHeader(payload, header => { header[156] = 50; })
		, changeHeader(payload, header => { header.fill(0, 0, 100); header.write("/absolute", 0); })
		, changeHeader(payload, header => { header.fill(0, 0, 100); header.write("../escape", 0); })
		, changeHeader(payload, header => { header.write("0104644\0", 100, "ascii"); })
		, changeHeader(payload, header => { header.write("0000002\0", 108, "ascii"); })
		, changeHeader(payload, header => { header[257] = 0; })
	]) refuses(pack(changed).archive);
	const padded = Buffer.from(payload); padded[512 + entries[0][1].length] = 1; refuses(pack(padded).archive);
	const ended = Buffer.from(payload); ended[ended.length - 1] = 1; refuses(pack(ended).archive);
	refuses(pack(payload, Buffer.alloc(0)).archive);
	refuses(pack(payload, Buffer.from([0xff])).archive);
	assert.deepEqual(checkNestedCheckedRecordRubyArchive(options), new Map(entries));
	t.diagnostic(`${controls} malformed-container controls with recalculated outer digests; no installed Gem execution.`);
});
