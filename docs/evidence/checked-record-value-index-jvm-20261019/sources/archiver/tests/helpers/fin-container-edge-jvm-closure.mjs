/**
 * Close JVM package and classpath inputs before compilation and every execution.
 * The selected JDK and Kotlin distribution remain trusted host toolchains.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { readClosedPackageZip } from "./closed-package-zip.mjs";

const receiptPath = "META-INF/lean-bridge/package-receipt.json";
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const invocation = profile => ["--enable-native-access=ALL-UNNAMED", "-cp"
	, profile === "java" ? "component.jar:classes" : "component.jar:consumer.jar"
	, profile === "java" ? "Consumer" : "ConsumerKt"];

/**
 * Authenticate the entire original JAR and its exact receipt inventory in memory.
 *
 * @param bytes - Original archive bytes, before a compiler can inspect the classpath.
 * @param archiveSha256 - Digest from the verified package-set receipt.
 */
export const inspectFinContainerEdgeJvmArchive = (bytes, archiveSha256) => {
	assert.match(archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(sha256(bytes), archiveSha256, "original JVM archive drift");
	const files = readClosedPackageZip(bytes), receiptBytes = files.get(receiptPath)?.toString("utf8");
	assert.equal(typeof receiptBytes, "string", "JVM archive receipt missing");
	const receipt = JSON.parse(receiptBytes);
	assert.equal(canonicalJson(receipt), receiptBytes, "canonical JVM receipt");
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-maven-package");
	assert.equal(receipt.ecosystem, "maven");
	assert.ok(receipt.files && !Array.isArray(receipt.files) && typeof receipt.files === "object");
	assert.deepEqual([...files.keys()].sort(), [...Object.keys(receipt.files), receiptPath].sort(), "unrecorded or missing JVM archive file");
	for(const [path, entry] of Object.entries(receipt.files))
		assert.deepEqual(identity(files.get(path)), entry, `JVM archive member drift: ${path}`);
	assert.equal(files.get("META-INF/MANIFEST.MF")?.toString("utf8"), "Manifest-Version: 1.0\n\n", "JVM manifest must not extend the classpath");
	for(const path of files.keys())
		assert.ok(!/^META-INF\/(?:services\/|versions\/|INDEX\.LIST$)/u.test(path) && path !== "module-info.class", "unexpected JVM discovery input");
	return { receiptBytes, packageFileSetSha256: sha256(canonicalJson([...files.keys()].sort())) };
};

/**
 * Verify original package bytes and the isolated outputs of a checked host compilation.
 * No mutable installed tree is used as the original package baseline.
 *
 * @param context - Immutable package/source/output identities and current consumer root.
 */
export const verifyFinContainerEdgeJvmEnvironment = async context => {
	const { root, profile, command, interpreterSha256, files } = context;
	assert.ok(["java", "kotlin"].includes(profile));
	assert.equal(await realpath(root), resolve(root), "JVM root must not traverse a symlink");
	assert.equal(sha256(await readFile(command)), interpreterSha256, "JVM interpreter drift");
	for(const [path, expected] of Object.entries(files))
	{
		assert.ok((await lstat(join(root, path))).isFile(), `regular JVM input: ${path}`);
		assert.deepEqual(identity(await readFile(join(root, path))), expected, `JVM environment drift: ${path}`);
	}
	assert.equal(files["component.jar"].sha256, context.archiveSha256);
	if(profile === "java")
	{
		assert.equal(await realpath(join(root, "classes")), join(resolve(root), "classes"), "JVM classes must not traverse a symlink");
		assert.deepEqual((await nativeArtifactPaths(join(root, "classes"))).map(path => `classes/${path}`)
			, Object.keys(files).filter(path => path.startsWith("classes/")).sort(), "unrecorded or missing JVM classpath file");
	}
	return {
		receiptSha256: sha256(context.receiptBytes)
		, packageFileSetSha256: context.packageFileSetSha256
		, classpathFilesSha256: sha256(canonicalJson(files)), interpreterSha256 };
};

/**
 * Execute only the pinned consumer classpath, without ambient JVM or compiler options.
 *
 * @param context - Verified installation context, updated only for root relocation.
 */
export const runFinContainerEdgeJvm = async context => {
	await verifyFinContainerEdgeJvmEnvironment(context);
	try
	{
		return await runCopied(context.command, invocation(context.profile), context.root);
	}
	finally
	{
		await verifyFinContainerEdgeJvmEnvironment(context);
	}
};

/**
 * Install a verified JAR and compile the host consumer in a fresh, isolated classpath.
 *
 * @param options - Original package and explicitly selected host toolchains.
 * @param options.profile - Java or Kotlin.
 * @param options.root - Fresh consumer directory containing only its source file.
 * @param options.archive - Original package-set JAR.
 * @param options.archiveSha256 - Original artifact digest.
 * @param options.environment - Selected JDK and Kotlin paths, not inherited JVM options.
 */
export const installFinContainerEdgeJvm = async ({ profile, root, archive, archiveSha256, environment }) => {
	assert.ok(["java", "kotlin"].includes(profile));
	assert.equal(await realpath(root), resolve(root), "JVM root must not traverse a symlink");
	const source = `consumer.${profile === "java" ? "java" : "kt"}`;
	assert.deepEqual(await nativeArtifactPaths(root), [source], "fresh JVM consumer directory required");
	const bytes = await readFile(archive), original = inspectFinContainerEdgeJvmArchive(bytes, archiveSha256);
	const command = await realpath(environment.LEAN_BRIDGE_JAVA), interpreterSha256 = sha256(await readFile(command));
	const files = { [source]: identity(await readFile(join(root, source))), "component.jar": identity(bytes) };
	await writeFile(join(root, "component.jar"), bytes, { flag: "wx" });
	if(profile === "java") await mkdir(join(root, "classes"));
	const before = { root, profile, command, interpreterSha256, archiveSha256, ...original, files };
	await verifyFinContainerEdgeJvmEnvironment(before);
	if(profile === "java")
		await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-proc:none", "-cp", "component.jar", "-d", "classes", source], root);
	else
		await runCopied(environment.LEAN_BRIDGE_KOTLINC, ["-Werror", "-jvm-target", "22", "-cp", "component.jar", source, "-include-runtime", "-d", "consumer.jar"]
			, root, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin", JAVA_HOME: dirname(dirname(command)) });
	assert.equal(sha256(await readFile(archive)), archiveSha256, "JVM archive changed during compilation");
	const outputs = profile === "java" ? (await nativeArtifactPaths(join(root, "classes"))).map(path => `classes/${path}`) : ["consumer.jar"];
	assert.ok(outputs.includes(profile === "java" ? "classes/Consumer.class" : "consumer.jar"));
	for(const path of outputs)
	{
		if(profile === "java") assert.match(path, /^classes\/Consumer(?:\$[A-Za-z0-9_$]+)?\.class$/u, "unexpected host compiler output");
		assert.ok((await lstat(join(root, path))).isFile()); files[path] = identity(await readFile(join(root, path)));
	}
	const context = Object.freeze({ ...before, files: Object.freeze(Object.fromEntries(Object.entries(files).map(([path, entry]) => [path, Object.freeze(entry)]))) });
	await verifyFinContainerEdgeJvmEnvironment(context);
	return { context, args: invocation(profile), run: () => runFinContainerEdgeJvm(context) };
};
