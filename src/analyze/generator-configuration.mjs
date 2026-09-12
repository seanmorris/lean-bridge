/**
 * Validate package-relative recipes for captured Lean text generators.
 *
 * @file
 */
/**
 * Reject invalid author intent before inspecting Lake declarations.
 *
 * @param message - Concrete configuration error.
 */
const fail = message => { throw Object.assign(new Error(message), { code: "invalid-export-configuration" }); };
const closed = (value, keys, label) => {
	if(!value || typeof value !== "object" || Array.isArray(value)
		|| JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(`${label} must have exactly the declared fields`);
};
const logicalName = value => typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,127}$(?![\s\S])/.test(value);
const leanName = value => typeof value === "string" && value.length <= 256 && /^[A-Za-z_][A-Za-z0-9_']*(?:\.[A-Za-z_][A-Za-z0-9_']*)*$(?![\s\S])/.test(value);
const controls = value => [...value].some(character => character.codePointAt(0) < 32 || character.codePointAt(0) === 127);
const path = value => typeof value === "string" && value.length <= 1024 && !controls(value) && !/[\\:*?\uD800-\uDFFF]/u.test(value)
	&& value.split("/").every(part => part && part !== "." && part !== ".."
		&& !part.startsWith(".lean-bridge-") && !part.startsWith(".env.")
		&& ![".git", ".lake", ".env", ".npmrc", "build", "dist", "target", "node_modules"].includes(part));
const list = (value, minimum, label) => {
	if(!Array.isArray(value) || value.length < minimum || value.length > 128) fail(`${label} requires ${minimum} to 128 entries`);
};
const unique = (values, label) => { if(new Set(values).size !== values.length) fail(`Duplicate ${label}`); };

/**
 * Check authored recipes without running Lean, Lake, tools, or package hooks.
 * Target selection, module ownership and captured file identity are checked later.
 *
 * @param recipes - Optional generators array from lean-bridge.exports.json.
 */
export const validateGeneratorConfiguration = recipes => {
	list(recipes, 0, "generators");
	for(const recipe of recipes)
	{
		closed(recipe, ["name", "profile", "module", "declaration", "inputs", "arguments", "outputs"], "Generator recipe");
		if(!leanName(recipe.name) || recipe.profile !== "lean-text-v1" || !leanName(recipe.module) || !leanName(recipe.declaration)) fail("Invalid generator target, profile, module or declaration");
		if(recipe.name.length > 128 || !logicalName(recipe.name)) fail("Generator target names require portable identifiers");
		list(recipe.inputs, 0, "Generator inputs");
		list(recipe.arguments, 0, "Generator arguments");
		list(recipe.outputs, 1, "Generator outputs");
		for(const entries of [recipe.inputs, recipe.outputs])
		{
			for(const entry of entries)
			{
				closed(entry, ["name", "path"], "Named generator file");
				if(!logicalName(entry.name) || !path(entry.path)) fail("Generator files require logical names and package-relative paths");
			}
			unique(entries.map(entry => entry.name), "generator file name");
			unique(entries.map(entry => entry.path), "generator file path");
		}
		if(recipe.outputs.some(output => !/\.(lean|c|h)$/.test(output.path))) fail("Generator outputs must be Lean, C or header files");
		if(recipe.arguments.some(value => typeof value !== "string" || Buffer.byteLength(value) > 16384 || controls(value) || /[\uD800-\uDFFF]/u.test(value))) fail("Generator arguments must be bounded literal UTF-8 text");
	}
	unique(recipes.map(recipe => recipe.name), "generator target name");
	const outputs = recipes.flatMap(recipe => recipe.outputs.map(output => output.path));
	unique(outputs, "generator output path");
	if(outputs.some(output => outputs.some(other => other.startsWith(`${output}/`)))) fail("Generator output paths overlap");
	return true;
};
