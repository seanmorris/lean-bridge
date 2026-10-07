/**
 * Original installed generic-record observations, retained without promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { genericRecordInstantiations } from "./generic-record-packages.mjs";

const directory = "docs/evidence/generic-record-hosts-20261007";
const expected = [
	{ id: "rust"
		, revision: "e54ea9e8ad6ae02345abff719253e9156767daef"
		, sha256: "e06cfe8042936f20a518c526eda924ad9243b71e60457568a3c80df85e22cfea"
		, profiles: ["rust"] }
	, { id: "python"
		, revision: "e54ea9e8ad6ae02345abff719253e9156767daef"
		, sha256: "f5881f66790c11a17a32f657d00a5c0687a696a5396de98dea1e50f9fed34468"
		, profiles: ["python"] }
	, { id: "ruby"
		, revision: "e54ea9e8ad6ae02345abff719253e9156767daef"
		, sha256: "81f77b4156d9a68a0bc6ce8fbf3f57e23307d82213218a41c189e542695d9c90"
		, profiles: ["ruby"] }
	, { id: "dotnet"
		, revision: "e54ea9e8ad6ae02345abff719253e9156767daef"
		, sha256: "ddb6ad9285e813f1c53fddbeca29b2154580b4ddbfa197ce454a14ae82eff7d9"
		, profiles: ["dotnet"] }
	, { id: "managed-types"
		, revision: "afabea275b25a0371e170d092e2a42187d446d8f"
		, sha256: "272dd8d21bf71a23ff7da381346337f66424e4c794b5d629afe40312123da16f"
		, profiles: ["dotnet","java","kotlin"] }
	, { id: "python312"
		, revision: "afabea275b25a0371e170d092e2a42187d446d8f"
		, sha256: "f5881f66790c11a17a32f657d00a5c0687a696a5396de98dea1e50f9fed34468"
		, profiles: ["python"] }
	, { id: "perl-5.36.3-threaded"
		, revision: "15687ed0530935514878dddda6f1a97a81a94bcf"
		, sha256: "a0af2ab6b6c6d47f6a776b221af99e64a74c21191dc2cfd92ac04f2c75e6db17"
		, profiles: ["perl"] }
	, { id: "perl-5.36.3-unthreaded"
		, revision: "15687ed0530935514878dddda6f1a97a81a94bcf"
		, sha256: "08a7d2c38d991cd2c97845baf0fce04b1dfab6996e260c14dbcc262a7e0127bd"
		, profiles: ["perl"] }
	, { id: "perl-5.38.2-threaded"
		, revision: "15687ed0530935514878dddda6f1a97a81a94bcf"
		, sha256: "8565b743fc028ea4728956f2b137b0812398cd65671f70c2a4e245f6a18fdebc"
		, profiles: ["perl"] }
	, { id: "perl-5.38.2-unthreaded"
		, revision: "15687ed0530935514878dddda6f1a97a81a94bcf"
		, sha256: "6b04457cf51bcdbd3ea56abf6ac9dfbde71b943d81edeb5acc43a0aa12ab7023"
		, profiles: ["perl"] }
	, { id: "php-native"
		, revision: "15687ed0530935514878dddda6f1a97a81a94bcf"
		, sha256: "0e8c68b5a0fde8a04a4255030531deb4e83e126d4d2461b945dc484a012b3ea9"
		, profiles: ["php-native"] }
	, { id: "wit-wasi"
		, revision: "758229f3cecac8599e869fe2ff06beecddcdeaab"
		, sha256: "7ab31440a17c195608f40ee5cfd34d17340b974c21fc53eb645c111c121882fd"
		, profiles: ["wit-wasi"] }
];
const counts = { rust: 1013, python: 1019, ruby: 1021, dotnet: 1018, java: 1018, kotlin: 1015, perl: 1025, "php-native": 1021, "wit-wasi": 1019 };
const extensions = { rust: "rs", python: "py", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", perl: "pl", "php-native": "php", "wit-wasi": "c" };

test("generic host archive retains all original producer reports and runtime selections", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.planNode, 1439);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.sourcePath, "ordinary-source");
	assert.equal(receipt.glibcMinimumVersion, "2.36");
	assert.deepEqual(receipt.profiles, ["dotnet", "java", "kotlin", "perl", "php-native", "python", "ruby", "rust", "wit-wasi"]);
	assert.deepEqual(receipt.reports.map(({ id, revision, sha256, profiles }) => ({ id, revision, sha256, profiles })), expected);
	assert.match(receipt.scope, /do not execute finite function specializations/u);
	for(const reference of receipt.reports)
	{
		assert.equal(reference.path, `${directory}/${reference.id}.json`);
		const bytes = await readFile(reference.path);
		assert.equal(sha256(bytes), reference.sha256);
		assert.match(reference.reproduceCommand, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36/u);
		assert.ok(reference.reproduceCommand.includes(`LEAN_BRIDGE_GENERIC_RECORD_PROFILES=${reference.profiles.join(",")}`));
		const report = JSON.parse(bytes);
		assert.equal(report.schemaVersion, 1);
		assert.equal(report.reproducible, true);
		assert.deepEqual(report.reports.map(item => item.profile), reference.profiles);
		for(const item of report.reports)
		{
			assert.equal(item.path, "ordinary-source");
			assert.equal(item.checks, counts[item.profile]);
			for(const key of ["sourceRemovedBeforeInstallation", "compilerFreePath", "offlineInstall"]) assert.equal(item[key], true, key);
			for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(item[key], /^[a-f0-9]{64}$/u, key);
			assert.deepEqual(item.instantiations, genericRecordInstantiations);
			const caller = `tests/fixtures/generic-record-consumers/${item.profile}.${extensions[item.profile]}`;
			assert.equal(item.consumerSha256, sha256(await readFile(caller)), caller);
			for(const pkg of item.packages) for(const artifact of pkg.artifacts)
				assert.equal(report.archives[artifact.path], artifact.sha256);
			if(item.rustTypes || item.managedTypes)
			{
				const checked = item.rustTypes ?? item.managedTypes;
				assert.equal(checked.repeatExecutionAfterTypeRejection, true);
				assert.deepEqual(checked.rejected.map(rejection => rejection.case), ["alias", "field", "missing"]);
				for(const rejection of checked.rejected)
				{
					assert.match(rejection.sourceSha256, /^[a-f0-9]{64}$/u);
					assert.ok(rejection.diagnostics.length > 0);
					for(const diagnostic of rejection.diagnostics)
					{
						assert.equal(diagnostic.file, `invalid-${rejection.case}.${extensions[item.profile]}`);
						assert.ok(diagnostic.line > 0 && diagnostic.column > 0);
					}
				}
				if(item.managedTypes)
				{
					assert.equal(checked.positiveCompiles, true);
					assert.equal(checked.artifactUnchanged, true);
					assert.match(checked.artifactSha256, /^[a-f0-9]{64}$/u);
					assert.match(checked.positiveSourceSha256, /^[a-f0-9]{64}$/u);
				}
			}
		}
	}
	const oldDotnet = receipt.reports.find(item => item.id === "dotnet");
	assert.equal(oldDotnet.scope, "runtime-only");
	assert.equal(oldDotnet.supersededBy, "managed-types");
	const python = receipt.reports.filter(item => item.profiles[0] === "python");
	assert.deepEqual(python.map(item => item.runtime), ["Python 3.11.2", "Python 3.12.14"]);
	assert.equal(python[0].sha256, python[1].sha256, "The original reports do not encode the interpreter version");
	assert.match(python[1].reproduceCommand, /LEAN_BRIDGE_PYTHON=\/app\/\.toolchains\/python312\/bin\/python3\.12/u);
	for(const abi of ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"])
	{
		const perl = receipt.reports.find(item => item.id === `perl-${abi}`);
		assert.equal(perl.runtime, abi);
		assert.ok(perl.reproduceCommand.includes(`LEAN_BRIDGE_CORPUS_PERL=/app/.toolchains/perl/${abi}/bin/perl`));
		assert.ok(perl.reproduceCommand.includes("LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36"));
	}
});
