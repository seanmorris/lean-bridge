/**
 * Verify original installed recursive Rust packages and isolated safety probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, cp, mkdir, readFile, readdir, realpath, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { captureRustCompiler } from "./type-corpus-rust.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { rustRecursiveOwnershipTests, rustRecursivePoisonTests } from "./rust-recursive-callable-probes.mjs";
import { rustRecursiveCallableDocumentation } from "./rust-recursive-callable-docs.mjs";

const linker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;

const compileEnvironment = (root, environment) => ({ ...copiedCleanEnvironment
	, PATH: join(root, "tools"), RUSTC: environment.LEAN_BRIDGE_RUSTC
	, RUSTFLAGS: "-Dwarnings", CARGO_HOME: join(root, "cargo-home")
	, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0"
	, CARGO_TARGET_DIR: join(root, "target")
	, CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER: join(root, "tools/link-only") });

/**
 * Install original archives using an empty Cargo home and only host linking.
 *
 * @param options - Producer-free archives and selected Rust tools.
 * @param options.consumer - Private consumer workspace.
 * @param options.handoff - Relocated package-set handoff.
 * @param options.dependencies - Locked vendored Rust dependencies.
 * @param options.packages - Verified package-set entries.
 * @param options.environment - Absolute Rust compiler and Cargo paths.
 */
export const installRustRecursiveConsumer = async ({ consumer, handoff, dependencies, packages, environment }) => {
	const root = join(consumer, "rust"), tools = join(root, "tools");
	const pkg = packages.find(pkg => pkg.role === "component");
	const archive = join(handoff, pkg.artifacts[0].path);
	const dependencyArchive = join(consumer, "dependencies", dependencies.archive);
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	assert.equal(sha256(await readFile(dependencyArchive)), dependencies.sha256);
	await mkdir(tools, { recursive: true });
	await symlink("/usr/bin/ld", join(tools, "ld"));
	await saveLakeFile(tools, "link-only", linker); await chmod(join(tools, "link-only"), 0o755);
	const env = compileEnvironment(root, environment);
	await mkdir(env.CARGO_HOME); assert.deepEqual(await readdir(env.CARGO_HOME), []);
	const rejectedLinkInputs = ["-c", "-S", "-E", "-xc", "-fsyntax-only", "input.c", "input.cpp", "input.s", "@arguments"];
	for(const argument of rejectedLinkInputs)
	{
		const rejected = await captureRustCompiler(join(tools, "link-only"), [argument], root, env);
		assert.equal(rejected.code, 65);
	}
	for(const file of [archive, dependencyArchive])
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", file], root);
	const installed = join(root, `${pkg.name}-${pkg.version}`);
	assert.equal(sha256(await readFile(join(installed, "Cargo.lock"))), dependencies.lockSha256);
	for(const dependency of dependencies.packages)
	{
		const path = join(root, "dependencies", dependency.directory);
		const bytes = await readFile(join(path, ".cargo-checksum.json"));
		assert.equal(sha256(bytes), dependency.manifestSha256);
		const checksum = JSON.parse(bytes);
		assert.equal(checksum.package, dependency.checksum);
		for(const [file, hash] of Object.entries(checksum.files))
			assert.equal(sha256(await readFile(join(path, file))), hash);
	}
	await saveLakeFile(root, ".cargo/config.toml", '[source.crates-io]\nreplace-with = "prepared"\n[source.prepared]\ndirectory = "dependencies"\n');
	await saveLakeFile(root, "Cargo.toml", `[package]\nname="consumer"\nversion="0.0.0"\nedition="2021"\n[dependencies]\n${pkg.name}={path="${pkg.name}-${pkg.version}"}\n[[bin]]\nname="consumer"\npath="consumer.rs"\n[profile.dev]\ndebug=0\nincremental=false\n`);
	const source = await readFile("tests/fixtures/structured-callable-consumers/rust-recursive.rs", "utf8");
	await saveLakeFile(root, "consumer.rs", source);
	const run = args => runCopied(environment.LEAN_BRIDGE_CARGO, args, root, env);
	await run(["generate-lockfile", "--offline"]);
	const metadata = JSON.parse((await run(["metadata", "--offline", "--locked", "--format-version", "1"])).stdout);
	const publicPackage = metadata.packages.find(item => item.name === pkg.name);
	assert.equal(await realpath(publicPackage.manifest_path), join(installed, "Cargo.toml"));
	const registry = metadata.packages.filter(item => item.source !== null);
	assert.deepEqual(registry.map(item => `${item.name}-${item.version}`).sort(), dependencies.packages.map(item => item.directory).sort());
	for(const item of registry)
		assert.equal(await realpath(item.manifest_path), join(root, "dependencies", `${item.name}-${item.version}`, "Cargo.toml"));
	await run(["build", "--offline", "--locked", "--bin", "consumer"]);
	const command = join(root, "target/debug/consumer");
	const executed = await runCopied(command, [], root);
	assert.equal(executed.stderr, ""); assert.match(executed.stdout, /^recursive-rust-ok:[0-9]+\n$/u);
	const checks = Number(executed.stdout.trim().split(":")[1]); assert.ok(checks >= 2349);
	const rustcVersion = (await runCopied(environment.LEAN_BRIDGE_RUSTC, ["--version"], root, env)).stdout.trim();
	const cargoVersion = (await run(["--version"])).stdout.trim();
	const verifiedDependencyFiles = dependencies.packages.reduce((sum, entry) => sum + entry.files, 0);
	return { command, checks, consumerSha256: sha256(source)
		, rustcVersion, cargoVersion
		, offlineInstall: true, compilerFreePath: true, emptyCargoHome: true
		, linkOnly: true, linkerSha256: sha256(linker), rejectedLinkInputs
		, verifiedDependencyFiles };
};

