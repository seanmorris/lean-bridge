/**
 * Verify retained optional CPAN handoffs without extracting or executing them.
 * No opaque archive or native-binary digest is treated as a universal golden.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const zeros = bytes => bytes.every(byte => byte === 0);
const text = bytes => {
	const end = bytes.indexOf(0), content = end < 0 ? bytes : bytes.subarray(0, end);
	if(end >= 0) assert.ok(zeros(bytes.subarray(end)));
	assert.equal(Buffer.from(content.toString("utf8")).compare(content), 0);
	return content.toString("utf8");
};
const octal = bytes => {
	const value = text(bytes); assert.match(value, /^[0-7]+$/u);
	const number = Number.parseInt(value, 8); assert.ok(Number.isSafeInteger(number)); return number;
};

/**
 * Strict regular-file-only USTAR decoding for the repository's own archives.
 *
 * @param bytes - Original gzip archive bytes.
 * @param root - Independently required archive root.
 * @param locale - Recorded producer collation locale.
 */
export const readOwnedPerlCallbackVariantTar = (bytes, root, locale = "en-US") => {
	const tar = gunzipSync(bytes, { maxOutputLength: 512 * 1024 ** 2 });
	assert.equal(tar.length % 512, 0);
	const files = new Map(); let offset = 0;
	while(offset + 512 <= tar.length && !zeros(tar.subarray(offset, offset + 512)))
	{
		const header = tar.subarray(offset, offset + 512);
		const checksum = header.subarray(148, 156).toString("ascii"); assert.match(checksum, /^[0-7]{6}\0 $/u);
		assert.equal(Number.parseInt(checksum, 8), header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0));
		assert.equal(header[156], 48); assert.equal(header.subarray(257, 265).toString("ascii"), "ustar\0" + "00");
		assert.ok(zeros(header.subarray(157, 257))); assert.ok(zeros(header.subarray(265, 345))); assert.ok(zeros(header.subarray(500)));
		assert.equal(octal(header.subarray(108, 116)), 0); assert.equal(octal(header.subarray(116, 124)), 0);
		assert.equal(octal(header.subarray(136, 148)), 1);
		assert.ok([0o644, 0o755].includes(octal(header.subarray(100, 108))));
		const prefix = text(header.subarray(345, 500)), name = text(header.subarray(0, 100));
		const path = prefix ? prefix + "/" + name : name;
		assert.ok(path.startsWith(root + "/"));
		const relative = path.slice(root.length + 1);
		assert.match(relative, /^[A-Za-z0-9_.+/-]+$/u);
		assert.ok(!relative.split("/").some(part => ["", ".", ".."].includes(part)));
		assert.ok(!files.has(relative), "duplicate tar entry");
		const size = octal(header.subarray(124, 136)), end = offset + 512 + size;
		assert.ok(end <= tar.length);
		files.set(relative, tar.subarray(offset + 512, end));
		offset += 512 + Math.ceil(size / 512) * 512;
		assert.ok(zeros(tar.subarray(end, offset)), "nonzero tar padding");
	}
	assert.equal(tar.length - offset, 1024); assert.ok(zeros(tar.subarray(offset)));
	assert.deepEqual([...files.keys()], [...files.keys()].sort(new Intl.Collator(locale).compare));
	assert.ok(files.size > 0); return files;
};

/**
 * Bind actual saved receipt and archive bytes to an already validated report.
 *
 * @param item - Independently validated report.
 * @param root - Retained or relocated handoff directory.
 * @param readArtifact - Byte reader, overridable for corruption tests.
 */
