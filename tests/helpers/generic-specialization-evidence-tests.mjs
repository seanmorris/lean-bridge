/**
 * Retain source-free specialization executions and the exact public callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { genericRecordInstantiations } from "./generic-record-packages.mjs";
import { genericRecordSpecializations, specializedGenericRecordConsumer } from "./generic-record-specializations.mjs";

const directory = "docs/evidence/generic-record-specializations-20261007";
const expected = [
	["specialized-c-cpp-python", "7d5fc9f6329a8890c286cc44a391ebc141ec4f6cd273c480414ad256232a3f9e", ["c", "cpp", "python"]]
	, ["specialized-python312-rust", "a81e5025607d325be456b06284205e3edde5eb7cb43bb48aa30aae03950061ce", ["python", "rust"]]
	, ["specialized-dotnet-java-kotlin", "e0b392e33ef384aa69cfcf0beeca077dccbbc52faef2c3f42d56b86b599be724", ["dotnet", "java", "kotlin"]]
	, ["specialized-php-native-ruby-wit-wasi", "5891a6b8e607b3e0d86ea704cf83df096cc2ed25ec8826d66f4840dd76ecf38b", ["php-native", "ruby", "wit-wasi"]]
];
const counts = { c: 1029, cpp: 1024, python: 1036, rust: 1025, dotnet: 1034, java: 1034, kotlin: 1030, "php-native": 1035, ruby: 1036, "wit-wasi": 1036 };
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", ruby: "rb", "wit-wasi": "c" };

test("specialization archives retain nine configured applications and real installed host rejection controls", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.deepEqual(receipt.planNodes, [1433, 1439]);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.glibcMinimumVersion, "2.36");
	assert.equal(receipt.sourcePath, "ordinary-source");
	assert.match(receipt.scope, /do not cover open generic dispatch/u);
	assert.equal(receipt.reports.length, expected.length);
	for(const [index, reference] of receipt.reports.entries())
	{
		const [id, digest, profiles] = expected[index];
		assert.equal(reference.id, id);
		assert.equal(reference.path, `${directory}/${id}.json`);
		assert.equal(reference.sha256, digest);
		assert.equal(reference.revision, "d5705ff38d67e6410c987a3a3a28cc409162ebfd");
		assert.deepEqual(reference.profiles, profiles);
		assert.ok(reference.reproduceCommand.includes(`LEAN_BRIDGE_GENERIC_RECORD_PROFILES=${profiles.join(",")}`));
		assert.ok(reference.reproduceCommand.includes("--test-name-pattern='relocated source-free native packages construct specialized'"));
		const bytes = await readFile(reference.path);
		assert.equal(sha256(bytes), digest);
		const report = JSON.parse(bytes);
		assert.equal(report.schemaVersion, 1);
		assert.equal(report.reproducible, true);
		assert.deepEqual(report.reports.map(item => item.profile), profiles);
		for(const item of report.reports)
		{
			assert.equal(item.path, "ordinary-source");
			assert.equal(item.checks, counts[item.profile]);
			assert.deepEqual(item.instantiations, genericRecordInstantiations);
			assert.deepEqual(item.specializations, genericRecordSpecializations());
			assert.equal(item.specializations.length, 9);
			for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(item[key], true, key);
			for(const key of ["bindingIrSha256", "modelSha256", "sourceTreeSha256", "receiptSha256"]) assert.match(item[key], /^[a-f0-9]{64}$/u, key);
			assert.equal(item.consumerSha256, sha256(await specializedGenericRecordConsumer(item.profile, extensions[item.profile])));
			for(const pkg of item.packages) for(const artifact of pkg.artifacts) assert.equal(report.archives[artifact.path], artifact.sha256);
			if(!["rust", "dotnet", "java", "kotlin"].includes(item.profile)) continue;
			const typed = item.profile === "rust" ? item.rustTypes : item.managedTypes;
			assert.equal(typed.repeatExecutionAfterTypeRejection, true);
			const extra = item.profile === "rust" ? ["specialized-list", "specialized-option"] : ["specialized-field", "specialized-missing"];
			assert.deepEqual(typed.rejected.map(rejection => rejection.case), ["alias", "field", "missing", "namespace", ...extra]);
			for(const rejection of typed.rejected)
			{
				assert.match(rejection.sourceSha256, /^[a-f0-9]{64}$/u);
				assert.ok(rejection.diagnostics.length > 0);
				for(const diagnostic of rejection.diagnostics)
				{
					assert.equal(diagnostic.file, `invalid-${rejection.case}.${extensions[item.profile]}`);
					assert.ok(diagnostic.line > 0 && diagnostic.column > 0);
				}
			}
			if(item.profile !== "rust")
			{
				assert.equal(typed.positiveCompiles, true);
				assert.equal(typed.artifactUnchanged, true);
				for(const key of ["artifactSha256", "positiveSourceSha256"]) assert.match(typed[key], /^[a-f0-9]{64}$/u, key);
			}
		}
	}
	assert.equal(receipt.reports[0].pythonRuntime, "Python 3.11.2");
	assert.equal(receipt.reports[1].pythonRuntime, "Python 3.12.14");
	assert.match(receipt.reports[1].reproduceCommand, /LEAN_BRIDGE_PYTHON=\/app\/\.toolchains\/python312\/bin\/python3\.12/u);
	assert.equal(receipt.reports[3].phpRuntime, "PHP 8.2.33");
	assert.match(receipt.reports[3].reproduceCommand, /LEAN_BRIDGE_PHP=\/usr\/bin\/php/u);
});
