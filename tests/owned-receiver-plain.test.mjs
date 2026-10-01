/**
 * Receiver exports do not require anchors, consuming inputs or host callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedReceiverConfiguration, ownedReceiverReviewedIr } from "./helpers/owned-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const plainReceiverProbe = await readFile("tests/fixtures/structured-types/owned-receiver-plain.c", "utf8");

for(const mode of ["ordinary", "reviewed"]) test(`plain ${mode} receiver exports need no optional ownership capabilities`, {
	skip: process.env.LEAN_BRIDGE_OWNED_RECEIVER_TEST !== "1", timeout: 600000
}, async t => {
	const names = ["newTicket", "serial", "retainTicket"];
	const configuration = await ownedReceiverConfiguration();
	configuration.exports = names.map(name => "Owned." + name); configuration.arities = {};
	configuration.contracts = { "Owned.serial": { receiver: "property" }, "Owned.retainTicket": { receiver: "method" } };
	const ir = ownedReceiverReviewedIr();
	ir.declarations = ir.declarations.filter(item => names.includes(item.name));
	ir.types = ir.types.filter(item => item.id === "lean:Owned.Ticket");
	ir.errors = [];
	for(const item of ir.declarations) if(item.result.ownership === "borrow")
		Object.assign(item.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration } : { reviewedIr: ir }
		, evidenceName: `receiver-plain-${mode}-inputs.json` });
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, receiverExports: true };
	const model = createCompiledNativeModel(input, { ownedGraphs: true, ownedReceiverExports: true });
	assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
	for(const key of ["hostCallbacks", "resultAnchors", "inputTransfers"])
		assert.equal(model.ownedGraph[key], undefined);
	assert.equal(model.ownedGraph.receiverExports.exports.length, 2);
	assert.equal(generateCompiledNativeLeanAdapters(model).callbackSource, undefined);
	const generated = generateOwnedCPackage(input);
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "plain-api.c" : path.split("/").at(-1), source + (path.startsWith("src/") ? `
size_t receiver_identity_count(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
` : ""));
	const run = await compiled.compile(mode + "-plain-receivers", plainReceiverProbe, false, ["plain-api.c", "-lgmp"]);
	const observed = await run(); assert.equal(observed.stderr, "");
	const result = JSON.parse(observed.stdout); assert.equal(result.checks, 14); assert.equal(result.identities, 0);
	await saveLakeFile("build/owned-receivers", mode + "-plain.json", canonicalJson({
		mode, input, model, result, sourceSha256: sha256(generated.source)
		, probeSha256: sha256(plainReceiverProbe) }));
	t.diagnostic(JSON.stringify({ mode, plain: true, ...result }));
});
