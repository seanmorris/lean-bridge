/**
 * Capture Lake's locked package set without fetching or running package code.
 *
 * @file
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { devNull } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../capsule/node.mjs";

const execute = promisify(execFile);
const captured = new WeakMap();
const manifestName = "lake-dependency-snapshot.json";
const packageName = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$(?![\s\S])/;
const excluded = new Set([".git", ".lake", ".direnv", ".toolchains", ".venv", "node_modules", "build", "dist", "target", ".env", ".npmrc"]);
const defaults = Object.freeze({ packages: 1024, files: 100000, fileBytes: 16 * 1024 * 1024, totalBytes: 256 * 1024 * 1024 });
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const frozen = value => {
	if(object(value) || Array.isArray(value))
	{
		Object.values(value).forEach(frozen);
		Object.freeze(value);
	}
	return value;
};
const closed = (value, allowed, required, label) => {
	if(!object(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !(key in value)))
		fail("invalid-lake-snapshot", `${label} has invalid fields`);
};
const controls = value => [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const text = value => typeof value === "string" && value.length > 0 && !controls(value);
const safePath = value => text(value) && !isAbsolute(value) && !value.includes("\\") && !value.includes(":")
	&& value.split("/").every(part => part && part !== "." && part !== "..");
const localPath = value => text(value) && !isAbsolute(value) && !value.includes("\\") && !value.includes(":");
const ignored = path => path.split("/").some(part => excluded.has(part) || part.startsWith(".env.") || part.startsWith(".lean-bridge-"));
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const inside = (parent, child) => {
	const path = relative(parent, child);
	return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
};
const policy = limits => {
	closed(limits, Object.keys(defaults), [], "snapshot limits");
	const result = { ...defaults, ...limits };
	if(Object.values(result).some(value => !Number.isSafeInteger(value) || value < 1)) fail("invalid-lake-snapshot", "Snapshot limits must be positive integers");
	return result;
};

const readRegular = async (path, maximum, signal) => {
	signal?.throwIfAborted();
	const before = await lstat(path);
	if(!before.isFile() || await realpath(path) !== path) fail("unsafe-lake-source", "Dependency inputs must be regular files without symlinks");
	if(before.size > maximum) fail("lake-snapshot-limit", "Dependency input exceeds the file size limit");
	const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try
	{
		const stat = await file.stat();
		if(!stat.isFile() || stat.ino !== before.ino || stat.dev !== before.dev || stat.size > maximum)
			fail("lake-source-drift", "Dependency input changed while opening it");
		// Reserve only the observed size plus one byte to detect concurrent growth.
		const buffer = Buffer.alloc(stat.size + 1);
		let length = 0;
		while(length < buffer.length)
		{
			signal?.throwIfAborted();
			const { bytesRead } = await file.read(buffer, length, Math.min(65536, buffer.length - length), null);
			if(bytesRead === 0) break;
			length += bytesRead;
		}
		const bytes = buffer.subarray(0, length);
		const after = await file.stat();
		if(bytes.length > maximum) fail("lake-snapshot-limit", "Dependency input exceeds the file size limit");
		const current = await lstat(path);
		if(bytes.length !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs
			|| current.ino !== stat.ino || current.dev !== stat.dev || await realpath(path) !== path)
			fail("lake-source-drift", "Dependency input changed while reading it");
		return { bytes, mode: (stat.mode & 0o111) ? 0o755 : 0o644 };
	} finally
	{ await file.close(); }
};

const inventory = async (root, limits, signal, exclude = true) => {
	const files = new Map();
	let size = 0;
	const visit = async prefix => {
		signal?.throwIfAborted();
		const directory = join(root, prefix);
		if(await realpath(directory) !== directory) fail("unsafe-lake-source", "Dependency directories cannot be symlinked");
		const before = await lstat(directory);
		if(!before.isDirectory()) fail("unsafe-lake-source", "Dependency roots must be directories");
		if(prefix.split("/").length > 128) fail("lake-snapshot-limit", "Dependency source nesting exceeds 128 directories");
		for(const name of (await readdir(directory)).sort())
		{
			const path = prefix ? `${prefix}/${name}` : name;
			if(exclude && ignored(path)) continue;
			if(!safePath(path)) fail("unsafe-lake-source", "Dependency contains a nonportable source path");
			const absolute = join(root, path);
			const stat = await lstat(absolute);
			if(stat.isSymbolicLink()) fail("unsafe-lake-source", "Dependency source cannot contain symlinks");
			if(stat.isDirectory()) await visit(path);
			else
			{
				if(files.size >= limits.files) fail("lake-snapshot-limit", "Dependency exceeds the source file limit");
				const entry = await readRegular(absolute, limits.fileBytes, signal);
				size += entry.bytes.length;
				if(size > limits.totalBytes) fail("lake-snapshot-limit", "Dependency exceeds the source byte limit");
				files.set(path, entry);
			}
		}
		const after = await lstat(directory);
		if(before.ino !== after.ino || before.dev !== after.dev || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs
			|| await realpath(directory) !== directory) fail("lake-source-drift", "Dependency directory changed during capture");
	};
	await visit("");
	return files;
};
const describe = files => [...files].map(([path, entry]) => ({ path, bytes: entry.bytes.length, sha256: sha256(entry.bytes), mode: entry.mode }))
	.sort((left, right) => compare(left.path, right.path));
const optional = async operation => {
	try
	{ return await operation(); }
	catch(error)
	{ if(error.code === "ENOENT") return null; throw error; }
};
const parse = bytes => {
	if(!Buffer.from(bytes.toString("utf8")).equals(bytes)) fail("invalid-lake-snapshot", "Lake manifest must use UTF-8");
	try
	{ return JSON.parse(bytes.toString("utf8")); }
	catch
	{ fail("invalid-lake-snapshot", "Lake manifest must contain valid JSON"); }
};
const remote = value => {
	if(!text(value)) return false;
	if(!value.includes("://")) return /^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9.-]+:[A-Za-z0-9._~/-]+$(?![\s\S])/.test(value);
	try
	{
		const url = new URL(value);
		return ["https:", "ssh:"].includes(url.protocol) && !!url.hostname && !url.password && !url.search && !url.hash
			&& (url.protocol === "ssh:" || !url.username);
	} catch
	{ return false; }
};
const validateEntry = entry => {
	const shared = ["name", "scope", "inherited", "configFile", "manifestFile"];
	const fields = entry?.type === "path" ? ["dir"] : ["url", "rev", "inputRev", "subDir"];
	closed(entry, ["type", ...shared, ...fields], ["type", "name", "inherited", ...(entry?.type === "path" ? ["dir"] : ["url", "rev"])], "Lake package entry");
	if(typeof entry.name !== "string" || !packageName.test(entry.name) || typeof entry.inherited !== "boolean"
		|| (entry.scope !== undefined && (typeof entry.scope !== "string" || controls(entry.scope))))
		fail("invalid-lake-snapshot", "Lake package names, scopes and inheritance must be explicit and portable");
	if(entry.configFile !== undefined && !safePath(entry.configFile)) fail("invalid-lake-snapshot", "Lake configFile must stay inside its package");
	if(entry.manifestFile != null && !safePath(entry.manifestFile)) fail("invalid-lake-snapshot", "Lake manifestFile must stay inside its package");
	if(entry.type === "path")
	{
		if(!localPath(entry.dir)) fail("invalid-lake-snapshot", "Local dependency paths must be relative");
	}
	else if(entry.type === "git")
	{
		if(!remote(entry.url) || typeof entry.rev !== "string" || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$(?![\s\S])/.test(entry.rev))
			fail("unpinned-lake-dependency", "Git dependencies require a credential-free remote and a full commit identity");
		if(entry.inputRev != null && !text(entry.inputRev)) fail("invalid-lake-snapshot", "Lake inputRev must be a string or null");
		if(entry.subDir != null && !safePath(entry.subDir)) fail("invalid-lake-snapshot", "Git subDir must stay inside its checkout");
	}
	else fail("invalid-lake-snapshot", "Only locked Git and local path dependencies are supported");
};

const git = async (root, args, signal, maximum) => {
	const env = {
		PATH: process.env.PATH, LANG: "C.UTF-8", LC_ALL: "C.UTF-8"
		, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull
		, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0"
		, GIT_NO_LAZY_FETCH: "1", GIT_ALLOW_PROTOCOL: ""
	};
	try
	{
		return (await execute("git", ["--no-replace-objects", "-c", "core.fsmonitor=false", "-C", root, ...args], {
			env, signal, encoding: "buffer", timeout: 30000, maxBuffer: maximum
		})).stdout;
	} catch(error)
	{
		signal?.throwIfAborted();
		fail("lake-git-unavailable", error.code === "ENOENT" ? "Git is required to verify locked checkouts" : "Cannot verify the cached Git dependency offline");
	}
};
const gitObjectHash = (type, bytes, revision) => createHash(revision.length === 40 ? "sha1" : "sha256")
	.update(`${type} ${bytes.length}\0`).update(bytes).digest("hex");
const gitTree = async (root, entry, limits, signal) => {
	const actualRoot = (await git(root, ["rev-parse", "--show-toplevel"], signal, limits.fileBytes)).toString().trim();
	const head = (await git(root, ["rev-parse", "--verify", "HEAD^{commit}"], signal, limits.fileBytes)).toString().trim();
	if(await realpath(actualRoot) !== root || head !== entry.rev) fail("lake-git-drift", "Cached Git dependency does not match its locked checkout and commit");
	const commit = await git(root, ["cat-file", "commit", entry.rev], signal, limits.fileBytes);
	if(gitObjectHash("commit", commit, entry.rev) !== entry.rev) fail("lake-git-drift", "Cached commit bytes do not match the locked identity");
	const rootTree = /^tree ([0-9a-f]+)\n/.exec(commit.toString("utf8"))?.[1];
	if(rootTree?.length !== entry.rev.length) fail("lake-git-drift", "Locked commit has an invalid root tree");
	const bytes = await git(root, ["ls-tree", "-rtz", "--full-tree", entry.rev], signal, limits.totalBytes);
	if(!Buffer.from(bytes.toString("utf8")).equals(bytes)) fail("unsafe-lake-source", "Git source paths must use UTF-8");
	const tree = new Map();
	const directories = new Map([["", { identity: rootTree, children: [] }]]);
	const paths = new Set();
	for(const line of bytes.toString("utf8").split("\0").filter(Boolean))
	{
		const match = /^(100644 blob|100755 blob|040000 tree) ([0-9a-f]+)\t([\s\S]+)$/.exec(line);
		if(!match || match[2].length !== entry.rev.length || !safePath(match[3]) || ignored(match[3]))
			fail("unsafe-lake-source", "Locked Git inputs must be regular source files without submodules, symlinks or excluded build/secret paths");
		const [, kind, identity, path] = match;
		if(paths.has(path)) fail("lake-git-drift", "Locked Git tree contains duplicate paths");
		paths.add(path);
		const parent = directories.get(dirname(path) === "." ? "" : dirname(path));
		if(!parent) fail("lake-git-drift", "Locked Git tree is missing a parent directory");
		const directory = kind === "040000 tree";
		const mode = directory ? "40000" : kind.slice(0, 6);
		parent.children.push(Buffer.from(`${mode} ${basename(path)}\0`), Buffer.from(identity, "hex"));
		if(directory) directories.set(path, { identity, children: [] });
		else tree.set(path, { object: identity, mode: mode === "100755" ? 0o755 : 0o644 });
	}
	// Reconstruct Git's binary trees in emitted order and check every tree hash.
	// Matching filenames from ls-tree alone would trust corrupt cached objects.
	for(const directory of directories.values())
		if(gitObjectHash("tree", Buffer.concat(directory.children), entry.rev) !== directory.identity)
			fail("lake-git-drift", "Cached tree bytes do not match the locked identity");
	return tree;
};
const assertGitFiles = (files, tree, revision) => {
	if(!same([...files.keys()].sort(), [...tree.keys()].sort())) fail("lake-git-drift", "Cached Git dependency has missing or untracked source files");
	for(const [path, file] of files)
	{
		const identity = gitObjectHash("blob", file.bytes, revision);
		if(identity !== tree.get(path).object || file.mode !== tree.get(path).mode) fail("lake-git-drift", "Cached Git dependency source bytes or executable mode differ from the pin");
	}
};
const checkAggregate = (files, limits) => {
	if(files.size > limits.files || [...files.values()].reduce((size, file) => size + file.bytes.length, 0) > limits.totalBytes)
		fail("lake-snapshot-limit", "Locked dependency set exceeds the aggregate file or byte limit");
};
const resolveConfig = (contents, packageRoot, requested) => {
	const candidates = extname(requested) ? [requested] : [`${requested}.lean`, `${requested}.toml`];
	const found = candidates.find(path => contents.has(packageRoot ? `${packageRoot}/${path}` : path));
	if(!found) fail("missing-lake-input", "Locked dependency configuration is missing");
	if(![".lean", ".toml"].includes(extname(found))) fail("invalid-lake-snapshot", "Lake configurations must use Lean or TOML");
	return found;
};
const rejectOverrides = async (root, lakeDir) => {
	if(await optional(() => lstat(join(root, lakeDir, "package-overrides.json"))))
		fail("unsupported-lake-overrides", "Package overrides must be resolved into the lock before snapshotting");
};

/**
 * Validate portable snapshot metadata without consulting the original workspace.
 * This checks structure, not authenticity. Readers must supply a trusted digest.
 *
 * @param document - Detached snapshot document.
 * @param options - Optional resource limits.
 * @param options.limits - Positive package, file and byte limits.
 */
