/**
 * Install verified Cargo archives through a checksum-bearing directory
 * registry, compile offline, then run with neither a registry nor a compiler.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { readVerifiedPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";

const exec = promisify(execFile);
const json = async p => JSON.parse(await readFile(p));
const run = async (cmd, args, cwd, env) => {
	try
	{ return (await exec(cmd, args, { cwd, env, timeout: 600_000, maxBuffer: 8 * 1024 ** 2 })).stdout; }
	catch(e)
	{ throw new Error([e.message, e.stdout, e.stderr].join("\n"), { cause: e }); }
};
const index = "registry+https://github.com/rust-lang/crates.io-index";
const checksum = async (dir, prefix = "") => {
	const files = {};
	for(const d of await readdir(join(dir, prefix), { withFileTypes: true }))
	{
		const p = prefix + d.name;
		if(d.isDirectory()) Object.assign(files, await checksum(dir, p + "/"));
		else
		{ assert.ok(d.isFile(), p); files[p] = sha256(await readFile(join(dir, p))); }
	}
	return files;
};
/**
 * Verify an archive and populate Cargo's on-disk directory registry.
 *
 * @param vendor - Fresh local registry.
 * @param name - Crate name from the verified receipt or lock.
 * @param version - Exact Cargo version.
 * @param archive - Source archive path.
 * @param sum - Expected archive SHA-256.
 * @param env - Extraction tool environment.
 */
const install = async (vendor, name, version, archive, sum, env) => {
	const root = join(vendor, name + "-" + version);
	assert.equal(sha256(await readFile(archive)), sum, archive);
	await mkdir(root);
	await run("tar", ["-xzf", archive, "--strip-components=1", "-C", root], vendor, env);
	const files = await checksum(root);
	await writeFile(join(root, ".cargo-checksum.json"), canonicalJson({ files, package: sum }), { flag: "wx" });
	return root;
};
/**
 * Read package coordinates and archive checksums from the generated Cargo lock.
 *
 * @param lock - Generated Cargo.lock text.
 */
