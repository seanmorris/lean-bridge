/**
 * Load an ES module from its exact Git producer revision and complete relative
 * import closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { bytesAtProducer } from "./producer-source.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const modules = new Map();
const moduleDirectories = new Set();
process.once("exit", () => {
	for(const directory of moduleDirectories)
		rmSync(directory, { recursive: true, force: true });
});
const revisionPattern = /^[a-f0-9]{40}$/u;
const modulePathPattern = /^(?:scripts|site|src|tests)\/(?:[^/]+\/)*[^/]+\.mjs$/u;
const sourcePathPattern = /^(?:config|docs|nix|poc|schema|scripts|site|src|tests)\/(?:[^/]+\/)*[^/]+\.(?:json|mjs)$/u;
const producerReadShims = new Map([
	["node:fs", ".producer-source-read-sync.mjs"]
	, ["node:fs/promises", ".producer-source-read.mjs"]
]);
const relativeSpecifier = (from, to) => {
	const path = posix.relative(posix.dirname(from), to);
	return path.startsWith(".") ? path : `./${path}`;
};
const redirectSourceReads = (source, path) => {
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const edits = [];
	const visit = node => {
		if(ts.isImportDeclaration(node)
			&& ts.isStringLiteralLike(node.moduleSpecifier)
			&& producerReadShims.has(node.moduleSpecifier.text)) edits.push({
				start: node.moduleSpecifier.getStart(file)
				, end: node.moduleSpecifier.getEnd()
				, replacement: JSON.stringify(relativeSpecifier(
					path, producerReadShims.get(node.moduleSpecifier.text)
				))
			});
		ts.forEachChild(node, visit);
	};
	visit(file);
	for(const edit of edits.sort((left, right) => right.start - left.start))
		source = source.slice(0, edit.start) + edit.replacement + source.slice(edit.end);
	return source;
};
const sourceReadSyncShim = (revision, root, directory) => `
import { execFileSync } from "node:child_process";
import { readFileSync as liveReadFileSync, realpathSync as liveRealpathSync } from "node:fs";
export * from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
const revision = ${JSON.stringify(revision)};
const root = ${JSON.stringify(root)};
const directory = ${JSON.stringify(directory)};
const sources = new Map();
const prefixes = new Set([".github", "config", "docs", "nix", "poc", "schema", "scripts", "site", "src", "tests"]);
const repositoryPath = input => {
	let path;
	if(input instanceof URL && input.protocol === "file:") path = fileURLToPath(input);
	else if(typeof input === "string") path = input;
	else return null;
	if(isAbsolute(path)) {
		const base = path === directory || path.startsWith(directory + sep)
			? directory : path === root || path.startsWith(root + sep) ? root : null;
		if(base === null) return null;
		path = relative(base, path);
	}
	path = path.split(sep).join("/");
	if(path === "package.json" || path === "flake.nix" || path === "lakefile.lean" || path === "lean-toolchain") return path;
	const parts = path.split("/");
	if(!prefixes.has(parts[0]) || parts.some(part => !part || part === "." || part === "..")) return null;
	return path;
};
export const readFileSync = (input, options) => {
	const path = repositoryPath(input);
	if(path === null) return liveReadFileSync(input, options);
	if(!sources.has(path)) sources.set(path, execFileSync(
		"git", ["show", revision + ":" + path], {
			cwd: root, maxBuffer: 512 * 1024 * 1024
		}
	));
	const bytes = sources.get(path);
	const encoding = typeof options === "string" ? options : options?.encoding;
	return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
};
export const realpathSync = input => {
	const path = input instanceof URL && input.protocol === "file:"
		? fileURLToPath(input) : input;
	if(typeof path === "string" && isAbsolute(path)
		&& (path === directory || path.startsWith(directory + sep))) return path;
	return liveRealpathSync(input);
};
`;
const sourceReadShim = (revision, root, directory) => `
import { execFileSync } from "node:child_process";
import { readFile as liveReadFile, realpath as liveRealpath } from "node:fs/promises";
export * from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
const revision = ${JSON.stringify(revision)};
const root = ${JSON.stringify(root)};
const directory = ${JSON.stringify(directory)};
const sources = new Map();
const prefixes = new Set([".github", "config", "docs", "nix", "poc", "schema", "scripts", "site", "src", "tests"]);
const repositoryPath = input => {
	let path;
	if(input instanceof URL && input.protocol === "file:") path = fileURLToPath(input);
	else if(typeof input === "string") path = input;
	else return null;
	if(isAbsolute(path)) {
		const base = path === directory || path.startsWith(directory + sep)
			? directory : path === root || path.startsWith(root + sep) ? root : null;
		if(base === null) return null;
		path = relative(base, path);
	}
	path = path.split(sep).join("/");
	if(path === "package.json" || path === "flake.nix" || path === "lakefile.lean" || path === "lean-toolchain") return path;
	const parts = path.split("/");
	if(!prefixes.has(parts[0]) || parts.some(part => !part || part === "." || part === "..")) return null;
	return path;
};
export const readFile = async (input, options) => {
	const path = repositoryPath(input);
	if(path === null) return liveReadFile(input, options);
	if(!sources.has(path)) sources.set(path, execFileSync(
		"git", ["show", revision + ":" + path], {
			cwd: root, maxBuffer: 512 * 1024 * 1024
		}
	));
	const bytes = sources.get(path);
	const encoding = typeof options === "string" ? options : options?.encoding;
	return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
};
export const realpath = async input => {
	const path = input instanceof URL && input.protocol === "file:"
		? fileURLToPath(input) : input;
	if(typeof path === "string" && isAbsolute(path)
		&& (path === directory || path.startsWith(directory + sep))) return path;
	return liveRealpath(input);
};
`;

const moduleAtProducerMode = (revision, entry, sourceReads) => {
	assert.match(revision, revisionPattern);
	assert.match(entry, modulePathPattern);
	assert.equal(posix.normalize(entry), entry);
	const key = `${revision}:${entry}:${sourceReads ? "source-reads" : "module-only"}`;
	if(!modules.has(key)) modules.set(key, (async () => {
		const closure = new Map();
		const visit = path => {
			assert.match(path, sourcePathPattern);
			assert.equal(posix.normalize(path), path);
			if(closure.has(path)) return;
			const bytes = bytesAtProducer(revision, path);
			closure.set(path, bytes);
			if(path.endsWith(".json"))
			{
				JSON.parse(bytes);
				return;
			}
			for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
			{
				const joined = posix.normalize(posix.join(
					posix.dirname(path), specifier
				));
				visit(posix.extname(joined) === "" ? `${joined}.mjs` : joined);
			}
		};
		visit(entry);
		const root = resolve("build");
		await mkdir(root, { recursive: true });
		const directory = await mkdtemp(join(root, ".producer-module-"));
		moduleDirectories.add(directory);
		try
		{
			for(const [path, bytes] of closure)
				await saveLakeFile(directory, path, sourceReads && path.endsWith(".mjs")
					? Buffer.from(redirectSourceReads(bytes.toString("utf8"), path))
					: bytes);
			if(sourceReads)
			{
				await writeFile(join(directory, producerReadShims.get("node:fs/promises"))
					, sourceReadShim(revision, resolve("."), directory));
				await writeFile(join(directory, producerReadShims.get("node:fs"))
					, sourceReadSyncShim(revision, resolve("."), directory));
			}
			return await import(pathToFileURL(join(directory, entry)).href);
		}
		catch(error)
		{
			moduleDirectories.delete(directory);
			rmSync(directory, { recursive: true, force: true });
			throw error;
		}
	})());
	return modules.get(key);
};

/**
 * Import one immutable producer module without consulting current source.
 *
 * @param revision - Full producer commit identity.
 * @param entry - Repository-relative module entry point.
 */
export const moduleAtProducer = (revision, entry) => {
	return moduleAtProducerMode(revision, entry, false);
};

/**
 * Import an immutable producer module whose deferred repository reads must
 * resolve against the same producer revision rather than the live checkout.
 *
 * @param revision - Full producer commit identity.
 * @param entry - Repository-relative module entry point.
 */
export const moduleAtProducerWithSourceReads = (revision, entry) =>
	moduleAtProducerMode(revision, entry, true);
