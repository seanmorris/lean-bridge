/**
 * Source-free ordinary and reviewed Perl/Python/Ruby/Rust acceptance for
 * direct proof erasure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, cp, lstat, mkdir, mkdtemp, readFile, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
	, runCopied
} from "./helpers/copied-fixture-install.mjs";
import {
	assertDirectProofErasureNativeComponent, prepareDirectProofErasureProject
	, retainDirectProofErasureNativeComponent
} from "./helpers/direct-proof-erasure-packages.mjs";
import {
	directProofErasureLanguageProfiles
} from "./helpers/direct-proof-erasure-language-report.mjs";
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
import { retainPackageSetEvidence } from "./helpers/package-set.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";

const flag = process.env.LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_TEST");
const enabled = flag === "1";
const profile = process.env.LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_PROFILE ?? "python";
assert.ok(directProofErasureLanguageProfiles.includes(profile));
const routes = process.env.LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_ROUTES?.split(",")
	?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const extension = { perl: "pl", python: "py", ruby: "rb", rust: "rs" };
const target = { perl: "cpan", python: "pypi", ruby: "rubygems", rust: "cargo" };
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_DIRECT_PROOF_LANGUAGE_OUTPUT
		?? "build/direct-proof-erasure-language/{profile}/{route}"
).replace("{profile}", profile).replace("{route}", route));
const sourcePath = name => `tests/fixtures/direct-proof-erasure-consumers/${name}.${extension[name]}`;
const negativeSource = Object.freeze({
	perl: "use LeanBridge::DirectProofErasure; LeanBridge::DirectProofErasure::keep(1, 0, 1);\n"
	, python: "from lean_directprooferasure import keep\nkeep(True, 0, True)\n"
	, ruby: "require \"lean_bridge/directprooferasure\"\nLeanBridge::Directprooferasure.keep(true, 0, true)\n"
	, rust: "fn main() { let _ = directprooferasure::keep(true, 0, true); }\n"
});
const diagnosticPattern = Object.freeze({
	perl: /(?:expects 1 arguments|Usage:)/iu
	, python: /(?:takes 1 positional argument but 3 were given|takes exactly one argument)/iu
	, ruby: /wrong number of arguments.*given 3.*expected 1/iu
	, rust: /(?:E0061|takes 1 argument but 3 arguments were supplied)/iu
});
const pythonReceipt = "lean_directprooferasure/lean_bridge/package-receipt.json";

for(const route of routes) test(
	`installed direct proof-erasure ${profile} package reproduces and relocates ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-direct-proof-language-"));
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
			const prepared = await prepareDirectProofErasureProject(t, {
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
			const component = await assertDirectProofErasureNativeComponent(outputRoot);
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
			await retainDirectProofErasureNativeComponent(records, attempt, outputRoot);
			await saveLakeFile(records, `build-${attempt}/package-set-receipt.json`
				, receiptBytes);
			await saveLakeFile(records, `build-${attempt}/configuration.json`
				, canonicalJson(prepared.configuration));
			await saveLakeFile(records, `build-${attempt}/DirectProofErasure.lean`
				, await readFile(join(prepared.projectRoot, "DirectProofErasure.lean")));
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
		const packages = receipt.packages.filter(item => item.target === target[profile]);
		assert.equal(packages.filter(item => item.role === "component").length, 1);
		const pkg = packages.find(item => item.role === "component");
		const source = await readFile(sourcePath(profile), "utf8");
		const fixture = {
			source: () => source, success: `direct-proof-${profile}`
			, expectedChecks: 1005
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
		const command = installed.command;
		const root = join(consumerRoot, profile);
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
			rerun = await runFinContainerEdgeRuby(context, ["consumer.rb"], relocated);
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
				, interpreterSha256: sha256(await readFile(command))
				, receiptsSha256: sha256(canonicalJson(receipts))
			};
			rerun = await runCopied(command, ["consumer.pl"], relocated, {
				...copiedCleanEnvironment, PERL5LIB: join(prefix, "lib/perl5")
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
		assert.equal(rerun.stdout, `direct-proof-${profile}:1005\n`);
		assert.equal(await readFile(join(relocated, `consumer.${extension[profile]}`)
			, "utf8"), source);
		const invalid = negativeSource[profile];
		let diagnostic = "";
		const rejected = error => {
			diagnostic = error.details?.stderr ?? error.message;
			assert.match(diagnostic, diagnosticPattern[profile]);
			return true;
		};
		if(profile === "python")
			await assert.rejects(runFinContainerEdgePython({
				...installed.pythonEnvironment, venv: join(relocated, "venv")
			}, ["-c", invalid], relocated, copiedCleanEnvironment), rejected);
		else if(profile === "ruby")
			await assert.rejects(runFinContainerEdgeRuby({
				...installed.rubyEnvironment, gems: join(relocated, "gems")
			}, ["-e", invalid], relocated), rejected);
		else if(profile === "perl")
			await assert.rejects(runCopied(command, ["-e", invalid], relocated, {
				...copiedCleanEnvironment
				, PERL5LIB: join(relocated, "installed/lib/perl5")
			}), rejected);
		else
		{
			const negativeRoot = join(suite, "negative-rust");
			await mkdir(join(negativeRoot, "dependencies"), { recursive: true });
			await cp(join(consumerRoot, "dependencies", dependencies.archive)
				, join(negativeRoot, "dependencies", dependencies.archive));
			await assert.rejects(installCopiedConsumer({
				profile, consumer: negativeRoot, handoff, packages, environment
				, dependencies
				, fixture: {
					source: () => invalid, success: "must-not-run", expectedChecks: 1
					, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
				}
			}), rejected);
		}
		await saveLakeFile(records, `${profile}/consumer.${extension[profile]}`, source);
		await saveLakeFile(records
			, `${profile}/proof-argument-negative.${extension[profile]}`, invalid);
		await saveLakeFile(records, "report.json", canonicalJson({
			schemaVersion: 1, profile, route, producerCommit
			, builds, receipt, dependencies
			, observation: {
				profile, checks: installed.checks, runtimeParameters: 1, proofSlots: 0
				, offlineInstall: installed.offlineInstall
				, compilerFreePath: installed.compilerFreePath
				, consumerSha256: sha256(source), closure
				, executions: [
					{ checks: 1005, relocated: false }
					, { checks: 1005, relocated: true }
				]
				, negativeProofArgument: {
					rejected: true, relocated: profile !== "rust"
					, diagnostic: diagnostic.replaceAll(suite, "<suite>")
				}
			}
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		}));
	}
);