export const validateLakeDependencySnapshotDocument = (document, { limits = {} } = {}) => {
	const bound = policy(limits);
	const digest = value => typeof value === "string" && /^[0-9a-f]{64}$(?![\s\S])/.test(value);
	closed(document, ["schemaVersion", "kind", "toolchain", "rootInputs", "packages"], ["schemaVersion", "kind", "toolchain", "rootInputs", "packages"], "snapshot");
	if(![1, 2].includes(document.schemaVersion) || document.kind !== "lean-bridge-lake-dependency-snapshot"
		|| typeof document.toolchain !== "string" || !/^leanprover\/lean4:v[0-9]+\.[0-9]+\.[0-9]+$(?![\s\S])/.test(document.toolchain)
		|| !Array.isArray(document.packages) || document.packages.length > bound.packages)
		fail("invalid-lake-snapshot", "Snapshot version, toolchain or package set is invalid");
	let count = 0, size = 0;
	const checkFiles = files => {
		if(!Array.isArray(files)) fail("invalid-lake-snapshot", "Snapshot files must be an array");
		let previous = "";
		const paths = new Set();
		for(const file of files)
		{
			closed(file, ["path", "bytes", "sha256", "mode"], ["path", "bytes", "sha256", "mode"], "snapshot file");
			if(!safePath(file.path) || ignored(file.path) || file.path.split("/").length > 128 || file.path <= previous
				|| !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !digest(file.sha256) || ![0o644, 0o755].includes(file.mode))
				fail("invalid-lake-snapshot", "Snapshot file paths and identities must be unique, sorted and portable");
			for(let parent = dirname(file.path); parent !== "."; parent = dirname(parent))
				if(paths.has(parent)) fail("invalid-lake-snapshot", "Snapshot file cannot also be a directory");
			previous = file.path;
			paths.add(file.path);
			count += 1; size += file.bytes;
			if(file.bytes > bound.fileBytes || count > bound.files || size > bound.totalBytes)
				fail("lake-snapshot-limit", "Snapshot exceeds the aggregate file or byte limit");
		}
		return paths;
	};
	const root = checkFiles(document.rootInputs);
	if(!root.has("lake-manifest.json") || !root.has("lean-toolchain") || (document.schemaVersion === 1 && root.size !== 2))
		fail("invalid-lake-snapshot", "Snapshot must include the root lock and toolchain");
	let previous = "";
	for(const pkg of document.packages)
	{
		const keys = ["name", "scope", "inherited", "directory", "packageRoot", "configFile", "manifestFile", "source", "files", "treeSha256"];
		closed(pkg, keys, keys, "snapshot package");
		const sourceKeys = pkg.source?.type === "path" ? ["type", "dir"] : ["type", "url", "rev", "inputRev", "subDir"];
		closed(pkg.source, sourceKeys, sourceKeys, "snapshot package source");
		validateEntry({ ...pkg.source, name: pkg.name, scope: pkg.scope, inherited: pkg.inherited, configFile: pkg.configFile, manifestFile: pkg.manifestFile });
		if(pkg.name <= previous || pkg.directory !== `packages/${pkg.name}` || typeof pkg.scope !== "string"
			|| pkg.packageRoot !== (pkg.source.type === "git" ? pkg.source.subDir ?? "" : "")
			|| (pkg.manifestFile !== null && !safePath(pkg.manifestFile)))
			fail("invalid-lake-snapshot", "Snapshot package roots and identities must be unique, sorted and portable");
		previous = pkg.name;
		const paths = checkFiles(pkg.files);
		if(resolveConfig(paths, pkg.packageRoot, pkg.configFile) !== pkg.configFile
			|| (pkg.manifestFile !== null && !paths.has([pkg.packageRoot, pkg.manifestFile].filter(Boolean).join("/")))
			|| !digest(pkg.treeSha256) || pkg.treeSha256 !== sha256(canonicalJson(pkg.files)))
			fail("invalid-lake-snapshot", "Snapshot package configuration or tree identity is invalid");
	}
	return true;
};

