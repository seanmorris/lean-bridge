/**
 * Resolve the relative ES module closure of an entry file from its syntax, not its text.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import ts from "typescript";

/**
 * Collect every file reachable through relative import, re-export and dynamic
 * import specifiers. Specifiers inside strings, template literals and comments
 * are not dependencies and are not followed.
 *
 * @param entry - Repository-relative entry module.
 */
export const collectModuleClosure = async entry => {
	const files = new Set();
	const visit = async path => {
		if(files.has(path)) return;
		files.add(path);
		const { importedFiles } = ts.preProcessFile(await readFile(path, "utf8"), true, true);
		for(const { fileName } of importedFiles)
		{
			if(!/^\.\.?\//.test(fileName)) continue;
			await visit(normalize(join(dirname(path), extname(fileName) === "" ? `${fileName}.mjs` : fileName)));
		}
	};
	await visit(entry);
	return [...files].sort();
};
