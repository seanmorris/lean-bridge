/**
 * Assemble an installable Ruby IO gem from the verified native component.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateRubySyncSources } from "../backends/ruby/sync-io.mjs";
import { buildRubyPlatformGem } from "./native-rubygems.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

/**
 * Package the application with its matching runtime, licenses and elaboration receipt.
 *
 * @param o - Pinned compiler evidence, wire entry descriptors and checked ELF bytes.
 */
export const writeRubySyncRelease = async o => {
	const { workRoot, name, version, prefix, wire, files, api, evidence, manifest, runtimeIdentity, componentIdentity, bindingIrSha256, floor, projectContract } = o;
	const profile = "native-ruby-io-v1", library = "lib" + prefix + ".so", libraries = {};
	for(const path of [library, "liblean_bridge_native.so", "libleanshared.so"])
	{
		const file = "lib/" + path, bytes = files.get(file);
		if(!bytes || (path !== library && sha256(bytes) !== manifest.files[file]?.sha256)) throw new Error("Missing or inconsistent Ruby native library: " + path);
		libraries[path] = sha256(bytes);
	}
	if(files.size !== Object.keys(libraries).length) throw new Error("Unexpected Ruby synchronous native payload");
	const source = await generateRubySyncSources({ name, wire, evidence: { componentId: api.component.id, library, libraries, runtimeIdentity } });
	const root = await mkdtemp(join(workRoot, ".ruby-io-"));
	try
	{
		const inventory = {};
		const save = async (path, value) => {
			await mkdir(dirname(join(root, path)), { recursive: true });
			await writeFile(join(root, path), value, { flag: "wx" });
			inventory[path] = { bytes: Buffer.byteLength(value), sha256: sha256(value) };
		};
		for(const [path, value] of Object.entries(source.files)) await save(path, value);
		for(const lib of Object.keys(libraries)) await save(`lib/${source.requirePath}/native/linux-x64/${lib}`, files.get("lib/" + lib));
		await save("lean-bridge/binding-ir.json", canonicalJson(api));
		await save("lean-bridge/elaboration.json", canonicalJson(evidence));
		await save("lean-bridge/runtime.json", canonicalJson(manifest));
		await save("lean-bridge/licenses/LeanBridge-LICENSE", await readFile(new URL("../../LICENSE", import.meta.url)));
		for(const f of ["LICENSE", "LICENSES"]) await save("lean-bridge/licenses/Lean-" + f, await readFile(join(o.leanPrefix, f)));
		for(const [path, b] of Object.entries(projectContract.notices)) await save("lean-bridge/licenses/" + path, b);
		await save("README.md", `# ${name}\n\nRequire \`${source.requirePath}\` and call \`${source.namespace}\` methods on the original process main thread. No compiler or event loop is needed. An IO failure raises IOError with its declaration; a thrown EIO raises DeclaredError with its declaration and payload. An Except returned normally is an Ok or Err value. MRI Ruby 3.3 on Linux x86-64, glibc ${floor}+. The matching Lean runtime is included.\n`);
		await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1
			, kind: "lean-bridge-native-ruby-io", profile, name, version
			, component: api.component, componentIdentity, bindingIrSha256
			, sourceTreeSha256: projectContract.sourceTreeSha256
			, runtimeIdentity, namespace: source.namespace
			, requirePath: source.requirePath, glibcMinimumVersion: floor
			, ruby: "3.3", platform: "x86_64-linux", files: inventory }));
		const pkg = await buildRubyPlatformGem({ working: workRoot
			, root, name, version
			, environment: o.environment, signal: o.signal, componentId: api.component.id
			, bindingIrSha256, metadata: projectContract.metadata ?? {}
			, summary: "Synchronous compiled Lean IO for Ruby" });
		const receipt = await writePackageSetReceipt({ root: workRoot
			, component: api.component
			, source: { treeSha256: projectContract.sourceTreeSha256 }
			, profiles: [{ id: profile, bindingIrSha256, runtimeIdentity }]
			, signal: o.signal
			, packages: [{ target: "rubygems", ecosystem: "rubygems"
				, name, version, profile, role: "component", runtimeIdentity
				, runtimeDelivery: "embedded", requires: []
				, artifacts: [{ path: "archives/" + pkg.archive, bytes: pkg.bytes, sha256: pkg.sha256 }] }] });
		return { receipt, api, evidence, bindingIrSha256, runtimeIdentity };
	} finally
	{ await rm(root, { recursive: true, force: true }); }
};
