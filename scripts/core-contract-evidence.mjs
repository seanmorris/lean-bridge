/**
 * Plan the retained evidence directories required by one Core contract shard.
 *
 * The initial checkout retains the complete source tree, documentation, root
 * evidence records, and every archive index. This planner follows the selected
 * tests' repository-local source closure and adds only the archived payload
 * directories those tests can name or enumerate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import ts from "typescript";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { moduleSpecifiers } from "../tests/helpers/module-closure.mjs";
import {
	collectCoreContractTestPaths, coreContractShardLabels
	, coreContractShardManifest
} from "./core-contract-shards.mjs";

export const coreContractEvidenceBaseline = Object.freeze({
	rootPatterns: Object.freeze([
		"/docs/evidence/*.json", "/docs/evidence/*.md"
		, "/docs/evidence/*.xml"
	])
	, archiveIndexPattern: "/docs/evidence/*/index.json"
});

const sourceExtensions = new Set([".cjs", ".js", ".mjs", ".sh"]);
const pathPattern = /(?:\.{0,2}\/)?(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:cjs|js|mjs|sh)/gu;
const selectorPattern = /[A-Za-z0-9][A-Za-z0-9-]{10,}/gu;
const explicitPrefixPattern
	= /core-evidence-prefix:\s*([A-Za-z0-9][A-Za-z0-9-]{10,})/gu;

const exists = async path => {
	try
	{ return (await stat(path)).isFile(); }
	catch(error)
	{
		if(error?.code === "ENOENT") return false;
		throw error;
	}
};

const inside = (root, path) => {
	const value = relative(root, path);
	return value !== "" && !value.startsWith("../") && !isAbsolute(value);
};

/**
 * Return literal text fragments, including regular-expression and template
 * fragments used to select archive directory names discovered by readdir.
 *
 * @param source - JavaScript or shell source.
 * @param path - Diagnostic source path.
 */
