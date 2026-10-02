/**
 * Reject callback-contract omissions, downgrades and coordinated forgeries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { packageOwnedNuget } from "../../src/release/owned-nuget.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Require compiler authentication at the adapter and compiled-assembly layers.
 *
 * @param options - Fresh receipts and the exact successful package inputs.
 */
export const rejectOwnedDotnetCallbackContracts = async options => {
	const { adapter, compiled, packageOptions, directory } = options;
	const receipts = { adapter, compiled };
	const paths = {
		adapter: [packageOptions.adapterRoot, "native-dotnet-adapter.json"]
		, compiled: [packageOptions.dotnetRoot, "native-dotnet.json"]
	};
	const layers = [["adapter", "ownedValues"], ["adapter", "dotnetValues"], ["compiled", "ownedValues"]];
	const rejected = [];
	const reject = async (name, change) => {
		const forged = structuredClone(receipts); change(forged);
		try
		{
			for(const [key, [root, path]] of Object.entries(paths))
				await saveLakeFile(root, path, canonicalJson(forged[key]));
			await assert.rejects(packageOwnedNuget({ ...packageOptions
				, working: join(directory, `forged-callback-${rejected.length}`) }), /compiler-authenticated/u);
		}
		finally
		{
			for(const [key, [root, path]] of Object.entries(paths))
				await saveLakeFile(root, path, canonicalJson(receipts[key]));
		}
		rejected.push(name);
	};
	for(const [receipt, section] of layers)
	{
		const prefix = `${receipt}.${section}`;
		for(const field of Object.keys(receipts[receipt][section].callbackResultAnchors))
		{
			await reject(`${prefix}.${field}.forged`, changed => {
				changed[receipt][section].callbackResultAnchors[field] = "forged";
			});
			await reject(`${prefix}.${field}.omitted`, changed => {
				delete changed[receipt][section].callbackResultAnchors[field];
			});
		}
		await reject(`${prefix}.omitted`, changed => { delete changed[receipt][section].callbackResultAnchors; });
		await reject(`${prefix}.downgraded`, changed => { changed[receipt][section].schemaVersion--; });
		for(const [name, change] of [
			["different-parameter", signatures => { signatures[1].parameter = 0; }]
			, ["missing-signature", signatures => { signatures.pop(); }]
			, ["duplicate-signature", signatures => { signatures[1] = signatures[0]; }]
			, ["foreign-signature", signatures => { signatures[0].id = "bridge:Forged"; }]
		]) await reject(`${prefix}.${name}`, changed => change(changed[receipt][section].callbackResultAnchors.signatures));
	}
	for(const receipt of Object.keys(receipts))
		await reject(`${receipt}.downgraded`, changed => { changed[receipt].schemaVersion--; });
	await reject("coordinated-original-owner-substitution", changed => {
		for(const [receipt, section] of layers)
			changed[receipt][section].callbackResultAnchors.anchor = "captured-closure-owner";
	});
	await reject("coordinated-wrong-argument", changed => {
		for(const [receipt, section] of layers)
			changed[receipt][section].callbackResultAnchors.signatures[1].parameter = 0;
	});
	return rejected;
};
