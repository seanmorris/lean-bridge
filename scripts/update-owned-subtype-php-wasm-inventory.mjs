#!/usr/bin/env node
/**
 * Reconcile installed PHP-Wasm owned Subtype evidence into the existing field cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const implementationCommit = "22c1efd6c9c66c42ba438a07ca6adff6fbc7f2c5";
const command = "source scripts/env.sh && LEAN_BRIDGE_OWNED_SUBTYPE_PHP_WASM_TEST=1 LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=build/owned-subtype-php-wasm-input/php-wasm-runtime npm run test:owned-subtype-php-wasm";
const evidencePath = "docs/evidence/owned-subtype-php-wasm-local-qualification-20261022.json";
const markdownPath = "docs/evidence/owned-subtype-php-wasm-local-qualification-20261022.md";
const sourcePaths = [
	".github/workflows/owned-subtype-php-wasm.yml"
	, "config/cli-package.v1.json"
	, "package.json"
	, "scripts/generate-type-docs.mjs"
	, "scripts/update-owned-subtype-php-wasm-inventory.mjs"
	, "src/abi/owned-refinement-model.mjs"
	, "src/build/owned-refinement-carriers.mjs"
	, "tests/fixtures/structured-types/owned-subtype-php-wasm.php"
	, "tests/helpers/owned-php-wasm-browser.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
	, "tests/owned-subtype-php-wasm-packaging.test.mjs"
	, evidencePath
	, markdownPath
];
const files = [];
for(const path of sourcePaths)
	files.push({ path, sha256: sha256(await readFile(path)) });

const commonScope = "The installed PHP-Wasm lane exercises one proof-erased Int Subtype field inside the tested acyclic Bundle owner. Ordinary source and independently reviewed Binding IR retain exact per-export constructors. Source-free offline installations are physically relocated before eight Node and eight Chromium executions per route cover borrowed and transferred parameters, leased results, embedded and Composer packages, startup and lazy loading, weak and strict PHP, rejection before ownership movement, explicit retain/close behavior, queued-finalizer cleanup, zero live identities and request recovery. Both routes reproduce and verify the Composer API, npm component and npm shared-runtime archives after author/build removal; 22 corrupted package or receipt controls reject per route. The recurring workflow retains each original package-set handoff with the combined report and logs.";
const boundary = "This evidence does not establish PHP-Wasm callback refinements, recursive owned graphs, other predicates, dispatch counts or peak memory. The pinned PHP-Wasm runtime, browser and external compiler distributions remain trusted inputs represented by recorded identities.";
const archive = (path, sha256) => ({ path, sha256 });
const runtimeName = "lean-bridge-php-wasm-copied-runtime-0.0.0-copied1.4c88837c0f4e612c0a1c8b345239db679c7bfc7a5e071ee99fc1b059959babba.tgz";
const artifactPath = (route, name) => `owned-subtype-php-wasm/evidence/${route}/handoff/packages/php-wasm/archives/${name}`;
const records = [
	{
		id: "owned-subtype-php-wasm-ordinary-installed"
		, kind: "installed"
		, revision: implementationCommit
		, command
		, scope: `${commonScope} ${boundary}`
		, files
		, artifacts: [archive(artifactPath("ordinary", runtimeName), "1d08d798d60402880a707a6af2a2becad4edbbcac98ce5c4c9d032c6a1b70927")
			, archive(artifactPath("ordinary", "lean-bridge-test-owned-php-wasm-1.0.0.tgz"), "2de52c2ff20cea071441bd9b7f0a6aa54d350b739e912437e3441f2e1aab2ffe")
			, archive(artifactPath("ordinary", "lean-bridge-test-owned-php-wasm-1.0.0-php-wasm.zip"), "b1b53ce6e3082c4afe1ebf80734e752e2dc6ba757f6738b41a4f0d80d31c1f8a")
			, archive("owned-subtype-php-wasm/packages.json", "715a729b0e503410b2c40ac974e3450fd6be08ce7fbf1ab1adfab3eece6a2a5e")]
	}
	, {
		id: "owned-subtype-php-wasm-reviewed-installed"
		, kind: "installed"
		, revision: implementationCommit
		, command
		, scope: `${commonScope} ${boundary}`
		, files
		, artifacts: [archive(artifactPath("reviewed", runtimeName), "1d08d798d60402880a707a6af2a2becad4edbbcac98ce5c4c9d032c6a1b70927")
			, archive(artifactPath("reviewed", "lean-bridge-test-owned-php-wasm-1.0.0.tgz"), "55321c068a8314a2e75e95106e1fe77716548f56bdf660866b5a281b3a145fec")
			, archive(artifactPath("reviewed", "lean-bridge-test-owned-php-wasm-1.0.0-php-wasm.zip"), "456bd1889c08ed5dc7e2549203df934af5d490afa95712dcc760d94acb34e1d8")
			, archive("owned-subtype-php-wasm/packages.json", "715a729b0e503410b2c40ac974e3450fd6be08ce7fbf1ab1adfab3eece6a2a5e")]
	}
];

const document = JSON.parse(await readFile(inventoryPath, "utf8"));
for(const record of records)
{
	const index = document.evidence.findIndex(entry => entry.id === record.id);
	if(index === -1) document.evidence.push(record);
	else document.evidence[index] = record;
}

const replaceOldBoundary = value => typeof value === "string"
	? value.replaceAll("Refined callbacks, owned values, recursive checked records"
		, "Refined callbacks, recursive checked records") : value;
const updateStrings = value => {
	if(Array.isArray(value)) return value.map(updateStrings);
	if(value && typeof value === "object")
		return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, updateStrings(child)]));
	return replaceOldBoundary(value);
};
for(const [route, id] of [
	["ordinary-source", "owned-subtype-php-wasm-ordinary-installed"]
	, ["reviewed-ir", "owned-subtype-php-wasm-reviewed-installed"]
]) {
	const index = document.observations.findIndex(observation =>
		observation.id === `nominal-subtype-php-wasm-fields-${route}`);
	assert.notEqual(index, -1, route);
	const observation = updateStrings(document.observations[index]);
	if(!observation.scope.includes(commonScope)) observation.scope += ` ${commonScope}`;
	observation.hostTypes.subtype.field = "corresponding PHP-Wasm primitive value in generated final readonly copied records, active variant cases, and the tested acyclic owned Bundle; no proof field; selected Subtype fields are checked at their declared public site before a transfer consumes any resource";
	for(const stage of Object.values(observation.stages))
	{
		if(!stage.evidence.includes(id)) stage.evidence.push(id);
		if(!stage.note.includes(commonScope)) stage.note += ` Additional owned-field acceptance: ${commonScope}`;
	}
	if(!observation.limitations.includes(boundary)) observation.limitations.push(boundary);
	const conversion = "In the tested owned Bundle, PHP-Wasm exposes the refined Int payload as Brick\\Math\\BigInteger inside the generated Payload and Bundle classes while resource fields retain their generated Ticket owners. Borrowed calls validate without consuming the input. A transferred call validates the complete refinement tree first, so rejection leaves every resource owner usable; success consumes the original owner and returns a fresh lease. Results contain the Int payload but no proof field.";
	if(!observation.conversionNotes.subtype.includes(conversion))
		observation.conversionNotes.subtype += ` ${conversion}`;
	document.observations[index] = observation;
}

assert.equal(new Set(document.evidence.map(entry => entry.id)).size
	, document.evidence.length, "Duplicate type-surface evidence ids");
await writeFile(inventoryPath, JSON.stringify(document, null, 2) + "\n");
process.stdout.write("Reconciled two installed PHP-Wasm owned Subtype routes into the existing field cells.\n");
