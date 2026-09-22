/**
 * Authenticate the previous C# verifiers after explicit value-equality upgrades.
 * Recorded original assemblies and source receipts remain unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

const fixtureImport = 'import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";';
const declarations = [
	"public sealed record SignalIdle\\(\\) : Signal"
	, "public sealed record SignalData\\(uint Count, string Label\\) : Signal"
	, "public sealed record SignalMarker\\(Unit Value\\) : Signal"
	, "public sealed record OneOnly\\(uint Value\\) : One"
];
const upgrades = new Map([
	["tests/dotnet-variant-contract.test.mjs"
		, declarations.map(declaration => [
			`\tassert.match(source, /${declaration};/);`
			, `\tassert.match(source, /${declaration}\\n\\{/);`])
	]
	, ["tests/dotnet-variant-evidence.test.mjs", [
		[fixtureImport, `${fixtureImport}\nimport { assertDotnetVariantSourceHash } from "./helpers/dotnet-source-history.mjs";`]
		, ['\tfor(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);'
			, '\tfor(const [path, hash] of Object.entries(record.sourceHashes)) assertDotnetVariantSourceHash(path, await readFile(path), hash);']
	]]
]);

/**
 * Accept unchanged source or reconstruct precisely the recorded verifier bytes.
 *
 * @param path - Historical source path.
 * @param contents - Current source bytes.
 * @param expected - Original recorded SHA-256.
 */
export const assertDotnetVariantSourceHash = (path, contents, expected) => {
	if(sha256(contents) === expected) return;
	assert.ok(upgrades.has(path), `Unreviewed historical .NET source change: ${path}`);
	let source = contents.toString();
	for(const [previous, current] of upgrades.get(path))
	{
		assert.equal(source.split(current).length, 2, `Expected one exact verifier upgrade: ${path}`);
		source = source.replace(current, previous);
	}
	assert.equal(sha256(source), expected, path);
};
