/**
 * Source-free Python, Ruby and Rust acceptance for owned proof-erased checked
 * records, host callbacks and returned Lean closures.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	access, cp, mkdir, mkdtemp, readFile, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateOwnedPythonPackage } from "../src/backends/python/owned-package.mjs";
import { generateOwnedRubyPackage } from "../src/backends/ruby/owned-package.mjs";
import { generateOwnedRustPackage } from "../src/backends/rust/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedPythonEvidence } from "../src/build/owned-python-artifacts.mjs";
import { ownedRubyEvidence } from "../src/build/owned-ruby-artifacts.mjs";
import { ownedRustEvidence } from "../src/build/owned-rust-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { packageOwnedCargo } from "../src/release/owned-cargo.mjs";
import { packageOwnedPython } from "../src/release/owned-pypi.mjs";
import { packageOwnedRuby } from "../src/release/owned-rubygems.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
	, runCopied
} from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedCheckedRecordFixture } from "./helpers/owned-checked-record-fixture.mjs";
import {
	ownedCheckedRecordLanguageRoutes, ownedCheckedRecordLanguageSelection
	, ownedCheckedRecordLanguageTargets
} from "./helpers/owned-checked-record-language-fixture.mjs";
import {
	copyPackageSetHandoff, retainPackageSetEvidence
} from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_TEST === "1";
const profileVariable = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_PROFILES";
const routeVariable = "LEAN_BRIDGE_OWNED_CHECKED_RECORD_LANGUAGE_ROUTES";
const allProfiles = Object.freeze(["python", "ruby", "rust"]);
const profiles = process.env[profileVariable]?.split(",") ?? [...allProfiles];
const routes = process.env[routeVariable]?.split(",")
	?? [...ownedCheckedRecordLanguageRoutes];
assert.ok(profiles.length && profiles.every(profile =>
	allProfiles.includes(profile)
));
assert.equal(new Set(profiles).size, profiles.length);
assert.ok(routes.length && routes.every(route =>
	ownedCheckedRecordLanguageRoutes.includes(route)
));
assert.equal(new Set(routes).size, routes.length);
const reports = [];
const extensions = { python: "py", ruby: "rb", rust: "rs" };
const json = async path => JSON.parse(await readFile(path, "utf8"));
const targetFor = profile => ownedCheckedRecordLanguageTargets[profile][0];
const successName = (profile, resultOnly) => `owned-checked-record-${resultOnly
	? "result-only-" : ""}${profile}`;
const installPython = async ({ baseCommand, root, archive }) => {
	const { command, ...context } = await installPythonWheel({
		root, archive, python: baseCommand
	});
	return { context
		, run: (args, cwd, environment) => runCopied(command
			, ["-I", "-B", ...args], cwd, environment) };
};

test.after(async () => {
	if(!enabled || reports.length !== routes.length) return;
	const complete = routes.length === ownedCheckedRecordLanguageRoutes.length
		&& ownedCheckedRecordLanguageRoutes.every(route => routes.includes(route));
	const name = complete ? "report.json"
		: `partial-${sha256(canonicalJson(routes.toSorted())).slice(0, 12)}.json`;
	await saveLakeFile("build/owned-checked-record-language-packaging", name
		, canonicalJson({ schemaVersion: 1
			, profile: "installed-owned-checked-record-languages"
			, selectedProfiles: profiles.toSorted()
			, reports: reports.toSorted((left, right) =>
				left.route.localeCompare(right.route)) }));
});

test("owned checked-record language generators preserve the exact API modes", () => {
	for(const route of ["reviewed-full", "reviewed-result-only"])
	{
		const selected = ownedCheckedRecordLanguageSelection(route, allProfiles);
		const before = structuredClone(selected.reviewedIr);
		const options = { transferredInputs: true, anchoredResults: true
			, hostCallbacks: true };
		const generated = {
			python: generateOwnedPythonPackage(selected.reviewedIr, null, options)
			, ruby: generateOwnedRubyPackage(selected.reviewedIr, null, options)
			, rust: generateOwnedRustPackage(selected.reviewedIr, null, {}, options)
		};
		assert.deepEqual(selected.reviewedIr, before);
		for(const [profile, output] of Object.entries(generated))
		{
			assert.deepEqual(output.c.functions.map(item => item.name)
				, selected.resultOnly
					? ["newTicket", "serial", "claimFor"]
					: ["newTicket", "serial", "echoBooking", "echoClaim"
						, "transferClaim", "claimFor", "pairClaim"
						, "withClaimCallback", "claimClosure"], profile);
			assert.equal(output.c.callbacks.length, selected.resultOnly ? 0 : 2
				, profile);
			assert.equal(Boolean(output.contract.inputTransfers)
				, !selected.resultOnly, profile);
			if(profile === "rust" && selected.resultOnly)
				assert.doesNotMatch(output.apiSource, /WithRecovery|with_recovery/u);
		}
	}
});

test("owned checked-record language consumers and recurring workflow stay registered", async () => {
	for(const profile of allProfiles)
		for(const resultOnly of [false, true])
		{
			const marker = successName(profile, resultOnly);
			const path = `tests/fixtures/structured-types/owned-checked-record-${resultOnly
				? "result-only-" : ""}${profile}.${extensions[profile]}`;
			const source = await readFile(path, "utf8");
			assert.match(source, new RegExp(marker, "u"));
			if(!resultOnly) assert.match(source, profile === "python" ? /gc\.collect\(\)/u
				: profile === "ruby" ? /GC\.start/u : /drop\(dropped\)/u);
		}
	const source = await readFile(
		".github/workflows/owned-checked-record-languages.yml", "utf8"
	);
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "profile: [python, ruby, rust]"
		, "npm run test:owned-checked-record-languages"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-checked-record-language-packaging/report.json"
		, "for route in ordinary-full ordinary-result-only reviewed-full reviewed-result-only; do"
		, "test -s \"build/owned-checked-record-language-packaging/evidence/$route/package-set-receipt.json\""
		, "build/owned-checked-record-language-packaging/"
		, "name: owned-checked-record-${{ matrix.profile }}-${{ github.sha }}"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error:\s*true/u);
});

const reproduce = async ({ routeRoot, output, environment, config, built }) => {
	const nativeRoot = join(output, "native/component");
	const runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-c-binding");
	const rubyAdapterRoot = join(output, "native/owned-ruby-binding");
	const rustRoot = join(output, "native/rust");
	const evidence = {};
	const options = {};
	if(profiles.includes("python"))
	{
		evidence.python = await ownedPythonEvidence({ nativeRoot, runtimeRoot
			, adapterRoot });
		options.python = { nativeRoot, runtimeRoot, adapterRoot, environment
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, settings: config.targets.pypi };
	}
	if(profiles.includes("ruby"))
	{
		evidence.ruby = await ownedRubyEvidence({ nativeRoot, runtimeRoot
			, adapterRoot: rubyAdapterRoot });
		options.ruby = { nativeRoot, runtimeRoot, adapterRoot: rubyAdapterRoot
			, environment, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, settings: config.targets.rubygems };
	}
	if(profiles.includes("rust"))
	{
		evidence.rust = await ownedRustEvidence({ nativeRoot, runtimeRoot
			, adapterRoot });
		options.rust = { rustRoot, nativeRoot, runtimeRoot, adapterRoot
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, settings: config.targets.cargo };
	}
	const builders = { python: packageOwnedPython, ruby: packageOwnedRuby
		, rust: packageOwnedCargo };
	const reassembled = {};
	const projections = built.projections ?? [built];
	for(const profile of profiles)
	{
		const projection = projections.find(item =>
			item.ecosystem === targetFor(profile));
		assert.ok(projection, `missing ${profile} projection`);
		const working = join(routeRoot, `reassembled-${profile}`);
		const rebuilt = await builders[profile]({ ...options[profile], working
			, environment
			, glibcMinimumVersion: projection.glibcMinimumVersion });
		assert.deepEqual(rebuilt.packages, projection.packages);
		const archive = rebuilt.packages[0].archive;
		const bytes = await readFile(join(working, "archives", archive));
		assert.deepEqual(bytes, await readFile(join(output, "archives", archive)));
		reassembled[profile] = { archive, sha256: sha256(bytes) };
		await rm(working, { recursive: true, force: true });
	}
	return { evidence, reassembled };
};

const relocate = async ({ routeRoot, consumers, observations, resultOnly }) => {
	const relocated = join(routeRoot, "relocated");
	await mkdir(relocated);
	const results = {};
	for(const profile of profiles)
	{
		const destination = join(relocated, profile);
		await rename(join(consumers, profile), destination);
		let command, args, environment = copiedCleanEnvironment;
		if(profile === "python")
		{
			command = join(destination, "venv/bin/python");
			args = ["-I", "consumer.py"];
		}
		else if(profile === "ruby")
		{
			command = observations.ruby.command;
			args = ["consumer.rb"];
			environment = { ...copiedCleanEnvironment
				, GEM_HOME: join(destination, "gems")
				, GEM_PATH: join(destination, "gems") };
		}
		else
		{
			command = join(destination, "target/debug/consumer");
			args = [];
			environment = { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable"
				, RUSTC: "/unavailable" };
		}
		const execution = await runCopied(command, args, destination, environment);
		assert.equal(execution.stderr, "");
		const success = successName(profile, resultOnly);
		assert.match(execution.stdout
			, new RegExp(`^${success}:[0-9]+\\n$`, "u"));
		const checks = Number(execution.stdout.trim().split(":")[1]);
		assert.equal(checks, observations[profile].checks);
		results[profile] = { checks, stdout: execution.stdout };
	}
	return results;
};

for(const route of routes)
	test(`installed ${route} owned checked records execute through selected language archives`, {
		skip: !enabled, timeout: 3_600_000
	}, async t => {
		const selected = ownedCheckedRecordLanguageSelection(route, profiles);
		const { authorRoute, resultOnly } = selected;
		const scratch = await mkdtemp(join(
			tmpdir(), `lean-owned-checked-record-languages-${route}-`
		));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(scratch, { recursive: true, force: true });
			else t.diagnostic(
				`Retained failed owned checked-record language inputs: ${scratch}`);
		});
		const author = join(scratch, "author");
		const output = join(scratch, "producer");
		const handoff = join(scratch, "handoff");
		const consumers = join(scratch, "consumers");
		await cp(resolve(ownedCheckedRecordFixture), author, { recursive: true });
		await saveLakeFile(author, "lean-bridge.exports.json"
			, canonicalJson(selected.configuration));
		if(authorRoute === "reviewed") await saveLakeFile(author
			, "api.binding-ir.json", canonicalJson(selected.reviewedIr));
		const environment = {
			...nativeFixtureEnvironment(profiles)
			, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:
				process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.36"
			, LEAN_BRIDGE_PYTHON: resolve(process.env.LEAN_BRIDGE_PYTHON
				?? ".toolchains/python311/bin/python3.11")
			, LEAN_BRIDGE_RUBY: resolve(process.env.LEAN_BRIDGE_RUBY
				?? ".toolchains/ruby33/bin/ruby")
			, LEAN_BRIDGE_GEM: resolve(process.env.LEAN_BRIDGE_GEM
				?? ".toolchains/ruby33/bin/gem")
			, LEAN_BRIDGE_CARGO: resolve(process.env.LEAN_BRIDGE_CARGO
				?? ".toolchains/rust-1.90.0/bin/cargo")
			, LEAN_BRIDGE_RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC
				?? ".toolchains/rust-1.90.0/bin/rustc")
			, CARGO_HOME: resolve(process.env.CARGO_HOME
				?? ".toolchains/cargo-copied")
		};
		const before = await lakeInputState(author);
		const targets = profiles.map(targetFor);
		const built = await buildCanonicalProject({ projectRoot: author
			, outputRoot: output, targets, environment
			, onProgress: event => t.diagnostic(`${route}: ${event.message}`) })
			.catch(error => { throw new Error(
				`${error.message}: ${JSON.stringify(error.details)}`
				, { cause: error }); });
		assert.deepEqual(await lakeInputState(author), before);
		const projections = built.projections ?? [built];
		assert.deepEqual(projections.map(item => item.ecosystem).toSorted()
			, targets.toSorted());
		const model = await json(join(output, "native/component/model.json"));
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr)
			, authorRoute === "reviewed");
		assert.deepEqual(model.bindingIr.declarations.map(item => item.name).toSorted()
			, (resultOnly ? ["newTicket", "serial", "claimFor"]
				: ["newTicket", "serial", "echoBooking", "echoClaim"
					, "transferClaim", "claimFor", "pairClaim"
					, "withClaimCallback", "claimClosure"]).toSorted());
		assert.equal(model.bindingIr.types.filter(type =>
			type.kind === "callback").length, resultOnly ? 0 : 2);
		assert.equal(model.bindingIr.declarations.some(item =>
			item.parameters.some(parameter => parameter.ownership === "transfer"))
			, !resultOnly);
		const { evidence, reassembled } = await reproduce({ routeRoot: scratch
			, output, environment, config: selected.configuration, built });
		const evidenceRoot = join("build/owned-checked-record-language-packaging"
			, "evidence", route);
		const retained = await retainPackageSetEvidence(output, evidenceRoot);
		const receipt = await copyPackageSetHandoff(evidenceRoot, handoff);
		assert.deepEqual(receipt, retained.receipt);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		let dependencies;
		if(profiles.includes("rust"))
		{
			await mkdir(join(consumers, "dependencies"), { recursive: true });
			dependencies = await prepareRustCorpusDependencies({
				rustRoot: join(output, "native/rust"), directory: scratch
				, handoff: join(consumers, "dependencies"), environment
			});
		}
		await rm(author, { recursive: true, force: true });
		await rm(output, { recursive: true, force: true });
		await assert.rejects(access(author), { code: "ENOENT" });
		await assert.rejects(access(output), { code: "ENOENT" });
		const observations = {};
		for(const profile of profiles)
		{
			const source = await readFile(
				`tests/fixtures/structured-types/owned-checked-record-${resultOnly
					? "result-only-" : ""}${profile}.${extensions[profile]}`, "utf8");
			observations[profile] = await installCopiedConsumer({ profile
				, consumer: consumers, handoff, dependencies, environment
				, packages: receipt.packages.filter(item =>
					item.target === targetFor(profile))
				, fixture: { source: () => source
					, success: successName(profile, resultOnly)
					, ...profile === "python" ? { installPython } : {}
					, ...resultOnly ? { expectedChecks: profile === "rust" ? 3 : 5 }
						: {} } });
		}
		await rm(handoff, { recursive: true, force: true });
		await assert.rejects(access(handoff), { code: "ENOENT" });
		const relocated = await relocate({ routeRoot: scratch, consumers
			, observations, resultOnly });
		const versions = {};
		const versionCommands = {
			python: environment.LEAN_BRIDGE_PYTHON
			, ruby: environment.LEAN_BRIDGE_RUBY
			, rust: environment.LEAN_BRIDGE_RUSTC
		};
		for(const profile of profiles)
		{
			const version = await runCopied(versionCommands[profile], ["--version"]
				, scratch, { PATH: "/unavailable" });
			versions[profile] = `${version.stdout}${version.stderr}`.trim();
		}
		reports.push({ route, authorRoute, mode: selected.mode
			, profiles: profiles.toSorted(), sourceUnchanged: true
			, sourceFreeInstallation: true, relocatedInstallation: true
			, handoffRemovedBeforeRelocatedExecution: true
			, deterministicReassembly: true
			, exactApiMode: true, constructorRejectionAndRecovery: !resultOnly
			, earlyAndLateRejection: !resultOnly
			, unchangedRejectedInputs: !resultOnly
			, transferredInputCheckedBeforeHandoff: !resultOnly
			, mixedOwnedAndCopiedTransport: !resultOnly
			, hostCallbackRecovery: !resultOnly
			, returnedClosureRecovery: !resultOnly
			, lifecycle: Object.fromEntries(profiles.map(profile => [profile
				, profile === "python" ? "gc-finalizer-plus-explicit-close"
					: profile === "ruby" ? "gc-finalizer-plus-explicit-close"
						: "drop-plus-explicit-close"]))
			, bindingIrSha256: built.bindingIrSha256, versions, dependencies
			, reassembled, packageSetReceipt: receipt
			, retainedPackageSet: { path: `evidence/${route}`
				, receiptSha256: retained.receiptSha256
				, archives: retained.archives, files: retained.files }
			, componentReceipts: Object.fromEntries(profiles.map(profile =>
				[profile, evidence[profile].receipt]))
			, observations: Object.fromEntries(profiles.map(profile => [profile, {
				checks: observations[profile].checks
				, consumerSha256: observations[profile].consumerSha256
				, relocatedChecks: relocated[profile].checks
				, ...observations[profile].pythonEnvironment ? {
					installation: observations[profile].pythonEnvironment
				} : {}
			}]))
		});
		complete = true;
		t.diagnostic(`${route}: ${profiles.map(profile =>
			`${profile}=${observations[profile].checks}`).join(", ")}`);
	});
