/**
 * Authenticate NuGet package records against the original complete C# generator.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeDotnetGenerator } from "./nominal-primitive-subtype-dotnet-generators.mjs";
import { assertNominalPrimitiveSubtypeDotnetIdentity, nominalPrimitiveSubtypeDotnetAssembly } from "./nominal-primitive-subtype-dotnet-package.mjs";

const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const receiptPath = "lean-bridge/package-receipt.json";

/**
 * Check every retained package source, generated managed source and loader input.
 *
 * @param options - Original readers and independently reconciled compiler model.
 * @param options.read - Selection-relative original byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.model - Reproduced compiler-owned model.
 * @param options.receipt - Package-set receipt.
 * @param options.floor - Explicit native glibc floor.
 * @param options.producerCommit - Original immutable source revision.
 * @param options.sdk - Actual selected SDK version.
 */
export const checkNominalPrimitiveSubtypeDotnetPackage = async ({ read, json, model, receipt, floor, producerCommit, sdk }) => {
	const pkg = receipt.packages[0], nuget = await json("nuget.json");
	assert.deepEqual(Object.keys(nuget).sort(), ["archive", "closure", "compiled"
		, "evidence", "files", "receiptSha256", "retained"]);
	assert.deepEqual(nuget.archive, pkg.artifacts[0]);
	const receiptBytes = await read(`package/${receiptPath}`);
	const packageReceipt = await json(`package/${receiptPath}`);
	assertNominalPrimitiveSubtypeDotnetIdentity(packageReceipt, pkg, model, floor);
	assert.equal(nuget.receiptSha256, sha256(receiptBytes));
	const files = { ...packageReceipt.files, [receiptPath]: identity(receiptBytes) };
	const paths = Object.keys(files).sort();
	assert.equal(paths.length, Object.keys(packageReceipt.files).length + 1);
	assert.equal(new Set(paths.map(path => path.toLowerCase())).size, paths.length);
	assert.deepEqual(nuget.files, files);
	for(const [path, file] of Object.entries(files))
	{
		assert.ok(/^[A-Za-z0-9_.+/[\]-]+$/u.test(path)
			&& path.split("/").every(part => part && part !== "." && part !== ".."));
		assert.ok(!/^(?:build|buildTransitive|buildMultiTargeting|analyzers|tools|content|contentFiles)\//iu.test(path));
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
	assert.deepEqual(nuget.retained, paths.filter(path => !path.startsWith("runtimes/") && !path.endsWith(".dll")));
	for(const path of nuget.retained)
	{
		const bytes = await read(`package/${path}`);
		assert.deepEqual(identity(bytes), files[path], path);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
	}
	const nuspec = (await read(`package/${pkg.name}.nuspec`)).toString();
	assert.ok(nuspec.includes(`<id>${pkg.name}</id>`));
	assert.ok(nuspec.includes(`<version>${pkg.version}</version>`));
	assert.doesNotMatch(nuspec, /<!DOCTYPE|<!ENTITY|<dependency\b|<references\b|<frameworkAssemblies\b/iu);
	assert.deepEqual(await json("package/lean-bridge/component/model.json"), model);
	assert.deepEqual(await json("package/lean-bridge/component/binding-ir.json"), model.bindingIr);
	const component = await json("package/lean-bridge/component/native-component.json");
	const adapter = await json("package/lean-bridge/native-c-adapter.json");
	const runtime = await json("package/lean-bridge/runtime.json");
	assert.equal(sha256(canonicalJson(runtime)), packageReceipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, packageReceipt.runtimeIdentity);
	assert.equal(adapter.runtimeIdentity, packageReceipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, model.bindingIrSha256);
	assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`]
		, [component.library]: component.nativeLibrary
		, ...Object.fromEntries(Object.entries(runtime.files)
			.filter(([path]) => path.startsWith("lib/"))
			.map(([path, file]) => [path.slice(4), file])) };
	const binaryPrefix = "runtimes/linux-x64/native/";
	assert.deepEqual(Object.fromEntries(paths.filter(path => path.startsWith("runtimes/"))
		.map(path => [path.slice(binaryPrefix.length), files[path]])), libraries);
	const evidence = { runtimeIdentity: packageReceipt.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library
		, libraries: Object.fromEntries(Object.entries(libraries).map(([name, file]) => [name, file.sha256])) };
	assert.deepEqual(nuget.evidence, evidence);
	const compiled = await json("package/lean-bridge/native-dotnet.json");
	assert.deepEqual(nuget.compiled, compiled);
	assert.deepEqual(Object.keys(compiled).sort(), ["assembly", "bindingIrSha256"
		, "evidence", "files", "profile", "schemaVersion", "sdk"]);
	assert.equal(sha256(canonicalJson(compiled)), packageReceipt.compiledProjectionSha256);
	assert.equal(compiled.schemaVersion, 1);
	assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.assembly, nominalPrimitiveSubtypeDotnetAssembly);
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.equal(compiled.sdk, sdk);
	assert.deepEqual(compiled.evidence, evidence);
	assert.equal(model.copiedGraph, undefined);
	const { generateCopiedDotnetPackage, paths: generatorPaths } = await nominalPrimitiveSubtypeDotnetGenerator(producerCommit);
	const generated = generateCopiedDotnetPackage(model.bindingIr, evidence);
	const library = `lib/net8.0/${nominalPrimitiveSubtypeDotnetAssembly}`;
	assert.deepEqual(Object.keys(compiled.files).sort(), [...Object.keys(generated)
		, "global.json"
		, ...["dll", "xml", "deps.json"].map(extension => `${library}.${extension}`)
	].sort());
	for(const file of Object.values(compiled.files))
	{
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
	for(const [path, source] of Object.entries(generated))
	{
		assert.deepEqual(compiled.files[path], identity(source), path);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.equal((await read(`package/lean-bridge/dotnet/${path}`)).toString(), source, path);
	}
	assert.deepEqual(paths.filter(path => path.endsWith(".cs")).sort(), Object.keys(generated)
		.filter(path => path.endsWith(".cs")).map(path => `lean-bridge/dotnet/${path}`).sort());
	const global = canonicalJson({ sdk: { version: sdk, rollForward: "disable", allowPrerelease: false } });
	assert.equal((await read("package/lean-bridge/dotnet/global.json")).toString(), global);
	assert.deepEqual(compiled.files["global.json"], identity(global));
	for(const extension of ["dll", "xml"])
		assert.deepEqual(compiled.files[`${library}.${extension}`], files[`${library}.${extension}`]);
	const assembly = await read(`api-probe/inputs/library/${nominalPrimitiveSubtypeDotnetAssembly}.dll`);
	assert.deepEqual(identity(assembly), files[`${library}.dll`]);
	assert.equal(nuget.closure.receiptSha256, sha256(receiptBytes));
	assert.equal(nuget.closure.packageFileSetSha256, sha256(canonicalJson(paths)));
	return { packageReceipt, nuget, generatorPaths };
};
