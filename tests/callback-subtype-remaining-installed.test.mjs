/**
 * Installed .NET, JVM and native PHP acceptance for directional callback Subtypes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { callbackSubtypeConfiguration, callbackSubtypeFixture, callbackSubtypeReviewedIr } from "./helpers/callback-subtype-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";

const profiles = process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_REMAINING_PROFILES?.split(",").sort() ?? [];
const supported = ["dotnet", "java", "kotlin", "php-native"];
assert.ok(profiles.length === new Set(profiles).size && profiles.every(profile => supported.includes(profile)));
const targets = {
	dotnet: ["nuget", { name: "LeanBridge.Callbacksubtypes", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:callbacksubtypes", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:callbacksubtypes", version: "1.0.0" }]
	, "php-native": ["composer", { name: "lean-bridge/callbacksubtypes", version: "1.0.0" }]
};
const extension = { dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php" };

test("ordinary and reviewed remaining managed callback Subtypes install offline", {
	skip: !profiles.length, timeout: 3_600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-callback-subtype-remaining-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true, force: true });
		else t.diagnostic(`Retained failed callback Subtype remaining inputs: ${root}`);
	});
	const environment = nativeFixtureEnvironment(profiles), reports = [];
	let review;
	for(const route of ["ordinary", "reviewed"])
	{
		const routeRoot = join(root, route), author = join(routeRoot, "author");
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const handoff = join(routeRoot, "handoff");
		await cp(callbackSubtypeFixture, projectRoot, { recursive: true });
		const selectedTargets = Object.fromEntries(profiles.map(profile => targets[profile]));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			...callbackSubtypeConfiguration(route), targets: selectedTargets
		}));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		const before = await lakeInputState(projectRoot);
		const targetNames = [...new Set(profiles.map(profile => targets[profile][0]))];
		t.diagnostic(`${route}: building callback Subtypes for ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: targetNames, environment })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		if(route === "ordinary") review = callbackSubtypeReviewedIr(model.bindingIr);
		else assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		for(const profile of profiles)
		{
			const consumer = join(routeRoot, `${profile}-consumer`), target = targets[profile][0];
			const observation = await installCopiedConsumer({ profile, consumer, handoff
				, packages: receipt.packages.filter(pkg => pkg.target === target)
				, environment
				, fixture: {
					source: () => readFile(`tests/fixtures/callback-subtype-consumers/${profile}.${extension[profile]}`, "utf8")
					, success: "callback-subtype-remaining-ok", expectedChecks: 14
				}
			});
			delete observation.command;
			reports.push({ ...observation, route, profile
				, bindingIrSha256: built.bindingIrSha256
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(consumer, { recursive: true, force: true });
		}
	}
	const output = resolve(process.env.LEAN_BRIDGE_CALLBACK_SUBTYPE_REMAINING_OUTPUT
		?? "build/callback-subtypes/remaining.json");
	await saveLakeFile(dirname(output), basename(output), canonicalJson({ schemaVersion: 1, reports }));
	complete = true;
});
