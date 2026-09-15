/**
 * Node-only consistency checks for prepared multi-ecosystem archive sets.
 * No archive extraction, package code, compiler, network or signer is invoked.
 *
 * @file
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export const packageSetReceiptName = "package-set-receipt.json";
export const packageSetReceiptKind = "lean-bridge-package-set-receipt";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const canonical = value => Array.isArray(value) ? value.map(canonical)
	: value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const json = value => `${JSON.stringify(canonical(value), null, 2)}\n`;
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const invalid = message => fail("invalid-package-set-receipt", message);
const closed = (value, keys, label) => {
	if(!value || typeof value !== "object" || Array.isArray(value) || json(Object.keys(value).sort()) !== json([...keys].sort())) invalid(`${label} fields must be closed`);
};
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$(?![\s\S])/.test(value);
const token = value => typeof value === "string" && value.length <= 256 && /^[A-Za-z0-9@][A-Za-z0-9@._:/+-]*$(?![\s\S])/.test(value);
const componentId = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*@[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$(?![\s\S])/;
const pathIsSafe = value => typeof value === "string" && value.length <= 1024 && /^[A-Za-z0-9_@.+/-]+$(?![\s\S])/.test(value)
	&& value.split("/").every(part => part && part !== "." && part !== "..");
const targetProfiles = { npm: "component-scalars-v1"
	, "php-wasm": "php-wasm-copied-v1"
	, ...Object.fromEntries(["cpan", "c", "cpp", "nuget", "maven", "rubygems", "wit-wasi", "pypi", "cargo", "php-native"].map(target => [target, "native-library-v1"])) };
const ecosystemFor = target => target === "php-native" ? ["composer"] : target === "php-wasm" ? ["npm", "composer"] : [target];
const nameKey = value => `${value.ecosystem}:${value.ecosystem === "pypi" ? value.name.toLowerCase().replaceAll(/[-_.]+/g, "-")
	: ["nuget", "composer", "npm", "cargo"].includes(value.ecosystem) ? value.name.toLowerCase() : value.name}`;
const coordinate = value => `${nameKey(value)}@${value.version}`;
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const identity = value => {
	if(!["npm", "composer", "cpan", "c", "cpp", "nuget", "maven", "rubygems", "wit-wasi", "pypi", "cargo"].includes(value.ecosystem)
		|| !token(value.name) || typeof value.version !== "string" || value.version.length > 256 || !/^[0-9][A-Za-z0-9._+-]*$(?![\s\S])/.test(value.version)) invalid("Invalid package name, ecosystem or exact version");
};

/**
 * Validate identities and exact dependency closure before opening any archive.
 *
 * @param receipt - Parsed ecosystem-neutral receipt.
 */
