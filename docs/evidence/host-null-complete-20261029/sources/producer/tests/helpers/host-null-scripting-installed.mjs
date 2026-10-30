/**
 * Source-free, relocated HostNull acceptance for prepared CPAN, PyPI and RubyGems packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, cp, mkdir, mkdtemp, readFile, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied
} from "./copied-fixture-install.mjs";
import {
	installFinContainerEdgePython, runFinContainerEdgePython
	, verifyFinContainerEdgePythonEnvironment
} from "./fin-container-edge-python-closure.mjs";
import {
	installFinContainerEdgeRuby, runFinContainerEdgeRuby
	, verifyFinContainerEdgeRubyEnvironment
} from "./fin-container-edge-ruby-closure.mjs";
import {
	hostNullArities, hostNullProjection, hostNullReviewedIr
} from "./host-null-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

export const hostNullScriptingProfiles = Object.freeze(["perl", "python", "ruby"]);
export const hostNullScriptingChecks = 36;
const targets = Object.freeze({
	cpan: Object.freeze({ module: "LeanBridge::HostNullDemo", version: "1.000" })
	, pypi: Object.freeze({ name: "host-null-demo-api", version: "1.0.0" })
	, rubygems: Object.freeze({ name: "host-null-demo-api", version: "1.0.0" })
});
const targetByProfile = Object.freeze({ perl: "cpan", python: "pypi", ruby: "rubygems" });
const extensionByProfile = Object.freeze({ perl: "pl", python: "py", ruby: "rb" });
const exports_ = hostNullReviewedIr().declarations.map(item => item.source.declaration);

const privateShape = ir => {
	const abi = createComponentPrivateAbi(ir);
	return { ...abi
		, types: abi.types.toSorted((left, right) => left.id.localeCompare(right.id))
		, callbacks: abi.callbacks.toSorted((left, right) => left.id.localeCompare(right.id))
		, exports: abi.exports.toSorted((left, right) => left.bindingId.localeCompare(right.bindingId)) };
};

const installedFiles = async root => {
	const entries = await Promise.all((await nativeArtifactPaths(root)).map(async path => {
		const bytes = await readFile(join(root, path));
		return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
	}));
	return Object.fromEntries(entries);
};

const stableObservation = observation => {
	const stable = structuredClone(observation);
	delete stable.api; delete stable.gem_root;
	return stable;
};

const assertRelocatedApi = (profile, observation, relocated) => {
	assert.equal(observation.checks, hostNullScriptingChecks);
	assert.ok(observation.api.startsWith(relocated + "/"), `${profile} API must load from the relocated installation`);
	if(profile === "ruby") assert.ok(observation.gem_root.startsWith(join(relocated, "gems") + "/"));
};

/**
 * Build both author routes, remove producer sources, install all three prepared
 * packages offline, remove the handoff, relocate each installation and rerun
 * its unchanged public consumer.
 *
 * @param t - Node test context owning all temporary roots.
 */
