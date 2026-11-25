/**
 * Package the verified synchronous, task or host-object adapter as two ordinary Cargo
 * crates: a component and its exact, content-addressed shared runtime.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { cargoPackageMetadata } from "../analyze/package-metadata.mjs";
import { generateRustTaskSources } from "../backends/rust/task-crate.mjs";
import { rustHostFacade } from "../backends/rust/host-facade.mjs";
import { copiedRustAssets } from "../backends/rust/copied-assets.mjs";
import { retainedTask } from "../backends/c/task-callback-exports.mjs";
import { validateOrdinaryCargoSettings } from "../backends/rust/copied-model.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";
import { createDeterministicTarGzFromFiles } from "./deterministic-archive.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

const runtimeName = "lean-bridge-task-runtime", taskProfile = "native-rust-task-v1", ioProfile = "native-rust-io-v1", hostProfile = "native-rust-host-v1";
const asset = path => readFile(new URL("../backends/rust/" + path, import.meta.url));
const inventory = files => Object.fromEntries([...files].map(([name, b]) => [name, { bytes: Buffer.byteLength(b), sha256: sha256(b) }]));
const pack = (files, name, version) => {
	const root = name + "-" + version, path = "archives/" + root + ".crate";
	const data = createDeterministicTarGzFromFiles({ sourceDateEpoch: 1
		, files: [...files].map(([f, v]) => ({ path: root + "/" + f, bytes: Buffer.from(v), mode: 0o644 })) });
	return { data, record: { path, bytes: data.length, sha256: sha256(data) } };
};
const pkg = (name, version, profile, role, record, runtimeIdentity, requires = []) => ({
	target: "cargo", ecosystem: "cargo", name, version
	, profile, role, runtimeIdentity
	, runtimeDelivery: role === "runtime" ? "provided" : "dependency"
	, requires, artifacts: [record]
});
const put = async (root, files) => {
	for(const [path, data] of files)
	{
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), data, { flag: "wx" });
	}
};
const seed = 'name = "lean-bridge-task-runtime"\nversion = "0.1.0"';
const withVersion = (source, before, after) => {
	if(source.split(before).length !== 2) throw new Error("Unexpected task crate coordinates in a checked template");
	return source.replace(before, after);
};

/**
 * Compile-check the two generated Cargo crates before issuing their exact release receipt.
 *
 * @param o - Checked component, runtime bytes, provenance, Cargo coordinates and toolchain.
 */
