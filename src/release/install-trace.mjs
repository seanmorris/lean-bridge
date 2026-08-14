/**
 * Implements the install trace module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");

/**
 * Reports install trace failures with stable machine-readable codes and structured diagnostic context.
 */
export class InstallTraceError extends Error
{
	/**
   * Initializes the error used to report install trace failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "InstallTraceError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new InstallTraceError(code, message, details);
};

const derivedRules = Object.freeze({
	npm: Object.freeze([
		Object.freeze({ pattern: /^package\.json$/, generator: "npm-v1", reason: "registry manifest" })
		, Object.freeze({ pattern: /^internal\/runtime\.mjs$/, generator: "npm-v1", reason: "canonical runtime projection" })
	])
	, c: Object.freeze([
		Object.freeze({ pattern: /^lib\/pkgconfig\/[^/]+\.pc$/, generator: "c-family-c-v1", reason: "pkg-config metadata" })
		, Object.freeze({ pattern: /^lib\/cmake\/[^/]+\/[^/]+Config\.cmake$/, generator: "c-family-c-v1", reason: "CMake package metadata" })
		, Object.freeze({ pattern: /^lib\/cmake\/[^/]+\/[^/]+ConfigVersion\.cmake$/, generator: "c-family-c-v1", reason: "CMake version metadata" })
		, Object.freeze({ pattern: /^lib\/cmake\/[^/]+\/[^/]+Targets\.cmake$/, generator: "c-family-c-v1", reason: "CMake target metadata" })
	])
	, cpp: Object.freeze([
		Object.freeze({ pattern: /^lib\/pkgconfig\/[^/]+\.pc$/, generator: "c-family-cpp-v1", reason: "pkg-config metadata" })
		, Object.freeze({ pattern: /^lib\/cmake\/[^/]+\/[^/]+Config\.cmake$/, generator: "c-family-cpp-v1", reason: "CMake package metadata" })
		, Object.freeze({ pattern: /^lib\/cmake\/[^/]+\/[^/]+ConfigVersion\.cmake$/, generator: "c-family-cpp-v1", reason: "CMake version metadata" })
		, Object.freeze({ pattern: /^lib\/cmake\/[^/]+\/[^/]+Targets\.cmake$/, generator: "c-family-cpp-v1", reason: "CMake target metadata" })
	])
});

const collectFiles = async root => {
	const files = [];
	const visit = async (directory, prefix = "") => {
		const entries = await readdir(directory, { withFileTypes: true });
		entries.sort((left, right) => left.name.localeCompare(right.name));
		for(const entry of entries)
		{
			const path = prefix ? `${prefix}/${entry.name}` : entry.name;
			const absolute = join(directory, entry.name);
			if(entry.isDirectory())
			{
				await visit(absolute, path);
				continue;
			}
			if(!entry.isFile()) fail("unsupported-installed-entry", `installed package contains a non-file entry: ${path}`);
			const bytes = await readFile(absolute);
			files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
		}
	};
	await visit(root);
	return files;
};

const addSource = (sources, record) => {
	const matches = sources.get(record.sha256) ?? [];
	matches.push(record);
	sources.set(record.sha256, matches);
};

/**
 * Records installed package as structured evidence that the deterministic release and independent-verification pipeline can verify independently.
 *
 * @param root0 - Named inputs and dependency overrides used to trace installed package.
 * @param root0.bundleRoot - Filesystem root containing the bundle.
 * @param root0.installRoot - Filesystem root containing the install.
 * @param root0.ecosystem - Registry ecosystem selecting package layout, commands, endpoint, and credential policy.
 */
export const traceInstalledPackage = async ({ bundleRoot, installRoot, ecosystem }) => {
	const rules = derivedRules[ecosystem];
	if(!rules) fail("unsupported-ecosystem", `install tracing does not support ${ecosystem}`);
	const { root: bundle, manifest, manifestSha256 } = await readVerifiedCanonicalBundle(bundleRoot);
	const sources = new Map();
	for(const artifact of manifest.artifacts)
	{
		addSource(sources, {
			kind: "canonical-artifact"
			, id: artifact.id
			, path: artifact.path
			, sha256: artifact.sha256
		});
	}
	for(const controlPath of ["canonical-package.json", "canonical-package.sha256", "bundle-identity.json"])
	{
		const bytes = await readFile(join(bundle, controlPath));
		addSource(sources, {
			kind: "canonical-control"
			, id: controlPath
			, path: controlPath
			, sha256: sha256(bytes)
		});
	}

	const files = [];
	for(const installed of await collectFiles(resolve(installRoot)))
	{
		const canonical = sources.get(installed.sha256);
		if(canonical)
		{
			files.push({ ...installed, trace: { kind: canonical[0].kind, sources: canonical } });
			continue;
		}
		const derived = rules.find(rule => rule.pattern.test(installed.path));
		if(!derived)
		{
			fail("untraceable-installed-file", `installed ${ecosystem} file has no canonical source or reviewed derivation: ${installed.path}`, {
				ecosystem
				, path: installed.path
				, sha256: installed.sha256
			});
		}
		files.push({
			...installed,
			trace: {
				kind: "backend-derived"
				, generator: derived.generator
				, reason: derived.reason
				, canonicalManifestSha256: manifestSha256
			}
		});
	}
	return Object.freeze({
		schemaVersion: 1
		, ecosystem
		, component: manifest.component.id
		, canonicalManifestSha256: manifestSha256
		, installedFiles: files.length
		, canonicalFiles: files.filter(file => file.trace.kind !== "backend-derived").length
		, derivedFiles: files.filter(file => file.trace.kind === "backend-derived").length
		, files: Object.freeze(files)
	});
};
