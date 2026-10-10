/**
 * Authenticate RubyGems and JVM environment records against the original reviewed package receipts.
 * Historical paths are checked as data; the reader never opens those installed trees.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertReviewedSubtypeHostRecords } from "./reviewed-subtype-host-report.mjs";
import { reviewedSubtypeHostConsumer } from "./reviewed-subtype-host-fixture.mjs";

const identity = value => ({ bytes: Buffer.byteLength(value), sha256: sha256(value) });
const fileMap = files => {
	assert.ok(files && typeof files === "object" && !Array.isArray(files));
	assert.ok(Object.keys(files).length > 0);
	for(const [path, file] of Object.entries(files))
	{
		assert.match(path, /^[A-Za-z0-9_.$+-]+(?:\/[A-Za-z0-9_.$+-]+)*$/u);
		assert.ok(path.split("/").every(part => part !== "." && part !== ".."));
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
};

/**
 * Require the actual selected Ruby, Java or Kotlin receipt and closed executable input set.
 *
 * @param options - Explicit profiles and an archive-relative original-record reader.
 */
export const assertReviewedSubtypeRubyJvmRecords = async options => {
	assert.ok(options.profiles.every(profile => ["ruby", "java", "kotlin"].includes(profile)));
	const report = await assertReviewedSubtypeHostRecords(options);
	const model = JSON.parse(await options.read("build-0/model.json"));
	for(const item of report.reports)
	{
		const ruby = item.profile === "ruby", environment = ruby ? item.rubyEnvironment : item.jvmEnvironment;
		const receipt = JSON.parse(environment.receiptBytes), pkg = item.packages.find(value => value.role === "component");
		assert.equal(environment.receiptBytes, canonicalJson(receipt));
		assert.equal(receipt.schemaVersion, 1);
		assert.equal(receipt.kind, ruby ? "lean-bridge-ordinary-rubygems-package" : "lean-bridge-ordinary-maven-package");
		for(const field of ["name", "version", "ecosystem", "runtimeIdentity"])
			assert.equal(receipt[field], pkg[field]);
		assert.equal(receipt.bindingIrSha256, item.bindingIrSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
		assert.equal(receipt.glibcMinimumVersion, "2.36");
		fileMap(receipt.files); fileMap(environment.files);
		const part = ruby ? "lean-bridge" : "META-INF/lean-bridge";
		assert.deepEqual(receipt.files[`${part}/component/model.json`], identity(canonicalJson(model)));
		assert.deepEqual(receipt.files[`${part}/component/binding-ir.json`], identity(canonicalJson(model.bindingIr)));
		if(ruby)
		{
			assert.equal(receipt.namespace, "LeanBridge::Subtypes");
			assert.equal(receipt.requirePath, "lean_bridge/subtypes");
			assert.equal(environment.fullName, "subtypes-1.0.0-x86_64-linux");
			assert.equal(environment.expectedSha256, sha256(canonicalJson(environment.files)));
			const prefix = `gems/${environment.fullName}/`, gemspec = `specifications/${environment.fullName}.gemspec`;
			const artifact = pkg.artifacts[0];
			assert.equal(pkg.artifacts.length, 1);
			assert.deepEqual(Object.keys(environment.files).sort(), [
				...Object.keys(receipt.files).map(path => prefix + path)
				, prefix + "lean-bridge/package-receipt.json"
				, `cache/${environment.fullName}.gem`, gemspec
			].sort());
			for(const [path, expected] of Object.entries(receipt.files)) assert.deepEqual(environment.files[prefix + path], expected);
			assert.deepEqual(environment.files[prefix + "lean-bridge/package-receipt.json"], identity(environment.receiptBytes));
			assert.deepEqual(environment.files[`cache/${environment.fullName}.gem`], { bytes: artifact.bytes, sha256: artifact.sha256 });
			assert.ok(environment.files[gemspec].bytes > 0);
			fileMap({ interpreter: environment.interpreter });
		}
		else
		{
			assert.equal(environment.profile, item.profile);
			assert.equal(receipt.namespace, "org.leanbridge.subtypes");
			assert.deepEqual(receipt.kotlin, { namespace: "org.leanbridge.subtypes.kotlin", standardLibraryVersion: "2.2.0" });
			assert.match(environment.interpreterSha256, /^[a-f0-9]{64}$/u);
			const artifact = pkg.artifacts.find(value => value.path.endsWith(".jar"));
			assert.equal(environment.archiveSha256, artifact.sha256);
			assert.deepEqual(environment.files["component.jar"], { bytes: artifact.bytes, sha256: artifact.sha256 });
			const source = `consumer.${item.profile === "java" ? "java" : "kt"}`;
			assert.deepEqual(environment.files[source], identity(await reviewedSubtypeHostConsumer(item.profile)));
			assert.deepEqual(Object.keys(environment.files).sort(), ["component.jar", source, item.profile === "java" ? "classes/Consumer.class" : "consumer.jar"].sort());
			const names = [...Object.keys(receipt.files), "META-INF/lean-bridge/package-receipt.json"].sort();
			assert.equal(environment.packageFileSetSha256, sha256(canonicalJson(names)));
			assert.deepEqual(receipt.files["META-INF/MANIFEST.MF"], identity("Manifest-Version: 1.0\n\n"));
			for(const path of names) assert.ok(!/^META-INF\/(?:services\/|versions\/|INDEX\.LIST$)/u.test(path) && path !== "module-info.class");
		}
	}
	return report;
};
