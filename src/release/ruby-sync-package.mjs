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
	const async = Boolean(wire?.wait), profile = o.host ? "native-ruby-host-v1" : async ? "native-ruby-task-v1" : "native-ruby-io-v1", library = "lib" + prefix + ".so", libraries = {};
	for(const path of [library, "liblean_bridge_native.so", "libleanshared.so"])
	{
		const file = "lib/" + path, bytes = files.get(file);
		if(!bytes || (path !== library && sha256(bytes) !== manifest.files[file]?.sha256)) throw new Error("Missing or inconsistent Ruby native library: " + path);
		libraries[path] = sha256(bytes);
	}
	let resourceLedger;
	if(o.host) libraries[o.host.domain] = sha256(files.get("lib/" + o.host.domain));
	if(wire?.leases?.length)
	{
		if(!/^[a-f0-9]{64}$/u.test(o.ledgerId)) throw new Error("Missing Ruby resource ledger identity");
		const path = "liblb_task_resources_" + o.ledgerId + ".so", bytes = files.get("lib/" + path);
		if(!bytes) throw new Error("Missing compiled Ruby resource ledger");
		libraries[path] = sha256(bytes); resourceLedger = { id: o.ledgerId, library: path, sha256: libraries[path] };
	}
	if(files.size !== Object.keys(libraries).length) throw new Error("Unexpected Ruby synchronous native payload");
	const source = o.host?.source ?? await generateRubySyncSources({ name, wire, ledgerId: o.ledgerId, evidence: { componentId: api.component.id, library, libraries, runtimeIdentity } });
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
		const requirements = `MRI Ruby 3.3 on Linux x86-64, glibc ${floor}+. The matching Lean runtime is included.`;
		const usage = o.host
			? `Require \`${source.requirePath}\`. Bind your Ruby classes on the original main thread:\n\n\`\`\`ruby\n${source.namespace}.bind_hosts(${o.ir.types.map(r => r.name.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase() + ": " + r.name).join(", ")}) do\n  # Call the component's methods on this fiber.\nend\n\`\`\`\n\nLean calls the public methods of the supplied classes. Matching components share identity while bound; objects retained in Lean become stale after the last binding ends. An unchanged Ruby exception is raised as the original exception. A new Lean IO failure raises the component's IOError; a thrown EIO raises DeclaredError with its declaration and payload.`
			: `Require \`${source.requirePath}\` and call \`${source.namespace}\` methods on the original process main thread. ${async ? "Tasks provide await and cancel. Pull streams provide next, each and close. Pending operations park through Ruby IO and honor a fiber scheduler. Close abandoned work or use with/each for deterministic cleanup." : "No compiler or event loop is needed."} An IO failure raises IOError with its declaration; a thrown EIO raises DeclaredError with its declaration and payload. An Except returned normally is an Ok or Err value.`;
		const workers = o.host && async ? "\n\nClass-bearing tasks and streams belong to the fiber that entered bind_hosts. Use task.await or stream.each inside that block. The worker carries the object; only the Ruby fiber invokes its callback. Leaving the block cancels unfinished deliveries without closing a peer component's binding." : "";
		await save("README.md", `# ${name}\n\n${usage}${workers}\n\n${requirements}\n`);
		await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1
			, kind: o.host ? "lean-bridge-native-ruby-host" : async ? "lean-bridge-native-ruby-task" : "lean-bridge-native-ruby-io"
			, profile, name, version
			, component: api.component, componentIdentity, bindingIrSha256
			, sourceTreeSha256: projectContract.sourceTreeSha256
			, runtimeIdentity, namespace: source.namespace
			, ...resourceLedger ? { resourceLedger } : {}
			, requirePath: source.requirePath, glibcMinimumVersion: floor
			, ruby: "3.3", platform: "x86_64-linux", files: inventory }));
		const pkg = await buildRubyPlatformGem({ working: workRoot
			, root, name, version
			, environment: o.environment, signal: o.signal, componentId: api.component.id
			, bindingIrSha256, metadata: projectContract.metadata ?? {}
			, summary: async ? "Compiled Lean tasks and pull streams for Ruby" : "Synchronous compiled Lean IO for Ruby" });
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
