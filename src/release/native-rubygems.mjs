/**
 * Package ordinary copied-value Ruby gems from verified compiled native inputs.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";
import { compiledPackageMetadata } from "../analyze/package-metadata.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { ordinaryRubyEvidence } from "../build/native-ruby-artifacts.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { generateCopiedRubyPackage } from "../backends/ruby/copied-values.mjs";
import { rubyLiteral } from "../backends/ruby/copied-assets.mjs";
import { validateOrdinaryRubySettings } from "../backends/ruby/copied-model.mjs";
import { auditManagedBindingPackage } from "../backends/managed/package-audit.mjs";

/**
 * Assemble an installable RubyGem without compiling Lean or a Ruby extension.
 *
 * @param options - Private staging, native artifacts and target settings.
 * @param options.working - Atomic release staging directory.
 * @param options.nativeRoot - Compiled native Lean component.
 * @param options.runtimeRoot - Compiled shared runtime.
 * @param options.adapterRoot - Compiled C adapter.
 * @param options.leanPrefix - Lean license notices.
 * @param options.settings - Optional gem coordinate and exact version.
 * @param options.glibcMinimumVersion - Validated native compatibility floor.
 * @param options.environment - Explicit packaging environment.
 * @param options.signal - Optional cancellation signal.
 */
export const packageOrdinaryRuby = async ({ working, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion, environment = process.env, signal }) => {
	validateOrdinaryRubySettings(settings);
	const { model, projection, evidence, receipt } = await ordinaryRubyEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const name = settings.name ?? `lean_bridge_${projection.surface.prefix}`, version = settings.version ?? model.component.version.replace("-", ".pre.");
	validateOrdinaryRubySettings({ name, version });
	const root = join(working, "packages/rubygems/package"), files = generateCopiedRubyPackage(model.bindingIr, evidence);
	auditManagedBindingPackage(model.bindingIr, files, "ruby");
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const [path, text] of Object.entries(files)) await save(path, text);
	for(const file of Object.keys(evidence.libraries))
		await copy(file === evidence.library ? join(adapterRoot, "lib", file) : file === receipt.library ? join(nativeRoot, file) : join(runtimeRoot, "lib", file), `lib/${projection.requirePath}/native/linux-x64/${file}`);
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "artifacts.json"])
		await copy(join(nativeRoot, path), `lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined) await copy(join(nativeRoot, "lake-generated-sources.json"), "lean-bridge/component/lake-generated-sources.json");
	await copy(join(adapterRoot, "native-c-adapter.json"), "lean-bridge/native-c-adapter.json");
	await copy(join(runtimeRoot, "runtime.json"), "lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "lean-bridge/licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "lean-bridge/licenses/Lean-LICENSES");
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files) await save(`lean-bridge/licenses/${path}`, bytes);
	await copy(fileURLToPath(new URL("../../LICENSE", import.meta.url)), "lean-bridge/licenses/LeanBridge-LICENSE");
	await save("lean-bridge/platform.json", canonicalJson({ profile: "native-library-v1", ruby: "3.3", platform: "x86_64-linux", glibcMinimumVersion }));
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1, kind: "lean-bridge-ordinary-rubygems-package", ecosystem: "rubygems", name, version, component: model.component, namespace: projection.namespace, requirePath: projection.requirePath, bindingIrSha256: model.bindingIrSha256, runtimeIdentity: evidence.runtimeIdentity, sourceIdentity: model.sourceIdentity, glibcMinimumVersion, files: inventory }));
	const entries = await nativeArtifactPaths(root), spec = `${name}.gemspec`, archive = `${name}-${version}-x86_64-linux.gem`;
	const metadata = compiledPackageMetadata(model.sourceIdentity);
	await save(spec, `Gem::Specification.new do |spec|
  spec.name = ${rubyLiteral(name)}
  spec.version = ${rubyLiteral(version)}
  spec.summary = ${rubyLiteral(metadata.description ?? "Compiled Lean API with generated Ruby copied-value conversions")}
  spec.authors = ${rubyLiteral(metadata.authors?.map(author => author.name) ?? ["Author not declared"])}
  spec.email = ${rubyLiteral(metadata.authors?.flatMap(author => author.email ? [author.email] : []) ?? [])}
${metadata.homepage ? `  spec.homepage = ${rubyLiteral(metadata.homepage)}\n` : ""}\
  spec.license = "Nonstandard"
  spec.date = "1970-01-01"
  spec.platform = Gem::Platform.new("x86_64-linux")
  spec.required_ruby_version = "~> 3.3.0"
  spec.files = ${rubyLiteral(entries)}
  spec.require_paths = ["lib"]
  spec.metadata = { "lean_bridge_component" => ${rubyLiteral(model.component.id)}, "lean_bridge_binding_ir_sha256" => ${rubyLiteral(model.bindingIrSha256)}${metadata.repository ? `, "source_code_uri" => ${rubyLiteral(metadata.repository)}` : ""} }
end
`);
	const env = { ...environment, SOURCE_DATE_EPOCH: "1" };
	for(const key of ["RUBYOPT", "RUBYLIB", "GEM_HOME", "GEM_PATH", "GEMRC", "RUBYGEMS_GEMDEPS", "BUNDLE_GEMFILE", "BUNDLE_PATH"]) delete env[key];
	const run = args => processBuildRunner.capture({ command: environment.LEAN_BRIDGE_RUBY ?? "ruby", args, cwd: root, env, signal });
	await run(["--disable-gems", "-e", 'abort "Ordinary gems require MRI Ruby 3.3" unless RUBY_ENGINE == "ruby" && RUBY_VERSION.start_with?("3.3.")']);
	for(const path of entries.filter(path => path.endsWith(".rb"))) await run(["--disable-gems", "-c", path]);
	await run(["--disable-gems", "-rrubygems", "-rrubygems/package", "-e", "Gem::Package.build(Gem::Specification.load(ARGV.fetch(0)), false, false, ARGV.fetch(1))", spec, archive]);
	const bytes = await readFile(join(root, archive)), hash = sha256(bytes);
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "rubygems", backend: "ordinary-ruby-v1", runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion, namespace: projection.namespace, packages: [{ archive, name, version, bytes: bytes.length, sha256: hash, compilerAccess: false }] };
};
