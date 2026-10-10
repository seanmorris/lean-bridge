/**
 * Observe checked container dispatch without changing installed wheels or crates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { finContainerDispatchColumns } from "./fin-container-dispatch.mjs";
import { finContainerHostInterposer, parseFinContainerHostDispatch, pythonFinContainerProbe, rustFinContainerProbe } from "./fin-container-host-probes.mjs";

/**
 * Compile test instrumentation, then run inside the installed compiler-free host.
 *
 * @param options - Existing prepared installation and absolute tool paths.
 * @param options.profile - Python or Rust profile.
 * @param options.consumer - Test-owned consumer root.
 * @param options.command - Installed Python interpreter or Rust consumer binary.
 * @param options.packages - Component package receipt entries.
 * @param options.environment - Producer toolchain selection.
 */
export const observeFinContainerHostDispatch = async ({ profile, consumer, command, packages, environment }) => {
	assert.ok(["python", "rust"].includes(profile));
	const root = join(consumer, profile), pkg = packages.find(item => item.role === "component");
	let installed, receiptPath, args;
	if(profile === "python")
	{
		installed = (await runCopied(command, ["-I", "-c", "import pathlib, lean_fincontainers; print(pathlib.Path(lean_fincontainers.__file__).parent.parent)"], root)).stdout.trim();
		assert.ok(installed.startsWith(`${root}/venv/`));
		receiptPath = join(installed, "lean_fincontainers/lean_bridge/package-receipt.json");
		args = ["-I", "dispatch.py"];
	}
	else
	{
		installed = join(root, `${pkg.name}-${pkg.version}`);
		receiptPath = join(installed, "lean-bridge/package-receipt.json");
		args = [];
	}
	const receiptBytes = await readFile(receiptPath), receipt = JSON.parse(receiptBytes);
	await verifyNativeFiles(installed, receipt.files);
	const interposer = finContainerHostInterposer();
	await saveLakeFile(root, "dispatch-interposer.c", interposer);
	const compileArgs = [
		"-std=c11", "-Wall", "-Wextra", "-Werror", "-shared", "-fPIC"
		, "-isystem"
		, join(environment.LEAN_BRIDGE_LEAN_PREFIX, "include")
		, "dispatch-interposer.c"
		, "-o"
		, "libdispatch.so"];
	await runCopied("/usr/bin/cc", compileArgs, root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
	const probe = profile === "python" ? pythonFinContainerProbe() : rustFinContainerProbe();
	if(profile === "python") await saveLakeFile(root, "dispatch.py", probe);
	else
	{
		await saveLakeFile(root, "src/bin/dispatch.rs", probe);
		await runCopied(environment.LEAN_BRIDGE_CARGO, ["rustc", "--offline", "--locked", "--bin", "dispatch", "--", "-Dwarnings"], root
			, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", RUSTC: environment.LEAN_BRIDGE_RUSTC, CARGO_HOME: join(root, "cargo-home"), CARGO_NET_OFFLINE: "true" });
		command = join(root, "target/debug/dispatch");
	}
	// Missing instrumentation must fail instead of producing a successful observation.
	await assert.rejects(() => runCopied(command, args, root), /fin_container_dispatch_count|interposer is not loaded/u);
	const run = await runCopied(command, args, root, { ...copiedCleanEnvironment, LD_PRELOAD: join(root, "libdispatch.so") });
	assert.equal(run.stderr, "");
	const observed = parseFinContainerHostDispatch(run.stdout);
	assert.deepEqual(await readFile(receiptPath), receiptBytes);
	await verifyNativeFiles(installed, receipt.files);
	return { columns: finContainerDispatchColumns
		, observed
		, interposer: "LD_PRELOAD"
		, positiveControl: "valid public and raw calls increment source and adapter counts inside the installed host process"
		, missingInterposerRejected: true
		, installedFilesUnchanged: true
		, compilerFreePath: true
		, installedFilesSha256: sha256(canonicalJson(receipt.files))
		, probeSha256: sha256(probe), interposerSha256: sha256(interposer) };
};