const dependencies = lock => lock.split("[[package]]").slice(1).map(s => Object.fromEntries(
	[...s.matchAll(/^(name|version|source|checksum) = "([^"\n]+)"$/gmu)].map(m => [m[1], m[2]])));
export { install as installVerifiedRustCrate, dependencies as rustLockPackages };

// Swap only the dependency aliases. In particular, do not rewrite the
// consumer source, either crate, its public declarations, or the lock file.
const appManifest = (primary, peer) => [
	"[package]"
	, 'name="rust-task-app"'
	, 'version="1.0.0"'
	, 'edition="2021"'
	, "[dependencies]"
	, 'task-lab={package="' + primary + '",version="=1.0.0"}'
	, 'task-lab-peer={package="' + peer + '",version="=1.0.0"}'
	, 'futures-core="0.3"', "[profile.dev]", "debug=0", "incremental=false", ""
].join("\n");

const ownerPackages = metadata => {
	const root = metadata.resolve.nodes.find(n => n.id === metadata.resolve.root);
	return Object.fromEntries(root.deps.filter(d => ["task_lab","task_lab_peer"].includes(d.name))
		.map(d => [d.name, metadata.packages.find(p => p.id === d.pkg).name]));
};

/**
 * Collect evidence from a relocated executable built from an offline registry.
 *
 * @param options - Scratch directory, retained release set and Rust toolchain.
 */
export const runInstalledRustTasks = async options => {
	const { root, kept, environment, parkedClient, swapPrimary } = options;
	const fx = join(kept, "client");
	const work = await mkdtemp(join(root, "installed-")), vendor = join(work, "registry"), client = join(work, "client");
	const cargo = environment.LEAN_BRIDGE_CARGO ?? "cargo", rustc = environment.LEAN_BRIDGE_RUSTC ?? "rustc";
	await mkdir(vendor); await mkdir(join(client, "src"), { recursive: true });
	const reports = [], pkgs = new Map();
	for(const route of ["ordinary", "reviewed"])
	{
		const handoff = join(kept, route, "handoff"), api = await json(join(handoff, "binding-ir.json"));
		const checks = await readVerifiedPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const { receipt, result } = checks;
		assert.equal(result.archives, 2); assert.equal(receipt.profiles[0].id, "native-rust-task-v1");
		const src = await json(join(handoff, "host-export-evidence.json")); assert.equal(Boolean(src.reviewedSourceSha256), route === "reviewed");
		if(api.types.some(t => t.kind === "callback"))
		{
			assert.equal(src.selection.rustTaskCallbacks, true);
			assert.equal(src.selection.pythonTaskCallbacks, undefined);
			assert.ok(api.errors.some(e => e.id === "error:RustCallbackError"));
			assert.ok(!api.errors.some(e => e.id === "error:PythonHostException"));
			const twice = api.declarations.find(d => d.source.declaration === "Lab.cbRepeatCall");
			assert.equal(twice.parameters[1].lifetime.scope, "explicit");
			assert.equal(twice.parameters[1].ownership, "lease");
			assert.equal(twice.resultMode, "promise");
			assert.deepEqual(new Set(twice.failure.errors), new Set(["error:TaskIO.Error", "error:RustCallbackError"]));
			const recover = api.declarations.find(d => d.source.declaration === "Lab.cbRecover");
			assert.equal(recover.result.type.constructor, "result"); assert.equal(recover.failure.mode, "none");
		}
		const sourceRoot = join(kept, route, "source");
		const original = await checksum(sourceRoot);
		const tree = Object.keys(original).sort((a, b) => a.localeCompare(b)).map(p => original[p] + "  " + p + "\n").join("");
		assert.equal(sha256(tree), receipt.source.treeSha256);
		assert.equal(hashBindingIr(api), receipt.profiles[0].bindingIrSha256);
		assert.equal(src.sourceTreeSha256, receipt.source.treeSha256);
		assert.equal(src.configurationSha256, sha256(canonicalJson(await json(join(sourceRoot, "lean-bridge.exports.json")))));
		if(route === "reviewed") assert.equal(src.reviewedSourceSha256, original["lab.binding-ir.json"]);
		let component, runtime;
		for(const p of receipt.packages)
		{
			const a = p.artifacts[0]; assert.equal(p.artifacts.length, 1);
			let spec = pkgs.get(p.name);
			if(spec)
			{ assert.equal(p.role, "runtime"); assert.equal(a.sha256, spec.archive.sha256); assert.equal(p.version, spec.version); }
			else
			{
				const dir = await install(vendor, p.name, p.version, join(handoff, a.path), a.sha256, environment);
				spec = { name: p.name, version: p.version, dir, archive: a, meta: await json(join(dir, "lean-bridge/package-receipt.json")) };
				const sums = (await json(join(dir, ".cargo-checksum.json"))).files;
				const files = Object.keys(sums).filter(f => f !== "lean-bridge/package-receipt.json").sort();
				assert.deepEqual(Object.keys(spec.meta.files).sort(), files);
				for(const f of files) assert.equal(spec.meta.files[f].sha256, sums[f]);
				pkgs.set(p.name, spec);
			}
			assert.equal(p.runtimeIdentity, spec.meta.runtimeIdentity);
			if(p.role === "component")
			{
				component = spec; assert.equal(spec.name, route === "reviewed" ? "task-lab-peer" : "task-lab");
				assert.deepEqual(await json(join(spec.dir, "lean-bridge/binding-ir.json")), api);
				assert.deepEqual(await json(join(spec.dir, "lean-bridge/elaboration.json")), src);
			}
			else runtime = spec;
		}
		assert.equal(runtime.name, "lean-bridge-task-runtime");
		assert.equal(component.meta.supportId, runtime.meta.supportId);
		assert.equal(runtime.version, "1.0.0-r" + runtime.meta.supportId);
		assert.equal(component.meta.bindingIrSha256, receipt.profiles[0].bindingIrSha256);
		reports.push({ route, receiptSha256: result.receiptSha256
			, bindingIrSha256: component.meta.bindingIrSha256
			, sourceTreeSha256: receipt.source.treeSha256
			, componentIdentity: component.meta.componentIdentity
			, componentArchive: component.archive, runtimeVersion: runtime.version
			, runtimeArchive: runtime.archive });
	}
	assert.notEqual(reports[0].componentIdentity, reports[1].componentIdentity); assert.equal(reports[0].bindingIrSha256, reports[1].bindingIrSha256);
	const lock = await readFile(join(pkgs.get("task-lab").dir, "Cargo.lock"), "utf8");
	const cache = join(environment.CARGO_HOME ?? join(homedir(), ".cargo"), "registry/cache"), indexes = await readdir(cache);
	for(const p of dependencies(lock).filter(v => v.source))
	{
		assert.equal(p.source, index);
		if(pkgs.has(p.name))
		{ assert.equal(pkgs.get(p.name).archive.sha256, p.checksum); continue; }
		const file = p.name + "-" + p.version + ".crate";
		let found;
		for(const dir of indexes)
		{
			const path = join(cache, dir, file);
			try
			{
				if(sha256(await readFile(path)) === p.checksum)
				{ found = path; break; }
			}
			catch(error)
			{ if(error.code !== "ENOENT") throw error; }
		}
		assert.ok(found, "Warm the pinned Cargo test dependencies before offline install: " + file);
		await install(vendor, p.name, p.version, found, p.checksum, environment);
	}
	const env = { ...environment, RUSTC: rustc, CARGO_BUILD_JOBS: "1", CARGO_INCREMENTAL: "0", CARGO_NET_OFFLINE: "true", CARGO_HOME: join(work, "clean-cargo"), CARGO_TARGET_DIR: join(work, "target"), LEAN_PATH: "/unavailable", LEAN_SYSROOT: "/unavailable", LD_PRELOAD: "", LD_LIBRARY_PATH: "" };
	await mkdir(join(client, ".cargo"));
	await writeFile(join(client, ".cargo/config.toml"), `[source.crates-io]\nreplace-with = "installed"\n[source.installed]\ndirectory = ${JSON.stringify(vendor)}\n`);
	await writeFile(join(client, "Cargo.toml"), appManifest("task-lab","task-lab-peer"));
	for(const [f, to] of [["consumer.rs", "main.rs"], ["pulse_checks.rs", "pulse_checks.rs"]]) await copyFile(join(fx, f), join(client, "src", to));
	// Historical receipts replay their own original client, not today's checks.
	const retained = (await readdir(fx)).includes("callback_checks.rs");
	if(retained) await copyFile(join(fx, "callback_checks.rs"), join(client, "src/callback_checks.rs"));
	const guide = (await readdir(fx)).includes("callback_example.rs");
	if(guide) await copyFile(join(fx, "callback_example.rs"), join(client, "src/callback_example.rs"));
	await run(cargo, ["generate-lockfile", "--offline"], client, env);
	const metadata = JSON.parse(await run(cargo, ["metadata", "--locked", "--offline", "--format-version", "1"], client, env));
	for(const [name, p] of pkgs)
	{
		const matches = metadata.packages.filter(x => x.name === name); assert.equal(matches.length, 1);
		assert.equal(matches[0].source, index); assert.equal(matches[0].version, p.version); assert.equal(matches[0].manifest_path, join(p.dir, "Cargo.toml"));
	}
	await run(cargo, ["build", "--locked", "--offline", "-j1"], client, env);
	await mkdir(join(client, "src/bin"));
	if(parkedClient)
	{
		await copyFile(parkedClient, join(client, "src/bin/parked.rs"));
		await run(cargo, ["build", "--bin", "parked", "--locked", "--offline", "-j1"], client, env);
		await copyFile(join(env.CARGO_TARGET_DIR, "debug/parked"), join(root, "relocated-parked"));
	}
	await writeFile(join(client, "src/bin/external.rs"), 'fn accepts<S:futures_core::stream::FusedStream>(s:S)->S{s}\nfn main(){let _=accepts(task_lab::series(false,false,"").unwrap());}\n');
	await run(cargo, ["check", "--offline", "--locked", "--bin", "external", "-j1"], client, env);
	await writeFile(join(client, "src/bin/invalid.rs"), 'fn send<T:Send>(){}\nfn main(){send::<task_lab::Task<i64>>();send::<task_lab::Ticket>();let b=task_lab::badge(1).unwrap();let _=task_lab_peer::count(&b); }\n');
	await assert.rejects(run(cargo, ["check", "--offline", "--locked", "--bin", "invalid", "-j1"], client, env), e => {
		assert.match(e.message, /E0277/u); assert.match(e.message, /E0308/u); assert.match(e.message, /cannot be sent between threads safely/u); return true;
	});
	const bin = join(root, "relocated-consumer");
	await copyFile(join(env.CARGO_TARGET_DIR, "debug/rust-task-app"), bin);
	let owners;
	const alternate = join(root, "relocated-reviewed-primary");
	if(swapPrimary)
	{
		assert.ok(retained, "dual-owner replay requires a callback-capable release pair");
		const ordinary = ownerPackages(metadata);
		assert.deepEqual(ordinary,{task_lab: "task-lab",task_lab_peer: "task-lab-peer"});
		const pin = await readFile(join(client,"Cargo.lock"));
		await writeFile(join(client, "Cargo.toml"), appManifest("task-lab-peer","task-lab"));
		const swapped = JSON.parse(await run(cargo, ["metadata","--locked","--offline","--format-version","1"], client, env));
		const reviewed = ownerPackages(swapped);
		assert.deepEqual(reviewed,{task_lab: "task-lab-peer",task_lab_peer: "task-lab"});
		await run(cargo, ["build","--bin","rust-task-app","--locked","--offline","-j1"], client, env);
		assert.deepEqual(await readFile(join(client,"Cargo.lock")), pin);
		await copyFile(join(env.CARGO_TARGET_DIR, "debug/rust-task-app"), alternate);
		owners = { ordinary, reviewed, lockSha256: sha256(pin) };
	}
	await rm(work, { recursive: true });
	const isolated = { PATH: "/unavailable", CARGO_HOME: "/unavailable", LEAN_SYSROOT: "/unavailable", TMPDIR: root, LEAN_NUM_THREADS: "1" };
	const output = (await run(bin, [], root, isolated)).trim();
	assert.match(output, /cross-crate resource cleanup passed$/u);
	if(retained) assert.match(output, /retained callback checks passed/u);
	if(swapPrimary)
	{
		const reviewed = (await run(alternate, [], root, isolated)).trim();
		assert.equal(reviewed,output,"both primary crates must pass every original consumer assertion");
		owners.outputs = {ordinary: output,reviewed};
	}
	let parked;
	if(parkedClient)
	{
		const orders = {};
		for(const order of [["ordinary", "reviewed"], ["reviewed", "ordinary"]])
		{
			const lines = (await run(join(root, "relocated-parked"), [order[0]], root, isolated)).trim().split("\n");
			const outcomes = { replace: "item", close: "end", drop: "owner-dropped" };
			assert.deepEqual(lines, order.flatMap(route => ["replace", "close", "drop"].map(mode =>
				route + " " + mode + " pulls=1 closes=1 observed=" + outcomes[mode])));
			orders[order.join("-then-")] = lines;
		}
		parked = { clientSha256: sha256(await readFile(parkedClient)), orders };
	}
	return { reports
		, ...owners ? { owners } : {}
		, ...parked ? { parked } : {}
		, output
		, consumerSha256: sha256(await readFile(join(fx, "consumer.rs")))
		, wakeChecksSha256: sha256(await readFile(join(fx, "pulse_checks.rs")))
		, ...retained ? { callbackChecksSha256: sha256(await readFile(join(fx, "callback_checks.rs"))) } : {}
		, ...guide ? { guideSha256: sha256(await readFile(join(fx, "callback_example.rs"))) } : {} };
};
