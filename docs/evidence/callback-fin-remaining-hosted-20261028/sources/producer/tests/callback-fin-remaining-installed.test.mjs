/**
 * Installed .NET, JVM, native PHP and WIT/WASI acceptance for checked Fin
 * callbacks and returned Lean closures.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { callbackSubtypeJvmInstaller } from "./helpers/callback-subtype-jvm-install.mjs";
import { closeCallbackSubtypeWit } from "./helpers/callback-subtype-wit-install.mjs";
import {
	callbackFinConfiguration, callbackFinFixture, callbackFinReviewedIr
} from "./helpers/callback-fin-fixture.mjs";
import {
	callbackFinRemainingChecks, callbackFinRemainingProfiles
	, callbackFinRemainingTestName
} from "./helpers/callback-fin-remaining-ci.mjs";
import {
	clearCallbackFinRetainedPackages, retainCallbackFinRoute
	, writeCallbackFinRetainedPackages
} from "./helpers/callback-fin-retained-packages.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
} from "./helpers/copied-fixture-install.mjs";
import { checkInstalledDotnetValues } from "./helpers/dotnet-copied-install.mjs";
import {
	installFinContainerEdgePhp, runFinContainerEdgePhp
	, verifyFinContainerEdgePhpEnvironment
} from "./helpers/fin-container-edge-php-closure.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";

const profiles = process.env.LEAN_BRIDGE_CALLBACK_FIN_REMAINING_PROFILES
	?.split(",").sort() ?? [];
assert.ok(profiles.length === new Set(profiles).size
	&& profiles.every(profile => callbackFinRemainingProfiles.includes(profile)));
const targets = {
	dotnet: ["nuget", { name: "LeanBridge.Reviewedcallbacks", version: "1.0.0" }]
	, java: ["maven", { name: "org.leanbridge:reviewedcallbacks", version: "1.0.0" }]
	, kotlin: ["maven", { name: "org.leanbridge:reviewedcallbacks", version: "1.0.0" }]
	, "php-native": ["php-native", {
		name: "lean-bridge/reviewedcallbacks", version: "1.0.0"
	}]
	, "wit-wasi": ["wit-wasi", { name: "reviewed-callbacks", version: "1.0.0" }]
};
const extension = {
	dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c"
};
const configuredTargets = selected => Object.fromEntries(
	selected.map(profile => targets[profile])
);

test("remaining callback Fin mappings separate host profiles from build aliases", () => {
	assert.deepEqual(Object.keys(configuredTargets(["php-native"])), ["php-native"]);
	assert.deepEqual(Object.keys(configuredTargets(["java", "kotlin"])), ["maven"]);
	assert.deepEqual(Object.keys(configuredTargets(["dotnet", "wit-wasi"]))
		, ["nuget", "wit-wasi"]);
});

test(callbackFinRemainingTestName, {
	skip: !profiles.length, timeout: 3_600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-callback-fin-remaining-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true, force: true });
		else t.diagnostic(`Retained failed callback Fin remaining inputs: ${root}`);
	});
	const output = resolve(process.env.LEAN_BRIDGE_CALLBACK_FIN_REMAINING_OUTPUT
		?? "build/callback-fin/remaining/report.json");
	await clearCallbackFinRetainedPackages(output);
	const retainedEntries = [];
	const environment = nativeFixtureEnvironment(profiles), reports = [];
	const review = callbackFinReviewedIr();
	for(const route of ["ordinary", "reviewed"])
	{
		const routeRoot = join(root, route), author = join(routeRoot, "author");
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const handoff = join(routeRoot, "handoff");
		await cp(callbackFinFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
			...callbackFinConfiguration(route), targets: configuredTargets(profiles)
		}));
		if(route === "reviewed") await saveLakeFile(projectRoot
			, "api.binding-ir.json", canonicalJson(review));
		const before = await lakeInputState(projectRoot);
		const targetNames = [...new Set(profiles.map(profile => targets[profile][0]))];
		t.diagnostic(`${route}: building callback Fin for ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({
			projectRoot, outputRoot, targets: targetNames, environment
		}).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const model = JSON.parse(await readFile(
			join(outputRoot, "native/component/model.json"), "utf8"));
		assert.equal(reviewedContractDifference(review, model.bindingIr), null);
		const { receipt, entry } = await retainCallbackFinRoute({
			output, route, source: outputRoot, handoff
		});
		retainedEntries.push(entry);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		const receiptSha256 = sha256(await readFile(
			join(handoff, "package-set-receipt.json")));
		let installJvm;
		if(profiles.some(profile => ["java", "kotlin"].includes(profile)))
		{
			const pkg = receipt.packages.find(item =>
				item.target === "maven" && item.role === "component");
			const dependencies = await prepareJvmCorpusDependencies({
				directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment
			});
			installJvm = callbackSubtypeJvmInstaller({ handoff, pkg, dependencies });
		}
		await rm(author, { recursive: true, force: true });
		for(const profile of profiles)
		{
			const consumer = join(routeRoot, `${profile}-consumer`);
			const target = targets[profile][0];
			const checks = callbackFinRemainingChecks[profile];
			const observation = await installCopiedConsumer({
				profile, consumer, handoff
				, packages: receipt.packages.filter(pkg => pkg.target === target)
				, environment
				, fixture: {
					source: () => readFile(
						`tests/fixtures/callback-fin-consumers/${profile}.${extension[profile]}`
						, "utf8")
					, success: "callback-fin-remaining-ok", expectedChecks: checks
					, ...["java", "kotlin"].includes(profile) ? { installJvm } : {}
					, ...profile === "php-native" ? {
						installPhp: installFinContainerEdgePhp
					} : {}
					, ...profile === "wit-wasi" ? {
						wit: [/resource function/u, /scaler/u, /visit/u]
						, parseResult: JSON.parse
					} : {}
				}
			});
			delete observation.command; delete observation.result;
			if(profile === "dotnet")
			{
				const runtimeHandoff = join(routeRoot, "dotnet-runtime-handoff");
				await cp(handoff, runtimeHandoff, { recursive: true });
				const deployed = await checkInstalledDotnetValues({
					consumer, handoff: runtimeHandoff
					, packages: receipt.packages.filter(pkg => pkg.target === target)
					, environment, checks
					, fixture: {
						namespace: "LeanBridge.Reviewedcallbacks"
						, success: "callback-fin-remaining-ok"
						, rejectedSources: {}, expectedDiagnostics: {}
					}
				});
				Object.assign(observation, {
					sdkFreeRuntime: true, repeatExecution: true
					, sourceFreeExecution: deployed.sourceFree
					, runtimeVersion: deployed.runtimeVersion
					, installedAssemblySha256: deployed.assemblySha256
				});
			}
			if(observation.jvmEnvironment)
			{
				Object.assign(observation, observation.jvmEnvironment);
				delete observation.jvmEnvironment;
			}
			if(observation.phpEnvironment)
			{
				const relocated = join(consumer, "php-relocated");
				await rename(observation.phpEnvironment.root, relocated);
				const context = { ...observation.phpEnvironment, root: relocated };
				for(const mode of ["weak", "strict"])
				{
					const replay = await runFinContainerEdgePhp(context, mode);
					assert.equal(replay.stderr, "");
					assert.equal(replay.stdout, "callback-fin-remaining-ok:19\n");
				}
				const verified = await verifyFinContainerEdgePhpEnvironment(context);
				Object.assign(observation, {
					closedComposerInstall: true, relocatedReplay: true
					, repeatExecution: true
					, packageFileSetSha256: verified.packageFileSetSha256
					, vendorFilesSha256: verified.vendorFilesSha256
				});
				delete observation.phpEnvironment;
			}
			if(profile === "wit-wasi")
			{
				assert.equal(profile, profiles.at(-1)
					, "WIT must close the route handoff last");
				Object.assign(observation, await closeCallbackSubtypeWit({
					consumer, handoff
					, pkg: receipt.packages.find(item =>
						item.target === target && item.role === "component")
					, relocated: join(routeRoot, "wit-relocated")
					, expectedChecks: checks
				}));
			}
			reports.push({
				...observation, route, profile
				, bindingIrSha256: built.bindingIrSha256
				, receiptSha256, sourceRemovedBeforeInstallation: true
			});
			await rm(consumer, { recursive: true, force: true });
		}
	}
	await saveLakeFile(dirname(output), basename(output)
		, canonicalJson({ schemaVersion: 1, reports }));
	await writeCallbackFinRetainedPackages(output, retainedEntries);
	complete = true;
});
