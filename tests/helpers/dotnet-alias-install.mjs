/**
 * Check installed alias catalogs, exact compiler rejections and SDK-free execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { checkInstalledDotnetValues } from "./dotnet-copied-install.mjs";
import { nativeAliasReviewedIr } from "./native-alias-fixture.mjs";

/**
 * Inspect the received package, then relocate its compiled consumer for execution.
 *
 * @param options - Completed installed .NET alias consumer.
 */
export const checkInstalledDotnetAliases = async options => {
	const pkg = options.packages.find(item => item.role === "component");
	const root = join(options.consumer, "dotnet/packages", pkg.name.toLowerCase(), pkg.version);
	const manifest = await readFile(join(root, "lean-bridge/dotnet/binding-manifest.json"));
	const aliases = JSON.parse(manifest).aliases;
	assert.equal(aliases.length, 27);
	const contracts = values => values.map(({ id, name, target }) => ({ id, name, target })).sort((a, b) => a.id.localeCompare(b.id));
	assert.deepEqual(contracts(aliases), contracts(nativeAliasReviewedIr().types.filter(type => type.kind === "alias")));
	const xml = await readFile(join(root, "lib/net8.0/LeanBridge.Aliases.xml"), "utf8");
	for(const alias of aliases) assert.ok(xml.includes(`<term><c>${alias.name}</c></term>`), alias.name);
	assert.match(xml, /<param name="Count">Contract type: <c>Count<\/c>\.<\/param>/);
	assert.match(xml, /<returns>Contract type: <c>OtherCount<\/c>\.<\/returns>/);
	assert.match(xml, /array&lt;list&lt;Count&gt;&gt;/);
	assert.match(await readFile(join(root, "README.md"), "utf8"), /C# using aliases are local to source files/);
	const bytes = await readFile("tests/fixtures/alias-consumers/dotnet-invalid.json");
	const rejected = JSON.parse(bytes);
	const installed = await checkInstalledDotnetValues({ ...options
		, fixture: { namespace: "LeanBridge.Aliases", success: "alias-dotnet-ok"
			, rejectedSources: Object.fromEntries(rejected.map(item => [item.name, item.statement]))
			, expectedDiagnostics: Object.fromEntries(rejected.map(item => [item.name, [item.code]])) } });
	return { ...installed, aliases, manifestSha256: sha256(manifest)
		, xmlSha256: sha256(xml), rejectionSourceSha256: sha256(bytes) };
};
