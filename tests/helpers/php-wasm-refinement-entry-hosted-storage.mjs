/**
 * Retain and reconstruct original PHP-Wasm artifact ZIPs and every output byte.
 * Byte integrity is separate from hosted identity and installed-route acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, statfs, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { reconstructCallbackSubtypeHostedArtifact } from "./callback-subtype-hosted-evidence.mjs";
import {
	checkedRecordValueIndexHostedDigest, checkedRecordValueIndexHostedSafeZipPath
	, extractCheckedRecordValueIndexHostedArtifact, splitCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";

const maxZipBytes = 128 * 1024 ** 2, maxOutputBytes = 256 * 1024 ** 2;
const maxFiles = 20_000, maxPartBytes = 64 * 1024 ** 2;
const object = (value, keys) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};
const integer = (value, maximum, minimum = 0) =>
	assert.ok(Number.isSafeInteger(value) && value >= minimum && value <= maximum);
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const canonical = async path => {
	assert.ok(typeof path === "string" && isAbsolute(path) && resolve(path) === path);
	assert.ok(!/[\0\r\n]/u.test(path));
	assert.equal(await realpath(path), path, "archive path must not traverse symlinks");
};
const fileReceipt = async (root, path) => {
	const absolute = join(root, path); await canonical(absolute);
	const information = await lstat(absolute); assert.ok(information.isFile());
	return { path, bytes: information.size, sha256: await checkedRecordValueIndexHostedDigest(absolute) };
};
const capacity = async (directory, required) => {
	const space = await statfs(directory);
	assert.ok(space.bavail * space.bsize >= required + 512 * 1024 ** 2
		, "artifact retention must leave at least 512 MiB free");
};

/**
 * Refuse oversized, encrypted, linked, ambiguous or unsafe ZIPs before extraction.
 * Zipinfo reads the central directory without inflating any member.
 *
 * @param zip - Canonical original or reconstructed ZIP.
 */
export const inspectPhpWasmEntryStoredZip = async zip => {
	await canonical(zip);
	const information = await lstat(zip); assert.ok(information.isFile());
	integer(information.size, maxZipBytes, 1);
	const output = execFileSync("/usr/bin/unzip", ["-Z", "-l", zip], {
		encoding: "utf8", timeout: 15_000, maxBuffer: 8 * 1024 ** 2
		, env: { ...process.env, LC_ALL: "C" }, stdio: ["ignore", "pipe", "pipe"]
	});
	const lines = output.trimEnd().split("\n");
	assert.equal(lines[0], `Archive:  ${zip}`);
	const header = lines[1]?.match(/^Zip file size: (\d+) bytes, number of entries: (\d+)$/u);
	assert.ok(header, "ZIP directory header");
	assert.equal(Number(header[1]), information.size);
	const count = Number(header[2]); integer(count, maxFiles, 1);
	assert.equal(lines.length, count + 3, "closed ZIP listing");
	const paths = new Set(), entries = [];
	let expandedBytes = 0;
	for(const line of lines.slice(2, -1))
	{
		const match = line.match(/^([-d][rwxstST-]{6,9})\s+\S+\s+\S+\s+(\d+)\s+([bt][-xl])\s+(\d+)\s+(stor|defN)\s+\S+\s+\S+\s+(\S+)$/u);
		assert.ok(match, "only unencrypted regular files and directories are admitted");
		const [, mode, size, , compressed, , path] = match;
		assert.ok(checkedRecordValueIndexHostedSafeZipPath(path), path);
		assert.ok(!paths.has(path), "unique ZIP members"); paths.add(path);
		assert.equal(mode.startsWith("d"), path.endsWith("/"), "ZIP entry kind");
		const bytes = Number(size); integer(bytes, maxOutputBytes);
		integer(Number(compressed), information.size);
		if(path.endsWith("/")) assert.equal(bytes, 0);
		expandedBytes += bytes; integer(expandedBytes, maxOutputBytes);
		entries.push({ path, bytes });
	}
	const files = entries.filter(entry => !entry.path.endsWith("/"))
		.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
	assert.ok(files.length > 0);
	for(const { path } of entries)
	{
		const parts = path.split("/");
		for(let index = 1; index < parts.length; index++)
			assert.ok(!paths.has(parts.slice(0, index).join("/")), "ZIP file/directory conflict");
		if(path.endsWith("/")) assert.ok(files.some(file => file.path.startsWith(path)), "empty ZIP directory");
	}
	// Check compressed streams and CRCs without writing payload files. Keep even
	// malformed-stream diagnostics and CPU time bounded before extraction starts.
	execFileSync("/usr/bin/unzip", ["-tqq", zip], {
		timeout: 15_000, maxBuffer: 1024 ** 2, stdio: ["ignore", "pipe", "pipe"]
	});
	return { bytes: information.size, expandedBytes, files };
};

