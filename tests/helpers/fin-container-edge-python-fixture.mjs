/**
 * Real Lean and production Python generation with a synthetic source-test receipt.
 * This fixture does not claim a wheel build or a package-manager installation.
 *
 * @file
 */
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { compileFinContainerEdgeFixture } from "./fin-container-edge-compiled-fixture.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Build real shared code and the normal generated loader, keeping the broker in its own library.
 *
 * @param root - Fresh source-test directory.
 * @param lean - Absolute pinned Lean executable.
 */
export const compileFinContainerEdgePythonFixture = async (root, lean) => {
	const compiled = await compileFinContainerEdgeFixture(root, lean);
	const { model, environment, prefix } = compiled;
	const runtime = [`-L${join(prefix, "lib/lean")}`, "-lleanshared", `-Wl,-rpath,${join(prefix, "lib/lean")}`];
	await runCopied("/usr/bin/cc", ["-shared", "-fPIC", "-O2", `-I${join(prefix, "include")}`, "-I.", "broker.c", ...runtime, "-lpthread", "-Wl,-z,defs", "-o", "liblean_bridge_native.so"], root, environment);
	await runCopied("/usr/bin/cc", [
		"-shared", "-fPIC", "-O2", `-I${join(prefix, "include")}`
		, "-I.", "-Iraw/include", "-Iraw/internal", "FinContainers.c", "adapters.c"
		, "native.c", "raw/src/fincontainers.c", "-L.", "-llean_bridge_native"
		, ...runtime, "-Wl,-rpath,$ORIGIN", "-Wl,-z,defs", "-o", "libedge-source.so"
	], root, environment);
	const site = join(root, "python"), directory = join(site, "lean_fincontainers/native/linux-x64");
	await mkdir(directory, { recursive: true });
	const libraries = {};
	for(const name of ["libedge-source.so", "liblean_bridge_native.so", "libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
	{
		const source = join(name.startsWith("libleanshared") ? join(prefix, "lib/lean") : root, name);
		await copyFile(source, join(directory, name));
		libraries[name] = sha256(await readFile(source));
	}
	const generated = generateCopiedPythonPackage(model.bindingIr, { componentId: model.component.id, runtimeIdentity: sha256("synthetic source-test runtime identity"), componentReceiptSha256: sha256("synthetic source-test component identity"), library: "libedge-source.so", libraries });
	const members = Object.keys(libraries).map(name => `lean_fincontainers/native/linux-x64/${name}`);
	for(const [path, source] of Object.entries(generated).filter(([path]) => path.startsWith("lean_fincontainers/")))
	{
		await saveLakeFile(site, path, source); members.push(path);
	}
	const bindingIrSha256 = hashBindingIr(model.bindingIr), modelPath = "lean_fincontainers/lean_bridge/component/model.json";
	const modelBytes = Buffer.from(JSON.stringify({ ...model, bindingIrSha256 }));
	await saveLakeFile(site, modelPath, modelBytes); members.push(modelPath);
	const files = {};
	for(const path of members)
	{
		const bytes = await readFile(join(site, path));
		files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const receiptPath = "lean_fincontainers/lean_bridge/package-receipt.json";
	const receiptBytes = Buffer.from(JSON.stringify({ component: model.component, bindingIrSha256, files }));
	await saveLakeFile(site, receiptPath, receiptBytes);
	return { ...compiled, site, receiptPath, receiptBytes, expectedModelSha256: sha256(modelBytes) };
};
