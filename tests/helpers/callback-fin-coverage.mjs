/**
 * Require the exact supported callback-Fin hosts, routes and evidence.
 *
 * @file
 */
import assert from "node:assert/strict";

const callbackFinCoverage = [
	[["node-javascript", "node-typescript"], "ordinary-source", ["npm-callback-fin-installed"]]
	, [["node-javascript", "node-typescript"], "reviewed-ir", ["reviewed-callback-fin-npm-r1-installed", "reviewed-callback-fin-npm-r2-installed"]]
	, [["browser-javascript", "browser-react", "browser-worker"], "ordinary-source", ["browser-callback-fin-ordinary-installed"]]
	, [["browser-javascript", "browser-react", "browser-worker"], "reviewed-ir", ["hosted-reviewed-callback-fin-browser-installed"]]
	, [["c", "cpp"], "ordinary-source", ["native-callback-fin-ordinary-installed", "native-callback-fin-host-replies-installed"]]
	, [["c", "cpp"], "reviewed-ir", ["reviewed-callback-fin-c-cpp-installed"]]
	, [["perl", "ruby", "python", "rust"], "ordinary-source"
		, ["hosted-callback-fin-native-languages-installed"]]
	, [["perl", "ruby", "python", "rust"], "reviewed-ir"
		, ["hosted-callback-fin-native-languages-installed"]]
	, [["php-native", "dotnet", "java", "kotlin", "wit-wasi"]
		, "ordinary-source", ["hosted-callback-fin-managed-wit-installed"]]
	, [["php-native", "dotnet", "java", "kotlin", "wit-wasi"]
		, "reviewed-ir", ["hosted-callback-fin-managed-wit-installed"]]
	, [["php-wasm"], "ordinary-source", ["callback-refinements-php-wasm-hosted-installed"]]
	, [["php-wasm"], "reviewed-ir", ["callback-refinements-php-wasm-hosted-installed"]]
];

/**
 * Check each observed host, source route, position and stage against the recorded evidence.
 *
 * @param cells - Installed callback-Fin cells from the current inventory.
 */
export const assertCallbackFinCoverage = cells => {
	const expected = new Map(callbackFinCoverage.flatMap(([profiles, path, evidence]) => profiles.flatMap(profile =>
		["callback-parameter", "callback-result"].map(position => [`${profile}/fin/${path}/${position}`, evidence]))));
	assert.deepEqual(cells.map(cell => cell.id).sort(), [...expected.keys()].sort());
	for(const cell of cells)
	{
		assert.equal(cell.id, `${cell.profile}/${cell.shape}/${cell.path}/${cell.position}`);
		assert.deepEqual(Object.keys(cell.stages).sort(), [
			"analysis", "compilation", "generation", "installedExecution", "packaging"
		], cell.id);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed", cell.id);
			assert.deepEqual(stage.evidence, expected.get(cell.id), cell.id);
		}
	}
};
