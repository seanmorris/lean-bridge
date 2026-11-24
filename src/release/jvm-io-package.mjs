/**
 * Compile both JVM projections and pack their checked native dependencies in a Maven release.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { mavenPackageMetadata } from "../analyze/package-metadata.mjs";
import { generateJvmIO } from "../backends/jvm/sync-io.mjs";
import { generateJvmHostApi, jvmHostReadme } from "../backends/jvm/host-api.mjs";
import { compileJvmSources } from "../build/compile-jvm-sources.mjs";
import { nativeArtifactPaths } from "../build/native-artifacts.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

/**
 * Write the JAR, POM, file repository and package-set receipt from original compiled bytes.
 *
 * @param o - Validated component, exact native outputs, compiler settings and producer staging paths.
 */
export const writeJvmIORelease = async o => {
	const { workRoot, projectContract, name, version, prefix, files, owner, api, evidence, runtimeIdentity, bindingIrSha256, componentIdentity, floor } = o;
	const host = o.host, tasks = Boolean(o.wire?.wait), profile = tasks ? "native-jvm-task-v1" : "native-jvm-io-v1", component = projectContract.component;
	const library = "lib" + prefix + ".so", libraries = {};
	const ledger = o.ledgerId && { id: o.ledgerId, library: "liblb_task_resources_" + o.ledgerId + ".so" };
	const built = [library, owner.name, ...ledger ? [ledger.library] : [], ...host ? [host.domain.name] : []];
	for(const n of [...built, "liblean_bridge_native.so", "libleanshared.so"])
	{
		const path = "lib/" + n, bytes = files.get(path);
		if(!bytes || (!built.includes(n) && sha256(bytes) !== o.manifest.files[path]?.sha256))
			throw new Error("Missing or inconsistent JVM IO native library: " + n);
		libraries[n] = sha256(bytes);
	}
	if(files.size !== Object.keys(libraries).length) throw new Error("Unexpected JVM IO native payload");
	const auth = { library, libraries, runtimeIdentity, componentId: component.id, componentReceiptSha256: componentIdentity, ...ledger ? { ledgerId: ledger.id } : {} };
	if(host)
	{ auth.hostDomainId = host.domain.id; auth.veneerSha256 = host.veneer.sha256; }
	const { namespace, files: sources } = host ? generateJvmHostApi({ api, ...host, evidence: auth }) : await generateJvmIO({ api, wire: o.wire, ...o.jvmEntry, evidence: auth });
	const stage = await mkdtemp(join(workRoot, ".jvm-io-")), root = join(stage, "jar"), compiler = join(stage, "compiler");
	const write = async (dir, path, bytes) => { await mkdir(dirname(join(dir, path)), { recursive: true }); await writeFile(join(dir, path), bytes, { flag: "wx" }); };
	const inventory = {}, save = async (path, value) => {
		await write(root, path, value); inventory[path] = { bytes: Buffer.byteLength(value), sha256: sha256(value) };
	};
	try
	{
		for(const [p, b] of Object.entries(sources))
		{
			await write(compiler, p, b);
			await save("META-INF/lean-bridge/generated/" + p, b);
		}
		const sdk = await compileJvmSources({ root: compiler, files: sources, environment: o.environment, signal: o.signal });
		const classes = await nativeArtifactPaths(join(compiler, "classes"));
		for(const p of [namespace.replaceAll(".", "/") + "/Api.class", namespace.replaceAll(".", "/") + "/kotlin/Api.class", "META-INF/" + sdk.kotlin.module + ".kotlin_module"])
			if(!classes.includes(p)) throw new Error("Missing compiled JVM IO API or Kotlin metadata: " + p);
		for(const p of classes) await save(p, await readFile(join(compiler, "classes", p)));
		for(const n of Object.keys(libraries)) await save("META-INF/lean-bridge/native/linux-x64/" + n, files.get("lib/" + n));
		const meta = "META-INF/lean-bridge/";
		if(host) await save(meta + "jni/" + host.veneer.name, host.veneer.bytes);
		for(const [p, v] of [["binding-ir.json", api], ["elaboration.json", evidence], ["runtime.json", o.manifest], ["compilers.json", sdk]])
			await save(meta + p, canonicalJson(v));
		await save(meta + "licenses/LeanBridge-LICENSE", await readFile(new URL("../../LICENSE", import.meta.url)));
		for(const f of ["LICENSE", "LICENSES"]) await save(meta + "licenses/Lean-" + f, await readFile(join(o.leanPrefix, f)));
		for(const [p, b] of Object.entries(projectContract.notices)) await save(meta + "licenses/" + p, b);
		const [group, artifact] = name.split(":");
		const coroutines = tasks ? "<dependency><groupId>org.jetbrains.kotlinx</groupId><artifactId>kotlinx-coroutines-core-jvm</artifactId><version>1.8.0</version></dependency>" : "";
		const pom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>${group}</groupId><artifactId>${artifact}</artifactId><version>${version}</version>${mavenPackageMetadata(projectContract.metadata ?? {})}<properties><maven.compiler.release>22</maven.compiler.release><project.build.sourceEncoding>UTF-8</project.build.sourceEncoding></properties><dependencies><dependency><groupId>org.jetbrains.kotlin</groupId><artifactId>kotlin-stdlib</artifactId><version>2.2.0</version></dependency>${coroutines}</dependencies></project>\n`;
		await save(`META-INF/maven/${group}/${artifact}/pom.xml`, pom);
		await save("META-INF/MANIFEST.MF", "Manifest-Version: 1.0\n\n");
		await save("README.md", `# ${name} ${version}\n\nCall ${namespace}.Api from Java or ${namespace}.kotlin.Api from Kotlin. JDK 22, Linux x86-64 (glibc ${floor}+), --enable-native-access=ALL-UNNAMED. ${tasks ? "Selected Lean tasks use Java CompletableFuture and Kotlin suspend functions. Stream factories expose Java Flow.Publisher and Kotlin Flow; demand starts and advances the cursor. Cancellation releases the native handle. Ordinary methods remain synchronous." : "Both APIs are synchronous."} Compatible packages share a native owner thread, including when called from different Java or virtual threads. Returned Except values are Result.Ok or Result.Err. An EIO throw raises the declaration's typed error; a Lean IO failure raises LeanIOException. No Lean compiler or scheduler setup is needed.\n` + (host ? jvmHostReadme(host) : ""));
		await save(meta + "package-receipt.json", canonicalJson({ schemaVersion: 1
			, kind: host ? "lean-bridge-jvm-host-package" : tasks ? "lean-bridge-jvm-task-package" : "lean-bridge-jvm-io-package"
			, profile, name, version, component, namespace
			, bindingIrSha256, runtimeIdentity, componentIdentity
			, glibcMinimumVersion: floor
			, owner: { id: owner.id, library: owner.name }
			, ...host ? { hostDomain: { id: host.domain.id, library: host.domain.name }, jni: { library: host.veneer.name, sha256: host.veneer.sha256 } } : {}
			, ...ledger ? { ledger } : {}
			, libraries, files: inventory }));
		const jar = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
		const repo = join(workRoot, "packages/maven/repository", ...group.split("."), artifact, version), artifacts = [];
		for(const [ext, bytes] of [["jar", jar], ["pom", Buffer.from(pom)]])
		{
			const archive = artifact + "-" + version + "." + ext, hash = sha256(bytes);
			await write(o.output, archive, bytes); await write(repo, archive, bytes);
			await write(repo, archive + ".sha256", hash + "\n");
			artifacts.push({ path: "archives/" + archive, bytes: bytes.length, sha256: hash });
		}
		const receipt = await writePackageSetReceipt({ root: workRoot, component
			, source: { treeSha256: projectContract.sourceTreeSha256 }
			, profiles: [{ id: profile, bindingIrSha256, runtimeIdentity }]
			, signal: o.signal
			, packages: [{ target: "maven", ecosystem: "maven", name, version, profile
				, role: "component", runtimeIdentity, runtimeDelivery: "embedded"
				, requires: [], artifacts }] });
		return { receipt, api, evidence, bindingIrSha256, runtimeIdentity };
	}
	finally
	{
		await rm(stage, { recursive: true, force: true });
	}
};
