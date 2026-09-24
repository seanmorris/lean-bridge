/**
 * Preserve the exact tests preceding Maven and Composer graph admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

const currentPackageVerifier = [
	['import { assertCurrentDotnetGraphPackages } from "./helpers/dotnet-current-graph-evidence.mjs";\n', ""]
	, ['\tawait assertCurrentDotnetGraphPackages(record);\n', '\tfor(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);\n']
];

/**
 * Remove only the current-package receipt check from the test's source snapshot.
 * Installed test bodies and all other assertions must remain byte-identical.
 *
 * @param source - Current or preceding complete NuGet graph test module.
 */
export const beforeDotnetCurrentPackageVerification = source => {
	source = beforeWitPackageIntegration("tests/dotnet-graph-package.test.mjs", source);
	if(currentPackageVerifier.every(([current]) => !source.includes(current))) return source;
	for(const [current, previous] of currentPackageVerifier)
	{
		assert.equal(source.split(current).length, 2, "Exactly one current NuGet package verifier change");
		source = source.replace(current, previous);
	}
	return source;
};

const changes = {
	"tests/dotnet-graph-package.test.mjs": [
		['import { beforeNativeSharedAdmission } from "./helpers/native-shared-admission.mjs";\n', ""]
		, ['const source = beforeNativeSharedAdmission(path, await readFile(path, "utf8"), "maven"), expected = baseline.sourceHashes[path];', 'const source = await readFile(path, "utf8"), expected = baseline.sourceHashes[path];']
	]
	, "tests/jvm-graph-package.test.mjs": [
		['\tassert.equal(compileNativeGraphProjection(ir, ["maven", "php-native"]).prefix, "recursive");\n', ""]
		, ['\tfor(const targets of [["maven", "wit-wasi"]])\n', '\tfor(const targets of [["maven", "php-native"], ["maven", "wit-wasi"]])\n']
	]
	, "tests/perl-graph-package.test.mjs": [[
		'\tfor(const target of ["nuget", "maven", "php-native"])\n'
		+ '\t{\n'
		+ '\t\tassert.deepEqual(compileNativeGraphProjection(ir, ["cpan", target], model.moduleName), model);\n'
		+ '\t\tassert.deepEqual(compileNativeGraphProjection(ir, [target, "cpan"], model.moduleName), model);\n'
		+ '\t\tassert.throws(() => compileNativeGraphProjection(ir, ["cpan", target], "LeanBridge::Runtime"), /module/);\n'
		+ '\t}\n'
		+ '\tfor(const target of ["unknown", "wit-wasi"])\n'
		+ '\t\tassert.throws(() => compileNativeGraphProjection(ir, ["cpan", target], model.moduleName), { code: "native-graph-projection-unavailable" });\n'
		, '\tassert.throws(() => compileNativeGraphProjection(ir, ["cpan", "maven"], model.moduleName), { code: "native-graph-projection-unavailable" });\n'
	]]
	, ...Object.fromEntries([["python", "pypi"], ["ruby", "rubygems"], ["rust", "cargo"]].map(([language, target]) => {
		const before = target === "cargo" ? '["maven"]' : `["${target}", "maven"]`;
		const after = target === "cargo" ? '["wit-wasi"]' : `["${target}", "wit-wasi"]`;
		const prefix = `\tfor(const targets of [[], ["${target}", "${target}"], ["${target}", "cpan"], `;
		return [`tests/${language}-graph-package.test.mjs`, [[
			'\tfor(const host of ["maven", "php-native"])\n'
			+ `\t\tassert.equal(compileNativeGraphProjection(ir, ["${target}", host]).layoutSha256, model.layoutSha256);\n`
			+ prefix + after + "])\n"
			, prefix + before + "])\n"
		]]];
	}))
};

/**
 * Reverse only the declared target-test updates, retaining unrelated changes.
 * Callers must authenticate the full predecessor with its original digest.
 *
 * @param path - One of the two updated target tests.
 * @param source - Complete current test source.
 */
