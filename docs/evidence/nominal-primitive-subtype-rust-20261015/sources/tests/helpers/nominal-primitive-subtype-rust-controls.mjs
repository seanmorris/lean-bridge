/**
 * Missing-record and coordinated-tamper controls for original Rust acceptance.
 * Mutations remain in memory; saved producer evidence is never changed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeRustModelMutations } from "./nominal-primitive-subtype-rust-model-controls.mjs";
import { checkNominalPrimitiveSubtypeRustReport, nominalPrimitiveSubtypeRustRecords } from "./nominal-primitive-subtype-rust-report.mjs";
import { checkNominalPrimitiveSubtypeRustModels } from "./nominal-primitive-subtype-rust-model-records.mjs";
import { checkNominalPrimitiveSubtypeRustPackageControls } from "./nominal-primitive-subtype-rust-package-controls.mjs";

/**
 * Reject missing originals and coordinated environment, model and result changes.
 *
 * @param originalRead - Original selection-relative byte reader.
 * @param options - Independently pinned producer, toolchain and runtime selection.
 */
export const checkNominalPrimitiveSubtypeRustControls = async (originalRead, options) => {
	const accepted = await checkNominalPrimitiveSubtypeRustReport(originalRead, options);
	const crate = JSON.parse(await originalRead("crate.json")), dependencies = JSON.parse(await originalRead("dependencies.json"));
	const paths = nominalPrimitiveSubtypeRustRecords(options.route, crate, dependencies), originals = new Map();
	assert.equal(new Set(paths).size, paths.length);
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`); return Buffer.from(value);
	};
	const json = path => JSON.parse(originals.get(path));
	const encoded = value => Buffer.from(canonicalJson(value));
	const reject = async (changes, label) => {
		assert.ok(changes.size > 0, label);
		assert.ok([...changes].some(([path, bytes]) => bytes === null || !bytes.equals(originals.get(path))), `No-op control: ${label}`);
		await assert.rejects(checkNominalPrimitiveSubtypeRustReport(path => read(path, changes), options), undefined, label);
	};
	let recordControls = 0, environmentControls = 0, modelControls = 0, executionControls = 0;
	for(const path of paths) for(const replacement of [null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])])
	{ await reject(new Map([[path, replacement]]), path); recordControls++; }
	// Change the authoritative installation and its duplicate in the report together.
	const installationChanges = [
		value => { value.emptyCargoHome = false; }
		, value => { value.offline = false; }
		, value => { value.linkOnly = false; }
		, value => { value.linkerControls.pop(); }
		, value => { value.executable = "target/unverified/consumer"; }
		, value => { value.executableSha256 = "not-a-digest"; }
		, value => { value.crateClosure.packageFileSetSha256 = "0".repeat(64); }
		, value => { value.crateReceiptSha256 = "0".repeat(64); }
		, value => { value.dependencyClosure.pop(); }
		, value => { value.dependencyClosure[0].fileSetSha256 = "0".repeat(64); }
		, value => { value.locked.code = 1; }
		, value => { value.api.present.push("forged"); }
	];
	for(const mutate of installationChanges)
	{
		const installation = json("installation.json"), report = json("report.json"); mutate(installation); report.installation = installation;
		await reject(new Map([["installation.json", encoded(installation)], ["report.json", encoded(report)]]), "coordinated installation"); environmentControls++;
	}
	const environments = [["PATH", "/usr/bin"], ["CC", "/usr/bin/cc"]
		, ["CXX", "/usr/bin/c++"]
		, ["LEAN_BRIDGE_LEAN_PREFIX", "/app/.toolchains/lean"]
		, ["LEAN_BRIDGE_NATIVE_ROOT", "/app/build/runtime"]
		, ["RUSTC", "/different/rustc"], ["CARGO_HOME", "/tmp/shared-cache"]
		, ["CARGO_TARGET_DIR", "/tmp/shared-target"], ["CARGO_NET_OFFLINE", "false"]
		, ["CARGO_BUILD_JOBS", "16"], ["RUSTFLAGS", ""]
		, ["CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER", "/usr/bin/cc"]
		, ["RUSTC_WRAPPER", "/tmp/substitute"]];
	for(const [key, value] of environments)
	{
		const value_ = json("consumer-environment.json"); value_[key] = value;
		await reject(new Map([["consumer-environment.json", encoded(value_)]]), key); environmentControls++;
	}
	for(const name of ["rustc", "cargo"]) for(const key of ["command", "sha256", "bytes", "run"])
	{
		const tools = json("toolchain.json"), installation = json("installation.json"), report = json("report.json");
		tools[name][key] = key === "command" ? `/another/${name}` : key === "sha256" ? "0".repeat(64) : key === "bytes" ? 1 : { code: 0, stdout: `${name} 1.89.0 (00000000 2025-01-01)\n`, stderr: "" };
		installation.tools = tools; report.installation = installation;
		await reject(new Map([["toolchain.json", encoded(tools)], ["installation.json", encoded(installation)], ["report.json", encoded(report)]]), key); environmentControls++;
	}
	const metadataChanges = [
		value => { value.packages.pop(); }
		, value => { value.packages.push(value.packages[0]); }
		, value => { value.packages[0].manifest_path = "/tmp/other/Cargo.toml"; }
		, value => { value.packages[0].version = "9.9.9"; }
		, value => { value.packages[0].source = null; }
		, value => { value.packages[0].targets[0].src_path = "/tmp/injected.rs"; }
		, value => { value.packages.find(pkg => pkg.name === "nominalprimitivesubtypes").dependencies[0].req = "*"; }
		, value => { value.packages.find(pkg => pkg.name === "nominal-consumer").targets[0].kind = ["custom-build"]; }
		, value => { value.resolve.nodes[0].dependencies.push(value.resolve.root); }
		, value => { value.resolve.nodes[1].deps = []; }
		, value => { value.resolve.nodes[0].features.push("unreviewed"); }
		, value => { value.workspace_members = []; }
		, value => { value.target_directory += "-other"; }
	];
	for(const mutate of metadataChanges)
	{
		const run = json("consumer-metadata.json"), value = JSON.parse(run.stdout); mutate(value); run.stdout = JSON.stringify(value) + "\n";
		await reject(new Map([["consumer-metadata.json", encoded(run)]]), "Cargo metadata"); environmentControls++;
	}
	const compilerChanges = [
		value => { value.code = 42; }
		, value => { value.stderr += "warning: unverified\n"; }
		, value => { value.stdout = value.stdout.replace(/\{"reason":"build-finished"[^\n]*\n/u, ""); }
		, value => { value.stdout = value.stdout.replace(/"success":(?:true|false)/u, `"success":${options.mode !== "full"}`); }
		, value => { value.stdout = value.stdout.replace('"manifest_path":"', '"manifest_path":"/substituted'); }
	];
	if(options.mode === "result-only") compilerChanges.push(value => { value.stdout = value.stdout.replaceAll("E0432", "E0000"); });
	for(const mutate of compilerChanges)
	{
		const run = json("api-probe.json"), installation = json("installation.json"), report = json("report.json");
		mutate(run); installation.apiProbe = run; report.installation = installation;
		await reject(new Map([["api-probe.json", encoded(run)], ["installation.json", encoded(installation)], ["report.json", encoded(report)]]), "compiler probe"); environmentControls++;
	}
	const sourceChanges = [
		["consumer.Cargo.lock", value => value.replace("0.4.6", "0.4.5")]
		, ["consumer.Cargo.toml", value => value + '\n[build-dependencies]\ncc = "1"\n']
		, ["consumer.config.toml", value => value.replace("vendor/dependencies", "/tmp/cache")]
		, ["link-only", value => value.replace("exit 65", "true")]
		, ["api-probe.rs", value => value.replace("echo_a", "forged_input")]
	];
	for(const [path, transform] of sourceChanges)
	{ await reject(new Map([[path, Buffer.from(transform(originals.get(path).toString()))]]), path); environmentControls++; }
	for(const change of ["checksum", "missing", "manifest", "extra"])
	{
		const value = json("dependencies.json"), report = json("report.json"), installation = json("installation.json"), changes = new Map();
		if(change === "checksum") value.packages[0].checksum = "0".repeat(64);
		if(change === "missing") value.packages.pop();
		if(change === "extra") value.packages.push({ ...value.packages[0], directory: "injected-1.0.0" });
		if(change === "manifest")
		{
			const pkg = value.packages[0], path = `dependency-manifests/${pkg.directory}.json`, manifest = json(path);
			delete manifest.files["Cargo.toml"]; const bytes = encoded(manifest); changes.set(path, bytes);
			pkg.files--; pkg.manifestSha256 = sha256(bytes);
			installation.dependencyClosure[0] = { directory: pkg.directory, manifestSha256: sha256(bytes), fileSetSha256: sha256(canonicalJson([...Object.keys(manifest.files), ".cargo-checksum.json"].sort())) };
		}
		report.dependencies = value; report.installation = installation;
		changes.set("dependencies.json", encoded(value)); changes.set("report.json", encoded(report)); changes.set("installation.json", encoded(installation));
		await reject(changes, "coordinated dependency"); environmentControls++;
	}
	const packageControls = await checkNominalPrimitiveSubtypeRustPackageControls(originalRead, { ...options
		, model: json("build-0/model.json")
		, receipt: json("build-0/package-set-receipt.json") });
	for(const [label, mutate] of nominalPrimitiveSubtypeRustModelMutations(options.mode))
	{
		const changes = new Map(), model = json("build-0/model.json"), report = json("report.json"); mutate(model);
		const bytes = encoded(model);
		for(const attempt of [0, 1])
		{ changes.set(`build-${attempt}/model.json`, bytes); report.builds[attempt].modelSha256 = sha256(bytes); }
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkNominalPrimitiveSubtypeRustModels({ ...options, report, read: mutatedRead, json: async path => JSON.parse(await mutatedRead(path)) }), assert.AssertionError, label); modelControls++;
	}
	for(const [index, stage] of ["installed", "relocated", "source-free"].entries())
	{
		const mutations = [
			item => { item.run.code = 1; }, item => { item.run.stderr = "warning"; }
			, item => { item.counts.checks--; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.snapshotControls = 0; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.wordBits = 32; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.rounds--; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.cwd += "-not-the-moved-tree"; }
			, item => { item.normalExitCleanup = false; }
			, item => { item.stage = "wrong"; }
			, item => { if(index === 2) item.sourcesRemoved = false; else item.closure.crate.receiptSha256 = "0".repeat(64); }
		];
		for(const mutate of mutations)
		{
			const observation = json(stage + ".json"), report = json("report.json"); mutate(observation); report.observations[index] = observation;
			await reject(new Map([[stage + ".json", encoded(observation)], ["report.json", encoded(report)]]), stage); executionControls++;
		}
	}
	for(const [path, hash] of identities) assert.equal(sha256(await originalRead(path)), hash, path);
	return { ...accepted, recordControls, environmentControls, packageControls, modelControls, executionControls };
};
