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
	, ["specialized-perl-5.36.3-threaded", "1c8a5efb1da07cb2955500b4021a9e448116da9a593b754d06e0c12c4a3c8187", ["perl"]]
	, ["specialized-perl-5.36.3-unthreaded", "cb3deedb0bbdb776c0eb7cf7742206bfced64b07db6226e2dd57579f58311c11", ["perl"]]
	, ["specialized-perl-5.38.2-threaded", "fa8bce44ecba6f9a73286ef01f1d3387abcbe6d9da0754c80f6b5c44fde009d4", ["perl"]]
	, ["specialized-perl-5.38.2-unthreaded", "f5abd1a10de1e3e4fb2f1f0bd6d3eaad9d182dfaab17d9187dba189d1bb7cd4d", ["perl"]]
	, ["specialized-npm", "6823785a955b34446c8ad254afb6113cdbcbfc8c1da2c7c6d7ca3c48394a0c07", ["npm"]]
];
const counts = { c: 1029, cpp: 1024, python: 1036, rust: 1025, dotnet: 1034, java: 1034, kotlin: 1030, "php-native": 1035, ruby: 1036, "wit-wasi": 1036, perl: 1040 };
const extensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", ruby: "rb", "wit-wasi": "c", perl: "pl" };

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
		const bytes = await readFile(reference.path);
		assert.equal(sha256(bytes), digest);
		const report = JSON.parse(bytes);
		assert.equal(report.schemaVersion, 1);
		if(id === "specialized-npm")
		{
			assert.equal(report.profile, "npm");
			assert.equal(report.abi, 7);
			assert.equal(report.checks, 1019);
			assert.equal(report.rejections, 1010);
			assert.deepEqual(report.specializations, genericRecordSpecializations("OnboardingSmall"));
			assert.equal(report.archiveSha256, "09be27d6338cdb17da704056691d22dc818f42e712fe270fb7eff1792e246f56");
			assert.equal(report.runtimeArchiveSha256, "253ebd12714831828d2710a45f3c411a4004a5516a75ae63dc98d03e450ca7ff");
			assert.match(reference.reproduceCommand, /LEAN_BRIDGE_LAKE_WASM_TEST=1/u);
			assert.ok(reference.reproduceCommand.includes("--test-name-pattern='installed npm packages specialize generic functions'"));
			assert.match(reference.scope, /not per-stage installation flags/u);
			continue;
		}
		assert.ok(reference.reproduceCommand.includes(`LEAN_BRIDGE_GENERIC_RECORD_PROFILES=${profiles.join(",")}`));
		assert.ok(reference.reproduceCommand.includes("--test-name-pattern='relocated source-free native packages construct specialized'"));
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
	for(const abi of ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"])
	{
		const perl = receipt.reports.find(item => item.id === `specialized-perl-${abi}`);
		assert.equal(perl.runtime, abi);
		assert.ok(perl.reproduceCommand.includes(`LEAN_BRIDGE_CORPUS_PERL=/app/.toolchains/perl/${abi}/bin/perl`));
		assert.ok(perl.reproduceCommand.includes("LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36"));
	}
});
