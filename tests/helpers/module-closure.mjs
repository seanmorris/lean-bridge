/**
 * Resolve the relative ES module closure of an entry file from its syntax tree.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import ts from "typescript";

/**
 * Static relative specifiers of import declarations, re-exports with a module
 * specifier, and dynamic `import("...")` calls, wherever they appear in the tree,
 * including inside template interpolations. Strings, template text, comments
 * and regular-expression literals never contribute.
 *
 * @param source - Module text.
 * @param path - Path used for diagnostics only.
 */
export const moduleSpecifiers = (source, path = "module.mjs") => {
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const found = [];
	const literal = node => node && ts.isStringLiteralLike(node) && !ts.isTemplateExpression(node) ? node.text : null;
	const visit = node => {
		if(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) found.push(literal(node.moduleSpecifier));
		else if(ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) found.push(literal(node.arguments[0]));
		ts.forEachChild(node, visit);
	};
	visit(file);
	return found.filter(specifier => specifier !== null && /^\.\.?\//.test(specifier));
};

/**
 * Collect every file reachable through relative module specifiers, with the
 * repository's `.mjs` extension inferred for bare relative paths.
 *
 * @param entry - Repository-relative entry module.
 */
export const collectModuleClosure = async entry => {
	const files = new Set();
	const visit = async path => {
		if(files.has(path)) return;
		files.add(path);
		for(const specifier of moduleSpecifiers(await readFile(path, "utf8"), path))
			await visit(normalize(join(dirname(path), extname(specifier) === "" ? `${specifier}.mjs` : specifier)));
	};
	await visit(entry);
	return [...files].sort();
};
