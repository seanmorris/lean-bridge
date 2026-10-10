/**
 * Retain the complete fresh ordinary/reviewed PHP-Wasm diagnostic executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertPhpWasmFinObservation } from "./php-wasm-fin-observation.mjs";
import { phpWasmExecutionTuples, phpWasmFinCaller, phpWasmFinFixtures } from "./php-wasm-fin-fixtures.mjs";

const directory = "docs/evidence/native-fin-diagnostic-installed-20261010";
const consumers = { products: "60c284c0afe09a71164b13fa54838f4c26081a78d9c258683c10a11553b5066e", records: "d0bbf93d626d7f8206966b7d31c290f5859d90ee4978056da2453f603faf1c47" };
const modules = { products: "aa79a2cb232c968d1e2e1e7d640630df97adc40dee506e5c4e26ad56c41ff220", records: "419dcccad2f2a6cafb828315e0e51ee3747ad15a3fe3c7a5e74deb7a532dd299" };

for(const [route, reviewed, digest] of [
	["ordinary", false, "205910d5f840473c2523f32c00491cc9a7c0aabe537d94362ce01e627bd7e194"]
	, ["reviewed", true, "fd7e059016d5e26b50391331ea7c7b8dea0cb678bf043392343656813645db83"]
]) {
	test(`fresh ${route} PHP-Wasm diagnostics retain both fixtures and every installed execution`, async () => {
		const bytes = await readFile(`${directory}/${route}-php-wasm.json`);
		assert.equal(sha256(bytes), digest);
		const archive = JSON.parse(bytes);
		assert.equal(archive.schemaVersion, 1);
		assert.deepEqual(archive.reports.map(report => report.fixture), ["products", "records"]);
		for(const report of archive.reports)
		{
			const fixture = phpWasmFinFixtures[report.fixture];
			const caller = beforeFinRefinementSource(fixture.consumer, await readFile(fixture.consumer, "utf8"), consumers[report.fixture]);
			assert.equal(sha256(caller), consumers[report.fixture]);
			const { request } = await phpWasmFinCaller(fixture), checks = report.fixture === "products" ? 2039 : 2053;
			assertPhpWasmFinObservation(report, fixture, caller, request, checks, reviewed);
			assert.equal(report.phpWasm.nodeVersion, "v22.23.2");
			assert.equal(report.phpWasm.browserVersion, "152.0.7977.75");
			assert.equal(report.phpWasm.nodeSha256, "3517c2df0b2f8cd7f422b4b8450ef81c6889f08eb03e281d6de9079b15e6a327");
			assert.equal(report.phpWasm.browserSha256, "11f46b4909b284a30e182599fa3627040befab3b3b2d96a0173ada6ff1693ecc");
			const source = report.phpWasm.component.sourceIdentity;
			assert.equal(source.extractorSha256, "46b46cbb21fe51d166ab700cde2c41583bc3a093f67cecd07d104cdf649f61ce");
			assert.equal(source.modules.find(item => item.module === fixture.module).source.sha256, modules[report.fixture]);
			for(const mutate of [
				report => report.phpWasm.executions.pop()
				, report => { report.dispatch = "measured"; }
				, report => { report.phpWasm.consumerSources.strict = report.phpWasm.consumerSources.weak; }
			]) {
				const changed = structuredClone(report); mutate(changed);
				assert.throws(() => assertPhpWasmFinObservation(changed, fixture, caller, request, checks, reviewed));
			}
		}
	});
}

test("fresh PHP-Wasm diagnostic TAP retains both successful tests and all forty-eight execution variants", async () => {
	const tap = await readFile(`${directory}/php-wasm.tap`, "utf8");
	assert.equal(sha256(tap), "58dd02da1da37b9247d16fff9eaf5595676744f6ce14569cb433af20dc28c9a0");
	assert.match(tap, /# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.doesNotMatch(tap, /^not ok /mu);
	for(const prefix of ["fin-", "reviewed-fin-"]) for(const fixture of ["products", "records"])
	{
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${prefix}${fixture} build (.+): wasm32$`, "gmu"))].map(match => match[1]), ["0", "1"]);
		const executions = [...tap.matchAll(new RegExp(`^# ${prefix}${fixture}: PHP-Wasm (Node|Chromium) (.+)$`, "gmu"))].map(match => `${match[1].toLowerCase()}/${match[2]}`).sort();
		assert.deepEqual(executions, phpWasmExecutionTuples);
	}
});
