/**
 * Authenticate the native callback Fin capability-gate repair without
 * rewriting any earlier implementation or evidence history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinNativeCapabilityHistoryPath
	= "docs/evidence/callback-fin-native-capability-source-history-20261028.json";
export const callbackFinNativeCapabilityPredecessor
	= "d4bc67690aa433c54b5ba5c8f763b60f3df9b9aa";
export const callbackFinNativeCapabilityImplementation
	= "eba488862e5989f565afbf6c641e0f255756888c";
export const callbackFinNativeCapabilityChangedPaths = Object.freeze([
	"src/build/native-c-projection.mjs"
	, "src/build/native-dotnet-artifacts.mjs"
	, "src/build/native-jvm-artifacts.mjs"
	, "src/build/native-php-artifacts.mjs"
	, "src/build/native-project.mjs"
	, "src/build/native-python-artifacts.mjs"
	, "src/build/native-ruby-artifacts.mjs"
	, "src/build/native-rust-artifacts.mjs"
	, "src/build/native-wit-artifacts.mjs"
	, "src/release/cpan-package.mjs"
	, "tests/helpers/checked-record-native-host-tests.mjs"
]);
export const callbackFinNativeCapabilityIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript-partition-07.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinNativeCapabilityNormalizationPaths = Object.freeze([
	...callbackFinNativeCapabilityChangedPaths
	, ...callbackFinNativeCapabilityIntegrationPaths
].toSorted());
export const callbackFinNativeCapabilityAddedPaths = Object.freeze([
	"scripts/update-callback-fin-native-capability-source-history.mjs"
	, "tests/helpers/callback-fin-native-capability-source-history-tests.mjs"
	, "tests/helpers/callback-fin-native-capability-source-history.mjs"
]);
export const callbackFinNativeCapabilityPins = Object.freeze([
	["src/build/native-project.mjs", 99, "b941e848c291a05a4fab3e93f2d9f5d3a5c9380f9a290c5668378c05ae5b5cf7", "805888604fbfd36739ddb89636669639e9ddc290a69a1e57302069e33df95637"]
	, ["src/build/native-c-projection.mjs", 92, "e2427f77720d5f90b0cc0a669cf42c4d179d4762ed1bf9367b6a7eb824253494", "684edc3b6ddc3ec05fe9dab1f3a13bad01371fa29a7e0fbe8ff635a44d88cf7b"]
	, ["src/build/native-python-artifacts.mjs", 15, "63c1ca8f03b289ca8064710d9ccd6a0c6c0a311d57b577333b8372ca51e23561", "095e332ea4ef1dea01dd6b4fe4b6ed691a021e68efa0606a1982f332e7d03db1"]
	, ["src/build/native-ruby-artifacts.mjs", 12, "296ccf9cbafd02ff8a0c0f8e4608c40e5379a681a2682ea795af818af65e4145", "983fd2a3ae831e83a45b030241efe7514dad0a7ab40cf06f4ca15bc191491218"]
	, ["src/build/native-rust-artifacts.mjs", 14, "85ca9fe5176ee629cb77455672da02da25b07f5751a9ea52d84ba6e1a4f5c04d", "c568f1ce875100577fdb30fce76a13d08e8a79b8b2fe0c8ea58566125f3387d1"]
	, ["src/build/native-dotnet-artifacts.mjs", 9, "6f99f52f9216cf4bd040aee0f5b82f60d88755da6261a48604ffc69220ddf1b3", "8e3d905bc6e09928a428febec6327f39f7787e7215b382735c5c3bfacb2a1f4a"]
	, ["src/build/native-jvm-artifacts.mjs", 19, "e60076860021983a46fefe2fb2cb22c218b915bf8b13753c083db3ef0150ee81", "eadaff10c1bbbe4bc714f6105642aee5cbcc356776817e484ad22473839f0ab8"]
	, ["src/build/native-php-artifacts.mjs", 10, "f918a4a6031de9a419062dfe4276181c98bd8f7ea7ff3d4c2ae29f8749983a24", "8e8739092c1e70aef2f37192986530a521f987bd16dc0f0f4b90a00cc622caab"]
	, ["src/build/native-wit-artifacts.mjs", 10, "1410b9eed76e33354b861751ec699ae6866cab704e562b597e89d2e82192f261", "ddbc315e7de3ba251bdb300b71c3de2c8dca087b2e486af10c13569283691694"]
	, ["src/release/cpan-package.mjs", 16, "b7a606541cc82a2917851074513a2371e968c8add561e08b86e4701b8b8ad463", "c112e85897ea6a0d90a2a879127c2177645a42858b88d5609eef46bd5cde2821"]
].map(([path, count, previousSha256, currentSha256]) => Object.freeze({ path, count, previousSha256, currentSha256 })));

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinNativeCapabilityHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackFinNativeCapabilityUpdate = (source, update) => {
	assert.ok(callbackFinNativeCapabilityNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact native callback Fin capability transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCallbackFinNativeCapabilitySource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackFinNativeCapabilityNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCallbackFinNativeCapabilityUpdate(current, update);
	}
	return current;
};
