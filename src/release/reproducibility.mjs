/**
 * Implements the reproducibility module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";

const sha256 = source => createHash("sha256").update(source).digest("hex");

const fail = (code, message, details = {}) => {
	const error = new Error(message);
	error.name = "ReleaseGateError";
	error.code = code;
	error.details = details;
	throw error;
};

/**
 * Collects release tree in deterministic order so the deterministic release and independent-verification pipeline can compare exact evidence.
 *
 * @param directory - Filesystem directory containing the inputs to process.
 */
export const collectReleaseTree = async directory => {
	const files = new Map();
	const visit = async current => {
		const entries = await readdir(current, { withFileTypes: true });
		entries.sort((left, right) => left.name.localeCompare(right.name));
		for(const entry of entries)
		{
			const absolute = join(current, entry.name);
			if(entry.isDirectory()) await visit(absolute);
			if(entry.isFile()) files.set(relative(directory, absolute), await readFile(absolute));
		}
	};
	await visit(directory);
	return files;
};

/**
 * Compares release trees and returns bounded diagnostics for every material difference.
 *
 * @param left - Left-hand value or inventory used for comparison.
 * @param right - Right-hand value or inventory used for comparison.
 */
export const compareReleaseTrees = (left, right) => {
	const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
	const differences = [];
	const artifacts = [];
	for(const path of paths)
	{
		const first = left.get(path);
		const second = right.get(path);
		const leftSha256 = first ? sha256(first) : null;
		const rightSha256 = second ? sha256(second) : null;
		if(leftSha256 !== rightSha256)
		{
			differences.push({ path, leftSha256, rightSha256 });
			continue;
		}
		artifacts.push({ path, bytes: first.length, sha256: leftSha256 });
	}
	return Object.freeze({ artifacts, differences });
};

const portablePath = path => path.replaceAll("\\", "/");

/**
 * Collects release inventory in deterministic order so the deterministic release and independent-verification pipeline can compare exact evidence.
 *
 * @param directory - Filesystem directory containing the inputs to process.
 * @param root0 - Named inputs and dependency overrides used to collect release inventory.
 * @param root0.prefix - Optional relative-path prefix applied to every collected inventory entry.
 */
export const collectReleaseInventory = async (directory, { prefix = "" } = {}) => {
	const files = new Map();
	const visit = async current => {
		const entries = await readdir(current, { withFileTypes: true });
		entries.sort((left, right) => left.name.localeCompare(right.name));
		for(const entry of entries)
		{
			const absolute = join(current, entry.name);
			const path = portablePath(join(prefix, relative(directory, absolute)));
			if(entry.isDirectory())
			{
				await visit(absolute);
				continue;
			}
			if(!entry.isFile()) fail("unsupported-release-entry", `release inventory only accepts regular files: ${path}`);
			const [bytes, facts] = await Promise.all([readFile(absolute), lstat(absolute)]);
			files.set(path, Object.freeze({ bytes, mode: facts.mode & 0o777 }));
		}
	};
	await visit(directory);
	return files;
};

const textExtensions = new Set([
	".c", ".cc", ".cpp", ".h", ".hpp", ".html", ".js", ".json", ".lean", ".md"
	, ".mjs"
	, ".py"
	, ".pyi"
	, ".rs"
	, ".sh"
	, ".toml"
	, ".ts"
	, ".tsx"
	, ".txt"
	, ".wit"
	, ".xml"
	, ".yaml"
	, ".yml"
]);

const textPreview = (path, left, right, limit) => {
	if(!textExtensions.has(extname(path).toLowerCase())) return null;
	if(left.includes(0) || right.includes(0)) return null;
	const leftText = left.toString("utf8");
	const rightText = right.toString("utf8");
	if(Buffer.byteLength(leftText) !== left.length || Buffer.byteLength(rightText) !== right.length) return null;
	const leftLines = leftText.split("\n");
	const rightLines = rightText.split("\n");
	const count = Math.max(leftLines.length, rightLines.length);
	let line = 0;
	while(line < count && leftLines[line] === rightLines[line]) line += 1;
	const start = Math.max(0, line - 1);
	const end = Math.min(count, line + 3);
	const clip = value => value.length <= limit ? value : `${value.slice(0, limit)}\n[preview truncated]`;
	return Object.freeze({
		kind: extname(path).toLowerCase() === ".json" ? "json" : "text"
		, firstDifferentLine: line + 1
		, left: clip(leftLines.slice(start, end).join("\n"))
		, right: clip(rightLines.slice(start, end).join("\n"))
	});
};

