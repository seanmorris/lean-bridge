/**
 * Real Lean and generated Java in a synthetic, receipt-bearing JAR for observer source controls.
 * This fixture does not replace canonical two-root installed-package acceptance.
 *
 * @file
 */
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { generateCopiedJvmPackage } from "../../src/backends/jvm/copied-values.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { compileFinContainerEdgeSplitFixture } from "./fin-container-edge-compiled-fixture.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Compile the original-plus-edge Lean fixture and production JVM wrappers once for both callers.
 *
 * @param t - Running source test owning its temporary files.
 */
export const finContainerEdgeJvmFixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-jvm-public-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const compiled = join(root, "compiled"); await mkdir(compiled);
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const { model, prefix } = await compileFinContainerEdgeSplitFixture(compiled, lean, { relocatable: true });
	const payload = join(root, "payload"), nativeDirectory = join(payload, "META-INF/lean-bridge/native/linux-x64");
	await mkdir(nativeDirectory, { recursive: true });
	const libraries = {};
	for(const name of ["libedge-source.so", "liblean_bridge_native.so", "libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
	{
		const source = join(name.startsWith("libleanshared") ? join(prefix, "lib/lean") : compiled, name);
		const dynamic = await runCopied("/usr/bin/readelf", ["-d", source], root);
		if(dynamic.stdout.includes(prefix)) throw new Error(`JVM fixture ${name} must not load libraries from the compiler tree`);
		await copyFile(source, join(nativeDirectory, name)); libraries[name] = sha256(await readFile(source));
	}
	const generated = generateCopiedJvmPackage(model.bindingIr, { componentId: model.component.id
		, runtimeIdentity: sha256("synthetic JVM edge source runtime")
		, componentReceiptSha256: sha256(canonicalJson({ libraries, bindingIrSha256: hashBindingIr(model.bindingIr) }))
		, library: "libedge-source.so", libraries });
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), sources = [];
	for(const [path, source] of Object.entries(generated).filter(([path]) => path.endsWith(".java")))
	{
		await saveLakeFile(root, path, source); sources.push(path);
	}
	await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-proc:none", "-d", "payload", ...sources], root);
	await saveLakeFile(payload, "META-INF/MANIFEST.MF", "Manifest-Version: 1.0\n\n");
	const bindingIrSha256 = hashBindingIr(model.bindingIr), modelBytes = Buffer.from(JSON.stringify({ ...model, bindingIrSha256 }));
	await saveLakeFile(payload, "META-INF/lean-bridge/component/model.json", modelBytes);
	const files = {};
	for(const path of await nativeArtifactPaths(payload))
	{
		const bytes = await readFile(join(payload, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const name = "org.leanbridge:fincontainers", version = "1.0.0", receiptPath = "META-INF/lean-bridge/package-receipt.json";
	const receiptBytes = Buffer.from(canonicalJson({ schemaVersion: 1, kind: "lean-bridge-ordinary-maven-package", ecosystem: "maven", name, version, component: model.component, bindingIrSha256, files }));
	await saveLakeFile(payload, receiptPath, receiptBytes);
	const archive = await createDeterministicZip({ directory: payload, sourceDateEpoch: 315532800 });
	await saveLakeFile(root, "component.jar", archive);
	return { root, payload, nativeDirectory, libraries, model, modelBytes
		, receiptPath, receiptBytes, environment, handoff: root
		, packages: [{ role: "component", name, version, artifacts: [{ path: "component.jar", sha256: sha256(archive) }] }] };
};
