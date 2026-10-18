/**
 * Authenticate value-index checked-record NuGet sources, assemblies and native inputs.
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

export const checkedRecordValueIndexDotnetAssembly = "LeanBridge.Checkedrecordvalueindices";
const packageName = "Checkedrecordvalueindices.Api";
const packageDirectory = "checkedrecordvalueindices.api/1.0.0";
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Bind NuGet coordinates, platform and provenance to the reproduced build.
 *
 * @param receipt - Archive-derived NuGet receipt.
 * @param pkg - Verified package-set component.
 * @param model - Reproduced compiler-owned model.
 * @param floor - Explicit glibc compatibility floor.
 */
export const assertCheckedRecordValueIndexDotnetIdentity = (
	receipt, pkg, model, floor
) => {
	assert.equal(pkg.target, "nuget"); assert.equal(pkg.ecosystem, "nuget");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.name, packageName);
	assert.equal(pkg.version, "1.0.0");
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "lean-bridge-ordinary-nuget-package");
	assert.equal(receipt.ecosystem, "nuget");
	assert.equal(receipt.namespace, checkedRecordValueIndexDotnetAssembly);
	assert.equal(receipt.assembly, checkedRecordValueIndexDotnetAssembly);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component);
	assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u);
	assert.equal(receipt.glibcMinimumVersion, floor);
	assert.match(receipt.compiledProjectionSha256, /^[a-f0-9]{64}$/u);
	assert.ok(pkg.artifacts[0].path.endsWith(`/${packageName}.1.0.0.nupkg`));
};

/**
 * Reconstruct private loader hashes from native receipts, not member order.
 *
 * @param receipt - Archive-derived NuGet receipt.
 * @param component - Compiled native component receipt.
 * @param adapter - Compiled C adapter receipt.
 * @param runtime - Shared native runtime manifest.
 */
export const checkedRecordValueIndexDotnetNativeEvidence = (
	receipt, component, adapter, runtime
) => {
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = {
		[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files)
			.filter(([path]) => path.startsWith("lib/"))
			.map(([path, file]) => [path.slice(4), file.sha256]))
	};
	const prefix = "runtimes/linux-x64/native/";
	assert.deepEqual(Object.fromEntries(Object.entries(receipt.files)
		.filter(([path]) => path.startsWith(prefix))
		.map(([path, file]) => [path.slice(prefix.length), file.sha256])), libraries);
	return {
		runtimeIdentity: receipt.runtimeIdentity
		, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library, libraries
	};
};

/**
 * Verify a source-free deployed tree against the installed file identities.
 *
 * @param root - Current physical deployment directory.
 * @param outputs - Original deployed file identities.
 */