export const validatePackageSetReceipt = receipt => {
	closed(receipt, ["schemaVersion", "kind", "component", "source", "profiles", "packages"], "package set");
	if(receipt.schemaVersion !== 1 || receipt.kind !== packageSetReceiptKind) invalid("Unsupported package-set receipt version or kind");
	closed(receipt.component, ["id", "name", "version"], "component");
	if(typeof receipt.component.name !== "string" || !receipt.component.name.length || receipt.component.name.length > 256
		|| !token(receipt.component.id) || !componentId.test(receipt.component.id)
		|| receipt.component.version !== receipt.component.id.slice(receipt.component.id.lastIndexOf("@") + 1)) invalid("Inconsistent component identity");
	closed(receipt.source, ["treeSha256"], "source");
	if(!hash(receipt.source.treeSha256)) invalid("Invalid source tree identity");
	if(!Array.isArray(receipt.profiles) || !receipt.profiles.length || receipt.profiles.length > 3) invalid("Expected one to three ABI profiles");
	if(!Array.isArray(receipt.packages) || !receipt.packages.length || receipt.packages.length > 128) invalid("Expected one to 128 packages");
	const profiles = new Map(), names = new Map(), paths = new Set(), packages = new Map();
	for(const profile of receipt.profiles)
	{
		closed(profile, ["id", "bindingIrSha256", "runtimeIdentity"], "profile");
		if(!Object.values(targetProfiles).includes(profile.id) || profiles.has(profile.id) || !hash(profile.bindingIrSha256) || !hash(profile.runtimeIdentity)) invalid("Invalid or duplicate compiled profile");
		profiles.set(profile.id, profile);
	}
	for(const pkg of receipt.packages)
	{
		closed(pkg, ["target", "ecosystem", "name", "version", "profile", "role", "runtimeIdentity", "runtimeDelivery", "requires", "artifacts"], "package");
		identity(pkg);
		if(!Object.hasOwn(targetProfiles, pkg.target) || targetProfiles[pkg.target] !== pkg.profile || !ecosystemFor(pkg.target).includes(pkg.ecosystem)) invalid("Package target, ecosystem and profile disagree");
		if(pkg.runtimeIdentity !== profiles.get(pkg.profile)?.runtimeIdentity) fail("package-set-runtime-mismatch", "Package runtime differs from its compiled profile");
		if(!["runtime", "component", "api"].includes(pkg.role) || !["provided", "embedded", "dependency"].includes(pkg.runtimeDelivery)) invalid("Invalid package role or runtime delivery");
		const runtimeTarget = pkg.target === "npm" || pkg.target === "cpan" || pkg.target === "php-wasm";
		if(pkg.role === "runtime" ? (!runtimeTarget || pkg.runtimeDelivery !== "provided" || pkg.ecosystem === "composer")
			: pkg.runtimeDelivery !== (runtimeTarget ? "dependency" : "embedded")) invalid("Package role and runtime delivery disagree");
		if((pkg.role === "api") !== (pkg.target === "php-wasm" && pkg.ecosystem === "composer")) invalid("Only the PHP-Wasm Composer companion has the API role");
		if(names.has(nameKey(pkg))) fail("package-set-coordinate-conflict", `Package name is supplied more than once: ${nameKey(pkg)}`);
		names.set(nameKey(pkg), pkg); packages.set(coordinate(pkg), pkg);
		if(!Array.isArray(pkg.requires) || pkg.requires.length > 16) invalid("Invalid in-set dependencies");
		for(const requirement of pkg.requires)
		{ closed(requirement, ["ecosystem", "name", "version"], "dependency"); identity(requirement); }
		if(new Set(pkg.requires.map(coordinate)).size !== pkg.requires.length) invalid("Repeated in-set dependencies");
		if(!Array.isArray(pkg.artifacts) || !pkg.artifacts.length || pkg.artifacts.length > 16) invalid("Expected one to sixteen files per package");
		for(const artifact of pkg.artifacts)
		{
			closed(artifact, ["path", "bytes", "sha256"], "artifact");
			if(!pathIsSafe(artifact.path) || [packageSetReceiptName, `${packageSetReceiptName}.sha256`].includes(basename(artifact.path))
				|| paths.has(artifact.path) || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1 || artifact.bytes > 4 * 1024 ** 3 || !hash(artifact.sha256)) invalid("Unsafe, duplicate or invalid archive entry");
			paths.add(artifact.path);
		}
	}
	const visited = new Set(), visiting = new Set();
	const visit = pkg => {
		const key = coordinate(pkg);
		if(visiting.has(key)) invalid("Package dependencies contain a cycle");
		if(visited.has(key)) return;
		visiting.add(key);
		for(const required of pkg.requires)
		{
			const dependency = packages.get(coordinate(required));
			if(!dependency || dependency.profile !== pkg.profile || dependency.runtimeIdentity !== pkg.runtimeIdentity) fail("package-set-runtime-mismatch", `Missing or incompatible dependency: ${coordinate(required)}`);
			visit(dependency);
		}
		visiting.delete(key); visited.add(key);
	};
	for(const pkg of receipt.packages)
	{
		visit(pkg);
		if(pkg.runtimeDelivery !== "dependency" && pkg.requires.length) invalid("Embedded and provider packages cannot require another package in this set");
		if(pkg.runtimeDelivery === "dependency")
		{
			const provider = pkg.requires.map(required => packages.get(coordinate(required))).find(dependency => dependency.role === "runtime");
			if(!provider) fail("package-set-runtime-mismatch", `No exact runtime package for ${coordinate(pkg)}`);
			if(pkg.role === "api" && !pkg.requires.some(required => packages.get(coordinate(required)).role === "component")) invalid("PHP-Wasm API package requires its component extension");
		}
	}
	for(const profile of profiles.keys()) if(!receipt.packages.some(pkg => pkg.profile === profile && pkg.role !== "runtime")) invalid("Compiled profile has no component package");
	return true;
};

/**
 * Read a bounded regular file without following its final symlink or running code.
 *
 * @param path - Explicit receipt path.
 * @param signal - Optional cancellation signal.
 * @param limit - Maximum receipt bytes.
 */
export const readReceiptBytes = async (path, signal, limit = 4 * 1024 ** 2) => {
	signal?.throwIfAborted();
	if((await lstat(path)).isSymbolicLink()) invalid("Receipt paths cannot be symlinks");
	const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try
	{
		const before = await file.stat();
		if(!before.isFile() || before.size > limit) invalid("Receipt must be a bounded regular file");
		const chunks = [], buffer = Buffer.alloc(65536); let size = 0;
		while(true)
		{
			signal?.throwIfAborted();
			const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
			if(!bytesRead) break;
			size += bytesRead;
			if(size > limit) invalid("Receipt exceeds its size limit");
			chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
		}
		const after = await file.stat();
		if(size !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) invalid("Receipt changed while reading");
		return Buffer.concat(chunks);
	} finally
	{ await file.close(); }
};

