/**
 * Attribute test-registering helper modules to complete Core root closures.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { moduleSpecifiers } from "./module-closure.mjs";

const testPath = path => path === "tests" || path.startsWith("tests/");
const resolveSpecifier = (parent, specifier) => normalize(join(
	dirname(parent), extname(specifier) === "" ? `${specifier}.mjs` : specifier
));

/**
 * Return every Core root whose static module closure reaches each named helper.
 * Static import declarations, re-exports and literal dynamic imports all count.
 *
 * @param roots - Complete repository-relative Core test roots.
 * @param helpers - `./helpers/...` specifiers relative to a root in `tests/`.
 */
export const testRegistrationRootOwners = async (roots, helpers) => {
	const rootSet = new Set(roots);
	const expected = new Map(helpers.map(path => [
		path, normalize(join("tests", path))
	]));
	const reverse = new Map();
	const visited = new Set();
	const pending = [...roots];
	while(pending.length)
	{
		const path = pending.pop();
		if(visited.has(path)) continue;
		visited.add(path);
		const source = await readFile(path, "utf8");
		for(const specifier of moduleSpecifiers(source, path))
		{
			const target = resolveSpecifier(path, specifier);
			if(!testPath(target) || extname(target) !== ".mjs") continue;
			if(!reverse.has(target)) reverse.set(target, new Set());
			reverse.get(target).add(path);
			if(!visited.has(target)) pending.push(target);
		}
	}
	const result = new Map();
	for(const [input, target] of expected)
	{
		const owners = new Set();
		const seen = new Set([target]);
		const ancestors = [target];
		while(ancestors.length)
		{
			const path = ancestors.pop();
			if(rootSet.has(path)) owners.add(path);
			for(const parent of reverse.get(path) ?? []) if(!seen.has(parent))
			{
				seen.add(parent); ancestors.push(parent);
			}
		}
		result.set(input, [...owners].sort());
	}
	return result;
};