export const coreContractEvidenceFragments = (source, path = "source.mjs") => {
	if(!/[.]?(?:c|m)?js$/u.test(extname(path)))
		return [...source.matchAll(/["'`]([^"'`\r\n]+)["'`]/gu)]
			.map(match => match[1]);
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true
		, ts.ScriptKind.JS);
	const fragments = [];
	const visit = node => {
		if(ts.isStringLiteralLike(node) || ts.isRegularExpressionLiteral(node)
			|| node.kind === ts.SyntaxKind.TemplateHead
			|| node.kind === ts.SyntaxKind.TemplateMiddle
			|| node.kind === ts.SyntaxKind.TemplateTail)
			fragments.push(node.text);
		ts.forEachChild(node, visit);
	};
	visit(file);
	return fragments;
};

const enumeratesEvidenceDirectories = (source, path) => {
	if(!/[.]?(?:c|m)?js$/u.test(extname(path))) return false;
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true
		, ts.ScriptKind.JS);
	let found = false;
	const visit = node => {
		if(found) return;
		if(ts.isCallExpression(node))
		{
			const callee = node.expression.getText(file);
			const argument = node.arguments[0];
			if(/(?:^|[.])readdir(?:Sync)?$/u.test(callee)
				&& ts.isStringLiteralLike(argument)
				&& argument.text === "docs/evidence") found = true;
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return found;
};

/**
 * Resolve exact archive names and stable name prefixes from one source file.
 * Prefix recognition is intentionally conservative: a selector must contain a
 * hyphen and at least twelve characters, which admits the three reviewed
 * directory-enumeration contracts without treating dates or ordinary words as
 * archive selectors.
 *
 * @param source - Source text.
 * @param path - Source path.
 * @param directories - Tracked top-level evidence directory names.
 */
export const coreContractEvidenceDirectoryReferences = (
	source, path, directories
) => {
	const selected = new Set(directories.filter(name => source.includes(name)));
	for(const match of source.matchAll(explicitPrefixPattern))
		for(const directory of directories)
			if(directory.startsWith(match[1])
				&& /^\d{8}$/u.test(directory.slice(match[1].length)))
				selected.add(directory);
	const enumeratesEvidence = enumeratesEvidenceDirectories(source, path);
	const selectors = new Set((enumeratesEvidence
		? coreContractEvidenceFragments(source, path) : [])
		.flatMap(fragment => [...fragment.matchAll(selectorPattern)]
			.map(match => match[0]))
		.filter(fragment => (fragment.match(/-/gu)?.length ?? 0) >= 2
			&& fragment.length >= 12));
	for(const directory of directories)
		if([...selectors].some(selector => directory.startsWith(selector)))
			selected.add(directory);
	return selected;
};

const repositorySourceReferences = async (source, path, root) => {
	const references = new Set();
	const add = async candidate => {
		let absolute;
		if(candidate.startsWith("./") || candidate.startsWith("../"))
			absolute = resolve(dirname(resolve(root, path)), candidate);
		else absolute = resolve(root, candidate.replace(/^\//u, ""));
		if(extname(absolute) === "") absolute += ".mjs";
		if(inside(root, absolute) && sourceExtensions.has(extname(absolute))
			&& await exists(absolute))
			references.add(relative(root, absolute).replaceAll("\\", "/"));
	};
	if(/[.]?(?:c|m)?js$/u.test(extname(path)))
	{
		for(const specifier of moduleSpecifiers(source, path)) await add(specifier);
		const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true
			, ts.ScriptKind.JS);
		const candidates = [];
		const visit = node => {
			if(ts.isCallExpression(node))
			{
				const callee = node.expression.getText(file);
				if(/(?:^|[.])(?:execFile|execFileSync|spawn|spawnSync|runCopied)$/u
					.test(callee))
					for(const argument of node.arguments)
						for(const match of argument.getText(file).matchAll(pathPattern))
							candidates.push(match[0]);
			}
			ts.forEachChild(node, visit);
		};
		visit(file);
		for(const candidate of candidates) await add(candidate);
	}
	else for(const match of source.matchAll(pathPattern)) await add(match[0]);
	return references;
};

const trackedEvidenceDirectories = root => execFileSync("git", [
	"-C", root, "ls-tree", "-z", "HEAD:docs/evidence"
], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).split("\0")
	.filter(Boolean).flatMap(line => {
		const match = /^\d+\s+(\S+)\s+[a-f0-9]+\t(.+)$/u.exec(line);
		assert.ok(match, `Malformed evidence tree entry: ${line}`);
		return match[1] === "tree" ? [match[2]] : [];
	}).toSorted();

/**
 * Read Git's sparse-checkout booleans without conflating an unset false value
 * with command failure. Actions/checkout omits core.sparseCheckoutCone for a
 * non-cone checkout.
 *
 * @param root - Repository root.
 */
export const coreSparseCheckoutMode = (root = resolve(".")) => {
	const read = key => {
		const result = spawnSync("git", [
			"-C", resolve(root), "config", "--bool", "--get", key
		], { encoding: "utf8" });
		assert.equal(result.signal, null, key);
		assert.ok(result.status === 0 || result.status === 1
			, result.stderr || key);
		return result.status === 0 ? result.stdout.trim() : undefined;
	};
	return Object.freeze({
		sparse: read("core.sparseCheckout") === "true"
		, cone: read("core.sparseCheckoutCone") === "true"
	});
};

/**
 * Compute a deterministic source and evidence closure without changing the
 * checkout.
 *
 * @param label - One-based Core shard label.
 * @param root - Repository root.
 */
export const collectCoreContractEvidencePlan = async (
	label, root = resolve(".")
) => {
	assert.ok(coreContractShardLabels.includes(label), `Unknown Core shard ${label}`);
	root = resolve(root);
	const contract = await collectCoreContractTestPaths(root);
	const shard = coreContractShardManifest(contract, label);
	const directories = trackedEvidenceDirectories(root);
	const selectedDirectories = new Set();
	const sources = new Set();
	const pending = [...shard.selection.files];
	while(pending.length)
	{
		const path = normalize(pending.pop()).replaceAll("\\", "/");
		if(sources.has(path)) continue;
		assert.ok(!path.startsWith("../") && !isAbsolute(path), path);
		const source = await readFile(join(root, path), "utf8");
		sources.add(path);
		// Source-history implementations consume the root JSON transition record,
		// which is part of the baseline. Archive-looking strings inside those
		// modules describe historical changed paths; they are not working-tree
		// payload reads. Their executable tests remain eligible below.
		if(!/-source-history[.]mjs$/u.test(path))
			for(const directory of coreContractEvidenceDirectoryReferences(
				source, path, directories)) selectedDirectories.add(directory);
		for(const reference of await repositorySourceReferences(source, path, root))
			if(!sources.has(reference)) pending.push(reference);
	}
	const sourceFiles = [...sources].toSorted();
	const evidenceDirectories = [...selectedDirectories].toSorted();
	const patterns = evidenceDirectories.map(directory =>
		`/docs/evidence/${directory}/`);
	return {
		schemaVersion: 1
		, contract: shard.contract
		, shard: shard.shard
		, selection: shard.selection
		, baseline: coreContractEvidenceBaseline
		, sources: {
			count: sourceFiles.length
			, sha256: sha256(canonicalJson(sourceFiles)), files: sourceFiles
		}
		, evidence: {
			directoryCount: evidenceDirectories.length
			, sha256: sha256(canonicalJson(evidenceDirectories))
			, directories: evidenceDirectories, patterns
		}
	};
};
