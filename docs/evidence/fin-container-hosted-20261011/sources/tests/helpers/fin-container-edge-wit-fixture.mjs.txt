/**
 * Actual Lean and a production-generated guarded Wasmtime host in a synthetic source-test archive.
 * This does not replace canonical two-root package production and acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { snapshotWasmtimeCapi } from "../../src/build/native-wit-projection.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader, renderWitHostSource } from "../../src/backends/wit/copied-host.mjs";
import { guardWitHostSource, witHostDependencies } from "../../src/backends/wit/host-evidence.mjs";
import { createDeterministicTarGzFromFiles } from "../../src/release/deterministic-archive.mjs";
import { compileFinContainerEdgeSplitFixture } from "./fin-container-edge-compiled-fixture.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Compile the complete Lean source and normal native/Component Model projections.
 *
 * @param t - Source test owning all temporary files.
 */
export const finContainerEdgeWitFixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-wit-public-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const compiled = join(root, "compiled"); await mkdir(compiled);
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const { model, prefix } = await compileFinContainerEdgeSplitFixture(compiled, lean, { relocatable: true });
	const payload = join(root, "payload"), nativeDirectory = join(payload, "lib");
	await mkdir(nativeDirectory, { recursive: true });
	await copyFile(join(prefix, "lib/lean/libleanshared.so"), join(nativeDirectory, "libleanshared.so"));
	await copyFile(join(compiled, "liblean_bridge_native.so"), join(nativeDirectory, "liblean_bridge_native.so"));
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const common = ["-shared", "-fPIC", "-O2", `-I${join(prefix, "include")}`
		, "-I.", "-Iraw/include", "-Iraw/internal", "-L", nativeDirectory
		, "-Wl,-rpath,$ORIGIN", "-Wl,-z,defs"];
	await runCopied("/usr/bin/cc", [...common
		, "FinContainers.c", "adapters.c", "-lleanshared"
		, "-Wl,-soname,libedge_component.so", "-o"
		, join(nativeDirectory, "libedge_component.so")], compiled, tools);
	await runCopied("/usr/bin/cc", [...common
		, "native.c", "raw/src/fincontainers.c"
		, "-Wl,--no-as-needed", "-ledge_component", "-llean_bridge_native"
		, "-lleanshared", "-Wl,-soname,libfincontainers.so", "-o"
		, join(nativeDirectory, "libfincontainers.so")], compiled, tools);
	const wasmtime = resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42");
	const wasmtimeFiles = await snapshotWasmtimeCapi(wasmtime, join(root, "wasmtime"));
	for(const path of Object.keys(wasmtimeFiles))
		await saveLakeFile(payload, path === "LICENSE" ? "share/Wasmtime-LICENSE" : path, await readFile(join(root, "wasmtime", path)));
	for(const path of await nativeArtifactPaths(join(compiled, "raw/include")))
		await saveLakeFile(payload, `include/${path}`, await readFile(join(compiled, "raw/include", path)));
	const libraries = {}, identities = {};
	for(const name of await nativeArtifactPaths(nativeDirectory))
	{
		const bytes = await readFile(join(nativeDirectory, name));
		libraries[name] = sha256(bytes); identities[name] = { bytes: bytes.length, sha256: libraries[name] };
		const dynamic = await runCopied("/usr/bin/readelf", ["-d", join(nativeDirectory, name)], root, tools);
		assert.ok(!dynamic.stdout.includes(prefix), `WIT fixture ${name} must not load from the compiler tree`);
	}
	const projection = compileCopiedWitModel(model.bindingIr, {}, { callables: true });
	const wasmTools = resolve(process.env.LEAN_BRIDGE_WASM_TOOLS ?? ".toolchains/wasm-tools/bin/wasm-tools");
	const toolVersion = (await runCopied(wasmTools, ["--version"], root, tools)).stdout.trim();
	assert.match(toolVersion, /^wasm-tools 1\.245\.1(?: |$)/u);
	await saveLakeFile(payload, "wit/fincontainers.wit", projection.wit);
	await saveLakeFile(payload, "component/fincontainers.wat", projection.wat);
	await runCopied(wasmTools, ["parse", "component/fincontainers.wat", "-o", "component/fincontainers.wasm"], payload, tools);
	await runCopied(wasmTools, ["validate", "--features", "component-model", "component/fincontainers.wasm"], payload, tools);
	const component = await readFile(join(payload, "component/fincontainers.wasm"));
	const dependencies = witHostDependencies({
		receipt: { library: "libedge_component.so", nativeLibrary: identities["libedge_component.so"] }
		, adapter: { library: "libfincontainers.so", files: { "lib/libfincontainers.so": identities["libfincontainers.so"] } }
		, runtime: { files: { "lib/libleanshared.so": identities["libleanshared.so"], "lib/liblean_bridge_native.so": identities["liblean_bridge_native.so"] } }
	}, wasmtimeFiles);
	await saveLakeFile(payload, "include/fincontainers_wasmtime.h", renderWitHostHeader(projection));
	const hostSource = guardWitHostSource(renderWitHostSource(projection, component), "fincontainers", dependencies);
	await saveLakeFile(payload, "src/fincontainers_wasmtime.c", hostSource);
	await runCopied("/usr/bin/cc", ["-std=c11", "-O2", "-g0", "-fPIC", "-shared"
		, "-Wall", "-Wextra", "-Werror", "-Iinclude"
		, "src/fincontainers_wasmtime.c", "-Llib", "-lfincontainers"
		, "-lwasmtime", "-ldl", "-Wl,-z,defs", "-Wl,-z,now"
		, "-Wl,-Bsymbolic-functions", "-Wl,--build-id=none"
		, "-Wl,-rpath,$ORIGIN", "-Wl,-soname,libfincontainers_wasmtime.so"
		, "-o", "lib/libfincontainers_wasmtime.so"], payload, tools);
	libraries["libfincontainers_wasmtime.so"] = sha256(await readFile(join(nativeDirectory, "libfincontainers_wasmtime.so")));
	const bindingIrSha256 = hashBindingIr(model.bindingIr), modelBytes = Buffer.from(JSON.stringify({ ...model, bindingIrSha256 }));
	await saveLakeFile(payload, "share/lean-bridge/component/model.json", modelBytes);
	await saveLakeFile(payload, "lib/pkgconfig/fincontainers-wit.pc", `prefix=\${pcfiledir}/../..
includedir=\${prefix}/include
libdir=\${prefix}/lib
Name: fincontainers-wit
Description: Source-control Lean Component Model host
Version: ${model.component.version}
Libs: -L\${libdir} -Wl,-rpath,\${libdir} -lfincontainers_wasmtime -lwasmtime
Cflags: -I\${includedir}
`);
	const files = {};
	for(const path of await nativeArtifactPaths(payload))
	{
		const bytes = await readFile(join(payload, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const name = "fincontainers", version = model.component.version, directory = `${name}-${version}-wit-wasi`;
	const receiptPath = "lean-bridge-package.json";
	const receiptBytes = Buffer.from(canonicalJson({ schemaVersion: 1, kind: "lean-bridge-ordinary-wit-package", ecosystem: "wit-wasi", name, version, component: model.component, bindingIrSha256, wasmtime: wasmtimeCapiIdentity.version, componentSha256: sha256(component), files }));
	await saveLakeFile(payload, receiptPath, receiptBytes);
	const members = await Promise.all((await nativeArtifactPaths(payload)).map(async path => ({ path: `${directory}/${path}`, bytes: await readFile(join(payload, path)), mode: 0o644 })));
	const archive = `${directory}.tar.gz`, bytes = createDeterministicTarGzFromFiles({ files: members, sourceDateEpoch: 1 });
	await saveLakeFile(root, archive, bytes);
	return { root, payload, nativeDirectory, libraries, model, modelBytes, prefix
		, receiptPath, receiptBytes, archive: join(root, archive)
		, archiveSha256: sha256(bytes), handoff: root, wasmTools, wasmtimeFiles
		, packages: [{ role: "component", name, version, artifacts: [{ path: archive, sha256: sha256(bytes) }] }] };
};
