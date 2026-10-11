/**
 * Authenticate recorded checked-record observations on Rust, .NET, native PHP and WIT.
 * Original host paths are provenance; this checker opens only relative producer records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { brickMathSources } from "../../src/backends/php/brick-math.mjs";
import { assertCheckedRecordHostRecords } from "./checked-record-native-records.mjs";
import { checkedRecordHostConsumer } from "./checked-record-native-fixture.mjs";

const identity = value => ({ bytes: Buffer.byteLength(value), sha256: sha256(value) });
const files = value => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.ok(Object.keys(value).length > 0);
	for(const [path, entry] of Object.entries(value))
	{
		assert.ok(!path.split("/").some(part => part === "." || part === ".."));
		assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
		assert.match(entry.sha256, /^[0-9a-f]{64}$/u);
	}
};
const names = (value, expected) => assert.deepEqual(Object.keys(value).sort(), expected.sort());

/**
 * Verify the full callers and the environment inventories actually recorded by each producer.
 *
 * @param options - Explicit host selection and original relative-record reader.
 */
export const assertCheckedRecordRemainingHostRecords = async options => {
	assert.ok(options.profiles.every(profile => ["rust", "dotnet", "php-native", "wit-wasi"].includes(profile)));
	const glibc = options.glibc ?? "2.36";
	assert.ok(["2.36", "2.38"].includes(glibc), "Unknown checked-record package glibc floor");
	const report = await assertCheckedRecordHostRecords(options);
	const model = JSON.parse(await options.read("build-0/model.json"));
	for(const item of report.reports)
	{
		const profile = item.profile, pkg = item.packages.find(value => value.role === "component");
		if(profile === "rust" || profile === "wit-wasi") continue;
		const dotnet = profile === "dotnet", environment = dotnet ? item.dotnetEnvironment : item.phpEnvironment;
		const receipt = JSON.parse(environment.receiptBytes), receiptPath = "lean-bridge/package-receipt.json";
		assert.equal(environment.receiptBytes, canonicalJson(receipt));
		assert.equal(receipt.schemaVersion, 1);
		assert.equal(receipt.kind, dotnet ? "lean-bridge-ordinary-nuget-package" : "lean-bridge-ordinary-php-package");
		for(const field of ["name", "version", "ecosystem", "runtimeIdentity"]) assert.equal(receipt[field], pkg[field]);
		assert.equal(receipt.bindingIrSha256, item.bindingIrSha256);
		assert.deepEqual(receipt.component, model.component); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
		assert.equal(receipt.glibcMinimumVersion, glibc); files(receipt.files);
		assert.deepEqual(receipt.files["lean-bridge/component/model.json"], identity(canonicalJson(model)));
		assert.deepEqual(receipt.files["lean-bridge/component/binding-ir.json"], identity(canonicalJson(model.bindingIr)));
		assert.equal(environment.packageFileSetSha256, sha256(canonicalJson([...Object.keys(receipt.files), receiptPath].sort())));
		assert.equal(pkg.artifacts.length, 1);
		const artifact = pkg.artifacts[0], archive = { bytes: artifact.bytes, sha256: artifact.sha256 };
		files(environment.inputs);
		const source = await checkedRecordHostConsumer(profile, options.route);
		assert.deepEqual(environment.inputs[dotnet ? "consumer.cs" : "consumer.php"], identity(source));
		if(dotnet)
		{
			assert.equal(receipt.assembly, "LeanBridge.Checkedrecords");
			assert.equal(environment.archiveName, "Checkedrecords.Api.1.0.0.nupkg");
			assert.equal(environment.packageDirectory, "checkedrecords.api/1.0.0");
			names(environment.inputs, ["consumer.cs", "Consumer.csproj", "NuGet.Config", "global.json", "feed/" + environment.archiveName]);
			assert.deepEqual(environment.inputs["feed/" + environment.archiveName], archive);
			files(environment.cacheFiles); files(environment.outputs); files(environment.buildInputs); files({ interpreter: environment.interpreter });
			names(environment.buildInputs, ["Consumer.csproj.nuget.dgspec.json", "Consumer.csproj.nuget.g.props", "Consumer.csproj.nuget.g.targets", "project.assets.json", "project.nuget.cache"]);
			const cached = {};
			for(const [path, entry] of Object.entries({ ...receipt.files, [receiptPath]: identity(environment.receiptBytes) }))
			{
				if(path === "[Content_Types].xml" || path === "_rels/.rels") continue;
				cached[`${environment.packageDirectory}/${path === "Checkedrecords.Api.nuspec" ? path.toLowerCase() : path}`] = entry;
			}
			const packageName = `${environment.packageDirectory}/checkedrecords.api.1.0.0.nupkg`;
			names(environment.cacheFiles, [...Object.keys(cached), packageName, packageName + ".sha512", environment.packageDirectory + "/.nupkg.metadata"]);
			for(const [path, entry] of Object.entries(cached)) assert.deepEqual(environment.cacheFiles[path], entry);
			assert.deepEqual(environment.cacheFiles[packageName], archive);
			const supplied = {};
			for(const [path, entry] of Object.entries(receipt.files))
			{
				if(path.startsWith("lib/net8.0/") && path.endsWith(".dll")) supplied[path.slice("lib/net8.0/".length)] = entry;
				else if(path.startsWith("runtimes/linux-x64/native/")) supplied[path] = entry;
			}
			names(environment.outputs, [...Object.keys(supplied), "Consumer.deps.json", "Consumer.dll", "Consumer.pdb", "Consumer.runtimeconfig.json"]);
			for(const [path, entry] of Object.entries(supplied)) assert.deepEqual(environment.outputs[path], entry);
		}
		else
		{
			assert.equal(environment.name, "example/checkedrecords");
			names(environment.inputs, ["consumer.php", "strict.php", "composer.json"]);
			assert.deepEqual(environment.inputs["strict.php"], identity(source.replace("declare(strict_types=0);", "declare(strict_types=1);")));
			files(environment.feedFiles); files(environment.dependencyFiles); files(environment.generatedFiles); files(environment.vendorFiles); files(environment.tools);
			assert.deepEqual(environment.feedFiles["component.zip"], archive);
			assert.deepEqual(environment.dependencyFiles, Object.fromEntries(Object.entries(brickMathSources()).map(([path, data]) => [path, identity(data)])));
			const generated = ["ClassLoader.php", "InstalledVersions.php", "LICENSE", "autoload_classmap.php", "autoload_files.php", "autoload_namespaces.php", "autoload_psr4.php", "autoload_real.php", "autoload_static.php", "installed.json", "installed.php", "platform_check.php"];
			names(environment.generatedFiles, ["composer.lock", "vendor/autoload.php", ...generated.map(path => "vendor/composer/" + path)]);
			const expected = Object.fromEntries([
				...Object.entries({ ...receipt.files, [receiptPath]: identity(environment.receiptBytes) }).map(([path, entry]) => [environment.name + "/" + path, entry])
				, ...Object.entries(environment.dependencyFiles).map(([path, entry]) => ["brick/math/" + path, entry])
				, ...Object.entries(environment.generatedFiles).filter(([path]) => path.startsWith("vendor/")).map(([path, entry]) => [path.slice(7), entry])
			]);
			assert.deepEqual(environment.vendorFiles, expected);
			assert.ok(environment.tools[environment.command] && environment.tools[environment.composer]);
			const flags = environment.runtimeFlags;
			assert.ok(Array.isArray(flags) && [3, 5].includes(flags.length));
			assert.equal(flags[0], "-n");
			assert.deepEqual(flags.slice(-2), ["-d", "ffi.enable=1"]);
			if(flags.length === 5)
			{
				assert.equal(flags[1], "-d"); assert.match(flags[2], /^extension=\/[^\0\r\n]+\/ffi\.so$/u);
				assert.ok(environment.tools[flags[2].slice("extension=".length)]);
			}
		}
	}
	return report;
};
