/**
 * Source-free RubyGems containing authenticated owned-value APIs and native code.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";
import { rubyPackageLicense } from "../analyze/package-license.mjs";
import { generateOwnedRubyPackage } from "../backends/ruby/owned-package.mjs";
import { validateOrdinaryRubySettings } from "../backends/ruby/copied-model.mjs";
import { rubyLiteral } from "../backends/ruby/copied-assets.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { ownedRubyEvidence } from "../build/owned-ruby-artifacts.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";

/**
 * Reverify all producer inputs, then assemble a gem with no install-time build.
 *
 * @param options - Artifact roots, gem coordinates and producer environment.
 */
export const packageOwnedRuby = async options => {
	const { working, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion, environment = process.env, signal } = options;
	validateOrdinaryRubySettings(settings);
	if(!/^2\.\d+$/u.test(glibcMinimumVersion)) throw new TypeError("Invalid Ruby native glibc floor");
	const { model, evidence, adapter, receipt, libraryPaths } = await ownedRubyEvidence(options);
	const transferredInputs = Boolean(model.ownedGraph.inputTransfers);
	const generated = generateOwnedRubyPackage(model.bindingIr, evidence, { transferredInputs }), prefix = generated.c.prefix;
	const name = settings.name ?? `lean_bridge_${prefix}`, version = settings.version ?? model.component.version.replace("-", ".pre.");
	validateOrdinaryRubySettings({ name, version });
	const root = join(working, "packages/rubygems/package");
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const [path, source] of Object.entries(generated.files)) await save(path, source);
	for(const [name, path] of Object.entries(libraryPaths))
		await copy(path, `lib/${generated.requirePath}/native/linux-x64/${name}`);
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json", "callbacks.c"])
		await copy(join(nativeRoot, path), `lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined)
	{
		const bytes = await readFile(join(nativeRoot, "lake-generated-sources.json"));
		if(sha256(bytes) !== receipt.sourceIdentity.lakeDependencies.generatedSourcesSha256) throw new Error("Owned Ruby generated Lean inputs differ from compilation");
		await save("lean-bridge/component/lake-generated-sources.json", bytes);
	}
	await copy(join(adapterRoot, "native-ruby-adapter.json"), "lean-bridge/native-ruby-adapter.json");
	for(const path of Object.keys(adapter.files).filter(path => !path.startsWith("lib/") && !path.startsWith("gmp/lib/")))
		await copy(join(adapterRoot, path), `lean-bridge/adapter/${path}`);
	await copy(join(runtimeRoot, "runtime.json"), "lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "lean-bridge/licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "lean-bridge/licenses/Lean-LICENSES");
	await copy(new URL("../../LICENSE", import.meta.url), "lean-bridge/licenses/LeanBridge-LICENSE");
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files)
		await save(`lean-bridge/licenses/${path}`, bytes);
	await save("lean-bridge/platform.json", canonicalJson({ profile: "native-library-v1", ruby: "3.3", platform: "x86_64-linux", glibcMinimumVersion }));
	const files = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: transferredInputs ? 2 : 1
		, kind: "lean-bridge-owned-rubygems-package"
		, ecosystem: "rubygems", name, version, component: model.component
		, namespace: generated.namespace, requirePath: generated.requirePath
		, bindingIrSha256: model.bindingIrSha256
		, runtimeIdentity: evidence.runtimeIdentity
		, sourceIdentity: model.sourceIdentity, glibcMinimumVersion
		, ownedValues: generated.contract, files }));
	const entries = await nativeArtifactPaths(root), spec = `${name}.gemspec`, archive = `${name}-${version}-x86_64-linux.gem`;
	const metadata = compiledPackageMetadata(model.sourceIdentity);
	await save(spec, `Gem::Specification.new do |spec|
  spec.name = ${rubyLiteral(name)}
  spec.version = ${rubyLiteral(version)}
  spec.summary = ${rubyLiteral(metadata.description ?? "Compiled Lean API with checked resource-bearing values")}
  spec.authors = ${rubyLiteral(metadata.authors?.map(author => author.name) ?? ["Author not declared"])}
  spec.email = ${rubyLiteral(metadata.authors?.flatMap(author => author.email ? [author.email] : []) ?? [])}
${metadata.homepage ? `  spec.homepage = ${rubyLiteral(metadata.homepage)}\n` : ""}\
  spec.license = ${rubyLiteral(rubyPackageLicense(metadata.license))}
  spec.date = "1970-01-01"
  spec.platform = Gem::Platform.new("x86_64-linux")
  spec.required_ruby_version = "~> 3.3.0"
  spec.files = ${rubyLiteral(entries)}
  spec.require_paths = ["lib"]
  spec.metadata = { ${metadata.license ? `"spdx_expression" => ${rubyLiteral(metadata.license)}, ` : ""}"lean_bridge_component" => ${rubyLiteral(model.component.id)}, "lean_bridge_binding_ir_sha256" => ${rubyLiteral(model.bindingIrSha256)}${metadata.repository ? `, "source_code_uri" => ${rubyLiteral(metadata.repository)}` : ""} }
end
`);
	const env = { ...environment, SOURCE_DATE_EPOCH: "1" };
	for(const key of ["RUBYOPT", "RUBYLIB", "GEM_HOME", "GEM_PATH", "GEMRC", "RUBYGEMS_GEMDEPS", "BUNDLE_GEMFILE", "BUNDLE_PATH"]) delete env[key];
	const run = args => processBuildRunner.capture({ command: environment.LEAN_BRIDGE_RUBY ?? "ruby", args, cwd: root, env, signal });
	await run(["--disable-gems", "-e", 'abort "Owned gems require MRI Ruby 3.3" unless RUBY_ENGINE == "ruby" && RUBY_VERSION.start_with?("3.3.")']);
	for(const path of entries.filter(path => path.endsWith(".rb"))) await run(["--disable-gems", "-c", path]);
	await run(["--disable-gems", "-rrubygems", "-rrubygems/package", "-e", "Gem::Package.build(Gem::Specification.load(ARGV.fetch(0)), false, false, ARGV.fetch(1))", spec, archive]);
	const bytes = await readFile(join(root, archive));
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "rubygems"
		, backend: transferredInputs ? "owned-ruby-v2" : "owned-ruby-v1"
		, runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion
		, namespace: generated.namespace, requirePath: generated.requirePath
		, packages: [{ archive, name, version, bytes: bytes.length, sha256: sha256(bytes), compilerAccess: false }] };
};
