/**
 * Install original structured gems and audit source-free callback ownership.
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

/**
 * Require both exception classes at every checkpoint in all forty paths.
 *
 * @param report - Observed cleanup and conversion fault counts.
 */
export const assertRubyStructuredFaults = report => {
	assert.deepEqual(report.shapes.map(item => item.shape).sort(), ["alias", "array", "list", "option", "record", "result", "tuple", "variant"]);
	assert.ok(report.checks > report.faults);
	assert.ok(report.clears > 0 && report.closes > 0 && report.malformed >= 10);
	assert.ok(report.conversion_methods >= 65);
	for(const shape of report.shapes)
	{
		assert.deepEqual(Object.keys(shape.paths).sort(), ["callback", "create", "create-call", "held-call", "repeated"]);
		for(const count of Object.values(shape.paths)) assert.ok(Number.isSafeInteger(count) && count > 0);
		assert.equal(shape.faults, 2 * Object.values(shape.paths).reduce((sum, count) => sum + count, 0));
	}
	assert.equal(report.faults, report.shapes.reduce((sum, shape) => sum + shape.faults, 0));
};

/**
 * Relocate, remove author handoff, execute and verify unchanged installed files.
 *
 * @param options - Original package and independent host fixtures.
 * @param options.consumer - Task-owned consumer directory.
 * @param options.handoff - Verified package-set handoff.
 * @param options.packages - Original archive metadata.
 * @param options.environment - Selected MRI interpreter and gem executable.
 * @param options.projection - Private layout offsets, never public expectations.
 */
export const installRubyStructuredCallables = async ({ consumer, handoff, packages, environment, projection }) => {
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
	await verifyNativeFiles(installed, receipt.files);
	const paths = await nativeArtifactPaths(installed);
	const sources = Object.fromEntries(await Promise.all(["ruby", "ruby-values", "ruby-faults"].map(async name => [
		`${name}.rb`
		, await readFile(`tests/fixtures/structured-callable-consumers/${name}.rb`, "utf8")
	])));
	for(const [name, source] of Object.entries(sources)) await saveLakeFile(root, name, source);
	const guide = await readFile("docs/consume/ruby.md", "utf8");
	const documented = guide.match(/### Structured callback values\n[\s\S]*?```ruby\n([\s\S]*?)\n```/u)?.[1];
	assert.ok(documented);
	await saveLakeFile(root, "documented.rb", documented + "\n");
	await rename(original, relocated);
	await rm(handoff, { recursive: true, force: true });
	await rm(join(relocated, "cache"), { recursive: true, force: true });
	env = { ...copiedCleanEnvironment, GEM_HOME: relocated, GEM_PATH: relocated };
	const deployed = (await runCopied(command, locate, root, env)).stdout;
	assert.equal(deployed, join(relocated, relative(original, installed)));
	const execute = async () => {
		const run = await runCopied(command, ["ruby.rb"], root, env); assert.equal(run.stderr, "");
		const result = JSON.parse(run.stdout);
		assert.ok(result.checks > 10000 && result.calls >= 1500 && result.rejected >= 300);
		assert.match(result.ruby, /^ruby 3\.3\./);
		assert.deepEqual(result.shapes, ["array", "list", "option", "result", "tuple", "record", "variant", "alias"]);
		assert.equal(result.api, join(deployed, "lib/lean_bridge/structured.rb"));
		return result;
	};
	const first = await execute();
	const { surface } = projection;
	const layouts = {
		bool: surface.copies.find(copy => copy.scalarName === "bool").index
		, sizes: Object.fromEntries(surface.copies.filter(copy => copy.aggregate).map(copy => [copy.index, copy.size]))
		, invalid: surface.copies.filter(copy => copy.variant || copy.element || ["option", "result"].includes(copy.compound)).map(copy => ({
			index: copy.index, size: copy.size
			, kind: copy.variant ? "variant" : copy.element ? "sequence" : copy.compound
		}))
	};
	const probe = await runCopied(command, ["ruby-faults.rb", JSON.stringify(layouts)], root, env);
	assert.equal(probe.stderr, "");
	const faults = JSON.parse(probe.stdout); assertRubyStructuredFaults(faults);
	const docs = await runCopied(command, ["documented.rb"], root, env);
	assert.equal(docs.stderr, ""); assert.equal(docs.stdout, "");
	assert.deepEqual(await execute(), first);
	assert.equal(sha256(await readFile(join(deployed, "lean-bridge/package-receipt.json"))), sha256(receiptBytes));
	await verifyNativeFiles(deployed, receipt.files);
	assert.deepEqual(await nativeArtifactPaths(deployed), paths);
	const { api, ruby, ...publicChecks } = first; void api;
	return {
		public: publicChecks, ruby, faults
		, installedFiles: receipt.files, installedReceiptSha256: sha256(receiptBytes)
		, rubySha256: sha256(await readFile(command))
		, sourceHashes: Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, sha256(source)]))
		, documentation: { sourceSha256: sha256(documented), executed: true }
		, offlineInstall: true, compilerFreeExecution: true
		, relocatedInstallation: true, producerHandoffRemoved: true
		, gemCacheRemoved: true, repeatExecution: true, installedFilesUnchanged: true
		, isolatedInMemoryFaultProbe: true
	};
};
