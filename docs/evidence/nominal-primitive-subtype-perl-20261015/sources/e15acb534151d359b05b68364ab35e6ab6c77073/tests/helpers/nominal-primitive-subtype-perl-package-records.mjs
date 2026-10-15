/**
 * Authenticate installed primitive-base Perl payloads, ABI selection and the producer's public API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertNominalPrimitiveSubtypePerlPackageIdentity } from "./nominal-primitive-subtype-perl-install.mjs";
import { nominalSubtypePerlOriginal as nominalPrimitiveSubtypePerlOriginal, nominalSubtypePerlGenerator as nominalPrimitiveSubtypePerlGenerator } from "./nominal-subtype-perl-generators.mjs";

const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);
const generated = new Map();
/**
 * Reject traversal and absolute names while allowing Perl namespace colons.
 *
 * @param path - Archive-relative or installed-relative path.
 */
export const nominalPrimitiveSubtypePerlSafePath = path => assert.ok(/^(?:[A-Za-z0-9_.:-]+\/)*[A-Za-z0-9_.:-]+$/u.test(path) && path.split("/").every(part => ![".", ".."].includes(part)));
const expectedApi = async (revision, model, manifest) => {
	const key = sha256(canonicalJson({ revision, model, manifest }));
	if(!generated.has(key))
	{
		const { generatePerlBindingPackage } = await nominalPrimitiveSubtypePerlGenerator(revision);
		const library = `libcomponent_${sha256(model.component.id).slice(0, 20)}.so`;
		const relative = manifest.module.replaceAll("::", "/");
		const librarySha256 = manifest.files[`lib/${relative}/native/${library}`]; hash(librarySha256);
		const files = generatePerlBindingPackage(model, { library
			, initializer: `initialize_LeanBridgeNative${sha256(model.component.id).slice(0, 16)}`
			, nativeLibrary: { sha256: librarySha256 }
			, runtimeIdentity: manifest.runtimeIdentity });
		const pm = files[`lib/${relative}.pm`].replace("our $VERSION = '0.001';", `our $VERSION = '${manifest.version}';`)
			.replace("use LeanBridge::Runtime;", `use LeanBridge::Runtime;\ndie "Incompatible shared Lean runtime package version\\n" unless $LeanBridge::Runtime::VERSION eq '${manifest.runtimeVersion}';`);
		generated.set(key, { xs: sha256(files[manifest.xs]), pm: sha256(pm) });
	}
	return generated.get(key);
};

/**
 * Bind each installed record to the prepared identity and exact producer API.
 *
 * @param options - Independent archive readers, compiled model and installation.
 * @param options.read - Original relative byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.item - One of eight installed observations.
 * @param options.receipt - Authenticated package-set receipt.
 * @param options.model - Independently reconciled nominal model.
 * @param options.producerCommit - Frozen producer source revision.
 * @param options.floor - Explicitly recorded minimum glibc version.
 */
