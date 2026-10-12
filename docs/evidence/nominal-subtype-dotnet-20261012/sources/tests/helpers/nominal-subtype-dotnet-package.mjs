/**
 * Authenticate NuGet sources, managed assemblies and native loader inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import { verifyFinContainerEdgeDotnetEnvironment } from "./fin-container-edge-dotnet-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const nominalSubtypeDotnetAssembly = "LeanBridge.Nominalsubtypes";
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Bind NuGet coordinates, platform and provenance to the two independent builds.
 *
 * @param receipt - Original archive-derived receipt.
 * @param pkg - Independently verified package-set component.
 * @param model - Reproduced compiler-owned model.
 * @param floor - Explicit platform floor.
 */
export const assertNominalSubtypeDotnetIdentity = (receipt, pkg, model, floor) => {
	assert.equal(pkg.target, "nuget"); assert.equal(pkg.ecosystem, "nuget");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.name, "Nominalsubtypes.Api"); assert.equal(pkg.version, "1.0.0");
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-nuget-package");
	assert.equal(receipt.ecosystem, "nuget"); assert.equal(receipt.namespace, nominalSubtypeDotnetAssembly);
	assert.equal(receipt.assembly, nominalSubtypeDotnetAssembly);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u); assert.equal(receipt.glibcMinimumVersion, floor);
	assert.match(receipt.compiledProjectionSha256, /^[a-f0-9]{64}$/u);
	assert.ok(pkg.artifacts[0].path.endsWith("/Nominalsubtypes.Api.1.0.0.nupkg"));
};

/**
 * Reconstruct private loader hashes from native receipts, not package member order.
 *
 * @param receipt - NuGet receipt.
 * @param component - Compiled native component receipt.
 * @param adapter - Compiled C adapter receipt.
 * @param runtime - Shared runtime manifest.
 */
export const nominalSubtypeDotnetNativeEvidence = (receipt, component, adapter, runtime) => {
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, receipt.runtimeIdentity); assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, receipt.bindingIrSha256); assert.equal(adapter.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) };
	const prefix = "runtimes/linux-x64/native/";
	assert.deepEqual(Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith(prefix))
		.map(([path, file]) => [path.slice(prefix.length), file.sha256])), libraries);
	return { runtimeIdentity: receipt.runtimeIdentity
		, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library, libraries };
};

/**
 * Verify a source-free deployed tree using the original installation's file identities.
 *
 * @param root - Current physical deployment directory.
 * @param outputs - Original archive-derived and compiler-produced deployed identities.
 */
export const verifyNominalSubtypeDotnetDeployment = async (root, outputs) => {
	assert.equal(await realpath(root), resolve(root));
	assert.ok(outputs["Consumer.dll"]); assert.ok(outputs[`${nominalSubtypeDotnetAssembly}.dll`]);
	assert.deepEqual(await nativeArtifactPaths(root), Object.keys(outputs).sort());
	for(const [path, expected] of Object.entries(outputs))
	{
		assert.equal(await realpath(join(root, path)), join(resolve(root), path));
		assert.ok((await lstat(join(root, path))).isFile());
		assert.deepEqual(identity(await readFile(join(root, path))), expected, path);
	}
	return { deployedFilesSha256: sha256(canonicalJson(outputs)) };
};

/**
 * Preserve original package text, consumer inputs, NuGet restore inputs and deployed output.
 * Restore/build stdout is not exposed by the existing closed installer and is not invented.
 *
 * @param options - Authenticated original installation and compiler inputs.
 * @param options.context - Archive-derived original installation context.
 * @param options.pkg - Verified package-set component.
 * @param options.model - Original independently reproduced native model.
 * @param options.floor - Explicit glibc floor.
 * @param options.tools - Actual selected host and SDK.
 * @param options.output - Fresh retained-record directory.
 */
