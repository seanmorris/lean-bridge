/**
 * Reconstruct each recorded native graph admission stage independently.
 * A matching predecessor is structural evidence, not installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";

const cPath = "src/build/native-c-projection.mjs";
const graphPath = "src/build/native-graph-projection.mjs";
const projectPath = "src/build/native-project.mjs";
const stages = [
	{ target: "nuget", binding: "dotnet", type: "Dotnet" }
	, { target: "maven", binding: "jvm", type: "Jvm" }
	, { target: "php-native", binding: "php", type: "Php" }
];
const messages = [
	"Native copied graphs currently require C, C++, Cargo, PyPI, RubyGems or CPAN target adapters"
	, "Native copied graphs currently require C, C++, Cargo, PyPI, RubyGems, CPAN or NuGet target adapters"
	, "Native copied graphs currently require C, C++, Cargo, PyPI, RubyGems, CPAN, NuGet or Maven target adapters"
	, "Native copied graphs currently require C, C++, Cargo, PyPI, RubyGems, CPAN, NuGet, Maven or native PHP target adapters"
];
const replaceOnce = (source, current, previous = "") => {
	assert.equal(source.split(current).length, 2, "Exactly one declared native graph admission edit");
	return source.replace(current, previous);
};
const list = values => `[${values.map(value => JSON.stringify(value)).join(", ")}]`;

/**
 * Reverse only NuGet/Maven/Composer admission, preserving all unrelated text.
 * Callers must compare the result with the original receipt's complete hash.
 *
 * @param path - One of the three shared native-build source paths.
 * @param source - Complete current source text.
 * @param beforeTarget - Return the source before this target was admitted.
 */
export const beforeNativeSharedAdmission = (path, source, beforeTarget) => {
	assert.ok([cPath, graphPath, projectPath].includes(path), `Not a shared native admission source: ${path}`);
	const stop = stages.findIndex(stage => stage.target === beforeTarget);
	assert.ok(stop >= 0, `Unknown native graph admission stage: ${beforeTarget}`);
	const base = ["c", "cpp", "cargo", "pypi", "rubygems", ...path === cPath ? [] : ["cpan"]];
	for(let index = stages.length - 1; index >= stop; index--)
	{
		const { target, binding, type } = stages[index];
		const before = list([...base, ...stages.slice(0, index).map(stage => stage.target)]);
		const after = list([...base, ...stages.slice(0, index + 1).map(stage => stage.target)]);
		source = replaceOnce(source, `${after}.includes(target)`, `${before}.includes(target)`);
		if(path === graphPath)
		{
			source = replaceOnce(source, `import { compileCopied${type}GraphPackageModel } from "../backends/${binding}/copied-graph-package.mjs";\n`);
			source = replaceOnce(source, messages[index + 1], messages[index]);
			source = replaceOnce(source, `\tconst ${binding} = targets.includes("${target}") ? compileCopied${type}GraphPackageModel(ir) : null;\n`);
			source = replaceOnce(source, ` ?? ${binding};`, ";");
		}
		else if(path === cPath && binding !== "dotnet")
		{
			source = replaceOnce(source, `import { generateCopied${type}GraphConversions } from "../backends/${binding}/copied-graph-conversions.mjs";\n`);
			source = replaceOnce(source, `\t\tif(targets.includes("${target}")) files["src/${binding}-graph-clear.c"] = generateCopied${type}GraphConversions(model.bindingIr).nativeReleaseSource;\n`);
			source = replaceOnce(source, `\t\t, ...graph && targets.includes("${target}") ? [join(root, "src/${binding}-graph-clear.c")] : []\n`);
		}
	}
	return source;
};