export const assertOwnedPerlCallbackVariantHandoff = async (item, root = item.savedHandoff, readArtifact = readFile) => {
	const receipt = await readArtifact(join(root, "package-set-receipt.json"));
	assert.equal(receipt.toString(), canonicalJson(item.packageSetReceipt));
	const sidecar = await readArtifact(join(root, "package-set-receipt.json.sha256"));
	assert.equal(sidecar.toString(), sha256(receipt) + "  package-set-receipt.json\n");
	const archives = [];
	for(const role of ["runtime", "component"])
	{
		const pkg = item.packageSetReceipt.packages.find(value => value.role === role);
		assert.ok(pkg); assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0], bytes = await readArtifact(join(root, artifact.path));
		assert.deepEqual(identity(bytes), { bytes: artifact.bytes, sha256: artifact.sha256 });
		const manifest = role === "runtime" ? item.runtimeManifest : item.manifest;
		const files = readOwnedPerlCallbackVariantTar(bytes, `${manifest.distribution}-${manifest.version}`, item.runtimeManifest.runtimePacking.collationLocale);
		assert.deepEqual([...files.keys()].sort(), [...Object.keys(manifest.files), "lean-bridge-package.json"].sort());
		assert.equal(files.get("lean-bridge-package.json").toString(), canonicalJson(manifest));
		for(const [path, digest] of Object.entries(manifest.files)) assert.equal(sha256(files.get(path)), digest, path);
		if(role === "component") for(const [path, record] of Object.entries(item.sources))
			assert.equal(files.get(path).toString(), record.source, path);
		for(const prebuilt of manifest.prebuilt)
		{
			const receiptPath = prebuilt.path.replace(/[^/]+$/u, "receipt.json");
			const buildReceipt = JSON.parse(files.get(receiptPath));
			assert.equal(files.get(receiptPath).toString(), JSON.stringify(JSON.parse(canonicalJson(buildReceipt))) + "\n");
			const installed = item.observations.find(value => value.mode === "build-xs"
				&& canonicalJson(value.receipts[0].receipt.abi) === canonicalJson(prebuilt.abi)).receipts.find(value => value.role === role).receipt;
			assert.deepEqual(Object.keys(buildReceipt).sort(), Object.keys(installed).sort());
			const normalized = structuredClone(buildReceipt);
			normalized.commands = normalized.commands.map(command => command.map((value, index) => index === 0 ? "/usr/bin/cc"
				: value.replaceAll("prebuilt/" + prebuilt.abiKey + "/", "_xs-build/")));
			normalized.generatedCSha256 = installed.generatedCSha256;
			normalized.outputSha256 = installed.outputSha256;
			assert.deepEqual(normalized, installed);
			assert.match(buildReceipt.generatedCSha256, /^[a-f0-9]{64}$/u);
			assert.deepEqual(buildReceipt.abi, prebuilt.abi);
			assert.equal(buildReceipt.outputSha256, manifest.files[prebuilt.path]);
			assert.equal(buildReceipt.sourceSha256, manifest.files[manifest.xs]);
			assert.equal(buildReceipt.runtimeIdentity, manifest.runtimeIdentity);
		}
		for(const observation of item.observations)
		{
			for(const entry of observation.nativePayload.filter(value => value.role === role))
				assert.deepEqual(identity(files.get(entry.path)), { bytes: entry.bytes, sha256: entry.sha256 });
			if(observation.mode === "prebuilt-only")
			{
				const selected = manifest.prebuilt.find(value => value.abiKey === sha256(JSON.stringify(JSON.parse(canonicalJson(observation.receipts[0].receipt.abi)))));
				assert.deepEqual(identity(files.get(selected.path)), observation.receipts.find(value => value.role === role).installed);
			}
			if(role === "component") for(const asset of observation.assets.observations)
			{
				const path = asset.asset === "OwnedProbe.so"
					? observation.mode === "prebuilt-only" ? manifest.prebuilt.find(value => manifest.files[value.path] === asset.original.sha256).path : null
					: "lib/LeanBridge/OwnedProbe/native/" + asset.asset;
				if(path) assert.deepEqual(identity(Buffer.concat([files.get(path), Buffer.from("\nchanged installed native asset\n")])), asset.forged);
			}
		}
		archives.push({ role, path: artifact.path, ...identity(bytes), files: files.size });
	}
	return { receipt: identity(receipt), sidecar: identity(sidecar), archives };
};