/**
 * Validate the closed byte receipt without trusting any recorded file paths.
 * This never promotes an artifact to installed or matrix acceptance.
 *
 * @param index - Original-ZIP byte storage receipt.
 */
export const checkPhpWasmEntryStoredIndex = index => {
	object(index, ["schemaVersion", "kind", "scope", "zip", "output"]);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "php-wasm-entry-artifact-bytes-v1");
	assert.equal(index.scope, "original-zip-and-output-bytes-only");
	object(index.zip, ["bytes", "sha256", "parts"]);
	integer(index.zip.bytes, maxZipBytes, 1); digest(index.zip.sha256);
	assert.ok(Array.isArray(index.zip.parts) && index.zip.parts.length > 0);
	assert.equal(index.zip.parts.length, Math.ceil(index.zip.bytes / maxPartBytes));
	let offset = 0;
	for(const [position, part] of index.zip.parts.entries())
	{
		object(part, ["path", "offset", "bytes", "sha256"]);
		assert.equal(part.path, `zip/${String(position).padStart(4, "0")}.part`);
		assert.equal(part.offset, offset); digest(part.sha256);
		assert.equal(part.bytes, Math.min(maxPartBytes, index.zip.bytes - offset));
		offset += part.bytes;
	}
	assert.equal(offset, index.zip.bytes);
	assert.ok(Array.isArray(index.output)); integer(index.output.length, maxFiles, 1);
	let bytes = 0;
	for(const file of index.output)
	{
		object(file, ["path", "bytes", "sha256"]);
		assert.ok(typeof file.path === "string" && file.path.startsWith("output/")
			&& !file.path.endsWith("/") && checkedRecordValueIndexHostedSafeZipPath(file.path));
		integer(file.bytes, maxOutputBytes); digest(file.sha256);
		bytes += file.bytes; integer(bytes, maxOutputBytes);
	}
	assert.deepEqual(index.output.map(file => file.path)
		, [...new Set(index.output.map(file => file.path))].sort());
	return ["index.json", ...index.zip.parts.map(part => part.path)
		, ...index.output.map(file => file.path)].sort();
};

/**
 * Write a fresh byte archive. Partial writes remain recoverable; index is last.
 * Preserve original ZIP bytes and independently copied extracted member bytes.
 *
 * @param zip - Original ZIP already bound to GitHub API identity by the caller.
 * @param destination - Fresh absolute artifact directory owned by the caller.
 */