export const checkNominalPrimitiveSubtypePerlPackages = async ({ read, json, item, receipt, model, producerCommit, floor }) => {
	const prefix = `${item.configuration}/${item.delivery}/`, installed = await json(prefix + "installed-files.json");
	assert.equal(item.installedFilesSha256, sha256(canonicalJson(installed)));
	assert.ok(Object.keys(installed).length > 5);
	for(const [path, record] of Object.entries(installed))
	{
		nominalPrimitiveSubtypePerlSafePath(path); hash(record.sha256);
		assert.deepEqual(Object.keys(record).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(record.bytes) && record.bytes >= 0);
	}
	assert.deepEqual(item.traces.map(trace => trace.role), ["runtime", "component"]);
	const runtime = await json(prefix + "runtime-manifest.json");
	for(const recorded of item.traces)
	{
		const role = recorded.role, manifest = await json(prefix + `${role}-manifest.json`);
		const receiptBytes = await read(prefix + `${role}-install-receipt.json`), installation = JSON.parse(receiptBytes);
		const trace = await json(prefix + `${role}-trace.json`);
		assert.equal(recorded.manifestSha256, sha256(canonicalJson(manifest)));
		assert.equal(recorded.receiptSha256, sha256(receiptBytes)); assert.equal(recorded.traceSha256, sha256(canonicalJson(trace)));
		assertNominalPrimitiveSubtypePerlPackageIdentity(manifest, receipt.packages.find(pkg => pkg.role === role), runtime);
		assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.backend, "perl"); assert.equal(manifest.ecosystem, "cpan");
		assert.equal(manifest.glibcMinimumVersion, floor);
		for(const [path, sha] of Object.entries(manifest.files))
		{ nominalPrimitiveSubtypePerlSafePath(path); hash(sha); }
		const relative = manifest.module.replaceAll("::", "/");
		const xsSha256 = sha256(await read(prefix + `${role}-source.xs`));
		const pmSha256 = sha256(await read(prefix + `${role}-public.pm`));
		assert.equal(xsSha256, manifest.files[manifest.xs]); assert.equal(pmSha256, manifest.files[`lib/${relative}.pm`]);
		if(role === "runtime")
		{
			assert.equal(xsSha256, sha256(nominalPrimitiveSubtypePerlOriginal(producerCommit, "src/backends/perl/Runtime.xs")));
			const pm = nominalPrimitiveSubtypePerlOriginal(producerCommit, "src/backends/perl/Runtime.pm").toString()
				.replace("our $VERSION = '0.001';", `our $VERSION = '${manifest.version}';`);
			assert.equal(pmSha256, sha256(pm));
		} else
		{
			assert.equal(manifest.version, "1.000");
			assert.equal(manifest.files["model.json"], sha256(canonicalJson(model)));
			assert.equal(manifest.files["binding-ir.json"], sha256(canonicalJson(model.bindingIr)));
			assert.deepEqual({ xs: xsSha256, pm: pmSha256 }, await expectedApi(producerCommit, model, manifest));
		}
		const operation = item.delivery === "prebuilt-only" ? "prebuilt-xs" : "generated-xs-only";
		assert.equal(installation.schemaVersion, 1); assert.equal(trace.schemaVersion, 1); assert.equal(trace.ecosystem, "cpan");
		assert.equal(installation.operation, operation); assert.equal(trace.operation, operation);
		assert.equal(trace.nativePayloadUnchanged, true); assert.equal(trace.runtimeIdentity, manifest.runtimeIdentity);
		for(const field of ["archname", "useithreads", "usemultiplicity", "ivsize", "ptrsize"])
			assert.equal(installation.abi[field], item.identity[field] ?? "", field);
		assert.equal(installation.abi.api_revision, item.identity.version.split(".")[0]);
		assert.equal(installation.abi.api_version, item.identity.version.split(".")[1]);
		assert.equal(manifest.prebuilt.length, 4);
		assert.equal(new Set(manifest.prebuilt.map(variant => variant.abiKey)).size, 4);
		for(const variant of manifest.prebuilt)
		{
			assert.equal(variant.abiKey, sha256(JSON.stringify(JSON.parse(canonicalJson(variant.abi)))));
			hash(manifest.files[variant.path]); nominalPrimitiveSubtypePerlSafePath(variant.path);
		}
		assert.deepEqual(manifest.prebuilt.map(variant => `${variant.abi.api_version}:${variant.abi.useithreads}`).sort(), ["36:", "36:define", "38:", "38:define"]);
		const variant = manifest.prebuilt.find(value => canonicalJson(value.abi) === canonicalJson(installation.abi)); assert.ok(variant);
		const suffix = `${relative}/install-receipt.json`, matched = Object.keys(installed).filter(path => path.endsWith("/" + suffix));
		assert.equal(matched.length, 1);
		const base = matched[0].slice(0, -suffix.length);
		assert.deepEqual(installed[matched[0]], { bytes: receiptBytes.length, sha256: sha256(receiptBytes) });
		assert.ok(trace.files.length > 1);
		for(const file of trace.files)
		{ nominalPrimitiveSubtypePerlSafePath(file.path); assert.equal(installed[base + file.path]?.sha256, file.sha256); }
		const payloads = Object.entries(manifest.files).filter(([path]) => path.startsWith("lib/")).map(([path, sha256]) => ({ path: path.slice(4), sha256, origin: "prepared-payload" }));
		assert.deepEqual(trace.files.slice(0, -1), payloads);
		assert.deepEqual(trace.files.at(-1), { path: `auto/${relative}/${relative.split("/").at(-1)}.so`, sha256: installation.outputSha256, origin: operation });
		if(item.delivery === "prebuilt-only") assert.equal(manifest.files[variant.path], installation.outputSha256);
		else
		{
			assert.equal(installation.sourceSha256, manifest.files[manifest.xs]);
			assert.equal(installation.runtimeIdentity, manifest.runtimeIdentity); hash(installation.generatedCSha256);
			assert.equal(installation.commands.length, 2);
			const [compile, link] = installation.commands, stem = relative.split("/").at(-1);
			assert.deepEqual(compile.filter(argument => argument.endsWith(".c")), [`_xs-build/${stem}.c`]);
			assert.ok(compile.includes("-c")); assert.ok(link.includes(`_xs-build/${stem}.o`));
			assert.ok(link.includes(`_xs-build/${stem}.so`));
			assert.ok([compile[0], link[0]].every(command => /^(?:\/usr\/bin\/)?(?:cc|gcc|x86_64-linux-gnu-gcc)$/u.test(command)));
		}
	}
};