export const beforeNativeSharedTestUpdates = (path, source) => {
	source = beforeWitPackageIntegration(path, source);
	assert.ok(Object.hasOwn(changes, path), `Not a shared native target test: ${path}`);
	if(path === "tests/dotnet-graph-package.test.mjs") source = beforeDotnetCurrentPackageVerification(source);
	for(const [current, previous] of changes[path])
	{
		assert.equal(source.split(current).length, 2, "Exactly one native target test update");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Reconstruct the original NuGet test before Maven and Composer admission.
 *
 * @param source - Complete current NuGet graph test source.
 */
export const beforeDotnetGraphTargetTests = source => {
	source = beforeNativeSharedTestUpdates("tests/dotnet-graph-package.test.mjs", source);
	const current = '\tfor(const targets of [["nuget", "maven"], ["nuget", "php-native"]])\n'
		+ '\t\tassert.equal(compileNativeGraphProjection(ir, targets).prefix, "recursive");\n'
		+ '\tfor(const targets of [["nuget", "nuget"], ["nuget", "wit-wasi"]])\n';
	const previous = '\tfor(const targets of [["nuget", "nuget"], ["nuget", "maven"], ["nuget", "php-native"]])\n';
	assert.equal(source.split(current).length, 2, "Exactly one NuGet target expansion");
	return source.replace(current, previous);
};

/**
 * Remove only the added numeric-CI-flag cases from the original registration test.
 *
 * @param source - Complete current or preceding registration-test module.
 */
export const beforeNumericFlagTests = source => {
	if(!source.includes('import { beforeNumericTestFlags } from "./helpers/source-registration-flags.mjs";\n'.trimEnd())) return source;
	const additions = [
		"\t\t, [\".github/workflows/consumer-matrix.yml\", \"          LEAN_BRIDGE_WASM32_RECURSIVE_TEST=1 node --test tests/wasm32-recursive-transport.test.mjs\"]\n"
		, "\t\t, [\".github/workflows/consumer-matrix.yml\", '              consumer_command=\"$consumer_command && LEAN_BRIDGE_WASM32_RECURSIVE_TEST=1 node --test tests/wasm32-recursive-transport.test.mjs\"']\n"
		, "\t\t, [\".github/workflows/consumer-matrix.yml\", \"          LEAN_BRIDGE_WASM32_RECURSIVE_TEST=1 node --test tests/wasm32-recursive-transport.test.mjs || true\"]\n"
		, "\t\t, [\".github/workflows/consumer-matrix.yml\", \"          LEAN_BRIDGE_WASM32_RECURSIVE_TEST=0 node --test tests/wasm32-recursive-transport.test.mjs\"]\n"
		, "import { beforeNumericTestFlags } from \"./helpers/source-registration-flags.mjs\";\n"
		, "test(\"numeric test flags preserve the original verifier hashes and reject unrelated edits\", async () => {\n\tconst record = JSON.parse(await readFile(\"docs/evidence/native-asset-tamper-20260923.json\"));\n\tfor(const path of [\"tests/helpers/source-registration-history.mjs\", \"tests/helpers/native-asset-tamper-history.mjs\"])\n\t{\n\t\tconst current = await readFile(path, \"utf8\"), expected = record.sourceHashes[path];\n\t\tassert.equal(sha256(beforeNumericTestFlags(path, current)), expected);\n\t\tassert.notEqual(sha256(beforeNumericTestFlags(path, current + \"\\n\")), expected);\n\t}\n\tassert.equal(beforeNumericTestFlags(\"src/build/native-project.mjs\", \"unaltered\"), \"unaltered\");\n});\n\n"
	];
	for(const addition of additions)
	{
		assert.equal(source.split(addition).length, 2, "Exactly one numeric-flag test addition");
		source = source.replace(addition, "");
	}
	return source;
};