const archiveIdentity = async (root, path, signal) => {
	if(!pathIsSafe(path)) invalid("Unsafe artifact path");
	let current = root;
	for(const part of path.split("/"))
	{
		current = join(current, part);
		if((await lstat(current)).isSymbolicLink()) invalid("Artifact paths cannot contain symlinks");
	}
	const file = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try
	{
		const before = await file.stat(), hash = createHash("sha256");
		if(!before.isFile() || before.size > 4 * 1024 ** 3) invalid("Artifact must be a bounded regular file");
		const buffer = Buffer.alloc(1024 * 1024); let bytes = 0;
		while(true)
		{
			signal?.throwIfAborted();
			const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
			if(!bytesRead) break;
			bytes += bytesRead;
			if(bytes > before.size) invalid("Artifact grew while hashing");
			hash.update(buffer.subarray(0, bytesRead));
		}
		const after = await file.stat();
		if(bytes !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) invalid("Artifact changed while hashing");
		return { path, bytes, sha256: hash.digest("hex") };
	} finally
	{ await file.close(); }
};

/**
 * Verify a receipt, its mandatory hash sidecar, and every named artifact.
 *
 * @param options - Receipt path, optional archive root and cancellation signal.
 */
export const readVerifiedPackageSetReceipt = async options => {
	const { receiptPath, artifactRoot = null, signal } = options;
	signal?.throwIfAborted();
	const path = resolve(receiptPath), bytes = await readReceiptBytes(path, signal), receipt = JSON.parse(bytes.toString("utf8"));
	validatePackageSetReceipt(receipt);
	if(!Buffer.from(json(receipt)).equals(bytes)) invalid("Package-set receipt must use canonical JSON");
	const receiptSha256 = digest(bytes);
	if(!(await readReceiptBytes(`${path}.sha256`, signal, 2048)).equals(Buffer.from(`${receiptSha256}  ${basename(path)}\n`))) fail("package-set-sidecar-mismatch", "Package-set receipt hash sidecar differs");
	const root = await realpath(resolve(artifactRoot ?? dirname(path)));
	for(const pkg of receipt.packages) for(const artifact of pkg.artifacts)
	{
		const actual = await archiveIdentity(root, artifact.path, signal);
		if(json(actual) !== json(artifact)) fail("package-set-artifact-mismatch", `Archive differs from the package-set receipt: ${artifact.path}`);
	}
	const result = Object.freeze({ verified: true
		, component: receipt.component.id, receiptSha256
		, profiles: receipt.profiles.map(profile => profile.id)
		, packages: receipt.packages.map(pkg => ({ target: pkg.target, ecosystem: pkg.ecosystem, name: pkg.name, version: pkg.version }))
		, archives: receipt.packages.reduce((count, pkg) => count + pkg.artifacts.length, 0) });
	return { receipt, result };
};

/**
 * Check a prepared handoff using only Node and the recorded archive paths.
 *
 * @param options - Receipt path, optional archive root and cancellation signal.
 */
export const verifyPackageSetReceipt = async options => (await readVerifiedPackageSetReceipt(options)).result;

/**
 * Write an additive receipt after checking the producer's exact archive hashes.
 *
 * @param options - Output root and verified producer identities, packages and signal.
 */
export const writePackageSetReceipt = async options => {
	const { root, component, source, profiles, packages, signal } = options;
	const document = structuredClone({ schemaVersion: 1, kind: packageSetReceiptKind, component, source, profiles, packages });
	document.profiles.sort((a, b) => compare(a.id, b.id));
	document.packages.sort((a, b) => compare(coordinate(a), coordinate(b)));
	const directory = await realpath(root);
	for(const name of [packageSetReceiptName, `${packageSetReceiptName}.sha256`])
	{
		const existing = await lstat(join(directory, name)).catch(error => {
			if(error.code !== "ENOENT") throw error;
			return null;
		});
		if(existing) fail("package-set-output-exists", `Package-set output already exists: ${name}`);
	}
	for(const pkg of document.packages)
	{
		pkg.requires.sort((a, b) => compare(coordinate(a), coordinate(b)));
		pkg.artifacts.sort((a, b) => compare(a.path, b.path));
		for(const [index, expected] of pkg.artifacts.entries())
		{
			const actual = await archiveIdentity(directory, expected.path, signal);
			if(expected.sha256 !== actual.sha256 || (expected.bytes !== undefined && expected.bytes !== actual.bytes)) fail("package-set-artifact-mismatch", `Producer archive identity differs: ${expected.path}`);
			pkg.artifacts[index] = actual;
		}
	}
	validatePackageSetReceipt(document);
	const bytes = json(document);
	signal?.throwIfAborted();
	await writeFile(join(directory, packageSetReceiptName), bytes, { flag: "wx" });
	await writeFile(join(directory, `${packageSetReceiptName}.sha256`), `${digest(bytes)}  ${packageSetReceiptName}\n`, { flag: "wx" });
	return document;
};