export const writeRustTaskRelease = async o => {
	const { workRoot, environment, signal, projectContract, name, version, prefix, files, entries, api, evidence, floor, gen, manifest, runtimeIdentity, bindingIrSha256, componentIdentity } = o;
	const host=o.host, synchronous = Boolean(host) || projectContract.synchronousIO === true, profile = host ? hostProfile : synchronous ? ioProfile : taskProfile;
	validateOrdinaryCargoSettings({ name, version });
	if(name.replaceAll("_", "-") === runtimeName || ["num-bigint", "sha2", "async-io", "futures-core"].includes(name.replaceAll("_", "-")))
		throw new Error("Rust task crate name conflicts with its dependencies");
	const native = name => "native/linux-x64/" + name, lib = "lib" + prefix + ".so";
	const libraries = Object.fromEntries([...files].filter(([p]) => p.startsWith("lib/")).map(([p, b]) => [p.slice(4), sha256(b)]));
	for(const n of [lib, "libleanshared.so", "liblean_bridge_native.so"]) if(!libraries[n]) throw new Error("Missing Rust task library " + n);
	for(const n of ["libleanshared.so", "liblean_bridge_native.so"])
		if(libraries[n] !== manifest.files["lib/" + n]?.sha256) throw new Error("Rust task shared library differs from its runtime");
	const common = new Map(), app = new Map(), leanLicense = "lean-bridge/licenses/";
	for(const [n, b] of files)
	{
		if(!n.startsWith("lib/")) throw new Error("Unexpected Rust native payload " + n);
		const f = n.slice(4);
		if(f !== lib && !["liblean_bridge_native.so", "libleanshared.so"].includes(f) && !(host ? f===host.domain && /^liblb_rust_host_domain_[0-9a-f]{64}\.so$/u.test(f) : /^liblb_task_resources_[0-9a-f]{64}\.so$/u.test(f))) throw new Error("Unexpected Rust native dependency " + f);
		(["liblean_bridge_native.so", "libleanshared.so"].includes(f) ? common : app).set(native(f), b);
	}
	const supportManifest = (await asset("task-runtime/Cargo.toml")).toString(), supportLock = (await asset("task-runtime/Cargo.lock")).toString();
	common.set("src/lib.rs", (await asset("task-runtime/src/lib.rs")).toString() + '\n#[doc(hidden)] pub mod __assets { pub static LEAN:&[u8]=include_bytes!("../native/linux-x64/libleanshared.so"); pub static BROKER:&[u8]=include_bytes!("../native/linux-x64/liblean_bridge_native.so"); }\n');
	common.set("src/resource.rs", await asset("task-runtime/src/resource.rs"));
	common.set("src/callback.rs", await asset("task-runtime/src/callback.rs"));
	common.set("src/delivery.rs", await asset("task-runtime/src/delivery.rs"));
	for(const file of ["owner.rs","port.rs"]) common.set("src/"+file,await asset("task-runtime/src/"+file));
	common.set("lean-bridge/runtime.json", canonicalJson(manifest));
	common.set("README.md", "Shared Linux x86-64 Lean runtime, resource identity and errors. Cargo selects this crate through your component's exact dependency. Only task components request the async feature for executor-independent task and stream delivery.\n");
	const license = await readFile(new URL("../../LICENSE", import.meta.url));
	common.set(leanLicense + "LeanBridge-LICENSE", license); app.set(leanLicense + "LeanBridge-LICENSE", license);
	for(const f of ["LICENSE", "LICENSES"]) common.set(leanLicense + "Lean-" + f, await readFile(join(o.leanPrefix, f)));
	for(const [path, b] of Object.entries(projectContract.notices)) app.set(leanLicense + path, b);
	// All three profiles must produce the same provider bytes and coordinate.
	// The v1 inner receipt identified just one profile; v2 names the full set.
	const descriptor = { schemaVersion: 2, role: "runtime", profiles: [ioProfile, taskProfile, hostProfile], runtimeIdentity };
	const supportId = sha256(canonicalJson({ descriptor, files: inventory(common), manifest: sha256(supportManifest), lock: sha256(supportLock) }));
	const runtimeVersion = "1.0.0-r" + supportId, final = `name = "${runtimeName}"\nversion = "${runtimeVersion}"`;
	common.set("Cargo.toml", withVersion(supportManifest, seed, final)); common.set("Cargo.lock", withVersion(supportLock, seed, final));
	common.set("lean-bridge/package-receipt.json", canonicalJson({ ...descriptor, supportId, files: inventory(common) }));
	const provider = pack(common, runtimeName, runtimeVersion);
	const assets={ runtimeIdentity, library: lib, libraries };
	const generated = host ? {"src/lib.rs": rustHostFacade({...host,entries,prefix,embedded: true}),"src/assets.rs": copiedRustAssets(assets,{task: true})}
		: await generateRustTaskSources({ prefix, entries, synchronousIO: synchronous, resources: api.types.filter(t => t.kind === "resource"), evidence: assets });
	for(const [f, s] of Object.entries(generated)) app.set(f, s);
	const metadata = cargoPackageMetadata({ description: synchronous ? "Synchronous compiled Lean IO" : "Compiled Lean tasks and pull streams", ...projectContract.metadata });
	const dependency = synchronous ? `{ version = "=${runtimeVersion}", default-features = false${host?', features = ["host-objects"]':""} }` : `"=${runtimeVersion}"`;
	app.set("Cargo.toml", `[package]\nname = "${name}"\nversion = "${version}"\nedition = "2021"\nrust-version = "1.90"\n${metadata}\nreadme = "README.md"\n[dependencies]\nnum-bigint = "=0.4.6"\nsha2 = "=0.10.9"\n${runtimeName} = ${dependency}\n`);
	const baseLock = withVersion((await asset(synchronous ? "sync-component.lock" : "task-component.lock")).toString(), 'name = "lean-bridge-task-placeholder"\nversion = "0.0.0"', `name = "${name}"\nversion = "${version}"`);
	const localLock = withVersion(baseLock, seed, final);
	app.set("Cargo.lock", withVersion(baseLock, seed, final + `\nsource = "registry+https://github.com/rust-lang/crates.io-index"\nchecksum = "${provider.record.sha256}"`));
	if(synchronous) app.set("README.md", `# ${name}\n\nLinux x86-64, glibc ${floor}+, Rust 1.90+. Cargo supplies the exact runtime with async delivery disabled. Call functions directly on the process main thread; no executor is required. A returned Except is an ordinary nested Result. CallError::Declared carries the throwing EIO declaration and payload. CallError::Io carries a Lean IO failure's declaration and message; CallError::Boundary reports invalid arguments or runtime faults. Do not reuse a warmed native runtime after fork.\n`);
	else app.set("README.md", `# ${name}\n\nLinux x86-64, glibc ${floor}+, Rust 1.90+. Cargo supplies the runtime automatically. Use a current-thread executor on the process main thread. Await the returned Task; drop it to cancel without blocking. A stream pulls only on demand. Call next().await or use the futures Stream trait. Returned Except values stay Rust Results; declared factory and step failures are Error::Start and Error::Step. IO errors carry the declaring function and message. Never reuse native state in a forked child.\n`);
	if(entries.some(retainedTask)) app.set("README.md", app.get("README.md") + "\nCallback-taking tasks accept Rust closures that return Result<Reply, CallbackError>. The executor runs closures on the main thread, even during factory initialization. Await the task for typed factory rejection, IO or declared terminal IO failure. An unchanged callback error retains its Rust identity. Drop or cancel the task to release all callback captures; RetainedCallback also permits explicit close. An unwinding Rust callback panic retires the native runtime.\n");
	if(entries.some(e => e.taskIO && !retainedTask(e))) app.set("README.md", app.get("README.md") + "\nA task declaring terminal IO errors without a callback uses ordinary Task<T>. Its factory can fail immediately; a later task failure is Fault::TaskIo on await. No callback queue is allocated.\n");
	app.set("lean-bridge/binding-ir.json", canonicalJson(api)); app.set("lean-bridge/elaboration.json", canonicalJson(evidence));
	if(host)
	{
		app.set("lean-bridge/host-imports.json",projectContract.hostImportsSource);
		app.set("README.md","# "+name+"\n\nLinux x86-64, glibc "+floor+"+, Rust 1.90+. Add this crate normally; Cargo supplies the exact shared runtime. Use bind_objects!(MyHost { "+host.model.kinds.map(k=>k.name+"=Your"+k.name).join(", ")+" }); then Binding::<MyHost>::new() on the process main thread. The macro forwards to your inherent methods. Use Rc for application-owned objects. A member may return its value or MemberResult<T>. HostCallError::Host preserves the original Rc<dyn Error>; Declared and Io are distinct errors; a returned Lean Except remains Result data. A panic retires the runtime. Call close or drop the binding on its owner thread. No Lean compiler, native link flags or executor are required.\n");
	}
	app.set("lean-bridge/generated.lean", gen.entryLean); app.set("lean-bridge/adapter.h", gen.header);
	app.set("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1, role: "component", profile, name, version, componentIdentity, bindingIrSha256, runtimeIdentity, supportId, glibcMinimumVersion: floor, files: inventory(app) }));
	const stage = await mkdtemp(join(workRoot, ".cargo-task-"));
	try
	{
		const root = join(stage, "component"), runtime = join(stage, "runtime");
		await put(runtime, common); await put(root, new Map([...app, ["Cargo.lock", localLock]]));
		const env = { ...environment, RUSTC: environment.LEAN_BRIDGE_RUSTC ?? "rustc", CARGO_TARGET_DIR: join(stage, "check"), CARGO_BUILD_JOBS: "1" };
		for(const key of ["RUSTFLAGS", "CARGO_ENCODED_RUSTFLAGS", "RUSTC_WRAPPER", "RUSTC_WORKSPACE_WRAPPER", "CARGO_BUILD_TARGET"]) delete env[key];
		const run = (command, args) => processBuildRunner.capture({ command, args, cwd: root, env, signal });
		if(!/^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /u.test((await run(env.RUSTC, ["--version"])).stdout)) throw new Error("Rust tasks require Rust 1.90 or newer");
		await run(environment.LEAN_BRIDGE_CARGO ?? "cargo", ["check", "-j1", "--locked", "--target", "x86_64-unknown-linux-gnu", "--config", 'patch.crates-io.' + runtimeName + '.path=' + JSON.stringify(runtime)]);
	} finally
	{
		await rm(stage, { recursive: true, force: true });
	}
	const component = pack(app, name, version);
	for(const archive of [provider, component]) await writeFile(join(workRoot, archive.record.path), archive.data, { flag: "wx" });
	const receipt = await writePackageSetReceipt({ root: workRoot
		, component: projectContract.component
		, source: { treeSha256: projectContract.sourceTreeSha256 }, signal
		, profiles: [{ id: profile, bindingIrSha256, runtimeIdentity }]
		, packages: [pkg(runtimeName, runtimeVersion, profile, "runtime", provider.record, runtimeIdentity)
			, pkg(name, version, profile, "component", component.record, runtimeIdentity, [{ ecosystem: "cargo", name: runtimeName, version: runtimeVersion }])] });
	return { receipt, api, evidence, bindingIrSha256, runtimeIdentity };
};