export const inspectNominalSubtypeDotnetPackage = async ({ context, pkg, model, floor, tools, output }) => {
	const closure = await verifyFinContainerEdgeDotnetEnvironment(context);
	assert.deepEqual(context.interpreter, tools.interpreter); assert.equal(context.command, tools.command);
	assert.equal(context.packageDirectory, "nominalsubtypes.api/1.0.0");
	const root = join(context.root, "inspection"), receipt = JSON.parse(context.receiptBytes);
	assert.equal(context.receiptBytes, canonicalJson(receipt));
	assertNominalSubtypeDotnetIdentity(receipt, pkg, model, floor);
	const json = async path => {
		const bytes = await readFile(join(root, path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value)); return value;
	};
	assert.deepEqual(await json("lean-bridge/component/model.json"), model);
	const component = await json("lean-bridge/component/native-component.json"), adapter = await json("lean-bridge/native-c-adapter.json"), runtime = await json("lean-bridge/runtime.json");
	const evidence = nominalSubtypeDotnetNativeEvidence(receipt, component, adapter, runtime);
	const compiled = await json("lean-bridge/native-dotnet.json");
	assert.equal(sha256(canonicalJson(compiled)), receipt.compiledProjectionSha256);
	assert.equal(compiled.schemaVersion, 1); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256); assert.equal(compiled.assembly, nominalSubtypeDotnetAssembly);
	assert.equal(compiled.sdk, tools.sdk.version); assert.deepEqual(compiled.evidence, evidence);
	assert.equal(model.copiedGraph, undefined, "This fixture retains the concrete copied-value projection");
	const generated = generateCopiedDotnetPackage(model.bindingIr, evidence);
	for(const [path, source] of Object.entries(generated))
	{
		assert.deepEqual(compiled.files[path], identity(source), path);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.equal(await readFile(join(root, "lean-bridge/dotnet", path), "utf8"), source, path);
	}
	const global = canonicalJson({ sdk: { version: compiled.sdk, rollForward: "disable", allowPrerelease: false } });
	assert.equal(await readFile(join(root, "lean-bridge/dotnet/global.json"), "utf8"), global);
	assert.deepEqual(compiled.files["global.json"], identity(global));
	assert.equal(await readFile(join(context.root, "global.json"), "utf8"), global);
	for(const extension of ["dll", "xml"])
	{
		const path = `lib/net8.0/${nominalSubtypeDotnetAssembly}.${extension}`;
		assert.deepEqual(compiled.files[path], receipt.files[path]);
	}
	const files = { ...receipt.files, "lean-bridge/package-receipt.json": identity(context.receiptBytes) }, retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.startsWith("runtimes/") || path.endsWith(".dll")) continue;
		const bytes = await readFile(join(root, path)); assert.deepEqual(identity(bytes), files[path]);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
		await saveLakeFile(output, `package/${path}`, bytes); retained.push(path);
	}
	for(const [path, expected] of Object.entries(context.inputs))
	{
		if(path.startsWith("feed/")) continue;
		const bytes = await readFile(join(context.root, path)); assert.deepEqual(identity(bytes), expected);
		await saveLakeFile(output, `consumer-environment/${path}`, bytes);
	}
	for(const [path, expected] of Object.entries(context.buildInputs))
	{
		const bytes = await readFile(join(context.root, "obj", path)); assert.deepEqual(identity(bytes), expected);
		await saveLakeFile(output, `consumer-environment/obj/${path}`, bytes);
	}
	for(const path of [".nupkg.metadata", "nominalsubtypes.api.1.0.0.nupkg.sha512", "nominalsubtypes.api.nuspec"])
	{
		const bytes = await readFile(join(context.root, "packages", context.packageDirectory, path));
		assert.deepEqual(identity(bytes), context.cacheFiles[`${context.packageDirectory}/${path}`]);
		await saveLakeFile(output, `consumer-environment/cache/${path}`, bytes);
	}
	for(const [path, expected] of Object.entries(context.outputs))
	{
		const bytes = await readFile(join(context.root, "out", path)); assert.deepEqual(identity(bytes), expected);
		if(path.startsWith("runtimes/") || path === `${nominalSubtypeDotnetAssembly}.dll`) continue;
		await saveLakeFile(output, `consumer-environment/out/${path}`, bytes);
	}
	const record = { archive: pkg.artifacts[0]
		, receiptSha256: sha256(context.receiptBytes)
		, files, retained, evidence, compiled, closure };
	await saveLakeFile(output, "nuget.json", canonicalJson(record));
	await saveLakeFile(output, "installation.json", canonicalJson(context));
	assert.deepEqual(await verifyFinContainerEdgeDotnetEnvironment(context), closure);
	return record;
};