/**
 * Load a transported snapshot against the digest authorized by its build plan.
 * No Git checkout, host compiler, original path or network access is required.
 *
 * @param options - Detached directory and independently expected identity.
 * @param options.snapshotRoot - Transported snapshot directory.
 * @param options.expectedSha256 - Required digest from the verified build inputs.
 * @param options.signal - Optional cancellation signal.
 * @param options.limits - Optional positive resource limits.
 */
export const readLakeDependencySnapshot = async ({ snapshotRoot, expectedSha256, signal, limits = {} }) => {
	if(typeof expectedSha256 !== "string" || !/^[0-9a-f]{64}$(?![\s\S])/.test(expectedSha256))
		fail("invalid-lake-snapshot", "Loading requires an independently expected snapshot digest");
	const bound = policy(limits);
	const root = resolve(snapshotRoot);
	if(await realpath(root) !== root) fail("unsafe-lake-source", "Snapshot directories cannot be symlinked");
	const marker = await readRegular(join(root, manifestName), Math.max(65536, bound.totalBytes), signal);
	if(marker.mode !== 0o644 || sha256(marker.bytes) !== expectedSha256)
		fail("lake-snapshot-drift", "Snapshot manifest differs from the authorized identity");
	const document = parse(marker.bytes);
	validateLakeDependencySnapshotDocument(document, { limits: bound });
	if(!marker.bytes.equals(Buffer.from(canonicalJson(document)))) fail("invalid-lake-snapshot", "Snapshot manifest must use canonical JSON");
	const files = await inventory(root, { ...bound, files: bound.files + 1
		, fileBytes: Math.max(bound.fileBytes, marker.bytes.length)
		, totalBytes: bound.totalBytes + marker.bytes.length }, signal, false);
	if(files.get(manifestName)?.mode !== marker.mode || !files.get(manifestName)?.bytes.equals(marker.bytes)) fail("lake-snapshot-drift", "Snapshot manifest changed while loading");
	files.delete(manifestName);
	const expected = document.rootInputs.map(file => ({ ...file, path: `root/${file.path}` }))
		.concat(document.packages.flatMap(pkg => pkg.files.map(file => ({ ...file, path: `${pkg.directory}/${file.path}` }))))
		.sort((a, b) => compare(a.path, b.path));
	if(!same(describe(files), expected)) fail("lake-snapshot-drift", "Snapshot files differ from the authorized identity");
	if(files.get("root/lean-toolchain").bytes.toString("utf8").trim() !== document.toolchain)
		fail("lake-toolchain-drift", "Snapshot toolchain differs from its captured source");
	// Match the transport metadata to the captured lock, without following local
	// paths or fetching Git. The original capture verified pins and Git objects.
	const lock = parse(files.get("root/lake-manifest.json").bytes);
	if(!Array.isArray(lock.packages) || lock.packages.length !== document.packages.length)
		fail("invalid-lake-snapshot", "Snapshot package set differs from its captured lock");
	const names = new Set();
	for(const entry of lock.packages)
	{
		validateEntry(entry);
		const pkg = document.packages.find(item => item.name === entry.name);
		const source = entry.type === "path" ? { type: "path", dir: entry.dir }
			: { type: "git", url: entry.url, rev: entry.rev, inputRev: entry.inputRev ?? null, subDir: entry.subDir ?? null };
		const configFile = pkg && resolveConfig(new Set(pkg.files.map(file => file.path)), pkg.packageRoot, entry.configFile ?? "lakefile");
		if(!pkg || names.has(entry.name) || !same(pkg.source, source) || pkg.scope !== (entry.scope ?? "")
			|| pkg.inherited !== entry.inherited || pkg.configFile !== configFile || pkg.manifestFile !== (entry.manifestFile === undefined ? "lake-manifest.json" : entry.manifestFile))
			fail("invalid-lake-snapshot", "Snapshot package identity differs from its captured lock");
		names.add(entry.name);
	}
	const snapshot = Object.freeze({ document: frozen(document), sha256: expectedSha256 });
	captured.set(snapshot, { files, limits: bound, roots: [root] });
	return snapshot;
};

