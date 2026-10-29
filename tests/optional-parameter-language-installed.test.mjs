/**
 * Source-free ordinary and reviewed language-package acceptance for optional
 * parameters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
	, runCopied
} from "./helpers/copied-fixture-install.mjs";
import {
	installFinContainerEdgePython, runFinContainerEdgePython
	, verifyFinContainerEdgePythonEnvironment
} from "./helpers/fin-container-edge-python-closure.mjs";
import {
	installFinContainerEdgeRuby, runFinContainerEdgeRuby
	, verifyFinContainerEdgeRubyEnvironment
} from "./helpers/fin-container-edge-ruby-closure.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./helpers/fin-container-edge-closure.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	optionalParameterLanguageProfiles
} from "./helpers/optional-parameter-language-report.mjs";
import {
	assertOptionalParameterNativeComponent, prepareOptionalParameterProject
	, retainOptionalParameterNativeComponent
} from "./helpers/optional-parameter-packages.mjs";
import { retainPackageSetEvidence } from "./helpers/package-set.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";

const flag = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_LANGUAGE_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_OPTIONAL_PARAMETER_LANGUAGE_TEST");
const enabled = flag === "1";
const profile = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_LANGUAGE_PROFILE
	?? "python";
assert.ok(optionalParameterLanguageProfiles.includes(profile));
const routes = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_LANGUAGE_ROUTES
	?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const extension = { perl: "pl", python: "py", ruby: "rb", rust: "rs" };
const target = { perl: "cpan", python: "pypi", ruby: "rubygems", rust: "cargo" };
const apiSuffix = {
	perl: "LeanBridge/OptionalParameters.pm"
	, python: "lean_defaults/__init__.py"
	, ruby: "lib/lean_bridge/defaults.rb"
	, rust: "optionalparameters-1.0.0/src/lib.rs"
};
const pythonReceipt = "lean_defaults/lean_bridge/package-receipt.json";
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_LANGUAGE_OUTPUT
		?? "build/optional-parameter-language/{profile}/{route}"
).replace("{profile}", profile).replace("{route}", route));
const sourcePath = name => `tests/fixtures/optional-parameter-consumers/${name}.${extension[name]}`;

const findSuffix = async (root, suffix) => {
	const matches = [];
	const visit = async directory => {
		for(const entry of await readdir(directory, { withFileTypes: true }))
		{
			const path = join(directory, entry.name);
			if(entry.isDirectory()) await visit(path);
			else if(entry.isFile() && path.replaceAll("\\", "/").endsWith(suffix))
				matches.push(path);
		}
	};
	await visit(root); assert.equal(matches.length, 1, `${suffix}: ${matches}`);
	return matches[0];
};

for(const route of routes) test(
	`installed optional-parameter ${profile} package reproduces and relocates ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-optional-language-"));
		t.after(() => rm(suite, { recursive: true, force: true }));
		const consumerRoot = join(suite, "consumers");
		await mkdir(consumerRoot);
		const environment = nativeFixtureEnvironment([profile]);
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim();
		const builds = [], handoff = join(records, "handoff");
		let receipt, dependencies = null;
		for(const attempt of [0, 1])
		{
			const prepared = await prepareOptionalParameterProject(t, {
				route, profiles: [profile]
			});
			const before = await lakeInputState(prepared.projectRoot);
			const outputRoot = join(prepared.directory, "release");
			const built = await buildCanonicalProject({
				projectRoot: prepared.projectRoot, outputRoot
				, targets: [target[profile]], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			const component = await assertOptionalParameterNativeComponent(outputRoot);
			await verifyPackageSetReceipt({
				receiptPath: join(outputRoot, "package-set-receipt.json")
			});
			assert.deepEqual(await lakeInputState(prepared.projectRoot), before);
			const receiptBytes = await readFile(
				join(outputRoot, "package-set-receipt.json")
			);
			const value = JSON.parse(receiptBytes);
			const archives = Object.fromEntries(value.packages
				.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))
				.sort(([left], [right]) => left.localeCompare(right)));
			const fact = {
				...component, bindingIrSha256: built.bindingIrSha256
				, packageSetReceiptSha256: sha256(receiptBytes), archives
			};
			await retainOptionalParameterNativeComponent(
				records, attempt, outputRoot);
			await saveLakeFile(records, `build-${attempt}/package-set-receipt.json`
				, receiptBytes);
			await saveLakeFile(records, `build-${attempt}/configuration.json`
				, canonicalJson(prepared.configuration));
			await saveLakeFile(records, `build-${attempt}/Defaults.lean`
				, await readFile(join(prepared.projectRoot, "Defaults.lean")));
			if(attempt === 0)
			{
				const retained = await retainPackageSetEvidence(outputRoot, handoff);
				receipt = retained.receipt;
				if(profile === "rust")
				{
					dependencies = await prepareRustCorpusDependencies({
						rustRoot: join(outputRoot, "native/rust")
						, directory: prepared.directory
						, handoff: join(consumerRoot, "dependencies"), environment
					});
					await saveLakeFile(records, `dependencies/${dependencies.archive}`
						, await readFile(join(consumerRoot, "dependencies", dependencies.archive)));
				}
			}
			builds.push(fact);
			await rm(prepared.directory, { recursive: true, force: true });
			await assert.rejects(lstat(prepared.directory), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		const packages = receipt.packages.filter(item =>
			item.target === target[profile]);
		const pkg = packages.find(item => item.role === "component");
		assert.ok(pkg);
		const source = await readFile(sourcePath(profile), "utf8");
		const runtimeChecks = profile === "rust" ? 21 : 23;
		const fixture = {
			source: () => source, success: `optional-parameter-${profile}`
			, expectedChecks: runtimeChecks
			, ...profile === "python" ? { installPython: input =>
				installFinContainerEdgePython({ ...input, receiptPath: pythonReceipt }) } : {}
			, ...profile === "ruby" ? { installRuby: installFinContainerEdgeRuby } : {}
			, ...profile === "rust"
				? { verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure } : {}
		};
		const installed = await installCopiedConsumer({
			profile, consumer: consumerRoot, handoff, packages, environment
			, dependencies, fixture
		});
		const root = join(consumerRoot, profile);
		const api = await readFile(await findSuffix(root, apiSuffix[profile]));
		const relocated = join(consumerRoot, `${profile}-relocated`);
		await rename(root, relocated);
		await assert.rejects(access(root), { code: "ENOENT" });
		let closure, rerun;
		if(profile === "python")
		{
			const context = {
				...installed.pythonEnvironment, venv: join(relocated, "venv")
			};
			closure = await verifyFinContainerEdgePythonEnvironment(context);
			rerun = await runFinContainerEdgePython(
				context, ["consumer.py"], relocated, copiedCleanEnvironment
			);
		}
		else if(profile === "ruby")
		{
			const context = {
				...installed.rubyEnvironment, gems: join(relocated, "gems")
			};
			closure = await verifyFinContainerEdgeRubyEnvironment(context);
			rerun = await runFinContainerEdgeRuby(
				context, ["consumer.rb"], relocated
			);
		}
		else if(profile === "perl")
		{
			const prefix = join(relocated, "installed");
			const files = await nativeArtifactPaths(prefix);
			const receipts = Object.fromEntries((await Promise.all(files
				.filter(path => path.endsWith("/install-receipt.json"))
				.map(async path => [path, sha256(await readFile(join(prefix, path)))])))
				.sort(([left], [right]) => left.localeCompare(right)));
			assert.equal(Object.keys(receipts).length, 2);
			closure = {
				installedFilesSha256: sha256(canonicalJson(files))
				, interpreterSha256: sha256(await readFile(installed.command))
				, receiptsSha256: sha256(canonicalJson(receipts))
			};
			rerun = await runCopied(installed.command, ["consumer.pl"], relocated, {
				...copiedCleanEnvironment
				, PERL5LIB: join(prefix, "lib/perl5")
			});
			assert.deepEqual(await nativeArtifactPaths(prefix), files);
		}
		else
		{
			const archive = join(handoff, pkg.artifacts[0].path);
			const installedRoot = join(relocated, `${pkg.name}-${pkg.version}`);
			closure = {
				...await verifyFinContainerEdgeArchiveClosure({
					profile, installed: installedRoot
					, receiptPath: "lean-bridge/package-receipt.json"
					, archive, archiveSha256: pkg.artifacts[0].sha256
				})
				, compilerSha256: sha256(await readFile(environment.LEAN_BRIDGE_RUSTC))
				, cargoSha256: sha256(await readFile(environment.LEAN_BRIDGE_CARGO))
				, executableSha256: sha256(await readFile(join(relocated, "target/debug/consumer")))
			};
			rerun = await runCopied(join(relocated, "target/debug/consumer"), []
				, relocated, copiedCleanEnvironment);
		}
		assert.equal(rerun.stderr, "");
		assert.equal(rerun.stdout
			, `optional-parameter-${profile}:${runtimeChecks}\n`);
		assert.equal(await readFile(join(relocated
			, `consumer.${extension[profile]}`), "utf8"), source);
		let invalidCompile = null;
		if(profile === "rust")
		{
			const invalid = await readFile(
				"tests/fixtures/optional-parameter-consumers/rust-invalid.rs"
			);
			await saveLakeFile(relocated, "invalid.rs", invalid);
			const manifest = await readFile(join(relocated, "Cargo.toml"), "utf8");
			await saveLakeFile(relocated, "Cargo.toml"
				, `${manifest}\n[[bin]]\nname="invalid"\npath="invalid.rs"\n`);
			let diagnostic = "";
			const invalidResult = runCopied(
				environment.LEAN_BRIDGE_CARGO
				, ["check", "--offline", "--bin", "invalid"]
				, relocated
				, {
					...copiedCleanEnvironment, PATH: "/usr/bin:/bin"
					, RUSTC: environment.LEAN_BRIDGE_RUSTC
					, CARGO_HOME: join(relocated, "cargo-home")
					, CARGO_NET_OFFLINE: "true"
				}
			);
			await assert.rejects(invalidResult, error => {
				diagnostic = error.details?.stderr ?? error.message;
				assert.match(diagnostic, /(?:E0308|mismatched types|expected u32)/u);
				return true;
			});
			await saveLakeFile(records, "rust/invalid.rs", invalid);
			invalidCompile = {
				rejected: true
				, diagnostic: diagnostic.replaceAll(suite, "<suite>")
			};
		}
		await saveLakeFile(records, `${profile}/consumer.${extension[profile]}`
			, source);
		await saveLakeFile(records, `${profile}/api.txt`, api);
		await saveLakeFile(records, "report.json", canonicalJson({
			schemaVersion: 1, profile, route, producerCommit
			, builds, receipt, dependencies
			, observation: {
				profile, checks: 23, runtimeChecks, invalidHostValues: 2
				, explicitHostNull: true, offlineInstall: installed.offlineInstall
				, compilerFreePath: installed.compilerFreePath
				, consumerSha256: sha256(source), apiSha256: sha256(api)
				, closure
				, executions: [
					{ checks: runtimeChecks, relocated: false }
					, { checks: runtimeChecks, relocated: true }
				]
				, invalidCompile
			}
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		}));
	}
);
