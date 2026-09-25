/**
 * Verify original recursive gems without their producer or compiler tools.
 * Safety probes modify only Ruby methods in isolated consumer processes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const rubyRecursiveConsumerNames = ["ruby-recursive", "ruby-recursive-faults", "ruby-recursive-lifetimes", "ruby-recursive-ownership", "ruby-recursive-poison"];

/** Keep the acyclic consumer unchanged except for the graph status exception. */
export const rubyRecursiveConsumerSources = async () => {
	const sources = Object.fromEntries(await Promise.all([...rubyRecursiveConsumerNames, "ruby-values"].map(async name => [
		`${name}.rb`
		, await readFile(`tests/fixtures/structured-callable-consumers/${name}.rb`, "utf8")
	])));
	const acyclic = await readFile("tests/fixtures/structured-callable-consumers/ruby.rb", "utf8");
	assert.equal(acyclic.split("rejects(RangeError) { escaped.call").length, 3);
	sources["ruby-acyclic.rb"] = acyclic.replaceAll("rejects(RangeError) { escaped.call", "rejects(API::LeanBridgeError) { escaped.call");
	return sources;
};

/**
 * Require both exception classes at every checkpoint across all nine shapes.
 *
 * @param report - Observed conversion and cleanup fault counts.
 */
export const assertRubyRecursiveFaults = report => {
	assert.deepEqual(report.shapes.map(item => item.shape).sort(), ["alias", "array", "list", "option", "record", "recursive", "result", "tuple", "variant"]);
	assert.ok(report.checks > report.faults);
	assert.ok(report.clears > 0 && report.closes > 0);
	assert.ok(report.conversion_methods >= 60); assert.equal(report.identities, 0);
	for(const shape of report.shapes)
	{
		assert.deepEqual(Object.keys(shape.paths).sort(), ["callback", "create", "create-call", "held-call", "repeated"]);
		for(const count of Object.values(shape.paths)) assert.ok(Number.isSafeInteger(count) && count > 0);
		assert.equal(shape.faults, 2 * Object.values(shape.paths).reduce((sum, count) => sum + count, 0));
	}
	assert.equal(report.faults, report.shapes.reduce((sum, shape) => sum + shape.faults, 0));
};

/**
 * Relocate the installed gem, remove archives, execute and check every file.
 *
 * @param options - Original package, public consumer fixtures and layout probes.
 * @param options.consumer - Task-owned consumer directory.
 * @param options.handoff - Verified package-set handoff.
 * @param options.packages - Original archive metadata.
 * @param options.environment - Selected MRI interpreter and gem executable.
 * @param options.projection - Private offsets, never public expected values.
 * @param options.documented - Exact Ruby documentation example.
 */