/**
 * Verify that a clean relocated project contains the captured root inputs.
 * Dependency locations are deliberately not followed by this check.
 *
 * @param options - Complete capture and relocated root.
 * @param options.snapshot - Opaque complete snapshot prepared or read by this process.
 * @param options.projectRoot - Independent root checkout to compare.
 * @param options.signal - Optional cancellation signal.
 */
export const verifyLakeSnapshotProject = async ({ snapshot, projectRoot, signal }) => {
	const state = captured.get(snapshot);
	if(!state || snapshot.document.schemaVersion !== 2) fail("invalid-lake-snapshot", "Project verification requires a complete prepared snapshot");
	const root = await realpath(projectRoot);
	const files = await inventory(root, state.limits, signal);
	if(!same(describe(files), snapshot.document.rootInputs))
		fail("lake-source-drift", "Independent project files differ from the captured root inputs");
	return true;
};

/**
 * Capture the flat package set recorded by Lake, including inherited entries.
 * This inventories inputs only; it does not authorize types or resolve imports.
 *
 * @param options - Source and resource limits.
 * @param options.projectRoot - Read-only Lake project with an existing lock.
 * @param options.signal - Optional cancellation signal.
 * @param options.limits - Optional positive package, file and byte limits.
 * @param options.includeProject - Capture root project files as well as dependency inputs.
 */