export const retainPhpWasmEntryHostedArtifact = async (zip, destination) => {
	const inspected = await inspectPhpWasmEntryStoredZip(zip);
	assert.ok(isAbsolute(destination) && resolve(destination) === destination);
	await canonical(dirname(destination));
	await capacity(dirname(destination), inspected.bytes * 2 + inspected.expandedBytes * 2);
	await capacity(tmpdir(), inspected.expandedBytes);
	const originalSha256 = await checkedRecordValueIndexHostedDigest(zip);
	const extracted = await extractCheckedRecordValueIndexHostedArtifact(zip);
	try
	{
		await mkdir(destination); await mkdir(join(destination, "zip"));
		const parts = await splitCheckedRecordValueIndexHostedArtifact(zip, join(destination, "zip"));
		const output = [];
		assert.deepEqual(await nativeArtifactPaths(extracted.root), inspected.files.map(file => file.path));
		for(const file of inspected.files)
		{
			const path = "output/" + file.path, target = join(destination, path);
			const original = await fileReceipt(extracted.root, file.path);
			assert.equal(original.bytes, file.bytes);
			await mkdir(dirname(target), { recursive: true });
			await copyFile(join(extracted.root, file.path), target, constants.COPYFILE_EXCL);
			const retained = await fileReceipt(destination, path);
			assert.equal(retained.bytes, original.bytes); assert.equal(retained.sha256, original.sha256);
			output.push(retained);
		}
		const index = { schemaVersion: 1, kind: "php-wasm-entry-artifact-bytes-v1"
			, scope: "original-zip-and-output-bytes-only"
			, zip: { bytes: inspected.bytes, sha256: originalSha256
				, parts: parts.map(part => ({ path: "zip/" + part.name
					, offset: part.offset, bytes: part.bytes, sha256: part.sha256 })) }
			, output };
		const paths = checkPhpWasmEntryStoredIndex(index);
		assert.deepEqual(await nativeArtifactPaths(destination), paths.filter(path => path !== "index.json"));
		assert.equal(await checkedRecordValueIndexHostedDigest(zip), originalSha256, "original ZIP changed during capture");
		await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
		// Reconstruct and compare the retained copy before reporting byte retention.
		await checkPhpWasmEntryHostedArtifactBytes(destination);
		return index;
	}
	finally
	{ await rm(extracted.root, { recursive: true, force: true }); }
};

/**
 * Reconstruct original ZIP bytes, independently extract them and compare every
 * retained output. No original download or stored success summary is consulted.
 *
 * @param directory - Canonical retained artifact directory.
 */
export const checkPhpWasmEntryHostedArtifactBytes = async directory => {
	await canonical(directory); assert.ok((await lstat(directory)).isDirectory());
	const indexPath = join(directory, "index.json"); await canonical(indexPath);
	const information = await lstat(indexPath); assert.ok(information.isFile());
	integer(information.size, 8 * 1024 ** 2, 1);
	const bytes = await readFile(indexPath), index = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(index));
	const expected = checkPhpWasmEntryStoredIndex(index);
	assert.deepEqual(await nativeArtifactPaths(directory), expected, "closed retained artifact file set");
	for(const row of [...index.zip.parts, ...index.output])
	{
		const current = await fileReceipt(directory, row.path);
		assert.equal(current.bytes, row.bytes, row.path); assert.equal(current.sha256, row.sha256, row.path);
	}
	await capacity(tmpdir(), index.zip.bytes + index.output.reduce((sum, file) => sum + file.bytes, 0));
	const temporary = await mkdtemp(join(tmpdir(), "lean-php-entry-byte-replay-"));
	let extracted;
	try
	{
		const zip = join(temporary, "artifact.zip");
		assert.equal(await reconstructCallbackSubtypeHostedArtifact(directory, index.zip.parts, zip), index.zip.bytes);
		assert.equal(await checkedRecordValueIndexHostedDigest(zip), index.zip.sha256);
		const inspected = await inspectPhpWasmEntryStoredZip(zip);
		assert.deepEqual(index.output.map(file => ({ path: file.path.slice(7), bytes: file.bytes })), inspected.files);
		extracted = await extractCheckedRecordValueIndexHostedArtifact(zip);
		for(const row of index.output)
		{
			const original = await fileReceipt(extracted.root, row.path.slice(7));
			assert.equal(original.bytes, row.bytes, row.path); assert.equal(original.sha256, row.sha256, row.path);
		}
		assert.deepEqual(await nativeArtifactPaths(extracted.root), index.output.map(file => file.path.slice(7)));
		return { schemaVersion: 1, scope: index.scope, files: index.output.length
			, zip: { bytes: index.zip.bytes, sha256: index.zip.sha256 }
			, outputBytes: index.output.reduce((sum, file) => sum + file.bytes, 0) };
	}
	finally
	{
		if(extracted) await rm(extracted.root, { recursive: true, force: true });
		await rm(temporary, { recursive: true, force: true });
	}
};