export const runHostNullScriptingAcceptance = async t => {
	const outputRoot = resolve(process.env.LEAN_BRIDGE_HOST_NULL_SCRIPTING_OUTPUT
		?? "build/host-null/scripting");
	const selectedRoutes = (process.env.LEAN_BRIDGE_HOST_NULL_SCRIPTING_ROUTES
		?? "ordinary,reviewed").split(",");
	assert.ok(selectedRoutes.length > 0 && new Set(selectedRoutes).size === selectedRoutes.length);
	assert.ok(selectedRoutes.every(route => ["ordinary", "reviewed"].includes(route)));
	await assert.rejects(access(outputRoot), { code: "ENOENT" });
	await mkdir(outputRoot, { recursive: true });
	const environment = nativeFixtureEnvironment(hostNullScriptingProfiles);
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
	const routes = [];
	for(const route of selectedRoutes)
	{
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-host-null-scripting-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const author = join(root, "author"), projectRoot = join(author, "project");
		const release = join(author, "release"), consumer = join(root, "consumer");
		const handoff = join(consumer, "handoff"), retained = join(outputRoot, route);
		await mkdir(retained, { recursive: true });
		await cp("tests/fixtures/onboarding/host-null", projectRoot, { recursive: true });
		const configuration = {
			schemaVersion: 1
			, modules: ["HostNullDemo"], hostProjections: [hostNullProjection]
			, targets
			, ...route === "ordinary" ? { exports: exports_, arities: hostNullArities } : {}
		};
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "reviewed.binding-ir.json"
			, canonicalJson(hostNullReviewedIr()));
		t.diagnostic(`${route}: compiling authenticated Perl, Python and Ruby HostNull packages`);
		const built = await buildCanonicalProject({
			projectRoot, outputRoot: release, targets: Object.keys(targets), environment
		}).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`;
			throw error;
		});
		const modelBytes = await readFile(join(release, "native/component/model.json"));
		const model = JSON.parse(modelBytes);
		assert.deepEqual(privateShape(model.bindingIr), privateShape(hostNullReviewedIr()));
		assert.doesNotMatch(JSON.stringify(model.bindingIr), /(?:null|value)Constructor/u);
		assert.ok(model.types.some(type => type.kind === "host-null"));
		const receipt = await copyPackageSetHandoff(release, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await saveLakeFile(retained, "configuration.json", canonicalJson(configuration));
		await saveLakeFile(retained, "HostNullDemo.lean", await readFile(join(projectRoot, "HostNullDemo.lean")));
		if(process.env.LEAN_BRIDGE_HOST_NULL_SCRIPTING_PACKAGE_DIR)
			await cp(handoff, join(resolve(process.env.LEAN_BRIDGE_HOST_NULL_SCRIPTING_PACKAGE_DIR), route), { recursive: true });
		await rm(author, { recursive: true, force: true });
		await assert.rejects(access(author), { code: "ENOENT" });

		const installed = [];
		for(const profile of hostNullScriptingProfiles)
		{
			const target = targetByProfile[profile];
			const packages = receipt.packages.filter(item => item.target === target);
			assert.equal(packages.filter(item => item.role === "component").length, 1);
			const extension = extensionByProfile[profile];
			const source = await readFile(`tests/fixtures/host-null-consumers/${profile}.${extension}`, "utf8");
			const fixture = {
				source: () => source, success: `host-null-${profile}`
				, expectedChecks: hostNullScriptingChecks
				, parseResult: output => JSON.parse(output)
				, ...profile === "python" ? { installPython: input => installFinContainerEdgePython({
					...input, receiptPath: "lean_host_null_demo/lean_bridge/package-receipt.json"
				}) } : {}
				, ...profile === "ruby" ? { installRuby: installFinContainerEdgeRuby } : {}
			};
			const result = await installCopiedConsumer({
				profile, consumer, handoff, packages, environment, fixture
			});
			const command = result.command; delete result.command;
			const perlFiles = profile === "perl"
				? await installedFiles(join(consumer, profile, "installed/lib/perl5")) : null;
			installed.push({ profile, extension, source, command, result, perlFiles });
		}
		await rm(handoff, { recursive: true, force: true });
		await assert.rejects(access(handoff), { code: "ENOENT" });

		const observations = [];
		for(const item of installed)
		{
			const current = join(consumer, item.profile);
			const relocated = join(consumer, `${item.profile}-relocated`);
			await rename(current, relocated);
			await assert.rejects(access(current), { code: "ENOENT" });
			let rerun, closure;
			if(item.profile === "python")
			{
				const context = { ...item.result.pythonEnvironment, venv: join(relocated, "venv") };
				closure = await verifyFinContainerEdgePythonEnvironment(context);
				rerun = await runFinContainerEdgePython(context, ["consumer.py"], relocated, copiedCleanEnvironment);
			}
			else if(item.profile === "ruby")
			{
				const context = { ...item.result.rubyEnvironment, gems: join(relocated, "gems") };
				closure = await verifyFinContainerEdgeRubyEnvironment(context);
				rerun = await runFinContainerEdgeRuby(context, ["consumer.rb"], relocated);
			}
			else
			{
				const library = join(relocated, "installed/lib/perl5");
				assert.deepEqual(await installedFiles(library), item.perlFiles);
				closure = { installedFilesSha256: sha256(canonicalJson(item.perlFiles))
					, perlSha256: sha256(await readFile(item.command)) };
				rerun = await runCopied(item.command, ["consumer.pl"], relocated
					, { ...copiedCleanEnvironment, PERL5LIB: library });
				assert.deepEqual(await installedFiles(library), item.perlFiles);
			}
			assert.equal(rerun.stderr, "");
			const repeated = JSON.parse(rerun.stdout);
			assertRelocatedApi(item.profile, repeated, relocated);
			assert.deepEqual(stableObservation(repeated), stableObservation(item.result.result));
			assert.equal(await readFile(join(relocated, `consumer.${item.extension}`), "utf8"), item.source);
			await saveLakeFile(retained, `${item.profile}/consumer.${item.extension}`, item.source);
			observations.push({
				profile: item.profile, checks: item.result.checks
				, consumerSha256: sha256(item.source), host: stableObservation(repeated)
				, offlineInstall: item.result.offlineInstall
				, compilerFreePath: item.result.compilerFreePath
				, nestedOptionDistinct: true
				, positions: ["parameter", "result", "field", "callback-parameter", "callback-result"]
				, executions: [
					{ checks: hostNullScriptingChecks, relocated: false }
					, { checks: hostNullScriptingChecks, relocated: true }
				]
				, installedBytesUnchanged: true, sourceUnchangedAfterReplay: true
				, ...closure
			});
		}
		const report = {
			schemaVersion: 1, route, profiles: hostNullScriptingProfiles, producerCommit
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(modelBytes), observations
			, sourceRemovedBeforeInstallation: true
			, installationHandoffRemovedBeforeRelocatedExecution: true
			, offlineInstall: true, compilerFreePath: true, relocatedInstallation: true
		};
		await saveLakeFile(retained, "report.json", canonicalJson(report));
		routes.push(report);
	}
	await saveLakeFile(outputRoot, "summary.json", canonicalJson({
		schemaVersion: 1, producerCommit, routes
	}));
	return routes;
};
