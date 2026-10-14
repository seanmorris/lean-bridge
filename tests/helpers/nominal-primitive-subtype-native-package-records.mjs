/**
 * Authenticate complete C/C++ archives and their frozen public-header generators.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { readOwnedPerlCallbackVariantTar as readRepositoryTar } from "./owned-perl-callback-result-variant-archives.mjs";
import { nominalPrimitiveSubtypeNativeGenerators, nominalPrimitiveSubtypeNativeOriginal } from "./nominal-primitive-subtype-native-generators.mjs";

/**
 * Name every original handoff file from the independently checked package set.
 *
 * @param receipt - Original C/C++ package-set receipt.
 */
export const nominalPrimitiveSubtypeNativeHandoffRecords = receipt => {
	validatePackageSetReceipt(receipt);
	assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["c", "cpp"]);
	return ["package-set-receipt.json", "package-set-receipt.json.sha256"
		, ...receipt.packages.flatMap(pkg => pkg.artifacts.map(file => file.path))].map(path => "handoff/" + path);
};

/**
 * Check package closure, generated headers and component/runtime library identities.
 *
 * @param options - Reproduced compiler authority and retained originals.
 * @param options.read - Read only selection-relative original bytes.
 * @param options.model - Independently checked native compiler model.
 * @param options.receipt - Independently checked package-set receipt.
 * @param options.floor - Explicit producer-selected glibc floor.
 * @param options.producerCommit - Frozen producer revision.
 */