export const verifyCheckedRecordValueIndexDotnetDeployment = async (
	root, outputs
) => {
	assert.equal(await realpath(root), resolve(root));
	assert.ok(outputs["Consumer.dll"]);
	assert.ok(outputs[`${checkedRecordValueIndexDotnetAssembly}.dll`]);
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
 * Preserve and authenticate the original package, restore inputs and deployment.
 *
 * @param root0 - Authenticated installation and compiler inputs.
 * @param root0.context - Archive-derived installation context.
 * @param root0.pkg - Verified package-set component.
 * @param root0.model - Reproduced compiler-owned model.
 * @param root0.floor - Explicit glibc compatibility floor.
 * @param root0.tools - Selected .NET host and SDK.
 * @param root0.output - Fresh retained-record directory.
 */
export const inspectCheckedRecordValueIndexDotnetPackage = async ({
	context, pkg, model, floor, tools, output
}) => {
	const closure = await verifyFinContainerEdgeDotnetEnvironment(context);
	assert.deepEqual(context.interpreter, tools.interpreter);
	assert.equal(context.command, tools.command);
	assert.equal(context.packageDirectory, packageDirectory);
	const root = join(context.root, "inspection");
	const receipt = JSON.parse(context.receiptBytes);
	assert.equal(context.receiptBytes, canonicalJson(receipt));
	assertCheckedRecordValueIndexDotnetIdentity(receipt, pkg, model, floor);
	const json = async path => {
		const bytes = await readFile(join(root, path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value)); return value;
	};
	assert.deepEqual(await json("lean-bridge/component/model.json"), model);
	const component = await json("lean-bridge/component/native-component.json");
	const adapter = await json("lean-bridge/native-c-adapter.json");
	const runtime = await json("lean-bridge/runtime.json");
	const evidence = checkedRecordValueIndexDotnetNativeEvidence(
		receipt, component, adapter, runtime
	);
	const compiled = await json("lean-bridge/native-dotnet.json");
	assert.equal(sha256(canonicalJson(compiled)), receipt.compiledProjectionSha256);
	assert.equal(compiled.schemaVersion, 1);
	assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.equal(compiled.assembly, checkedRecordValueIndexDotnetAssembly);
	assert.equal(compiled.sdk, tools.sdk.version);
	assert.deepEqual(compiled.evidence, evidence);
	assert.equal(model.copiedGraph, undefined);
	const generated = generateCopiedDotnetPackage(model.bindingIr, evidence);
	for(const [path, source] of Object.entries(generated))
	{
		assert.deepEqual(compiled.files[path], identity(source), path);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.equal(
				await readFile(join(root, "lean-bridge/dotnet", path), "utf8")
				, source, path
			);
	}
	const global = canonicalJson({
		sdk: { version: compiled.sdk, rollForward: "disable", allowPrerelease: false }
	});
	assert.equal(
		await readFile(join(root, "lean-bridge/dotnet/global.json"), "utf8"), global
	);
	assert.deepEqual(compiled.files["global.json"], identity(global));
	assert.equal(await readFile(join(context.root, "global.json"), "utf8"), global);
	for(const extension of ["dll", "xml"])
	{
		const path = `lib/net8.0/${checkedRecordValueIndexDotnetAssembly}.${extension}`;
		assert.deepEqual(compiled.files[path], receipt.files[path]);
	}
	const files = { ...receipt.files, "lean-bridge/package-receipt.json": identity(context.receiptBytes) }, retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.startsWith("runtimes/") || path.endsWith(".dll")) continue;
		const bytes = await readFile(join(root, path));
		assert.deepEqual(identity(bytes), files[path]);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
		await saveLakeFile(output, `package/${path}`, bytes); retained.push(path);
	}
	for(const [path, expected] of Object.entries(context.inputs))
	{
		if(path.startsWith("feed/")) continue;
		const bytes = await readFile(join(context.root, path));
		assert.deepEqual(identity(bytes), expected);
		await saveLakeFile(output, `consumer-environment/${path}`, bytes);
	}
	for(const [path, expected] of Object.entries(context.buildInputs))
	{
		const bytes = await readFile(join(context.root, "obj", path));
		assert.deepEqual(identity(bytes), expected);
		await saveLakeFile(output, `consumer-environment/obj/${path}`, bytes);
	}
	for(const path of [
		".nupkg.metadata", "checkedrecordvalueindices.api.1.0.0.nupkg.sha512"
		, "checkedrecordvalueindices.api.nuspec"
	]) {
		const bytes = await readFile(join(
			context.root, "packages", context.packageDirectory, path
		));
		assert.deepEqual(
			identity(bytes), context.cacheFiles[`${context.packageDirectory}/${path}`]
		);
		await saveLakeFile(output, `consumer-environment/cache/${path}`, bytes);
	}
	for(const [path, expected] of Object.entries(context.outputs))
	{
		const bytes = await readFile(join(context.root, "out", path));
		assert.deepEqual(identity(bytes), expected);
		if(path.startsWith("runtimes/")
			|| path === `${checkedRecordValueIndexDotnetAssembly}.dll`) continue;
		await saveLakeFile(output, `consumer-environment/out/${path}`, bytes);
	}
	const record = {
		archive: pkg.artifacts[0]
		, receiptSha256: sha256(context.receiptBytes)
		, files, retained, evidence, compiled, closure
	};
	await saveLakeFile(output, "nuget.json", canonicalJson(record));
	await saveLakeFile(output, "installation.json", canonicalJson(context));
	assert.deepEqual(await verifyFinContainerEdgeDotnetEnvironment(context), closure);
	return record;
};
