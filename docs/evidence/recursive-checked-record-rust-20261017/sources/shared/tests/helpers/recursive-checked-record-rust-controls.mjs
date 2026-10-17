/**
 * Missing-record and coordinated-tamper controls for recursive Rust evidence.
 * Mutations remain in memory; saved producer evidence is never changed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { recursiveCheckedRecordRustPackage } from "./recursive-checked-record-rust-fixture.mjs";
import { recursiveCheckedRecordRustModelMutations } from "./recursive-checked-record-rust-model-controls.mjs";
import { checkRecursiveCheckedRecordRustModels } from "./recursive-checked-record-rust-model-records.mjs";
import { checkRecursiveCheckedRecordRustPackageControls } from "./recursive-checked-record-rust-package-controls.mjs";
import {
	checkRecursiveCheckedRecordRustReport, recursiveCheckedRecordRustRecords
} from "./recursive-checked-record-rust-report.mjs";

/**
 * Reject missing originals and coordinated environment, model and result changes.
 *
 * @param originalRead - Original selection-relative byte reader.
 * @param options - Independently pinned producer, toolchain and runtime selection.
 */
export const checkRecursiveCheckedRecordRustControls = async (originalRead, options) => {
	const accepted = await checkRecursiveCheckedRecordRustReport(originalRead, options);
	const crate = JSON.parse(await originalRead("crate.json"));
	const dependencies = JSON.parse(await originalRead("dependencies.json"));
	const paths = recursiveCheckedRecordRustRecords(
		options.route, options.fixture, crate, dependencies);
	const originals = new Map();
	assert.equal(new Set(paths).size, paths.length);
	for(const path of paths) originals.set(path, Buffer.from(await originalRead(path)));
	const identities = new Map([...originals].map(([path, bytes]) => [path, sha256(bytes)]));
	const read = async (path, changes = new Map()) => {
		const value = changes.has(path) ? changes.get(path) : originals.get(path);
		assert.ok(Buffer.isBuffer(value), `Missing original record: ${path}`);
		return Buffer.from(value);
	};
	const json = path => JSON.parse(originals.get(path));
	const encoded = value => Buffer.from(canonicalJson(value));
	const reject = async (changes, label) => {
		assert.ok(changes.size > 0, label);
		assert.ok([...changes].some(([path, bytes]) => bytes === null
			|| !bytes.equals(originals.get(path))), `No-op control: ${label}`);
		await assert.rejects(checkRecursiveCheckedRecordRustReport(
			path => read(path, changes), options), undefined, label);
	};
	let recordControls = 0, resourceControls = 0, environmentControls = 0;
	let modelControls = 0, executionControls = 0;
	for(const path of paths)
		for(const replacement of [
			null, Buffer.concat([originals.get(path), Buffer.from("corrupted")])
		]){
			await reject(new Map([[path, replacement]]), path);
			recordControls++;
		}
	for(const mutate of [
		value => { value[0].observations[0].freeBytes = 1024; }
		, value => { value[0].observations[0].availableBytes = 1024; }
		, value => { value[0].observations.at(-1).load = json("report.json").loadCeiling; }
		, value => { value[0].waits++; }
		, value => { value.pop(); }
	]){
		const resources = json("resources.json");
		const report = json("report.json");
		mutate(resources);
		report.resourceChecks = resources;
		await reject(new Map([
			["resources.json", encoded(resources)], ["report.json", encoded(report)]
		]), "resource admission");
		resourceControls++;
	}
	for(const loadCeiling of [6, 10, 24])
	{
		const report = json("report.json");
		report.loadCeiling = loadCeiling;
		await reject(new Map([["report.json", encoded(report)]])
			, "unrecorded load ceiling");
		resourceControls++;
	}
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
		, value => { value.arguments.push("--features", "forged"); }
		, value => { value.metadataArguments.push("--features", "forged"); }
	];
	for(const mutate of installationChanges)
	{
		const installation = json("installation.json");
		const report = json("report.json");
		mutate(installation);
		report.installation = installation;
		await reject(new Map([
			["installation.json", encoded(installation)]
			, ["report.json", encoded(report)]
		]), "coordinated installation");
		environmentControls++;
	}
	const environments = [
		["PATH", "/usr/bin"], ["CC", "/usr/bin/cc"], ["CXX", "/usr/bin/c++"]
		, ["LEAN_BRIDGE_LEAN_PREFIX", "/app/.toolchains/lean"]
		, ["LEAN_BRIDGE_NATIVE_ROOT", "/app/build/runtime"]
		, ["RUSTC", "/different/rustc"], ["CARGO_HOME", "/tmp/shared-cache"]
		, ["CARGO_TARGET_DIR", "/tmp/shared-target"], ["CARGO_NET_OFFLINE", "false"]
		, ["CARGO_BUILD_JOBS", "16"], ["RUSTFLAGS", ""]
		, ["CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER", "/usr/bin/cc"]
		, ["RUSTC_WRAPPER", "/tmp/substitute"]
	];
	for(const [key, value] of environments)
	{
		const environment = json("consumer-environment.json");
		environment[key] = value;
		await reject(new Map([["consumer-environment.json", encoded(environment)]])
			, key);
		environmentControls++;
	}
	for(const name of ["rustc", "cargo"])
		for(const key of ["command", "sha256", "bytes", "run"])
		{
			const tools = json("toolchain.json");
			const installation = json("installation.json");
			const report = json("report.json");
			tools[name][key] = key === "command" ? `/another/${name}`
				: key === "sha256" ? "0".repeat(64) : key === "bytes" ? 1
					: { code: 0, stdout: `${name} 1.89.0 (00000000 2025-01-01)\n`, stderr: "" };
			installation.tools = tools;
			report.installation = installation;
			await reject(new Map([
				["toolchain.json", encoded(tools)]
				, ["installation.json", encoded(installation)]
				, ["report.json", encoded(report)]
			]), key);
			environmentControls++;
		}
	const packageName = recursiveCheckedRecordRustPackage(options.fixture).name;
	const metadataChanges = [
		value => { value.packages.pop(); }
		, value => { value.packages.push(value.packages[0]); }
		, value => { value.packages[0].manifest_path = "/tmp/other/Cargo.toml"; }
		, value => { value.packages[0].version = "9.9.9"; }
		, value => { value.packages[0].source = null; }
		, value => { value.packages[0].targets[0].src_path = "/tmp/injected.rs"; }
		, value => { value.packages.find(pkg => pkg.name === packageName)
			.dependencies[0].req = "*"; }
		, value => { value.packages.find(pkg => pkg.name === "recursive-consumer")
			.targets[0].kind = ["custom-build"]; }
		, value => { value.resolve.nodes[0].dependencies.push(value.resolve.root); }
		, value => { value.resolve.nodes[1].deps = []; }
		, value => { value.resolve.nodes.find(node => node.id.includes("#recursive-consumer@"))
			.features.push("forged"); }
		, value => { value.workspace_members = []; }
		, value => { value.target_directory += "-other"; }
	];
	for(const mutate of metadataChanges)
	{
		const run = json("consumer-metadata.json");
		const value = JSON.parse(run.stdout);
		mutate(value);
		run.stdout = JSON.stringify(value) + "\n";
		await reject(new Map([["consumer-metadata.json", encoded(run)]])
			, "Cargo metadata");
		environmentControls++;
	}
	const buildChanges = [
		value => { value.code = 42; }
		, value => { value.stdout = "unexpected"; }
		, value => { value.stderr += "warning: unverified\n"; }
		, value => { value.stderr = value.stderr.replace(/^ +Compiling [^\n]+\n/mu, ""); }
		, value => { value.stderr = value.stderr.replace(packageName, "substituted-package"); }
	];
	for(const mutate of buildChanges)
	{
		const build = json("consumer-build.json");
		const installation = json("installation.json");
		const report = json("report.json");
		mutate(build);
		installation.build = build;
		report.installation = installation;
		await reject(new Map([
			["consumer-build.json", encoded(build)]
			, ["installation.json", encoded(installation)]
			, ["report.json", encoded(report)]
		]), "compiler record");
		environmentControls++;
	}
	const sourceChanges = [
		["consumer.Cargo.lock", value => value.replace("0.4.6", "0.4.5")]
		, ["consumer.Cargo.toml", value => value + '\n[build-dependencies]\ncc = "1"\n']
		, ["consumer.config.toml", value => value.replace("vendor/dependencies", "/tmp/cache")]
		, ["link-only", value => value.replace("exit 65", "true")]
	];
	for(const [path, transform] of sourceChanges)
	{
		await reject(new Map([[path, Buffer.from(transform(originals.get(path).toString()))]])
			, path);
		environmentControls++;
	}
	for(const change of ["checksum", "missing", "manifest", "extra"])
	{
		const value = json("dependencies.json");
		const report = json("report.json");
		const installation = json("installation.json");
		const changes = new Map();
		if(change === "checksum") value.packages[0].checksum = "0".repeat(64);
		if(change === "missing") value.packages.pop();
		if(change === "extra")
			value.packages.push({ ...value.packages[0], directory: "injected-1.0.0" });
		if(change === "manifest")
		{
			const pkg = value.packages[0];
			const path = `dependency-manifests/${pkg.directory}.json`;
			const manifest = json(path);
			delete manifest.files["Cargo.toml"];
			const bytes = encoded(manifest);
			changes.set(path, bytes);
			pkg.files--;
			pkg.manifestSha256 = sha256(bytes);
			installation.dependencyClosure[0] = {
				directory: pkg.directory, manifestSha256: sha256(bytes)
				, fileSetSha256: sha256(canonicalJson([
					...Object.keys(manifest.files), ".cargo-checksum.json"
				].sort()))
			};
		}
		report.dependencies = value;
		report.installation = installation;
		changes.set("dependencies.json", encoded(value));
		changes.set("report.json", encoded(report));
		changes.set("installation.json", encoded(installation));
		await reject(changes, "coordinated dependency");
		environmentControls++;
	}
	const packageOptions = {
		...options, model: json("build-0/model.json")
		, receipt: json("build-0/package-set-receipt.json")
	};
	const packageControls = await checkRecursiveCheckedRecordRustPackageControls(
		originalRead, packageOptions);
	for(const [label, mutate] of recursiveCheckedRecordRustModelMutations(options.fixture))
	{
		const changes = new Map();
		const model = json("build-0/model.json");
		const report = json("report.json");
		mutate(model);
		const bytes = encoded(model);
		for(const attempt of [0, 1])
		{
			changes.set(`build-${attempt}/model.json`, bytes);
			report.builds[attempt].modelSha256 = sha256(bytes);
		}
		const mutatedRead = path => read(path, changes);
		await assert.rejects(checkRecursiveCheckedRecordRustModels({
			...options, report, read: mutatedRead
			, json: async path => JSON.parse(await mutatedRead(path))
		}), error => error instanceof assert.AssertionError || error instanceof TypeError, label);
		modelControls++;
	}
	for(const [index, stage] of ["installed", "relocated", "source-free"].entries())
	{
		const mutations = [
			item => { item.run.code = 1; }
			, item => { item.run.stderr = "warning"; }
			, item => { item.counts.checks--; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.snapshotControls = 0; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.snapshots--; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.counts.recoveries++; item.run.stdout = JSON.stringify(item.counts) + "\n"; }
			, item => { item.cwd += "-not-the-moved-tree"; }
			, item => { item.normalExitCleanup = false; }
			, item => { item.stage = "wrong"; }
			, item => {
				if(index === 2) item.sourcesRemoved = false;
				else item.closure.crate.receiptSha256 = "0".repeat(64);
			}
		];
		for(const mutate of mutations)
		{
			const observation = json(stage + ".json");
			const report = json("report.json");
			mutate(observation);
			report.observations[index] = observation;
			await reject(new Map([
				[stage + ".json", encoded(observation)]
				, ["report.json", encoded(report)]
			]), stage);
			executionControls++;
		}
	}
	for(const [path, hash] of identities)
		assert.equal(sha256(await originalRead(path)), hash, path);
	return {
		...accepted, recordControls, resourceControls, environmentControls
		, packageControls, modelControls, executionControls
	};
};