const entropyLeads = ({ path, left, right, preview }) => {
	const leads = new Set();
	const text = preview === null ? "" : `${preview.left}\n${preview.right}`;
	if(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(text)) leads.add("timestamp");
	if(/(?:\/tmp\/|\/nix\/store\/|\/workspace\/|[A-Za-z]:\\\\)/.test(text)) leads.add("absolute-path");
	if(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(text)) leads.add("random-identifier");
	if(/\b(?:LANG|LC_ALL|LC_CTYPE|TZ)=|\blocale\b/i.test(text)) leads.add("locale-or-timezone");
	if(/\b(?:latest|main|master|HEAD)\b|https?:\/\//.test(text)) leads.add("possibly-unpinned-input");
	if(/\b(?:process\.env|environment|HOSTNAME|USER)=?/i.test(text)) leads.add("environment-derived-value");
	if(/\.(?:tgz|tar|gz|zip|whl|crate)$/i.test(path)) leads.add("archive-or-compression-metadata");
	if(/\.(?:wasm|so|o|a|dll|dylib)$/i.test(path)) leads.add("compiler-build-id-or-toolchain");
	if(path.endsWith(".json") && left !== null && right !== null)
	{
		try
		{
			if(canonicalJson(JSON.parse(left.toString("utf8"))) === canonicalJson(JSON.parse(right.toString("utf8"))))
			{
				leads.add("serialization-order");
			}
		} catch
		{
			// Invalid JSON is a useful reproducibility lead, not a fatal audit error.
		}
	}
	return [...leads].sort();
};

const record = value => value === null ? null : Object.freeze({
	bytes: value.bytes.length
	, mode: value.mode
	, sha256: sha256(value.bytes)
});

/**
 * Compares release inventories and returns bounded diagnostics for every material difference.
 *
 * @param left - Left-hand value or inventory used for comparison.
 * @param right - Right-hand value or inventory used for comparison.
 * @param root0 - Named inputs and dependency overrides used to compare release inventories.
 * @param root0.previewBytes - Maximum differing bytes retained in a reproducibility diagnostic preview.
 */
export const compareReleaseInventories = (left, right, { previewBytes = 4096 } = {}) => {
	const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
	const artifacts = [];
	const differences = [];
	for(const path of paths)
	{
		const first = left.get(path) ?? null;
		const second = right.get(path) ?? null;
		const leftRecord = record(first);
		const rightRecord = record(second);
		if(
			leftRecord !== null && rightRecord !== null
      && leftRecord.sha256 === rightRecord.sha256 && leftRecord.mode === rightRecord.mode
		) {
			artifacts.push(Object.freeze({ path, ...leftRecord }));
			continue;
		}
		const kind = first === null
			? "missing-from-build-a"
			: second === null
				? "missing-from-build-b"
				: leftRecord.mode !== rightRecord.mode && leftRecord.sha256 === rightRecord.sha256
					? "mode"
					: "content";
		const preview = first !== null && second !== null
			? textPreview(path, first.bytes, second.bytes, previewBytes)
			: null;
		differences.push(Object.freeze({
			path
			, kind
			, buildA: leftRecord
			, buildB: rightRecord
			, preview
			, likelyEntropyCategories: entropyLeads({
				path
				, left: first?.bytes ?? null
				, right: second?.bytes ?? null
				, preview
			})
		}));
	}
	return Object.freeze({ artifacts: Object.freeze(artifacts), differences: Object.freeze(differences) });
};

/**
 * Computes a stable content identity for release inventory so the deterministic release and independent-verification pipeline can reject drift.
 *
 * @param artifacts - Artifact records whose paths, sizes, and content identities are bound into the result.
 */
export const hashReleaseInventory = artifacts => sha256(canonicalJson(artifacts));

/**
 * Classifies release path using the closed categories recognized by the deterministic release and independent-verification pipeline.
 *
 * @param path - Logical or filesystem path used to locate the input and anchor precise validation diagnostics.
 */
export const classifyReleasePath = path => {
	const name = basename(path);
	const categories = [];
	if(path.endsWith(".php")) categories.push("php");
	if(path.endsWith(".c") || path.endsWith(".h")) categories.push("c");
	if(path.endsWith(".wasm")) categories.push("wasm");
	if(path.endsWith(".so") && !path.endsWith(".so.wasm")) categories.push("extension");
	if(path.endsWith(".json") || name.endsWith("manifest.mjs")) categories.push("manifest");
	if(path.includes("/stubs/") || path.startsWith("stubs/")) categories.push("stub");
	if(path.endsWith(".md")) categories.push("documentation");
	if(path.includes("/metadata/") || path.startsWith("metadata/") || path.includes("/lean-bridge/"))
	{
		categories.push("metadata");
	}
	return categories;
};

const parseHashInventory = source => source.trim().split("\n").filter(Boolean).map(line => {
  const match = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
  if(!match) fail("invalid-hash-inventory", `invalid SHA-256 inventory line: ${line}`);
  return { sha256: match[1], path: match[2] };
});

/**
 * Verifies release inventory against recorded identities and rejects any drift before the deterministic release and independent-verification pipeline proceeds.
 *
 * @param root0 - Named inputs and dependency overrides used to verify release inventory.
 * @param root0.directory - Filesystem directory containing the inputs to process.
 * @param root0.releaseManifestPath - Filesystem path to the release manifest.
 * @param root0.hashInventoryPath - Filesystem path to the hash inventory.
 * @param root0.requiredCategories - Artifact categories that must appear in the verified release inventory.
 */
export const verifyReleaseInventory = async ({ directory, releaseManifestPath, hashInventoryPath, requiredCategories }) => {
	const files = await collectReleaseTree(directory);
	const release = JSON.parse(files.get(releaseManifestPath)?.toString("utf8") ?? "null");
	if(!release || !Array.isArray(release.artifacts))
	{
		fail("missing-release-manifest", `release manifest is absent or invalid: ${releaseManifestPath}`);
	}
	const listedPaths = new Set();
	for(const artifact of release.artifacts)
	{
		const bytes = files.get(artifact.path);
		if(!bytes) fail("missing-release-artifact", `release manifest artifact is absent: ${artifact.path}`);
		const actual = sha256(bytes);
		if(actual !== artifact.sha256 || bytes.length !== artifact.bytes)
		{
			fail("release-artifact-hash-mismatch", `release manifest identity changed for ${artifact.path}`, {
				expected: { bytes: artifact.bytes, sha256: artifact.sha256 }
				, actual: { bytes: bytes.length, sha256: actual }
			});
		}
		listedPaths.add(artifact.path);
	}
	const excluded = new Set([releaseManifestPath, hashInventoryPath]);
	const unlisted = [...files.keys()].filter(path => !excluded.has(path) && !listedPaths.has(path));
	if(unlisted.length > 0) fail("unlisted-release-artifact", "release files are absent from the release manifest", { paths: unlisted });

	const inventorySource = files.get(hashInventoryPath)?.toString("utf8");
	if(inventorySource === undefined) fail("missing-hash-inventory", `SHA-256 inventory is absent: ${hashInventoryPath}`);
	const inventory = parseHashInventory(inventorySource);
	const inventoryPaths = new Set();
	for(const artifact of inventory)
	{
		const bytes = files.get(artifact.path);
		if(!bytes) fail("missing-hash-artifact", `SHA-256 inventory artifact is absent: ${artifact.path}`);
		const actual = sha256(bytes);
		if(actual !== artifact.sha256)
		{
			fail("hash-inventory-mismatch", `SHA-256 inventory changed for ${artifact.path}`, {
				expected: artifact.sha256
				, actual
			});
		}
		inventoryPaths.add(artifact.path);
	}
	const unhashed = [...files.keys()].filter(path => path !== hashInventoryPath && !inventoryPaths.has(path));
	if(unhashed.length > 0) fail("unhashed-release-artifact", "release files are absent from the SHA-256 inventory", { paths: unhashed });

	const coverage = Object.fromEntries(requiredCategories.map(category => [category, []]));
	for(const path of files.keys())
	{
		for(const category of classifyReleasePath(path))
		{
			if(coverage[category]) coverage[category].push(path);
		}
	}
	const missingCategories = Object.entries(coverage)
    .filter(([, paths]) => paths.length === 0)
    .map(([category]) => category);
	if(missingCategories.length > 0)
	{
		fail("release-category-gap", "release does not retain every required artifact category", { missingCategories });
	}

	return Object.freeze({
		packageId: release.packageId
		, bindingIrSha256: release.bindingIr.semanticSha256
		, artifactCount: files.size
		, totalBytes: [...files.values()].reduce((total, bytes) => total + bytes.length, 0)
		, releaseManifestSha256: sha256(files.get(releaseManifestPath))
		, coverage
	});
};