export const prepareLakeDependencySnapshot = async ({ projectRoot, signal, limits = {}, includeProject = false }) => {
	if(typeof includeProject !== "boolean") fail("invalid-lake-snapshot", "includeProject must be a boolean");
	const bound = policy(limits);
	const root = await realpath(projectRoot);
	const lock = await optional(() => readRegular(join(root, "lake-manifest.json"), bound.fileBytes, signal));
	if(!lock) fail("missing-lake-lock", "Create and review a Lake lock before capturing dependencies");
	const toolchain = await readRegular(join(root, "lean-toolchain"), bound.fileBytes, signal);
	const version = toolchain.bytes.toString("utf8").trim();
	if(!/^leanprover\/lean4:v[0-9]+\.[0-9]+\.[0-9]+$(?![\s\S])/.test(version)) fail("unpinned-lake-toolchain", "Snapshot requires an exact Lean release toolchain");
	const manifest = parse(lock.bytes);
	closed(manifest, ["version", "name", "lakeDir", "packagesDir", "packages", "fixedToolchain"], ["version", "packages"], "Lake manifest");
	if(!["1.0.0", "1.1.0", "1.2.0"].includes(manifest.version) || !Array.isArray(manifest.packages)
		|| manifest.packages.length > bound.packages) fail("invalid-lake-snapshot", "Lake manifest version or package count is unsupported");
	if((manifest.name !== undefined && (typeof manifest.name !== "string" || controls(manifest.name)))
		|| (manifest.fixedToolchain !== undefined && typeof manifest.fixedToolchain !== "boolean"))
		fail("invalid-lake-snapshot", "Lake root name and fixedToolchain have invalid types");
	const lakeDir = manifest.lakeDir === undefined ? ".lake" : manifest.lakeDir;
	const packagesDir = manifest.packagesDir ?? ".lake/packages";
	if(!safePath(lakeDir) || !safePath(packagesDir)) fail("invalid-lake-snapshot", "Lake cache directories must stay inside the source project");
	await rejectOverrides(root, lakeDir);
	const rootFiles = includeProject ? await inventory(root, bound, signal)
		: new Map([["lake-manifest.json", lock], ["lean-toolchain", toolchain]]);
	for(const [path, expected] of [["lake-manifest.json", lock], ["lean-toolchain", toolchain]])
		if(!rootFiles.get(path)?.bytes.equals(expected.bytes)) fail("lake-source-drift", "Root inputs changed before project capture");
	const files = new Map([...rootFiles].map(([path, file]) => [`root/${path}`, file]));
	checkAggregate(files, bound);
	const packages = [], checks = [];
	const names = new Set();
	for(const entry of manifest.packages)
	{
		validateEntry(entry);
		if(names.has(entry.name)) fail("invalid-lake-snapshot", "Lake dependency names must be unique");
		names.add(entry.name);
		const location = entry.type === "path" ? resolve(root, entry.dir) : join(root, packagesDir, entry.name);
		if(await realpath(location) !== location) fail("unsafe-lake-source", "Dependency roots cannot be symlinked");
		if(inside(location, root)) fail("unsafe-lake-source", "A dependency cannot contain the root project");
		const tree = entry.type === "git" ? await gitTree(location, entry, bound, signal) : null;
		const contents = await inventory(location, bound, signal);
		if(tree) assertGitFiles(contents, tree, entry.rev);
		const packageRoot = entry.type === "git" ? entry.subDir ?? "" : "";
		const configFile = resolveConfig(contents, packageRoot, entry.configFile ?? "lakefile");
		const manifestFile = entry.manifestFile === undefined ? "lake-manifest.json" : entry.manifestFile;
		const prefix = path => packageRoot ? `${packageRoot}/${path}` : path;
		if(manifestFile !== null && !contents.has(prefix(manifestFile))) fail("missing-lake-input", "Locked dependency manifest is missing");
		for(const path of new Set(["lean-toolchain", prefix("lean-toolchain")]))
			if(contents.has(path) && contents.get(path).bytes.toString("utf8").trim() !== version)
				fail("incompatible-lake-toolchain", "Dependency toolchain differs from the selected Lean release");
		const records = describe(contents);
		packages.push({ name: entry.name, scope: entry.scope ?? ""
			, inherited: entry.inherited
			, directory: `packages/${entry.name}`, packageRoot, configFile, manifestFile
			, source: entry.type === "path" ? { type: "path", dir: entry.dir }
				: { type: "git", url: entry.url, rev: entry.rev, inputRev: entry.inputRev ?? null, subDir: entry.subDir ?? null }
			, files: records, treeSha256: sha256(canonicalJson(records)) });
		for(const [path, file] of contents) files.set(`packages/${entry.name}/${path}`, file);
		checks.push({ location, records, entry });
		checkAggregate(files, bound);
	}
	// Recheck all inputs before returning an immutable, private byte snapshot.
	for(const { location, records, entry } of checks)
	{
		if(!same(describe(await inventory(location, bound, signal)), records)) fail("lake-source-drift", "Dependency source changed during capture");
		if(entry.type === "git") await gitTree(location, entry, bound, signal);
	}
	for(const [path, expected] of [["lake-manifest.json", lock], ["lean-toolchain", toolchain]])
		if(!same(describe(new Map([[path, await readRegular(join(root, path), bound.fileBytes, signal)]])), describe(new Map([[path, expected]]))))
			fail("lake-source-drift", "Root lock or toolchain changed during capture");
	await rejectOverrides(root, lakeDir);
	if(includeProject && !same(describe(await inventory(root, bound, signal)), describe(rootFiles)))
		fail("lake-source-drift", "Root project changed during capture");
	const document = frozen({ schemaVersion: includeProject ? 2 : 1
		, kind: "lean-bridge-lake-dependency-snapshot", toolchain: version
		, rootInputs: describe(rootFiles)
		, packages: packages.sort((left, right) => compare(left.name, right.name)) });
	const snapshot = Object.freeze({ document, sha256: sha256(canonicalJson(document)) });
	captured.set(snapshot, { files, limits: bound, roots: [root, ...checks.map(check => check.location)] });
	return snapshot;
};

