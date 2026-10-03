/**
 * Reconstruct callback-only CPAN policies before running installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyOwnedCpanTransfers } from "../../src/release/owned-cpan-contract.mjs";
import { readVerifiedCpanPackage } from "../../src/release/cpan-package.mjs";
import { ownedPerlCallbackPackageFixture } from "./owned-perl-callback-result-package-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("CPAN callback-v5 policies reconstruct both source paths with independent capabilities", async () => {
	for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true]) for(const host of [false, true])
	{
		const { manifest, files, model, generated } = await ownedPerlCallbackPackageFixture(mode, combined, host);
		assert.equal(manifest.ownedValues.schemaVersion, 5);
		assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
		assert.equal(generated.generated.wholeOwners, true);
		assert.equal(generated.generated.hostCallbacks, host);
		assert.equal(files.has("callbacks.c"), host);
		for(const key of ["inputTransfers", "resultAnchors", "receiverExports"])
			assert.equal(Boolean(manifest.ownedValues[key]), combined, key);
		assert.equal(manifest.ownedValues.callbackResultAnchors.parameterNumbering, "callback-local");
		assert.equal(manifest.ownedValues.callbackResultAnchors.signatures.length, 4);
		assert.doesNotThrow(() => verifyOwnedCpanTransfers(manifest, files));
	}
});

test("CPAN callback contracts reject downgraded summaries and altered compiler artifacts", async t => {
	let rejected = 0;
	for(const combined of [false, true]) for(const host of [false, true])
	{
		const original = await ownedPerlCallbackPackageFixture("reviewed", combined, host);
		const mutations = [
			value => { delete value.manifest.ownedValues; }
			, value => { value.manifest.ownedValues.schemaVersion = 4; }
			, value => { delete value.manifest.ownedValues.callbackResultAnchors; }
			, value => { value.manifest.ownedValues.callbackResultAnchors.parameterNumbering = "native-slot"; }
			, value => { value.manifest.ownedValues.callbackResultAnchors.signatures[0].parameter++; }
			, value => { value.files.delete("LeanBridgeBuild.pm"); value.manifest.ownedValues.schemaVersion = 1; }
			, value => { value.files.set("Component.xs", Buffer.from("unverified XS")); }
			, value => { value.files.set("allocation-guard.h", Buffer.from("unverified guard")); }
			, value => { host ? value.files.delete("callbacks.c") : value.files.set("callbacks.c", Buffer.from("unexpected host transport")); }
			, value => {
				for(const path of ["model.json", "native-component.json", "binding-manifest.json"])
				{
					const document = JSON.parse(value.files.get(path));
					delete document.callbackResultAnchors;
					if(document.ownedGraph) delete document.ownedGraph.callbackResultAnchors;
					if(document.owned) delete document.owned.callbackResultAnchors;
					value.files.set(path, Buffer.from(canonicalJson(document)));
				}
				delete value.manifest.ownedValues.callbackResultAnchors;
			}
			, value => {
				value.manifest.ownedValues.schemaVersion = combined ? 4 : 1;
				delete value.manifest.ownedValues.callbackResultAnchors;
				for(const path of ["model.json", "native-component.json", "binding-manifest.json"])
				{
					const document = JSON.parse(value.files.get(path));
					if(path === "model.json")
					{
						document.schemaVersion = combined ? 10 : 7;
						document.ownedGraph.schemaVersion = combined ? 5 : 2;
						delete document.ownedGraph.callbackResultAnchors;
					}
					else if(path === "native-component.json")
					{
						document.schemaVersion = combined ? 6 : 3;
						delete document.callbackResultAnchors;
					}
					else
					{
						document.schemaVersion = combined ? 4 : 1;
						document.owned.schemaVersion = document.schemaVersion;
						delete document.owned.callbackResultAnchors;
					}
					value.files.set(path, Buffer.from(canonicalJson(document)));
				}
			}
			, value => {
				const ir = JSON.parse(value.files.get("binding-ir.json"));
				value.files.clear();
				value.files.set("binding-ir.json", Buffer.from(canonicalJson(ir)));
				delete value.manifest.ownedValues;
			}
		];
		for(const mutate of mutations)
		{
			const changed = { manifest: structuredClone(original.manifest), files: new Map(original.files) };
			mutate(changed); assert.throws(() => verifyOwnedCpanTransfers(changed.manifest, changed.files)); rejected++;
		}
	}
	t.diagnostic(`${rejected} forged CPAN callback policies rejected`);
});

test("prepared CPAN callback verification binds the exact installer beyond its mutable inventory", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-perl-callback-package-contract-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const { manifest, files } = await ownedPerlCallbackPackageFixture("ordinary", false, false);
	for(const [path, bytes] of files) await saveLakeFile(directory, path, bytes);
	await saveLakeFile(directory, "lean-bridge-package.json", canonicalJson(manifest));
	await readVerifiedCpanPackage(directory);
	for(const installer of ["1;\n", files.get("LeanBridgeBuild.pm").toString() + "\n# altered\n"])
	{
		await saveLakeFile(directory, "LeanBridgeBuild.pm", installer);
		manifest.files["LeanBridgeBuild.pm"] = sha256(installer);
		await saveLakeFile(directory, "lean-bridge-package.json", canonicalJson(manifest));
		await assert.rejects(() => readVerifiedCpanPackage(directory), /callback installer differs/u);
	}
});
