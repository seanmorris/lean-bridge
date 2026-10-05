/**
 * Verify and relocate prepared gems before independent, compiler-free consumers.
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
 * Install offline, remove the handoff and rerun unchanged relocated Ruby files.
 *
 * @param root0 - Verified package handoff, tools and private probe indices.
 * @param root0.consumer - Task-owned working directory.
 * @param root0.handoff - Verified package-set directory.
 * @param root0.packages - Package-set entries.
 * @param root0.environment - Producer tool selection.
 * @param root0.projection - Ruby model used only to locate private fault probes.
 */
export const installRubyLists = async ({ consumer, handoff, packages, environment, projection }) => {
	const root = join(consumer, "ruby"); await mkdir(root);
	const command = (await runCopied(environment.LEAN_BRIDGE_RUBY, ["--disable-gems", "-rrbconfig", "-e", "print RbConfig.ruby"], root)).stdout;
	const pkg = packages.find(item => item.role === "component"), archive = join(handoff, pkg.artifacts[0].path);
	const original = join(root, "gems"), relocated = join(root, "relocated-gems");
	let env = { ...copiedCleanEnvironment, GEM_HOME: original, GEM_PATH: original };
	await runCopied(command, [environment.LEAN_BRIDGE_GEM ?? join(dirname(command), "gem"), "install", "--norc", archive, "--local", "--install-dir", original, "--no-document"], root, env);
	const locate = ["-e", 'print Gem::Specification.find_by_name("lists-api", "1.0.0").full_gem_path'];
	const installed = (await runCopied(command, locate, root, env)).stdout;
	assert.ok(installed.startsWith(`${original}/gems/`));
	const receiptBytes = await readFile(join(installed, "lean-bridge/package-receipt.json")), receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.kind, "lean-bridge-ordinary-rubygems-package");
	assert.equal(receipt.name, "lists-api"); assert.equal(receipt.version, "1.0.0");
	await verifyNativeFiles(installed, receipt.files);
	const sources = Object.fromEntries(await Promise.all(["ruby", "ruby-faults"].map(async name => [name, await readFile(`tests/fixtures/list-consumers/${name}.rb`, "utf8")])));
	for(const [name, source] of Object.entries(sources)) await saveLakeFile(root, `${name}.rb`, source);
	await rename(original, relocated);
	await rm(handoff, { recursive: true, force: true });
	env = { ...copiedCleanEnvironment, GEM_HOME: relocated, GEM_PATH: relocated };
	const deployed = (await runCopied(command, locate, root, env)).stdout;
	assert.equal(deployed, join(relocated, relative(original, installed)));
	const expectedLibraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.endsWith(".so")).map(([path, value]) => [path, value.sha256]));
	assert.ok(Object.keys(expectedLibraries).length >= 3);
	const execute = async () => {
		const run = await runCopied(command, ["ruby.rb"], root, env);
		assert.equal(run.stderr, "");
		const observation = JSON.parse(run.stdout);
		assert.ok(observation.checks > 20000);
		assert.match(observation.ruby, /^ruby 3\.3\./);
		assert.equal(observation.gem_root, deployed);
		assert.equal(observation.api, join(deployed, "lib/lean_bridge/lists.rb"));
		assert.deepEqual(observation.native_libraries, expectedLibraries);
		return observation;
	};
	const first = await execute();
	const indices = ["reverse_uint32", "mix"].map(name => projection.surface.copy(projection.surface.functions.find(fn => fn.field === name).declaration.result.type).index);
	const probe = await runCopied(command, ["ruby-faults.rb", JSON.stringify(indices)], root, env);
	assert.equal(probe.stderr, "");
	const faults = JSON.parse(probe.stdout);
	assert.ok(faults.checks > 100); assert.equal(faults.partial_inputs, 16); assert.equal(faults.layouts, 9);
	const second = await execute(); assert.deepEqual(second, first);
	assert.equal(sha256(await readFile(join(deployed, "lean-bridge/package-receipt.json"))), sha256(receiptBytes));
	await verifyNativeFiles(deployed, receipt.files);
	return { checks: first.checks
		, ruby: first.ruby
		, nativeLibraries: first.native_libraries
		, installedFiles: receipt.files
		, installedReceiptSha256: sha256(receiptBytes)
		, rubySha256: sha256(await readFile(command))
		, consumerSha256: sha256(sources.ruby)
		, probeSha256: sha256(sources["ruby-faults"])
		, faults
		, offlineInstall: true
		, compilerFreeExecution: true
		, relocatedInstallation: true
		, producerHandoffRemoved: true
		, publicApiOnly: true
		, repeatExecution: true
		, installedFilesUnchanged: true
		, isolatedInMemoryFaultProbe: true };
};