/**
 * Write captured bytes to a new directory outside every read-only input root.
 *
 * @param options - Prepared snapshot and new destination.
 * @param options.snapshot - Opaque capture returned by prepareLakeDependencySnapshot.
 * @param options.outputRoot - New private staging directory.
 * @param options.signal - Optional cancellation signal.
 */
export const writeLakeDependencySnapshot = async ({ snapshot, outputRoot, signal }) => {
	const state = captured.get(snapshot);
	if(!state) fail("invalid-lake-snapshot", "Write requires a snapshot prepared by this process");
	signal?.throwIfAborted();
	const output = resolve(outputRoot);
	const parent = await realpath(dirname(output));
	if(parent !== dirname(output) || state.roots.some(root => inside(root, output) || inside(output, root)))
		fail("unsafe-lake-output", "Snapshot output must be outside the input projects and cannot replace their ancestors");
	await mkdir(output, { mode: 0o700 });
	try
	{
		for(const [path, file] of state.files)
		{
			signal?.throwIfAborted();
			await mkdir(dirname(join(output, path)), { recursive: true });
			await writeFile(join(output, path), file.bytes, { flag: "wx", signal });
			await chmod(join(output, path), file.mode);
		}
		await writeFile(join(output, manifestName), canonicalJson(snapshot.document), { flag: "wx", signal });
		await chmod(join(output, manifestName), 0o644);
		return Object.freeze({ output, sha256: snapshot.sha256 });
	} catch(error)
	{
		await rm(output, { recursive: true, force: true });
		throw error;
	}
};

