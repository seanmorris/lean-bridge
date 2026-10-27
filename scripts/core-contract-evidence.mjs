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
import {
	assertTypeSurfaceEvidenceReceipt, typeSurfaceEvidenceSourcePaths
} from "../src/adoption/type-surface-evidence-receipt.mjs";
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
const documentationExtensions = new Set([".md"]);
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
 * Distinguish enumeration that locates complete archives for replay from an
 * index-only inventory. The baseline already retains every archive index, so
 * an enumerator that never passes a selected root to an evidence checker does
 * not need the archive payloads in its sparse working tree.
 *
 * @param source - JavaScript source.
 * @param path - Diagnostic source path.
 */
const replaysEnumeratedEvidenceDirectories = (source, path) => {
	if(!enumeratesEvidenceDirectories(source, path)) return false;
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true
		, ts.ScriptKind.JS);
	let found = false;
	const visit = node => {
		if(found) return;
		if(ts.isCallExpression(node))
		{
			const callee = node.expression;
			const name = ts.isIdentifier(callee) ? callee.text
				: ts.isPropertyAccessExpression(callee) ? callee.name.text : "";
			if(/^check[A-Z][A-Za-z0-9]*Evidence$/u.test(name)) found = true;
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return found;
};

/**
 * Detect executable calls that require `readTypeSurface` to authenticate every
 * source named by the live inventory. Merely importing or defining the
 * function does not require the complete retained-evidence closure.
 *
 * @param source - JavaScript source.
 * @param path - Diagnostic source path.
 */
export const coreContractReadsTypeSurface = (source, path = "source.mjs") => {
	if(!/[.]?(?:c|m)?js$/u.test(extname(path))) return false;
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true
		, ts.ScriptKind.JS);
	let found = false;
	const visit = node => {
		if(found) return;
		if(ts.isCallExpression(node))
		{
			const callee = node.expression;
			if((ts.isIdentifier(callee) && callee.text === "readTypeSurface")
				|| (ts.isPropertyAccessExpression(callee)
					&& callee.name.text === "readTypeSurface")
				|| (ts.isElementAccessExpression(callee)
					&& ts.isStringLiteralLike(callee.argumentExpression)
					&& callee.argumentExpression.text === "readTypeSurface"))
				found = true;
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return found;
};

/**
 * Return every retained evidence directory needed by `readTypeSurface`'s
 * complete file-hash pass. Root evidence records remain part of the baseline;
 * source paths outside `docs/evidence` remain in the source checkout.
 *
 * @param document - Parsed live type-surface inventory.
 * @param directories - Tracked top-level evidence directory names.
 */
export const coreTypeSurfaceEvidenceDirectories = (document, directories) => {
	assert.ok(Array.isArray(document?.evidence));
	const tracked = new Set(directories);
	const selected = new Set();
	for(const evidence of document.evidence)
	{
		assert.ok(Array.isArray(evidence?.files));
		for(const file of evidence.files)
		{
			assert.equal(typeof file?.path, "string");
			const match = /^docs\/evidence\/([^/]+)\//u.exec(file.path);
			if(!match) continue;
			assert.ok(tracked.has(match[1])
				, `Type-surface evidence directory is not tracked: ${match[1]}`);
			selected.add(match[1]);
		}
	}
	return selected;
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
	const fragments = coreContractEvidenceFragments(source, path);
	const selected = new Set(directories.filter(name => fragments.some(fragment =>
		fragment === name || fragment.startsWith(`${name}/`)
			|| fragment.includes(`/docs/evidence/${name}/`)
			|| fragment.endsWith(`/docs/evidence/${name}`)
			|| fragment.startsWith(`docs/evidence/${name}/`)
			|| fragment === `docs/evidence/${name}`)));
	for(const match of source.matchAll(explicitPrefixPattern))
		for(const directory of directories)
			if(directory.startsWith(match[1])
				&& /^\d{8}$/u.test(directory.slice(match[1].length)))
				selected.add(directory);
	const enumeratesEvidence = enumeratesEvidenceDirectories(source, path);
	const selectors = new Set((enumeratesEvidence
		&& replaysEnumeratedEvidenceDirectories(source, path) ? fragments : [])
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

/**
 * Return repository documentation named literally by one executable source.
 * Documentation contracts read these files and then resolve their local links,
 * so their evidence-directory names belong to the same static closure as an
 * imported helper. Limit traversal to tracked Markdown under `docs/`; archived
 * payloads are selected separately by directory and never followed as text.
 *
 * @param source - Executable JavaScript or shell source.
 * @param path - Repository-relative source path.
 * @param root - Repository root.
 */
export const coreContractDocumentationReferences = async (
	source, path, root = resolve(".")
) => {
	if(!sourceExtensions.has(extname(path))) return new Set();
	root = resolve(root);
	const references = new Set();
	for(const fragment of coreContractEvidenceFragments(source, path))
	{
		if(!documentationExtensions.has(extname(fragment))) continue;
		const absolute = fragment.startsWith("./") || fragment.startsWith("../")
			? resolve(dirname(resolve(root, path)), fragment)
			: resolve(root, fragment.replace(/^\//u, ""));
		const repositoryPath = relative(root, absolute).replaceAll("\\", "/");
		if(!inside(root, absolute) || !repositoryPath.startsWith("docs/")
			|| repositoryPath.startsWith("docs/evidence/")
			|| !await exists(absolute)) continue;
		references.add(repositoryPath);
	}
	return references;
};

/**
 * Resolve the exact retained-evidence files reached by local Markdown links.
 * Documentation contracts call `access` on these targets; they do not consume
 * every sibling payload in the target's archive directory.
 *
 * @param source - Markdown source.
 * @param path - Repository-relative documentation path.
 * @param trackedFiles - Tracked repository evidence paths.
 */
export const coreContractDocumentationEvidenceFiles = (
	source, path, trackedFiles
) => {
	if(extname(path) !== ".md" || !path.startsWith("docs/")) return new Set();
	const tracked = new Set(trackedFiles);
	const selected = new Set();
	for(const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu))
	{
		const target = match[1].split("#")[0];
		if(!target || /^[a-z]+:/u.test(target)) continue;
		const repositoryPath = normalize(join(dirname(path), target))
			.replaceAll("\\", "/");
		if(repositoryPath.startsWith("docs/evidence/")
			&& tracked.has(repositoryPath)) selected.add(repositoryPath);
	}
	return selected;
};

/**
 * List the tracked top-level retained-evidence directories at HEAD.
 *
 * @param root - Repository root.
 */
export const trackedEvidenceDirectories = root => execFileSync("git", [
	"-C", root, "ls-tree", "-z", "HEAD:docs/evidence"
], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).split("\0")
	.filter(Boolean).flatMap(line => {
		const match = /^\d+\s+(\S+)\s+[a-f0-9]+\t(.+)$/u.exec(line);
		assert.ok(match, `Malformed evidence tree entry: ${line}`);
		return match[1] === "tree" ? [match[2]] : [];
	}).toSorted();

/**
 * List every tracked retained-evidence file at HEAD.
 *
 * @param root - Repository root.
 */
export const trackedEvidenceFiles = root => execFileSync("git", [
	"-C", root, "ls-tree", "-r", "-z", "--name-only", "HEAD:docs/evidence"
], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0")
	.filter(Boolean).map(path => `docs/evidence/${path}`).toSorted();

/**
 * Authenticate one exact receipt before excluding the full type-surface corpus
 * from a shard's sparse working tree.
 *
 * @param receiptPath - Receipt artifact produced by the prerequisite job.
 * @param root - Repository root at the same exact revision.
 */
export const coreTypeSurfaceEvidenceReceipt = async (receiptPath
	, root = resolve(".")) => {
	assert.equal(typeof receiptPath, "string");
	assert.ok(receiptPath && !/[\0\r\n]/u.test(receiptPath));
	root = resolve(root);
	const sources = Object.fromEntries(await Promise.all(
		typeSurfaceEvidenceSourcePaths.map(async path => [
			path, await readFile(join(root, path))
		])
	));
	const document = JSON.parse(
		sources["docs/type-surface.v1.json"].toString("utf8")
	);
	const receipt = JSON.parse(await readFile(resolve(receiptPath), "utf8"));
	const commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"])
		.toString().trim();
	assertTypeSurfaceEvidenceReceipt(receipt, {
		commit, document
		, sourceSha256: Object.fromEntries(typeSurfaceEvidenceSourcePaths
			.map(path => [path, sha256(sources[path])]))
	});
	return receipt;
	};

/**
 * Plan the one full corpus materialization performed before the shard matrix.
 *
 * @param root - Repository root.
 */
export const collectCoreTypeSurfaceEvidencePlan = async (
	root = resolve(".")
) => {
	root = resolve(root);
	const directories = trackedEvidenceDirectories(root);
	const document = JSON.parse(await readFile(
		join(root, "docs/type-surface.v1.json"), "utf8"));
	const selected = [...coreTypeSurfaceEvidenceDirectories(
		document, directories)].toSorted();
	const patterns = selected.map(directory => `/docs/evidence/${directory}/`);
	return {
		schemaVersion: 1, baseline: coreContractEvidenceBaseline
		, evidence: {
			directoryCount: selected.length
			, sha256: sha256(canonicalJson(selected))
			, directories: selected, patterns
		}
	};
};

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
 * @param options - Exact prerequisite artifacts.
 * @param options.evidenceReceipt - Optional authenticated type-surface receipt.
 */
export const collectCoreContractEvidencePlan = async (
	label, root = resolve("."), { evidenceReceipt } = {}
) => {
	assert.ok(coreContractShardLabels.includes(label), `Unknown Core shard ${label}`);
	root = resolve(root);
	const contract = await collectCoreContractTestPaths(root);
	const shard = coreContractShardManifest(contract, label);
	const directories = trackedEvidenceDirectories(root);
	const evidenceFiles = trackedEvidenceFiles(root);
	const selectedDirectories = new Set();
	const selectedFiles = new Set();
	const sources = new Set();
	let completeTypeSurface = false;
	const pending = [...shard.selection.files];
	while(pending.length)
	{
		const path = normalize(pending.pop()).replaceAll("\\", "/");
		if(sources.has(path)) continue;
		assert.ok(!path.startsWith("../") && !isAbsolute(path), path);
		const source = await readFile(join(root, path), "utf8");
		sources.add(path);
		if(coreContractReadsTypeSurface(source, path)) completeTypeSurface = true;
		// Source-history implementations consume the root JSON transition record,
		// which is part of the baseline. Archive-looking strings inside those
		// modules describe historical changed paths; they are not working-tree
		// payload reads. Their executable tests remain eligible below.
		if(extname(path) === ".md" && path.startsWith("docs/"))
			for(const file of coreContractDocumentationEvidenceFiles(
				source, path, evidenceFiles)) selectedFiles.add(file);
		else if(!/-source-history[.]mjs$/u.test(path))
			for(const directory of coreContractEvidenceDirectoryReferences(
				source, path, directories)) selectedDirectories.add(directory);
		for(const reference of await repositorySourceReferences(source, path, root))
			if(!sources.has(reference)) pending.push(reference);
		for(const reference of await coreContractDocumentationReferences(
			source, path, root))
			if(!sources.has(reference)) pending.push(reference);
	}
	let typeSurfaceAuthentication = "not-required";
	if(completeTypeSurface && evidenceReceipt)
	{
		await coreTypeSurfaceEvidenceReceipt(evidenceReceipt, root);
		typeSurfaceAuthentication = "workflow-receipt-v1";
	}
	else if(completeTypeSurface)
	{
		typeSurfaceAuthentication = "direct-files-v1";
		const document = JSON.parse(await readFile(
			join(root, "docs/type-surface.v1.json"), "utf8"));
		for(const directory of coreTypeSurfaceEvidenceDirectories(
			document, directories)) selectedDirectories.add(directory);
	}
	const sourceFiles = [...sources].toSorted();
	const evidenceDirectories = [...selectedDirectories].toSorted();
	const exactEvidenceFiles = [...selectedFiles].toSorted();
	const patterns = [
		...evidenceDirectories.map(directory => `/docs/evidence/${directory}/`)
		, ...exactEvidenceFiles.map(file => `/${file}`)
	].toSorted();
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
			completeTypeSurface, typeSurfaceAuthentication
			, directoryCount: evidenceDirectories.length
			, sha256: sha256(canonicalJson(evidenceDirectories))
			, directories: evidenceDirectories
			, fileCount: exactEvidenceFiles.length
			, fileSha256: sha256(canonicalJson(exactEvidenceFiles))
			, files: exactEvidenceFiles, patterns
		}
	};
};
