/**
 * Source-free Python, Ruby and Rust acceptance for checked owned aggregates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
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
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedSubtypePackageReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_SUBTYPE_LANGUAGE_TEST === "1";
const profiles = ["python", "ruby", "rust"];
const extensions = { python: "py", ruby: "rb", rust: "rs" };
const targets = {
	python: ["pypi", { name: "lean-owned-subtypes", version: "1.0.0" }]
	, ruby: ["rubygems", { name: "lean_bridge_owned_subtypes", version: "1.0.0" }]
	, rust: ["cargo", { name: "owned-subtypes", version: "1.0.0" }]
};
const reports = [];
const json = async path => JSON.parse(await readFile(path, "utf8"));

test.after(async () => {
	if(enabled && reports.length === 2)
		await saveLakeFile("build/owned-subtype-language-packaging", "report.json", canonicalJson({
			schemaVersion: 1, profile: "installed-owned-subtype-languages"
			, reports: reports.toSorted((left, right) => left.route.localeCompare(right.route))
		}));
});

test("Python, Ruby and Rust generate callback-free checked transfer copies", () => {
	const ir = ownedSubtypePackageReviewedIr(), before = structuredClone(ir);
	const generated = {
		python: generateOwnedPythonPackage(ir, null, { transferredInputs: true })
		, ruby: generateOwnedRubyPackage(ir, null, { transferredInputs: true })
		, rust: generateOwnedRustPackage(ir, null, {}, { transferredInputs: true })
	};
	assert.deepEqual(ir, before);
	for(const [profile, output] of Object.entries(generated))
	{
		assert.equal(output.c.callbacks.length, 0, profile);
		assert.ok(output.c.copies?.some(copy => copy.id === "lean:Owned.Bundle"), profile);
		assert.equal(output.contract.inputTransfers.validation, "before-consumption", profile);
		assert.deepEqual(output.c.functions.map(item => item.name), [
			"newTicket", "serial", "echoRecord", "echoRecordAlternate", "transferRecord"
		], profile);
	}
});

test("owned Subtype language consumers and required workflow stay registered", async () => {
	for(const [path, marker] of [
		["tests/fixtures/structured-types/owned-subtype-python.py", "owned-subtype-python"]
		, ["tests/fixtures/structured-types/owned-subtype-ruby.rb", "owned-subtype-ruby"]
		, ["tests/fixtures/structured-types/owned-subtype-rust.rs", "owned-subtype-rust"]
	]) assert.match(await readFile(path, "utf8"), new RegExp(marker, "u"));
	const source = await readFile(".github/workflows/owned-subtype-languages.yml", "utf8");
	for(const required of [
		"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"
		, "cancel-in-progress: true"
		, "npm run test:owned-subtype-languages"
		, "rg '^# fail 0$'"
		, "rg '^# skipped 0$'"
		, "test -s build/owned-subtype-language-packaging/report.json"
		, "if: always()\n        uses: actions/upload-artifact@v7"
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
	const evidence = {
		python: await ownedPythonEvidence({ nativeRoot, runtimeRoot, adapterRoot })
		, ruby: await ownedRubyEvidence({ nativeRoot, runtimeRoot, adapterRoot: rubyAdapterRoot })
		, rust: await ownedRustEvidence({ nativeRoot, runtimeRoot, adapterRoot })
	};
	const options = {
		python: { nativeRoot, runtimeRoot, adapterRoot, environment
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, settings: config.targets.pypi }
		, ruby: { nativeRoot, runtimeRoot, adapterRoot: rubyAdapterRoot, environment
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, settings: config.targets.rubygems }
		, rust: { rustRoot, nativeRoot, runtimeRoot, adapterRoot
			, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
			, settings: config.targets.cargo }
	};
	const builders = { python: packageOwnedPython, ruby: packageOwnedRuby, rust: packageOwnedCargo };
	const reassembled = {};
	for(const profile of profiles)
	{
		const target = targets[profile][0];
		const projection = built.projections.find(item => item.ecosystem === target);
		const working = join(routeRoot, `reassembled-${profile}`);
		const rebuilt = await builders[profile]({ ...options[profile], working
			, glibcMinimumVersion: projection.glibcMinimumVersion });
		assert.deepEqual(rebuilt.packages, projection.packages);
		const archive = rebuilt.packages[0].archive;
		assert.deepEqual(await readFile(join(working, "archives", archive))
			, await readFile(join(output, "archives", archive)));
		reassembled[profile] = { archive, sha256: sha256(await readFile(join(working, "archives", archive))) };
		await rm(working, { recursive: true, force: true });
	}
	return { evidence, reassembled };
};

const relocate = async ({ routeRoot, consumers, observations }) => {
	const relocated = join(routeRoot, "relocated"); await mkdir(relocated);
	const results = {};
	for(const profile of profiles)
	{
		const destination = join(relocated, profile);
		await rename(join(consumers, profile), destination);
		let command, args, environment = copiedCleanEnvironment;
		if(profile === "python")
		{
			command = join(destination, "venv/bin/python"); args = ["-I", "consumer.py"];
		}
		else if(profile === "ruby")
		{
			command = observations.ruby.command; args = ["consumer.rb"];
			environment = { ...copiedCleanEnvironment
				, GEM_HOME: join(destination, "gems")
				, GEM_PATH: join(destination, "gems") };
		}
		else
		{
			command = join(destination, "target/debug/consumer"); args = [];
			environment = { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" };
		}
		const execution = await runCopied(command, args, destination, environment);
		assert.equal(execution.stderr, "");
		assert.match(execution.stdout, new RegExp(`^owned-subtype-${profile}:[0-9]+\\n$`, "u"));
		const checks = Number(execution.stdout.trim().split(":")[1]);
		assert.equal(checks, observations[profile].checks);
		results[profile] = { checks, stdout: execution.stdout, command };
	}
	return results;
};

for(const route of ["ordinary", "reviewed"]) test(`installed ${route} owned Subtypes execute through wheel, gem and crate archives`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const scratch = await mkdtemp(join(tmpdir(), `lean-owned-subtype-languages-${route}-`));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(scratch, { recursive: true, force: true });
		else t.diagnostic(`Retained failed owned Subtype language inputs: ${scratch}`);
	});
	const author = join(scratch, "author"), output = join(scratch, "producer");
	const handoff = join(scratch, "handoff"), consumers = join(scratch, "consumers");
	await cp(resolve("tests/fixtures/onboarding/owned-subtypes"), author, { recursive: true });
	const config = route === "ordinary" ? await json(join(author, "lean-bridge.exports.json"))
		: { schemaVersion: 1, modules: ["Owned"] };
	config.targets = Object.fromEntries(Object.values(targets));
	await saveLakeFile(author, "lean-bridge.exports.json", canonicalJson(config));
	if(route === "reviewed")
		await saveLakeFile(author, "api.binding-ir.json", canonicalJson(ownedSubtypePackageReviewedIr()));
	const environment = {
		...nativeFixtureEnvironment(profiles)
		, LEAN_BRIDGE_PYTHON: resolve(process.env.LEAN_BRIDGE_PYTHON ?? ".toolchains/python311/bin/python3.11")
		, LEAN_BRIDGE_RUBY: resolve(process.env.LEAN_BRIDGE_RUBY ?? ".toolchains/ruby33/bin/ruby")
		, LEAN_BRIDGE_GEM: resolve(process.env.LEAN_BRIDGE_GEM ?? ".toolchains/ruby33/bin/gem")
		, LEAN_BRIDGE_CARGO: resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo")
		, LEAN_BRIDGE_RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc")
		, CARGO_HOME: resolve(process.env.CARGO_HOME ?? ".toolchains/cargo-copied")
	};
	const before = await lakeInputState(author);
	const buildOptions = { projectRoot: author, outputRoot: output
		, targets: Object.values(targets).map(([target]) => target), environment
		, onProgress: event => t.diagnostic(`${route}: ${event.message}`) };
	const built = await buildCanonicalProject(buildOptions)
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	assert.deepEqual(await lakeInputState(author), before);
	assert.deepEqual(built.projections.map(item => item.ecosystem).sort(), ["cargo", "pypi", "rubygems"]);
	const model = await json(join(output, "native/component/model.json"));
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), route === "reviewed");
	assert.equal(model.ownedGraph.hostCallbacks, undefined);
	assert.ok(model.ownedGraph.inputTransfers);
	const echo = model.bindingIr.declarations.find(item => item.name === "echoRecord");
	const alternate = model.bindingIr.declarations.find(item => item.name === "echoRecordAlternate");
	assert.equal(echo.source.extensions["lean-lang.org/refinements"].parameters[0]
		.fields[4].refinement.fields[0].refinement.constructor, "Owned.checkedCount");
	assert.equal(alternate.source.extensions["lean-lang.org/refinements"].parameters[0]
		.fields[4].refinement.fields[0].refinement.constructor, "Owned.checkedCountAlternate");
	const { evidence, reassembled } = await reproduce({ routeRoot: scratch, output, environment, config, built });
	const receipt = await copyPackageSetHandoff(output, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await mkdir(join(consumers, "dependencies"), { recursive: true });
	const dependencies = await prepareRustCorpusDependencies({ rustRoot: join(output, "native/rust")
		, directory: scratch
		, handoff: join(consumers, "dependencies")
		, environment });
	await rm(author, { recursive: true, force: true });
	await rm(output, { recursive: true, force: true });
	await assert.rejects(access(author), { code: "ENOENT" });
	await assert.rejects(access(output), { code: "ENOENT" });
	const sources = Object.fromEntries(await Promise.all(profiles.map(async profile => {
		const path = `tests/fixtures/structured-types/owned-subtype-${profile}.${extensions[profile]}`;
		return [profile, await readFile(path, "utf8")];
	})));
	const observations = {};
	for(const profile of profiles)
	{
		const installOptions = { profile, consumer: consumers, handoff
			, packages: receipt.packages.filter(item => item.target === targets[profile][0])
			, environment, dependencies
			, fixture: { source: () => sources[profile], success: `owned-subtype-${profile}` } };
		observations[profile] = await installCopiedConsumer(installOptions);
		assert.ok(observations[profile].checks >= 100);
	}
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = await relocate({ routeRoot: scratch, consumers, observations });
	const versions = {};
	const versionCommands = { python: environment.LEAN_BRIDGE_PYTHON
		, ruby: environment.LEAN_BRIDGE_RUBY, rustc: environment.LEAN_BRIDGE_RUSTC };
	for(const [name, command] of Object.entries(versionCommands))
	{
		const version = await runCopied(command, ["--version"], scratch, { PATH: "/unavailable" });
		versions[name] = `${version.stdout}${version.stderr}`.trim();
	}
	reports.push({
		route, sourceUnchanged: true, sourceFreeInstallation: true
		, relocatedInstallation: true, handoffRemovedBeforeRelocatedExecution: true
		, deterministicReassembly: true, compilerSelectedConstructors: true
		, transferredInputCheckedBeforeHandoff: true
		, versions, dependencies, reassembled
		, observations: Object.fromEntries(profiles.map(profile => [profile, {
			checks: observations[profile].checks
			, consumerSha256: observations[profile].consumerSha256
			, relocatedChecks: relocated[profile].checks
		}]))
		, packageSetReceipt: receipt
		, componentReceipts: {
			python: evidence.python.receipt
			, ruby: evidence.ruby.receipt
			, rust: evidence.rust.receipt
		}
	});
	complete = true;
	t.diagnostic(`${route}: ${profiles.map(profile => `${profile}=${observations[profile].checks}`).join(", ")}`);
});
