/**
 * Exercise callback-Fin coverage without parsing the full support inventory.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertCallbackFinCoverage } from "./callback-fin-coverage.mjs";

const evidence = "callback-refinements-php-wasm-hosted-installed";
const stages = ["analysis", "generation", "compilation", "packaging", "installedExecution"];
const fixture = () => {
	const routes = [
		["node-javascript", "ordinary-source", ["npm-callback-fin-installed"]]
		, ["node-typescript", "ordinary-source", ["npm-callback-fin-installed"]]
		, ...["node-javascript", "node-typescript"].map(profile => [profile
			, "reviewed-ir"
			, ["reviewed-callback-fin-npm-r1-installed", "reviewed-callback-fin-npm-r2-installed"]])
		, ...["browser-javascript", "browser-react", "browser-worker"].map(profile => [profile
			, "ordinary-source", ["browser-callback-fin-ordinary-installed"]])
		, ...["c", "cpp"].flatMap(profile => [
			[profile, "ordinary-source", ["native-callback-fin-ordinary-installed", "native-callback-fin-host-replies-installed"]]
			, [profile, "reviewed-ir", ["reviewed-callback-fin-c-cpp-installed"]]
		])
		, ["php-wasm", "ordinary-source", [evidence]]
		, ["php-wasm", "reviewed-ir", [evidence]]
	];
	return routes.flatMap(([profile, path, evidence]) =>
		["callback-parameter", "callback-result"].map(position => ({
			id: `${profile}/fin/${path}/${position}`
			, profile
			, path
			, position
			, shape: "fin"
			, stages: Object.fromEntries(stages.map(stage => [stage
				, { state: "passed", evidence: [...evidence] }]))
		}))
	);
};

test("Fin coverage accepts all 26 independently enumerated callback cells", () => {
	const cells = fixture();
	assert.equal(cells.length, 26);
	assert.equal(cells.filter(cell => cell.profile === "php-wasm").length, 4);
	assertCallbackFinCoverage(cells);
});

test("Fin coverage rejects missing, duplicated, widened or misattributed evidence", () => {
	const original = fixture();
	const php = cells => cells.find(cell => cell.id === "php-wasm/fin/reviewed-ir/callback-result");
	const mutations = [
		cells => { cells.pop(); }
		, cells => { cells.push(structuredClone(cells[0])); }
		, cells => { php(cells).profile = "php-native"; }
		, cells => { php(cells).shape = "checked-record"; }
		, cells => { php(cells).position = "field"; }
		, cells => { php(cells).path = "ordinary-source"; }
		, cells => { php(cells).id = "php-native/fin/reviewed-ir/callback-result"; }
		, ...stages.flatMap(stage => [
			cells => { php(cells).stages[stage].state = "unreviewed"; }
			, cells => { php(cells).stages[stage].evidence = ["npm-callback-fin-installed"]; }
			, cells => { php(cells).stages[stage].evidence.push("invented"); }
			, cells => { delete php(cells).stages[stage]; }
		])
		, cells => { cells.find(cell => cell.id === "c/fin/reviewed-ir/callback-result")
			.stages.installedExecution.evidence = ["native-callback-fin-ordinary-installed"]; }
	];
	for(const mutate of mutations)
	{
		const cells = structuredClone(original);
		mutate(cells);
		assert.throws(() => assertCallbackFinCoverage(cells), assert.AssertionError);
	}
});

test("PHP-Wasm Fin coverage names the retained hosted promotion and both routes", async () => {
	const bytes = await readFile("docs/evidence/callback-refinements-php-wasm-20261023/index.json");
	assert.equal(createHash("sha256").update(bytes).digest("hex")
		, "297895d119c12fd4dde45763fc18271774a62a6de1130de070528145f7a11208");
	const index = JSON.parse(bytes);
	const fin = index.profiles.find(profile => profile.profile === "fin");
	assert.deepEqual(fin.reports.map(report => report.route), ["ordinary", "reviewed"]);
	assert.deepEqual(index.accepted.results.filter(result => result.profile === "fin")
		.map(({ profile, route, executions, checks }) => ({ profile, route, executions, checks })), [
		{ profile: "fin", route: "ordinary", executions: 12, checks: 23 }
		, { profile: "fin", route: "reviewed", executions: 12, checks: 23 }]
	);
	const promotion = await readFile("tests/helpers/callback-refinements-php-wasm-promotion.mjs", "utf8");
	assert.ok(promotion.includes('= "' + evidence + '";'));
});

test("the live inventory checks use the same strict callback coverage guard", async () => {
	const source = await readFile("tests/helpers/nominal-fin-contract-tests.mjs", "utf8");
	assert.match(source, /^import \{ assertCallbackFinCoverage \} from "\.\/callback-fin-coverage\.mjs";$/mu);
	assert.match(source, /assertCallbackFinCoverage\(await installedCallbackFinCells\(\)\)/u);
	assert.equal(source.match(/\bassertCallbackFinCoverage\(/gu).length, 2);
});
