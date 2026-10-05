/**
 * Audit and relocate exact prepared alias gems before compiler-free consumers.
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
import { rubyAliasReviewedIr, rubyAliasValueTypes } from "./ruby-alias-fixture.mjs";

/**
 * Inspect installed metadata and public comments against the independent contract.
 *
 * @param files - Exact installed file contents.
 */
export const checkRubyAliasFiles = files => {
	const ir = rubyAliasReviewedIr(), manifest = JSON.parse(files["binding-manifest.json"]);
	const expected = ir.types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target, rubyType: rubyAliasValueTypes[name] }));
	assert.equal(expected.length, 27);
	assert.deepEqual([...manifest.aliases].sort((a, b) => a.id.localeCompare(b.id)), expected);
	const source = files["lib/lean_bridge/aliases.rb"], readme = files["README.md"];
	const type = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named" ? ref.id.slice("lean:Aliases.".length)
		: `${ref.constructor}<${ref.arguments.map(type).join(", ")}>`;
	for(const alias of expected)
	{
		assert.ok(source.includes(`# ${alias.name} = ${type(alias.target)}; Ruby: ${alias.rubyType}`));
		assert.ok(readme.includes(`| \`${alias.name}\` | \`${type(alias.target)}\` | \`${alias.rubyType.replaceAll("|", "\\|")}\` |`));
		assert.doesNotMatch(source, new RegExp(`^\\s*${alias.name}\\s*=`, "m"));
	}
	for(const declaration of ir.declarations)
	{
		const signature = [...declaration.parameters.map((site, index) => `    # arg${index}: ${type(site.type)}`)
			, `    # Returns: ${type(declaration.result.type)}`
			, `    def ${declaration.name}(`].join("\n");
		assert.ok(source.includes(signature), declaration.name);
	}
	for(const record of ir.types.filter(type => type.kind === "record"))
	{
		const start = source.indexOf(`    class ${record.name}\n`), end = source.indexOf("      attr_reader", start);
		const comments = source.slice(start, end);
		for(const field of record.fields) assert.ok(comments.includes(`# ${field.name}: ${type(field.type)}`), `${record.name}.${field.name}`);
	}
	return { aliases: expected, transparentTargetValues: true, installedSourceDocumentation: true, originalAliasChains: true };
};

/**
 * Install offline, remove producer archives, relocate and rerun public consumers.
 *
 * @param root0 - Verified package handoff, tools and private probe indices.
 * @param root0.consumer - Task-owned working directory.
 * @param root0.handoff - Verified package-set directory.
 * @param root0.packages - Package-set entries.
 * @param root0.environment - Producer tool selection.
 * @param root0.projection - Ruby model used only to locate private fault probes.
 */
export const installRubyAliases = async ({ consumer, handoff, packages, environment, projection }) => {
	const root = join(consumer, "ruby"); await mkdir(root);
	const command = (await runCopied(environment.LEAN_BRIDGE_RUBY, ["--disable-gems", "-rrbconfig", "-e", "print RbConfig.ruby"], root)).stdout;
	const pkg = packages.find(item => item.role === "component"), archive = join(handoff, pkg.artifacts[0].path);
	const original = join(root, "gems"), relocated = join(root, "relocated-gems");
	let env = { ...copiedCleanEnvironment, GEM_HOME: original, GEM_PATH: original };
	await runCopied(command, [environment.LEAN_BRIDGE_GEM ?? join(dirname(command), "gem"), "install", "--norc", archive, "--local", "--install-dir", original, "--no-document"], root, env);
	const locate = ["-e", 'print Gem::Specification.find_by_name("aliases-api", "1.0.0").full_gem_path'];
	const installed = (await runCopied(command, locate, root, env)).stdout;
	assert.ok(installed.startsWith(`${original}/gems/`));
	const receiptBytes = await readFile(join(installed, "lean-bridge/package-receipt.json")), receipt = JSON.parse(receiptBytes);
	assert.equal(receipt.kind, "lean-bridge-ordinary-rubygems-package");
	assert.equal(receipt.name, "aliases-api"); assert.equal(receipt.version, "1.0.0");
	await verifyNativeFiles(installed, receipt.files);
	const catalog = checkRubyAliasFiles(Object.fromEntries(await Promise.all(["binding-manifest.json", "README.md", "lib/lean_bridge/aliases.rb"].map(async file => [file, await readFile(join(installed, file), "utf8")]))));
	const sources = Object.fromEntries(await Promise.all(["ruby", "ruby-faults"].map(async name => [name, await readFile(`tests/fixtures/alias-consumers/${name}.rb`, "utf8")])));
	for(const [name, source] of Object.entries(sources)) await saveLakeFile(root, `${name}.rb`, source);
	await rename(original, relocated); await rm(handoff, { recursive: true, force: true });
	env = { ...copiedCleanEnvironment, GEM_HOME: relocated, GEM_PATH: relocated };
	const deployed = (await runCopied(command, locate, root, env)).stdout;
	assert.equal(deployed, join(relocated, relative(original, installed)));
	const expectedLibraries = Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.endsWith(".so")).map(([path, value]) => [path, value.sha256]));
	assert.equal(Object.keys(expectedLibraries).length, 4);
	const execute = async () => {
		const run = await runCopied(command, ["ruby.rb"], root, env); assert.equal(run.stderr, "");
		const observation = JSON.parse(run.stdout); assert.ok(observation.checks > 3000);
		assert.match(observation.ruby, /^ruby 3\.3\./); assert.equal(observation.gem_root, deployed);
		assert.equal(observation.api, join(deployed, "lib/lean_bridge/aliases.rb"));
		assert.deepEqual(observation.native_libraries, expectedLibraries); return observation;
	};
	const first = await execute();
	const result = name => projection.surface.copy(projection.surface.functions.find(fn => fn.field === name).declaration.result.type);
	assert.equal(result("echo_maybe").size, 3); assert.deepEqual(result("echo_maybe").fields.map(field => field.offset), [1]);
	assert.equal(result("echo_outcome").size, 80); assert.deepEqual(result("echo_outcome").fields.map(field => field.offset), [8, 48]);
	const indices = [result("echo_maybe"), result("echo_outcome"), result("reverse_rows").element, result("reverse_rows"), result("echo_string"), result("echo_char")].map(copy => copy.index);
	const probe = await runCopied(command, ["ruby-faults.rb", JSON.stringify(indices)], root, env); assert.equal(probe.stderr, "");
	const faults = JSON.parse(probe.stdout);
	assert.ok(faults.checks > 300); assert.equal(faults.partial_inputs, 64); assert.equal(faults.layouts, 22);
	assert.deepEqual(await execute(), first);
	assert.equal(sha256(await readFile(join(deployed, "lean-bridge/package-receipt.json"))), sha256(receiptBytes));
	await verifyNativeFiles(deployed, receipt.files);
	return { checks: first.checks, ruby: first.ruby, catalog, faults
		, nativeLibraries: first.native_libraries, installedFiles: receipt.files
		, installedReceiptSha256: sha256(receiptBytes)
		, rubySha256: sha256(await readFile(command))
		, consumerSha256: sha256(sources.ruby)
		, probeSha256: sha256(sources["ruby-faults"])
		, offlineInstall: true, compilerFreeExecution: true
		, relocatedInstallation: true
		, producerHandoffRemoved: true, publicApiOnly: true, repeatExecution: true
		, installedFilesUnchanged: true, isolatedInMemoryFaultProbe: true };
};
