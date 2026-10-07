/**
 * Retain original reviewed Fin container observations without broadening their scope.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finContainerRefinements } from "./fin-container-install.mjs";
import { finContainerDispatchColumns, finContainerDispatchExpected } from "./fin-container-dispatch.mjs";
import { finContainerReviewedIr } from "./reviewed-fin-container-fixture.mjs";

const directory = "docs/evidence/reviewed-fin-hosts-20261007";
const expected = [
	["reviewed-python-rust", "86a14fab5433ae94f7b4b99261a61e8f004b2b81300096f80c95b8b1447b4f93", ["python", "rust"], [2029, 2027]]
	, ["reviewed-dotnet-java-kotlin", "239369e4bc0542a58b89c4aca181aa9b81915a3a53e917875e3095d439681f10", ["dotnet", "java", "kotlin"], [2026, 2026, 2025]]
	, ["reviewed-php-native-ruby-wit-wasi", "e17fb2f98f385a53d76c03d1881a9d5cfda355e97a967096519488d175257069", ["php-native", "ruby", "wit-wasi"], [2026, 2025, 2033]]
];
const extensions = { python: "py", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", ruby: "rb", "wit-wasi": "c" };

test("reviewed Fin host archives preserve source-free executions and distinguish observed dispatch", async () => {
	const receipt = JSON.parse(await readFile(`${directory}/receipt.json`, "utf8"));
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.planNode, 1438);
	assert.equal(receipt.execution, "local");
	assert.equal(receipt.glibcMinimumVersion, "2.36");
	assert.equal(receipt.sourcePath, "reviewed-ir");
	assert.match(receipt.scope, /do not cover scalar-only signatures/u);
	assert.equal(receipt.reports.length, expected.length);
	for(const [index, reference] of receipt.reports.entries())
	{
		const [id, digest, profiles, counts] = expected[index];
		assert.equal(reference.path, `${directory}/${id}.json`);
		assert.equal(reference.sha256, digest);
		assert.equal(reference.revision, "758229f3cecac8599e869fe2ff06beecddcdeaab");
		assert.deepEqual(reference.profiles, profiles);
		assert.deepEqual(reference.observedDispatch, profiles.filter(profile => ["python", "rust"].includes(profile)));
		assert.match(reference.reproduceCommand, /LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2\.36/u);
		assert.ok(reference.reproduceCommand.includes(`LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=${profiles.join(",")}`));
		const bytes = await readFile(reference.path);
		assert.equal(sha256(bytes), digest);
		const report = JSON.parse(bytes);
		assert.equal(report.schemaVersion, 1);
		assert.equal(report.reproducible, true);
		assert.deepEqual(report.reports.map(item => item.profile), profiles);
		assert.deepEqual(report.reports.map(item => item.checks), counts);
		for(const item of report.reports)
		{
			assert.equal(item.path, "reviewed-ir");
			for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreePath"]) assert.equal(item[key], true, key);
			for(const key of ["bindingIrSha256", "modelSha256", "sourceTreeSha256", "receiptSha256"]) assert.match(item[key], /^[a-f0-9]{64}$/u, key);
			assert.equal(item.reviewedSourceSha256, sha256(canonicalJson(finContainerReviewedIr())));
			assert.deepEqual(item.refinements, finContainerRefinements);
			assert.equal(item.consumerSha256, sha256(await readFile(`tests/fixtures/fin-container-consumers/${item.profile}.${extensions[item.profile]}`)));
			for(const pkg of item.packages) for(const artifact of pkg.artifacts) assert.equal(report.archives[artifact.path], artifact.sha256);
			if(reference.observedDispatch.includes(item.profile))
			{
				const dispatch = item.dispatch;
				assert.equal(dispatch.interposer, "LD_PRELOAD");
				for(const key of ["compilerFreePath", "installedFilesUnchanged", "missingInterposerRejected"]) assert.equal(dispatch[key], true, key);
				for(const key of ["installedFilesSha256", "interposerSha256", "probeSha256"]) assert.match(dispatch[key], /^[a-f0-9]{64}$/u, key);
				assert.deepEqual(dispatch.columns, finContainerDispatchColumns);
				assert.deepEqual(dispatch.observed, finContainerDispatchExpected);
			}
			else assert.equal(item.dispatch.observed, false, "No dispatch observation is claimed for this host");
		}
	}
	assert.equal(receipt.reports[2].phpRuntime, "PHP 8.2.33");
	assert.match(receipt.reports[2].reproduceCommand, /LEAN_BRIDGE_PHP=\/usr\/bin\/php/u);
});