/**
 * Compile misuse cases and inject failures into a copy of the installed crate.
 *
 * @param options - Original installation and its authenticated model.
 * @param options.consumer - Private consumer workspace.
 * @param options.packages - Verified package-set entries.
 * @param options.environment - Selected Rust compiler and Cargo tools.
 * @param options.model - Checked Rust graph projection.
 */
export const checkRustRecursiveInstallation = async ({ consumer, packages, environment, model }) => {
	const root = join(consumer, "rust"), pkg = packages.find(pkg => pkg.role === "component");
	const installed = join(root, `${pkg.name}-${pkg.version}`);
	const receiptBytes = await readFile(join(installed, "lean-bridge/package-receipt.json"));
	const receipt = JSON.parse(receiptBytes), paths = await nativeArtifactPaths(installed);
	assert.equal(receipt.kind, "lean-bridge-ordinary-cargo-package");
	await verifyNativeFiles(installed, receipt.files);
	const original = await readFile(join(installed, "src/__runtime.rs"), "utf8");
	const env = compileEnvironment(root, environment);
	const documentation = await rustRecursiveCallableDocumentation();
	await saveLakeFile(root, "src/bin/documented.rs", documentation.consumer + "\n");
	await runCopied(environment.LEAN_BRIDGE_CARGO, ["build", "--offline", "--locked", "--bin", "documented"], root, env);
	const documented = await runCopied(join(root, "target/debug/documented"), [], root);
	assert.equal(documented.stdout, ""); assert.equal(documented.stderr, "");
	const tree = "api::Tree::Leaf {value:api::BigUint::from(7u8)}";
	const negatives = [
		["argument", "api::call_recursive(42, Ok).unwrap();", "E0308"]
		, ["callback-argument", `api::call_recursive(&${tree}, |v: String| Ok(v)).unwrap();`, "E0631"]
		, ["callback-result", `api::call_recursive(&${tree}, |_| Ok(42)).unwrap();`, "E0308"]
		, ["borrowed-result", `api::call_recursive(&${tree}, |v| Ok(&v)).unwrap();`, "E0308"]
		, ["recursive-child", "let _=api::Tree::Branch {children:vec![42]};", "E0308"]
		, ["closure-argument", `api::make_recursive(&${tree}).unwrap().call(true, "wrong").unwrap();`, "E0308"]
		, ["closure-result", `let value: String=api::make_recursive(&${tree}).unwrap().call(true,&${tree}).unwrap();drop(value);`, "E0308"]
		, ["send", `fn send<T: Send>(_:T) {} send(api::make_recursive(&${tree}).unwrap());`, "E0277"]
		, ["sync", `fn sync<T: Sync>(_:&T) {} sync(&api::make_recursive(&${tree}).unwrap());`, "E0277"]
		, ["clone", `api::make_recursive(&${tree}).unwrap().clone();`, "E0599"]
		, ["async", `api::call_recursive(&${tree}, |v| async move {Ok(v)}).unwrap();`, "E0308"]
		, ["moved", `let value=api::make_recursive(&${tree}).unwrap();let moved=value;value.call(true,&${tree}).unwrap();drop(moved);`, "E0382"]
	];
	const rejected = [];
	for(const [name, statement, code] of negatives)
	{
		const source = `use structured_api as api; fn main() { ${statement} }\n`;
		await saveLakeFile(root, `src/bin/${name}.rs`, source);
		const result = await captureRustCompiler(environment.LEAN_BRIDGE_CARGO, ["check", "--offline", "--locked", "--bin", name, "--message-format=json"], root, env);
		assert.equal(result.code, 101, result.stderr);
		const diagnostics = result.stdout.trim().split("\n").map(line => JSON.parse(line)).filter(item => item.reason === "compiler-message" && item.message.level === "error");
		assert.ok(diagnostics.length > 0);
		assert.ok(diagnostics.every(item => item.message.code?.code === code && item.message.spans.some(span => span.is_primary && span.file_name === `src/bin/${name}.rs`)), result.stdout);
		rejected.push({ name, code, sourceSha256: sha256(source), diagnostics: diagnostics.length });
	}
	const probe = join(root, "safety-probe"); await cp(installed, probe, { recursive: true });
	const faults = await readFile("tests/fixtures/structured-callable-consumers/rust-recursive-faults.rs", "utf8");
	const ownership = rustRecursiveOwnershipTests(model), poison = rustRecursivePoisonTests(model);
	const execute = async source => {
		await saveLakeFile(probe, "src/__runtime.rs", source);
		return captureRustCompiler(environment.LEAN_BRIDGE_CARGO, ["test", "--offline", "--locked", "--manifest-path", join(probe, "Cargo.toml"), "--lib", "--", "--test-threads=1", "--nocapture"], root, env);
	};
	const checked = await execute(original + "\n" + faults + ownership);
	assert.equal(checked.code, 0, checked.stdout + checked.stderr); assert.match(checked.stdout, /10 passed; 0 failed/);
	const rows = [...checked.stdout.matchAll(/recursive-rust-faults:(\w+):(\d+):(\d+)/gu)]
		.map(([, shape, cases, failures]) => ({ shape, cases: Number(cases), failures: Number(failures) }));
	assert.deepEqual(rows.map(row => row.shape), ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"]);
	for(const row of rows)
	{
		assert.equal(row.cases, 5); assert.ok(row.failures > 0 && row.failures % 2 === 0);
	}
	const retired = await execute(original + poison);
	assert.equal(retired.code, 0, retired.stdout + retired.stderr); assert.match(retired.stdout, /1 passed; 0 failed/);
	const keep = "scope.one(value).map_err(graph_error)?;";
	assert.equal(original.split(keep).length - 1, model.callbacks.size);
	const missingOwner = await execute(original.replaceAll(keep, "") + ownership);
	assert.equal(missingOwner.code, 101, missingOwner.stderr); assert.match(missingOwner.stdout, /0 passed; 9 failed/);
	const finish = "graph_finish(result, Some(&runtime.lifecycle)).map_err(graph_error)";
	assert.equal(original.split(finish).length, 2);
	const missingRetirement = await execute(original.replace(finish, "let _ = runtime; result.map_err(graph_error)") + poison);
	assert.equal(missingRetirement.code, 101, missingRetirement.stderr); assert.match(missingRetirement.stdout, /0 passed; 1 failed/);
	await rm(probe, { recursive: true, force: true });
	await verifyNativeFiles(installed, receipt.files);
	assert.deepEqual(await nativeArtifactPaths(installed), paths);
	assert.equal(sha256(await readFile(join(installed, "lean-bridge/package-receipt.json"))), sha256(receiptBytes));
	return { rejected, faults: rows, faultTests: 1, ownershipTests: 9
		, documentation: { sourceSha256: sha256(documentation.consumer), compiled: true, executed: true }
		, faultSourceSha256: sha256(faults), ownershipSourceSha256: sha256(ownership)
		, poisonSourceSha256: sha256(poison)
		, malformedOutputRetiresRuntime: true, missingCallbackOwnerRejected: true
		, missingRetirementRejected: true
		, installedFilesUnchanged: true, installedFiles: receipt.files
		, installedReceiptSha256: sha256(receiptBytes) };
};
