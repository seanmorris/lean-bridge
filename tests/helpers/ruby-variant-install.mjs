/**
 * Verify original gems, relocate them and probe public variants without compilers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Install offline, remove handoff/cache, relocate and rerun unchanged gem files.
 *
 * @param options - Verified archive, selected interpreter and private probe data.
 * @param options.consumer - Task-owned consumer root.
 * @param options.handoff - Verified package-set handoff.
 * @param options.packages - Package-set entries.
 * @param options.environment - Producer tool selection.
 * @param options.projection - Private indices/layouts, not expected public results.
 */
export const installRubyVariants = async ({ consumer, handoff, packages, environment, projection }) => {
	const root = join(consumer, "ruby"); await mkdir(root);
	const command = (await runCopied(environment.LEAN_BRIDGE_RUBY, ["--disable-gems", "-rrbconfig", "-e", "print RbConfig.ruby"], root)).stdout;
	const pkg = packages.find(item => item.role === "component"), archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const original = join(root, "gems"), relocated = join(root, "relocated-gems");
	let env = { ...copiedCleanEnvironment, GEM_HOME: original, GEM_PATH: original };
	await runCopied(command, [environment.LEAN_BRIDGE_GEM ?? join(dirname(command), "gem"), "install", "--norc", archive, "--local", "--install-dir", original, "--no-document"], root, env);
	const locate = ["-e", 'print Gem::Specification.find_by_name("variants-api", "1.0.0").full_gem_path'];
	const installed = (await runCopied(command, locate, root, env)).stdout;
	assert.ok(installed.startsWith(`${original}/gems/`));
	const receiptBytes = await readFile(join(installed, "lean-bridge/package-receipt.json")), receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.kind, "lean-bridge-ordinary-rubygems-package");
	assert.equal(receipt.name, "variants-api"); assert.equal(receipt.version, "1.0.0");
	await verifyNativeFiles(installed, receipt.files);
	const sources = Object.fromEntries(await Promise.all(["ruby", "ruby-faults"].map(async name => [name, await readFile(`tests/fixtures/variant-consumers/${name}.rb`, "utf8")])));
	for(const [name, source] of Object.entries(sources)) await saveLakeFile(root, `${name}.rb`, source);
	await rename(original, relocated); await rm(handoff, { recursive: true, force: true });
	await rm(join(relocated, "cache"), { recursive: true, force: true });
	env = { ...copiedCleanEnvironment, GEM_HOME: relocated, GEM_PATH: relocated };
	const deployed = (await runCopied(command, locate, root, env)).stdout;
	assert.equal(deployed, join(relocated, relative(original, installed)));
	const expectedLibraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.endsWith(".so")).map(([path, value]) => [path, value.sha256]));
	assert.equal(Object.keys(expectedLibraries).length, 4);
	const execute = async () => {
		const run = await runCopied(command, ["ruby.rb"], root, env); assert.equal(run.stderr, "");
		const observation = JSON.parse(run.stdout); assert.ok(observation.checks > 25000); assert.ok(observation.calls > 4000); assert.equal(observation.rejected, 81);
		assert.match(observation.ruby, /^ruby 3\.3\./); assert.equal(observation.gem_root, deployed);
		assert.equal(observation.api, join(deployed, "lib/lean_bridge/variants.rb"));
		assert.deepEqual(observation.native_libraries, expectedLibraries); return observation;
	};
	const first = await execute();
	const layouts = projection.surface.copies.filter(copy => copy.variant).map(copy => ({ name: copy.publicName, index: copy.index, size: copy.size, payloadOffset: copy.payloadOffset }));
	assert.equal(layouts.length, 7);
	const probe = await runCopied(command, ["ruby-faults.rb", JSON.stringify(layouts)], root, env); assert.equal(probe.stderr, "");
	const faults = JSON.parse(probe.stdout);
	assert.ok(faults.checks > 200); assert.equal(faults.partial_inputs, 64);
	assert.equal(faults.layouts, 13); assert.equal(faults.malformed_tags, 7); assert.equal(faults.inactive_cases, 6);
	assert.equal(faults.constructor_probes, 22); assert.ok(faults.conversion_methods >= 60);
	assert.deepEqual(await execute(), first);
	assert.equal(sha256(await readFile(join(deployed, "lean-bridge/package-receipt.json"))), sha256(receiptBytes));
	await verifyNativeFiles(deployed, receipt.files);
	return { checks: first.checks, calls: first.calls, rejected: first.rejected
		, ruby: first.ruby, faults
		, nativeLibraries: first.native_libraries, installedFiles: receipt.files
		, installedReceiptSha256: sha256(receiptBytes)
		, rubySha256: sha256(await readFile(command))
		, consumerSha256: sha256(sources.ruby)
		, probeSha256: sha256(sources["ruby-faults"])
		, offlineInstall: true, compilerFreeExecution: true
		, relocatedInstallation: true, gemCacheRemoved: true
		, producerHandoffRemoved: true, publicApiOnly: true, repeatExecution: true
		, installedFilesUnchanged: true, isolatedInMemoryFaultProbe: true };
};