/**
 * Check a captured snapshot against its expected identity and exact input bytes.
 *
 * @param options - Private snapshot directory and expected capture identity.
 * @param options.snapshot - Opaque immutable capture containing the expected identity.
 * @param options.snapshotRoot - Previously written snapshot directory.
 * @param options.signal - Optional cancellation signal.
 */
export const verifyLakeDependencySnapshot = async ({ snapshot, snapshotRoot, signal }) => {
	const state = captured.get(snapshot);
	if(!state) fail("invalid-lake-snapshot", "Verification requires a prepared snapshot identity");
	const root = await realpath(snapshotRoot);
	if(root !== resolve(snapshotRoot)) fail("unsafe-lake-source", "Snapshot directories cannot be symlinked");
	const manifest = Buffer.from(canonicalJson(snapshot.document));
	const files = await inventory(root, { ...state.limits
		, files: state.limits.files + 1
		, fileBytes: Math.max(state.limits.fileBytes, manifest.length)
		, totalBytes: state.limits.totalBytes + manifest.length }, signal, false);
	const document = files.get(manifestName);
	if(!document || document.mode !== 0o644 || !document.bytes.equals(manifest)) fail("lake-snapshot-drift", "Snapshot manifest differs from the prepared identity");
	files.delete(manifestName);
	if(!same(describe(files), describe(state.files))) fail("lake-snapshot-drift", "Snapshot files differ from the prepared identity");
	return Object.freeze({ verified: true, sha256: snapshot.sha256, packages: snapshot.document.packages.length });
};
