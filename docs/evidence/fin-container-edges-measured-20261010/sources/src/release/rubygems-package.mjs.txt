/**
 * Implements the RubyGems package module in the release subsystem.
 *
 * @file
 */

import { execFile } from "node:child_process";
import { rename, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import {
	copy,
	coreProjection,
	json,
	prepareManagedPackage,
	readBindingManifest,
	sha256,
	writeProjectionPlan,
} from "./managed-registry-package.mjs";

const execute = promisify(execFile);
const rubyString = value => JSON.stringify(value);

/**
 * Builds ruby gems package from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to build ruby gems package.
 * @param root0.bundleRoot - Filesystem root containing the bundle.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.gemCommand - RubyGems executable used to build the deterministic gem archive.
 */
export const buildRubyGemsPackage = async ({ bundleRoot, outputRoot, gemCommand = process.env.LEAN_BRIDGE_GEM ?? "gem" }) => {
	const prepared = await prepareManagedPackage({ bundleRoot, outputRoot, ecosystem: "rubygems", targetId: "ruby" });
	const { output, bundle, manifest, manifestSha256, mapping, selected } = prepared;
	const binding = await readBindingManifest({ bundle, targetId: "ruby" });
	if(binding.bindingIrSha256 !== manifest.bindingIr.semanticSha256) throw new Error("Ruby binding identity differs from the canonical Binding IR");
	const root = join(output, "package");
	const packagePath = artifact => {
		if(artifact.path.startsWith("bindings/ruby/")) return artifact.path.slice("bindings/ruby/".length);
		if(artifact.path.startsWith("artifacts/native/lib/")) return `lib/lean_bridge/native/linux-x64/${basename(artifact.path)}`;
		return `lean-bridge/${artifact.path}`;
	};
	for(const artifact of selected)
	{
		if(artifact.path === "bindings/ruby/lean_bridge_alpha.gemspec") continue;
		await copy(join(bundle, artifact.path), join(root, packagePath(artifact)));
	}
	await writeFile(join(root, "lean-bridge/package-receipt.json"), json({ schemaVersion: 1, ecosystem: "rubygems", component: manifest.component.id, canonicalManifestSha256: manifestSha256 }));
	const packagedFiles = [
		...binding.files.filter(path => path !== "lean_bridge_alpha.gemspec")
		, "lib/lean_bridge/native/linux-x64/liblean_alpha_component.so"
		, "lib/lean_bridge/native/linux-x64/liblean_beta_component.so"
		, "lib/lean_bridge/native/linux-x64/liblean_bridge_native.so"
		, "lean-bridge/package-receipt.json"
	].sort();
	const date = new Date(manifest.provenance.sourceDateEpoch * 1000).toISOString().slice(0, 10);
	await writeFile(join(root, "lean_bridge_alpha.gemspec"), `Gem::Specification.new do |spec|\n  spec.name = ${rubyString(mapping.name)}\n  spec.version = ${rubyString(mapping.version)}\n  spec.summary = ${rubyString(`Generated Ruby bindings for ${manifest.component.name}`)}\n  spec.authors = ["Lean Bridge"]\n  spec.license = ${rubyString(manifest.licenses.expression)}\n  spec.homepage = ${rubyString(manifest.source.repository)}\n  spec.date = ${rubyString(date)}\n  spec.files = ${JSON.stringify(packagedFiles)}\n  spec.require_paths = ["lib"]\n  spec.required_ruby_version = ">= 3.3"\n  spec.metadata = { "lean_bridge_component" => ${rubyString(manifest.component.id)}, "lean_bridge_manifest_sha256" => ${rubyString(manifestSha256)} }\nend\n`);
	const filename = `${mapping.name}-${mapping.version}.gem`;
	await execute(gemCommand, ["build", "lean_bridge_alpha.gemspec", "--output", filename], { cwd: root, env: { ...process.env, SOURCE_DATE_EPOCH: String(manifest.provenance.sourceDateEpoch) } });
	const archivePath = join(output, filename);
	await rename(join(root, filename), archivePath);
	const archive = await import("node:fs/promises").then(module => module.readFile(archivePath));
	const coreArtifacts = coreProjection({ selected, packagePath });
	await writeProjectionPlan({ output, backend: "rubygems-v1", ecosystem: "rubygems", manifest, manifestSha256, coreArtifacts, commands: [`${basename(gemCommand)} build package.gemspec`] });
	return Object.freeze({ package: `${mapping.name}@${mapping.version}`, output, archive: archivePath, archiveSha256: sha256(archive), canonicalManifestSha256: manifestSha256, coreArtifacts: Object.freeze(coreArtifacts) });
};