export const checkNominalPrimitiveSubtypeNativePackages = async ({ read, model, receipt, floor, producerCommit }) => {
	nominalPrimitiveSubtypeNativeHandoffRecords(receipt); assert.match(floor, /^2\.[0-9]+$/u);
	const receiptBytes = await read("handoff/package-set-receipt.json");
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString(), sha256(receiptBytes) + "  package-set-receipt.json\n");
	const generators = await nominalPrimitiveSubtypeNativeGenerators(producerCommit), results = [];
	for(const pkg of receipt.packages)
	{
		const profile = pkg.target, name = "nominalprimitivesubtypes";
		assert.equal(pkg.ecosystem, profile); assert.equal(pkg.role, "component");
		assert.equal(pkg.profile, "native-library-v1"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.deepEqual(pkg.requires, []); assert.equal(pkg.name, name); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.runtimeIdentity, receipt.profiles[0].runtimeIdentity);
		const artifact = pkg.artifacts[0], archiveRoot = `${name}-1.0.0-${profile}`;
		assert.equal(artifact.path, `archives/${archiveRoot}.tar.gz`);
		const archive = await read("handoff/" + artifact.path);
		assert.equal(archive.length, artifact.bytes); assert.equal(sha256(archive), artifact.sha256);
		const files = readRepositoryTar(archive, archiveRoot);
		const bytes = files.get("lean-bridge-package.json"), packaged = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(packaged));
		assert.deepEqual(await read(profile + "/lean-bridge-package.json"), bytes);
		assert.equal(packaged.schemaVersion, 1); assert.equal(packaged.kind, "lean-bridge-native-c-package");
		assert.equal(packaged.ecosystem, profile); assert.equal(packaged.name, name); assert.equal(packaged.version, "1.0.0");
		assert.equal(packaged.profile, "native-library-v1"); assert.equal(packaged.runtimeIdentity, pkg.runtimeIdentity);
		assert.equal(packaged.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(packaged.component, model.component);
		assert.equal(packaged.glibcMinimumVersion, floor); assert.equal(packaged.copiedGraph, undefined);
		assert.equal(packaged.pkgConfig, name); assert.equal(packaged.cmakePackage, "LeanBridgeNominalprimitivesubtypes");
		assert.equal(packaged.cmakeTarget, "LeanBridge::nominalprimitivesubtypes");
		assert.equal(packaged.exactIntegers, profile === "c" ? "gmp-6.3.0" : undefined);
		assert.deepEqual([...files.keys()].sort(), [...Object.keys(packaged.files), "lean-bridge-package.json"].sort());
		for(const [path, record] of Object.entries(packaged.files))
		{
			const value = files.get(path);
			assert.deepEqual(record, { bytes: value.length, sha256: sha256(value) }, path);
		}
		const json = path => {
			const value = files.get("share/lean-bridge/" + path), record = JSON.parse(value);
			assert.equal(value.toString(), canonicalJson(record), path); return record;
		};
		assert.deepEqual(json("component/model.json"), model);
		assert.deepEqual(json("component/binding-ir.json"), model.bindingIr);
		const component = json("component/native-component.json"), adapter = json("native-c-adapter.json"), runtime = json("runtime.json");
		assert.equal(sha256(canonicalJson(runtime)), packaged.runtimeIdentity);
		assert.equal(component.runtimeIdentity, packaged.runtimeIdentity); assert.equal(adapter.runtimeIdentity, packaged.runtimeIdentity);
		assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
		assert.equal(packaged.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(packaged.adapterReceiptSha256, sha256(canonicalJson(adapter)));
		assert.equal(adapter.componentReceiptSha256, packaged.componentReceiptSha256);
		const libraries = {
			["lib/" + adapter.library]: adapter.files["lib/" + adapter.library]
			, ["lib/" + component.library]: component.nativeLibrary
			, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")))
			, ...profile === "c" ? Object.fromEntries(Object.entries(adapter.files).filter(([path]) => path.startsWith("gmp/lib/")).map(([path, file]) => [path.slice(4), file])) : {}
		};
		assert.deepEqual(Object.keys(packaged.files).filter(path => path.startsWith("lib/") && !path.startsWith("lib/pkgconfig/") && !path.startsWith("lib/cmake/")).sort(), Object.keys(libraries).sort());
		for(const [path, record] of Object.entries(libraries))
			assert.deepEqual(packaged.files[path], { bytes: record.bytes, sha256: record.sha256 }, path);
		const raw = generators.generateCBindingPackage(model.bindingIr);
		const generated = profile === "c" ? generators.generateGmpProjection(model.bindingIr).files
			: { ...raw, ...generators.generateCppBindingPackage(model.bindingIr), ...generators.boostSources() };
		for(const [path, text] of Object.entries(generated).filter(([path]) => path.startsWith("include/") || path === "share/lean-bridge/boost.json" || path.endsWith("Boost-LICENSE")))
			assert.equal(files.get(path)?.toString(), text, path);
		const headers = Object.keys(generated).filter(path => path.startsWith("include/"));
		if(profile === "c")
		{
			headers.push("include/gmp.h");
			assert.deepEqual(adapter.gmp, { library: "libnominalprimitivesubtypes_gmp.so", version: "6.3.0" });
			const gmp = json("gmp.json"), source = files.get("share/lean-bridge/sources/gmp-6.3.0.tar.xz");
			assert.deepEqual(source, nominalPrimitiveSubtypeNativeOriginal(producerCommit, "src/backends/c/gmp.source.tar.xz"));
			assert.equal(gmp.version, "6.3.0"); assert.equal(gmp.checked, true);
			assert.equal(gmp.sha256, "a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898");
			assert.equal(sha256(source), gmp.sha256);
			assert.equal(gmp.source, "https://ftp.gnu.org/gnu/gmp/gmp-6.3.0.tar.xz");
			assert.equal(gmp.signingKey, "343C2FF0FBEE5EC2EDBEF399F3599FF828C67298");
			assert.equal(gmp.license, "LGPL-3.0-or-later OR GPL-2.0-or-later");
			assert.equal(gmp.soname, undefined); assert.equal(gmp.binding, undefined);
			assert.deepEqual(Object.keys(gmp.files).sort(), [
				"include/gmp.h", "lib/libgmp.so.10"
				, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(name => "share/lean-bridge/licenses/GMP-" + name)].sort());
			for(const [path, record] of Object.entries(gmp.files))
			{
				assert.deepEqual(record, packaged.files[path], path);
				assert.deepEqual(record, adapter.files["gmp/" + path], path);
			}
			for(const flag of [
				"--build=x86_64-pc-linux-gnu", "--host=x86_64-pc-linux-gnu"
				, "--enable-fat", "--enable-shared", "--disable-static"
				, "--disable-cxx", "--with-pic", "ABI=64"])
				assert.ok(gmp.configure.includes(flag), flag);
		}
		assert.deepEqual([...files.keys()].filter(path => path.startsWith("include/")).sort(), headers.sort());
		const sourceLicense = nominalPrimitiveSubtypeNativeOriginal(producerCommit, "tests/fixtures/onboarding/nominal-primitive-subtypes/LICENSE");
		const noticePath = "share/lean-bridge/licenses/source-notices.json";
		assert.equal(sha256(files.get(noticePath)), model.sourceIdentity.sourceNoticesSha256);
		const payloadPath = "share/lean-bridge/licenses/source-notices/" + sha256(sourceLicense) + ".txt";
		assert.deepEqual(files.get(payloadPath), sourceLicense);
		const expectedPaths = [
			"README.md", "package-metadata.json", ...headers, ...Object.keys(libraries)
			, "lib/pkgconfig/" + name + ".pc"
			, ...["Config", "ConfigVersion"].map(suffix => "lib/cmake/" + packaged.cmakePackage + "/" + packaged.cmakePackage + suffix + ".cmake")
			, ...["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json"].map(path => "share/lean-bridge/component/" + path)
			, "share/lean-bridge/runtime.json", "share/lean-bridge/native-c-adapter.json"
			, ...["Lean-LICENSE", "Lean-LICENSES", "LeanBridge-LICENSE"].map(path => "share/lean-bridge/licenses/" + path)
			, noticePath, payloadPath
			, ...profile === "c" ? [
				"share/lean-bridge/gmp.json", "share/lean-bridge/sources/gmp-6.3.0.tar.xz"
				, ...["COPYING", "COPYING.LESSERv3", "COPYINGv2", "COPYINGv3"].map(path => "share/lean-bridge/licenses/GMP-" + path)
			] : ["share/lean-bridge/boost.json", "share/lean-bridge/licenses/Boost-LICENSE"]
		];
		assert.equal(new Set(expectedPaths).size, expectedPaths.length);
		assert.deepEqual(Object.keys(packaged.files).sort(), expectedPaths.sort());
		results.push({ profile, artifact, receiptSha256: sha256(bytes)
			, packageFileSetSha256: sha256(canonicalJson([...files.keys()].sort()))
			, files: files.size });
	}
	return { packages: results, generatorPaths: generators.paths };
};
