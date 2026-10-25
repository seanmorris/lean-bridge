/**
 * Source-free package acceptance for owned checked records in .NET, JVM,
 * native PHP and WIT consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { generateOwnedDotnetPackage } from "../src/backends/dotnet/owned-package.mjs";
import { generateOwnedJvmPackage } from "../src/backends/jvm/owned-package.mjs";
import { generateOwnedPhpPackage } from "../src/backends/php/owned-package.mjs";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { ownedWitPublicPrefix } from "../src/backends/wit/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedDotnetEvidence } from "../src/build/owned-dotnet-artifacts.mjs";
import { ownedJvmEvidence } from "../src/build/owned-jvm-artifacts.mjs";
import { ownedPhpEvidence } from "../src/build/owned-php-artifacts.mjs";
import { readVerifiedOwnedWitHost } from "../src/build/owned-wit-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { packageOwnedPhp } from "../src/release/owned-composer.mjs";
import { packageOwnedMaven } from "../src/release/owned-maven.mjs";
import { packageOwnedNuget } from "../src/release/owned-nuget.mjs";
import { packageOwnedWasi } from "../src/release/owned-wasi.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
	, runCopied
} from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedCheckedRecordFixture } from "./helpers/owned-checked-record-fixture.mjs";
import {
	ownedCheckedRecordManagedRoutes, ownedCheckedRecordManagedSelection
	, ownedCheckedRecordManagedTargets
} from "./helpers/owned-checked-record-managed-fixture.mjs";
import {
	copyPackageSetHandoff, retainPackageSetEvidence
} from "./helpers/package-set.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_TEST === "1";
const groupVariable = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_GROUPS";
const routeVariable = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_MANAGED_ROUTES";
const allGroups = Object.freeze(Object.keys(ownedCheckedRecordManagedTargets));
const groups = process.env[groupVariable]?.split(",") ?? [...allGroups];
const routes = process.env[routeVariable]?.split(",")
	?? [...ownedCheckedRecordManagedRoutes];
assert.ok(groups.length && groups.every(group => allGroups.includes(group)));
assert.equal(new Set(groups).size, groups.length);
assert.ok(routes.length && routes.every(route =>
	ownedCheckedRecordManagedRoutes.includes(route)));
assert.equal(new Set(routes).size, routes.length);
const extensions = { dotnet: "cs", java: "java", kotlin: "kt"
	, "php-native": "php", "wit-wasi": "c" };
const reports = [];
const json = async path => JSON.parse(await readFile(path, "utf8"));
const packagingRoot = "build/owned-checked-record-managed-packaging";
const evidenceRoot = join(packagingRoot, "evidence");
const successName = (profile, resultOnly) => `owned-checked-record-${resultOnly
	? "result-only-" : ""}${profile}`;

test.before(async () => {
	if(enabled) await rm(packagingRoot, { recursive: true, force: true });
});

test.after(async () => {
	if(!enabled || reports.length !== routes.length * groups.length) return;
	for(const group of groups)
	{
		const selected = reports.filter(report => report.group === group);
		await saveLakeFile(packagingRoot
			, `${group}.json`, canonicalJson({ schemaVersion: 1
				, profile: "installed-owned-checked-record-managed"
				, group
				, reports: selected.toSorted((left, right) =>
					left.route.localeCompare(right.route)) }));
	}
});

test("managed owned checked-record generators preserve exact API modes", async t => {
	for(const group of allGroups) for(const route of ownedCheckedRecordManagedRoutes)
	{
		const selected = ownedCheckedRecordManagedSelection(route, group);
		validateExportConfiguration(selected.configuration);
		if(selected.authorRoute !== "ordinary") continue;
		assert.deepEqual(selected.configuration.exports
			, selected.reviewedIr.declarations.map(item => item.source.declaration));
		if(selected.resultOnly) continue;
		assert.deepEqual(selected.configuration.contracts["OwnedCheckedRecords.transferPairClaim"]
			.parameters.map(parameter => parameter.ownership), ["transfer", "transfer"]);
		assert.deepEqual(selected.configuration.contracts["OwnedCheckedRecords.transferWithClaimCallback"]
			.parameters.map(parameter => parameter.ownership), ["transfer", "borrow"]);
	}
	for(const route of ["reviewed-full", "reviewed-result-only"])
	{
		const selected = ownedCheckedRecordManagedSelection(route, "dotnet");
		const before = structuredClone(selected.reviewedIr);
		const options = { transferredInputs: true, anchoredResults: true
			, hostCallbacks: true };
		const generated = {
			dotnet: generateOwnedDotnetPackage(selected.reviewedIr, null, options)
			, jvm: generateOwnedJvmPackage(selected.reviewedIr, null, options)
			, php: generateOwnedPhpPackage(selected.reviewedIr, null, options)
		};
		assert.deepEqual(selected.reviewedIr, before);
		for(const [profile, output] of Object.entries(generated))
		{
			assert.deepEqual(output.c.functions.map(item => item.name)
				, selected.resultOnly ? ["newTicket", "serial", "claimFor"]
					: ["newTicket", "serial", "echoBooking", "echoClaim"
						, "transferClaim", "claimFor", "pairClaim"
						, "withClaimCallback", "claimClosure", "bookingSpan", "claimQuota"
						, "echoGrant", "echoClaims", "transferWithClaimCallback"
						, "transferPairClaim"], profile);
			assert.equal(output.c.callbacks.length, selected.resultOnly ? 0 : 2
				, profile);
			assert.equal(Boolean(output.contract.inputTransfers)
				, !selected.resultOnly, profile);
		}
	}
	await checkManagedWitCallers(t);
});

test("managed owned checked-record consumers are independently authored", async () => {
	for(const profile of ["dotnet", "java", "kotlin", "php-native"])
		for(const resultOnly of [false, true])
		{
			const sourceProfile = profile === "php-native" ? "php" : profile;
			const path = `tests/fixtures/structured-types/owned-checked-record-${resultOnly
				? "result-only-" : ""}${sourceProfile}.${extensions[profile]}`;
			const source = await readFile(path, "utf8");
			assert.ok(source.includes(successName(profile, resultOnly)), path);
		}
	for(const resultOnly of [false, true])
	{
		const source = await readFile(`tests/fixtures/structured-types/owned-checked-record-${resultOnly
			? "result-only" : "installed"}.c`, "utf8");
		assert.ok(source.includes(`owned-checked-record-${resultOnly
			? "result-only-" : ""}c:`));
	}
	const workflow = await readFile(
		".github/workflows/owned-checked-record-managed.yml", "utf8");
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "group: [dotnet, jvm, php, wit]"
		, "npm run test:owned-checked-record-managed"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-checked-record-managed-packaging/${{ matrix.group }}.json"
		, "for route in ordinary-full ordinary-result-only reviewed-full reviewed-result-only; do"
		, "test -s \"build/owned-checked-record-managed-packaging/evidence/${{ matrix.group }}/$route/handoff/package-set-receipt.json\""
		, "build/owned-checked-record-managed-packaging/"
		, "name: owned-checked-record-managed-${{ matrix.group }}-${{ github.sha }}"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(workflow.includes(required), required);
	assert.doesNotMatch(workflow, /continue-on-error:\s*true/u);
});

const checkManagedWitCallers = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-checked-wit-headers-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const options = { transferredInputs: true, anchoredResults: true, hostCallbacks: true };
	for(const resultOnly of [false, true])
	{
		const selected = ownedCheckedRecordManagedSelection(
			resultOnly ? "reviewed-result-only" : "reviewed-full", "wit");
		const ir = selected.reviewedIr;
		const values = generateOwnedCValues(ir, { ...options
			, publicPrefix: ownedWitPublicPrefix(ir, options) });
		const model = compileOwnedWitGraphModel(ir, {}, options);
		assert.deepEqual(model.manifest.declarations.map(item => item.name)
			, ir.declarations.map(item => item.name));
		const fixture = await fixtureFor("wit-wasi", resultOnly);
		for(const required of fixture.wit) assert.match(model.wit, required);
		if(!resultOnly)
			assert.ok(values.header.includes(
				"OWNED_CHECKED_RECORDS_WASMTIME_TRANSFER_WITH_CLAIM_CALLBACK_ARGUMENT1_T_REQUIRES_RECOVERY"));
		const root = join(directory, resultOnly ? "result-only" : "full");
		await saveLakeFile(root, `include/${values.prefix}.h`, values.header);
		await saveLakeFile(root, "consumer.c", fixture.source());
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
			, "-I", "include", "-fsyntax-only", "consumer.c"], root
		, { PATH: "/usr/bin:/bin" });
	}
};

const environmentFor = group => {
	const profiles = ownedCheckedRecordManagedTargets[group].profiles;
	const environment = nativeFixtureEnvironment(profiles);
	if(group === "php") return { ...environment
		, LEAN_BRIDGE_PHP: resolve(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php")
		, LEAN_BRIDGE_COMPOSER: resolve(process.env.LEAN_BRIDGE_COMPOSER
			?? "/usr/bin/composer") };
	if(group === "wit") return { ...environment
		, CC: resolve(process.env.CC ?? "/usr/bin/cc")
		, LEAN_BRIDGE_WASM_TOOLS: resolve(process.env.LEAN_BRIDGE_WASM_TOOLS
			?? ".toolchains/wasm-tools/bin/wasm-tools")
		, LEAN_BRIDGE_WASMTIME_C_API: resolve(
			process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42") };
	return environment;
};

const reassemble = async ({ group, root, output, environment, settings
	, projection }) => {
	const nativeRoot = join(output, "native/component");
	const runtimeRoot = join(output, "native/runtime");
	const common = { working: join(root, "reassembled"), nativeRoot, runtimeRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, settings
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	let evidence, rebuilt;
	if(group === "dotnet")
	{
		const adapterRoot = join(output, "native/owned-dotnet-binding");
		evidence = await ownedDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
		rebuilt = await packageOwnedNuget({ ...common, adapterRoot
			, dotnetRoot: join(output, "native/dotnet") });
	}
	else if(group === "jvm")
	{
		const adapterRoot = join(output, "native/owned-jvm-binding");
		evidence = await ownedJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
		rebuilt = await packageOwnedMaven({ ...common, adapterRoot
			, jvmRoot: join(output, "native/jvm") });
	}
	else if(group === "php")
	{
		const adapterRoot = join(output, "native/owned-php-binding");
		evidence = await ownedPhpEvidence({ nativeRoot, runtimeRoot, adapterRoot
			, environment });
		rebuilt = await packageOwnedPhp({ ...common, adapterRoot, environment });
	}
	else
	{
		const witRoot = join(output, "native/owned-wit-adapter");
		evidence = await readVerifiedOwnedWitHost({ ...common, witRoot });
		rebuilt = await packageOwnedWasi({ ...common, witRoot });
	}
	assert.deepEqual(rebuilt.packages, projection.packages);
	for(const pkg of rebuilt.packages)
		assert.deepEqual(await readFile(join(common.working, "archives", pkg.archive))
			, await readFile(join(output, "archives", pkg.archive)), pkg.archive);
	const packages = rebuilt.packages.map(pkg => ({ archive: pkg.archive
		, sha256: pkg.sha256 }));
	const result = { packages
		, componentReceiptSha256: sha256(canonicalJson(evidence.receipt)) };
	await rm(common.working, { recursive: true, force: true });
	return result;
	};

const fixtureFor = async (profile, resultOnly) => {
	if(profile === "wit-wasi")
	{
		const name = `owned-checked-record-${resultOnly ? "result-only" : "installed"}.c`;
		const source = (await readFile(`tests/fixtures/structured-types/${name}`, "utf8"))
			.replaceAll("owned_checked_records", "owned_checked_records_wasmtime")
			.replaceAll("OWNED_CHECKED_RECORDS", "OWNED_CHECKED_RECORDS_WASMTIME")
			.replace(`owned-checked-record-${resultOnly ? "result-only-" : ""}c:`
				, successName(profile, resultOnly) + ":");
		return { source: () => source, success: successName(profile, resultOnly)
			, wit: [/resource identity-ticket/u, /claim-for: func/u
				, ...resultOnly ? [] : [/with-claim-callback: func/u
					, /claim-closure: func/u, /echo-grant: func/u, /echo-claims: func/u
					, /transfer-pair-claim: func/u, /transfer-with-claim-callback: func/u]]
			, ...resultOnly ? { expectedChecks: 14 } : {} };
	}
	const sourceProfile = profile === "php-native" ? "php" : profile;
	const source = await readFile(`tests/fixtures/structured-types/owned-checked-record-${resultOnly
		? "result-only-" : ""}${sourceProfile}.${extensions[profile]}`, "utf8");
	return { source: () => source, success: successName(profile, resultOnly)
		, ...resultOnly ? { expectedChecks: 4 } : {} };
};

const relocate = async ({ root, consumers, observations, resultOnly }) => {
	const repeated = {};
	for(const [profile, observation] of Object.entries(observations))
	{
		const destination = join(root, `relocated-${profile}`);
		await rename(join(consumers, profile), destination);
		let command = observation.command, args = [], environment = copiedCleanEnvironment;
		if(profile === "dotnet")
		{
			args = ["out/Consumer.dll"];
			environment = { ...environment, DOTNET_ROOT: dirname(command)
				, DOTNET_CLI_HOME: join(destination, "dotnet-home")
				, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1"
				, NUGET_PACKAGES: join(destination, "packages") };
		}
		else if(profile === "java")
		{
			const classpath = [join(destination, "component.jar")
				, join(destination, "kotlin-stdlib.jar"), destination].join(":");
			args = ["--enable-native-access=ALL-UNNAMED", "-cp", classpath
				, "Consumer"];
		}
		else if(profile === "kotlin")
		{
			const classpath = `${join(destination, "component.jar")}:${join(
				destination, "consumer.jar")}`;
			args = ["--enable-native-access=ALL-UNNAMED", "-cp", classpath
				, "ConsumerKt"];
		}
		else if(profile === "php-native") args = ["-n", "-d", "extension=ffi"
			, "-d", "ffi.enable=1", "consumer.php"];
		else command = join(destination, "consumer");
		const result = await runCopied(command, args, destination, environment);
		assert.equal(result.stderr, "");
		assert.equal(result.stdout, `${successName(profile, resultOnly)}:${observation.checks}\n`);
		repeated[profile] = { checks: observation.checks, stdout: result.stdout };
	}
	return repeated;
};

for(const group of groups) for(const route of routes)
	test(`installed ${route} owned checked records execute through ${group} packages`, {
		skip: !enabled, timeout: 3_600_000
	}, async t => {
		const selected = ownedCheckedRecordManagedSelection(route, group);
		const { authorRoute, resultOnly, specification } = selected;
		const scratch = await mkdtemp(join(tmpdir()
			, `lean-owned-checked-record-managed-${group}-${route}-`));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(scratch, { recursive: true, force: true });
			else t.diagnostic(`Retained failed ${group}/${route} inputs: ${scratch}`);
		});
		const author = join(scratch, "author"), output = join(scratch, "producer");
		const handoff = join(scratch, "handoff"), consumers = join(scratch, "consumers");
		await cp(resolve(ownedCheckedRecordFixture), author, { recursive: true });
		await saveLakeFile(author, "lean-bridge.exports.json"
			, canonicalJson(selected.configuration));
		if(authorRoute === "reviewed") await saveLakeFile(author
			, "api.binding-ir.json", canonicalJson(selected.reviewedIr));
		const environment = environmentFor(group), before = await lakeInputState(author);
		const built = await buildCanonicalProject({ projectRoot: author
			, outputRoot: output, targets: [specification.target], environment
			, onProgress: event => t.diagnostic(`${group}/${route}: ${event.message}`) })
			.catch(error => { throw new Error(
				`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
		assert.deepEqual(await lakeInputState(author), before);
		const projection = (built.projections ?? [built]).find(item =>
			item.ecosystem === specification.target);
		assert.ok(projection, specification.target);
		const model = await json(join(output, "native/component/model.json"));
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr)
			, authorRoute === "reviewed");
		assert.deepEqual(model.bindingIr.declarations.map(item => item.name).toSorted()
			, (resultOnly ? ["newTicket", "serial", "claimFor"]
				: ["newTicket", "serial", "echoBooking", "echoClaim"
					, "transferClaim", "claimFor", "pairClaim"
					, "withClaimCallback", "claimClosure", "bookingSpan", "claimQuota"
					, "echoGrant", "echoClaims", "transferWithClaimCallback"
					, "transferPairClaim"]).toSorted());
		assert.equal(model.bindingIr.types.filter(type => type.kind === "callback").length
			, resultOnly ? 0 : 2);
		const reassembled = await reassemble({ group, root: scratch, output
			, environment, settings: selected.configuration.targets[specification.target]
			, projection });
		const retainedRoot = join(evidenceRoot, group, route, "handoff");
		const retained = await retainPackageSetEvidence(output, retainedRoot);
		const receipt = await copyPackageSetHandoff(retainedRoot, handoff);
		assert.deepEqual(receipt, retained.receipt);
		await verifyPackageSetReceipt({ receiptPath: join(handoff
			, "package-set-receipt.json") });
		await rm(author, { recursive: true, force: true });
		await rm(output, { recursive: true, force: true });
		await assert.rejects(access(author), { code: "ENOENT" });
		await assert.rejects(access(output), { code: "ENOENT" });
		const packages = receipt.packages.filter(item =>
			item.target === specification.target);
		const observations = {};
		for(const profile of specification.profiles)
			observations[profile] = await installCopiedConsumer({ profile
				, consumer: consumers, handoff, packages, environment
				, fixture: await fixtureFor(profile, resultOnly) });
		await rm(handoff, { recursive: true, force: true });
		await assert.rejects(access(handoff), { code: "ENOENT" });
		const repeated = await relocate({ root: scratch, consumers, observations
			, resultOnly });
		reports.push({ route, group, authorRoute, mode: selected.mode
			, profiles: specification.profiles, sourceUnchanged: true
			, sourceFreeInstallation: true, relocatedInstallation: true
			, handoffRemovedBeforeRelocatedExecution: true
			, deterministicReassembly: true, immutableInstalledInputs: true
			, packageSetReceiptSha256: sha256(canonicalJson(receipt))
			, retainedPackageSet: { path: `evidence/${group}/${route}/handoff`
				, receiptSha256: retained.receiptSha256
				, archives: retained.archives
				, archiveBytes: retained.archiveBytes, files: retained.files }
			, reassembled, repeated
			, observations: Object.fromEntries(Object.entries(observations).map(
				([profile, observed]) => [profile, { checks: observed.checks
					, consumerSha256: observed.consumerSha256 }])) });
		complete = true;
		t.diagnostic(`${group}/${route}: ${Object.entries(observations).map(
			([profile, observed]) => `${profile}=${observed.checks}`).join(", ")}`);
	});
