/**
 * Resource-only C# members require neither callbacks nor anchored results.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedReceiverConfiguration } from "./helpers/owned-receiver-fixture.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { ownedDotnetPlainReceiverProbe, ownedDotnetReceiverProject
	, ownedDotnetPlainReceiverReviewedIr, ownedDotnetPlainReceiverSource } from "./helpers/owned-dotnet-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const consuming of [false, true]) for(const mode of ["ordinary", "reviewed"])
	test(`C# ${mode} resource-only receivers${consuming ? " consume without anchors" : " need no optional capabilities"}`, {
		skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_RECEIVER_TEST !== "1"
		, timeout: 600000
	}, async t => {
		const names = ["newTicket", "serial", "retainTicket", "pingTicket", ...consuming ? ["transferTicket"] : []];
		const configuration = await ownedReceiverConfiguration();
		configuration.exports = names.map(name => "Owned." + name); configuration.arities = {};
		const transfer = configuration.contracts["Owned.transferTicket"];
		configuration.contracts = { "Owned.serial": { receiver: "property" }
			, "Owned.pingTicket": { receiver: "property" }
			, "Owned.retainTicket": { receiver: "method" }
			, ...consuming ? { "Owned.transferTicket": transfer } : {} };
		const name = `${mode}-${consuming ? "consuming" : "plain"}`;
		const compiled = await compileOwnedDotnetFixture(t, {
			...mode === "ordinary" ? { configuration } : { reviewedIr: ownedDotnetPlainReceiverReviewedIr(consuming) }
			, receiverExports: true, hostCallbacks: false, transferredInputs: consuming
			, sourceSuffix: ownedDotnetPlainReceiverSource
			, evidenceName: `dotnet-receivers-${name}-inputs.json`
		});
		assert.equal(compiled.model.c.anchoredResults, undefined);
		assert.equal(compiled.model.c.copies, undefined);
		assert.equal(compiled.callbackSource, undefined);
		const probe = ownedDotnetPlainReceiverProbe(consuming);
		let result;
		try
		{
			const execute = await compiled.compile({ "Program.cs": probe, "Calls.csproj": ownedDotnetReceiverProject });
			result = await execute("plain-receivers");
		}
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.equal(result.stderr, "");
		const observed = JSON.parse(result.stdout);
		assert.deepEqual(observed, { checks: consuming ? 13 : 12, live: 0, identities: 0 });
		await saveLakeFile("build/owned-dotnet-receivers", `${name}.json`, canonicalJson({
			mode, consuming, actualLean: true, installedPackage: false, observed
			, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
			, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, source]) => [path, sha256(source)]))
			, nativeProbeSha256: sha256(compiled.implementation)
			, loaderSha256: sha256(compiled.loader), probeSha256: sha256(probe)
			, optimizedProjectSha256: sha256(ownedDotnetReceiverProject)
		}));
		t.diagnostic(JSON.stringify({ mode, consuming, ...observed }));
	});
