/**
 * Check archive-authenticated WIT members against the original complete generator.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeWitGenerator } from "./nominal-subtype-wit-generators.mjs";
import { assertNominalSubtypeWitIdentity, nominalSubtypeWitReceipt, nominalSubtypeWitNativeEvidence } from "./nominal-subtype-wit-package.mjs";

export const nominalSubtypeWitComponentRecord = "package/component/nominalsubtypes.wasm";

/**
 * Reconcile original source members, native identities and the actual component bytes.
 * The component supplement must be extracted from the authenticated original archive.
 *
 * @param options - Original records and independently authenticated compiler model.
 * @param options.read - Selection-relative original byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.model - Reproduced compiler model.
 * @param options.receipt - Verified package-set receipt.
 * @param options.floor - Explicit glibc floor.
 * @param options.tools - Authenticated original C API identity.
 * @param options.producerCommit - Immutable generator revision.
 */
export const checkNominalSubtypeWitPackageRecords = async ({ read, json, model, receipt, floor, tools, producerCommit }) => {
	const pkg = receipt.packages[0], packaged = await json("package.json");
	assert.deepEqual(Object.keys(packaged).sort(), ["archive", "closure", "evidence", "files", "receiptSha256", "retained"]);
	assert.deepEqual(packaged.archive, pkg.artifacts[0]);
	const receiptBytes = await read(`package/${nominalSubtypeWitReceipt}`), packageReceipt = await json(`package/${nominalSubtypeWitReceipt}`);
	assertNominalSubtypeWitIdentity(packageReceipt, pkg, model, floor);
	assert.equal(packaged.receiptSha256, sha256(receiptBytes));
	const paths = [...Object.keys(packageReceipt.files), nominalSubtypeWitReceipt].sort();
	assert.equal(new Set(paths).size, paths.length); assert.deepEqual(Object.keys(packaged.files).sort(), paths);
	for(const path of paths)
	{
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."));
		const file = packaged.files[path]; assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		if(Object.hasOwn(packageReceipt.files, path)) assert.deepEqual(file, packageReceipt.files[path]);
	}
	assert.deepEqual(packaged.retained, paths.filter(path => !path.endsWith(".so") && !path.endsWith(".wasm")));
	for(const path of packaged.retained)
	{
		const bytes = await read(`package/${path}`);
		assert.deepEqual(packaged.files[path], { bytes: bytes.length, sha256: sha256(bytes) }, path);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
	}
	const prefix = "package/share/lean-bridge/";
	assert.equal(model.copiedGraph, undefined);
	assert.deepEqual(await json(prefix + "component/model.json"), model);
	assert.deepEqual(await json(prefix + "component/binding-ir.json"), model.bindingIr);
	const component = await json(prefix + "component/native-component.json"), adapter = await json(prefix + "native-c-adapter.json");
	const runtime = await json(prefix + "runtime.json"), wit = await json("package/native-wit-adapter.json");
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(wit.wasmTools, tools.versions.wasmTools.run.stdout.trim());
	const evidence = nominalSubtypeWitNativeEvidence(packageReceipt, component, adapter, runtime, wit, tools);
	assert.deepEqual(packaged.evidence, evidence);
	const bytes = await read(nominalSubtypeWitComponentRecord);
	assert.deepEqual(bytes.subarray(0, 8), Buffer.from([0, 97, 115, 109, 13, 0, 1, 0]));
	assert.equal(sha256(bytes), packageReceipt.componentSha256);
	assert.deepEqual(packaged.files["component/nominalsubtypes.wasm"], { bytes: bytes.length, sha256: sha256(bytes) });
	const generator = await nominalSubtypeWitGenerator(producerCommit);
	const projection = generator.compileCopiedWitModel(model.bindingIr, { name: pkg.name, version: pkg.version }, { callables: true });
	for(const [path, source] of Object.entries({ "wit/nominalsubtypes.wit": projection.wit
		, "component/nominalsubtypes.wat": projection.wat
		, "include/nominalsubtypes_wasmtime.h": generator.renderWitHostHeader(projection)
		, "binding-manifest.json": canonicalJson(projection.manifest)
		, "src/nominalsubtypes_wasmtime.c": generator.guardWitHostSource(generator.renderWitHostSource(projection, bytes), projection.surface.prefix, evidence.dependencies) }))
		assert.equal((await read("package/" + path)).toString(), source, path);
	const pkgConfig = "prefix=${pcfiledir}/../..\nincludedir=${prefix}/include\nlibdir=${prefix}/lib\n\nName: nominalsubtypes-wit\nDescription: Compiled Lean WIT API and Wasmtime 42.0.1 host\nVersion: 1.0.0\nLibs: -L${libdir} -Wl,-rpath,${libdir} -lnominalsubtypes_wasmtime -lwasmtime\nCflags: -I${includedir}\n";
	assert.equal((await read("package/lib/pkgconfig/nominalsubtypes-wit.pc")).toString(), pkgConfig);
	const closure = { receiptSha256: sha256(receiptBytes), packageFileSetSha256: sha256(canonicalJson(paths)) };
	assert.deepEqual(packaged.closure, closure);
	return { packageReceipt, packaged, projection, generatorPaths: generator.paths };
};