export const installRubyRecursiveCallables = async ({ consumer, handoff, packages, environment, projection, documented }) => {
	const sources = await rubyRecursiveConsumerSources();
	const root = join(consumer, "ruby"); await mkdir(root);
	const command = (await runCopied(environment.LEAN_BRIDGE_RUBY, ["--disable-gems", "-rrbconfig", "-e", "print RbConfig.ruby"], root)).stdout;
	assert.equal(packages.length, 1);
	const pkg = packages[0]; assert.equal(pkg.ecosystem, "rubygems"); assert.equal(pkg.role, "component");
	assert.equal(pkg.artifacts.length, 1);
	const archive = join(handoff, pkg.artifacts[0].path);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const original = join(root, "gems"), relocated = join(root, "relocated-gems");
	let env = { ...copiedCleanEnvironment, GEM_HOME: original, GEM_PATH: original };
	await runCopied(command, [environment.LEAN_BRIDGE_GEM ?? join(dirname(command), "gem"), "install", "--norc", archive, "--local", "--install-dir", original, "--no-document"], root, env);
	const locate = ["-e", 'print Gem::Specification.find_by_name("structured-api", "1.0.0").full_gem_path'];
	const installed = (await runCopied(command, locate, root, env)).stdout;
	assert.ok(installed.startsWith(`${original}/gems/`));
	const receiptBytes = await readFile(join(installed, "lean-bridge/package-receipt.json")), receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.kind, "lean-bridge-ordinary-rubygems-package");
	assert.equal(receipt.name, "structured-api"); assert.equal(receipt.version, "1.0.0");
	assert.ok(Object.hasOwn(receipt.files, "lean-bridge/include/detail/structured-callable-borrows.h"));
	await verifyNativeFiles(installed, receipt.files);
	const paths = await nativeArtifactPaths(installed);
	for(const [name, source] of Object.entries(sources)) await saveLakeFile(root, name, source);
	await saveLakeFile(root, "documented.rb", documented + "\n");
	await rename(original, relocated);
	await rm(handoff, { recursive: true, force: true });
	await rm(join(relocated, "cache"), { recursive: true, force: true });
	env = { ...copiedCleanEnvironment, GEM_HOME: relocated, GEM_PATH: relocated };
	const deployed = (await runCopied(command, locate, root, env)).stdout;
	assert.equal(deployed, join(relocated, relative(original, installed)));
	const ownership = ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"].map(shape => {
		const callback = projection.functions.find(fn => fn.publicName === "call_" + shape).parameters[1].callback;
		return { shape, callback: callback.index, input: callback.parameters[0].index
			, output: callback.result.index, size: callback.result.size };
	});
	const layouts = { call: projection.functions.find(fn => fn.publicName === "call_recursive").index, ownership };
	const execute = async name => {
		const run = await runCopied(command, [name + ".rb", JSON.stringify(layouts)], root, env);
		assert.equal(run.stderr, "");
		return JSON.parse(run.stdout);
	};
	const publicChecks = await execute("ruby-recursive"), acyclic = await execute("ruby-acyclic");
	assert.equal(publicChecks.checks, 379);
	assert.equal(acyclic.checks, 51335); assert.equal(acyclic.calls, 1536); assert.equal(acyclic.rejected, 457);
	assert.equal(acyclic.api, join(deployed, "lib/lean_bridge/structured.rb"));
	assert.match(acyclic.ruby, /^ruby 3\.3\./);
	const faults = await execute("ruby-recursive-faults"); assertRubyRecursiveFaults(faults);
	const lifetimes = await execute("ruby-recursive-lifetimes");
	assert.equal(lifetimes.creator_exit_rejections, 16); assert.equal(lifetimes.capacity, 4096);
	for(const key of ["overflow_rejected", "replacement_usable", "finalization_released"]) assert.equal(lifetimes[key], true);
	assert.equal(lifetimes.identities, 0);
	assert.deepEqual(await execute("ruby-recursive-ownership"), { ownership_checks: 9 });
	const poison = await runCopied(command, ["ruby-recursive-poison.rb", JSON.stringify(layouts)], root, env);
	assert.equal(poison.stderr, ""); assert.equal(poison.stdout, "malformed-output-retires-runtime\n");
	const counterfactuals = [];
	for(const [name, marker] of [["ownership", "9 Callback owners released before native copying"], ["poison", "Retired runtime reentered"]])
	{
		await assert.rejects(() => runCopied(command, [`ruby-recursive-${name}.rb`, JSON.stringify(layouts), "mutant"], root, env), error => {
			assert.equal(error.code, "build-command-failed"); assert.match(error.message, /exited with status 1/);
			assert.ok(error.details.stderr.includes(marker), error.details.stderr); assert.equal(error.details.stdout, "");
			return true;
		});
		counterfactuals.push({ name, rejected: true, marker });
	}
	const docs = await runCopied(command, ["documented.rb"], root, env);
	assert.equal(docs.stderr, ""); assert.equal(docs.stdout, "");
	assert.deepEqual(await execute("ruby-recursive"), publicChecks);
	assert.equal(sha256(await readFile(join(deployed, "lean-bridge/package-receipt.json"))), sha256(receiptBytes));
	await verifyNativeFiles(deployed, receipt.files);
	assert.deepEqual(await nativeArtifactPaths(deployed), paths);
	const { api, ruby, ...acyclicChecks } = acyclic; void api;
	return { public: publicChecks, acyclic: acyclicChecks
		, ruby, faults, lifetimes, counterfactuals
		, ownershipChecks: 9, malformedOutputRetiresRuntime: true
		, installedFiles: receipt.files, installedReceiptSha256: sha256(receiptBytes)
		, rubySha256: sha256(await readFile(command))
		, sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, sha256(source)]))
		, documentation: { sourceSha256: sha256(documented), executed: true }
		, offlineInstall: true, compilerFreeExecution: true
		, relocatedInstallation: true
		, producerHandoffRemoved: true, gemCacheRemoved: true, repeatExecution: true
		, installedFilesUnchanged: true, isolatedInMemoryFaultProbe: true };
};
