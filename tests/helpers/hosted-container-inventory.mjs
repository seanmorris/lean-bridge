/**
 * Attach the hosted Python/Rust counter reports to their four existing coverage observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertHostedContainerArchive, hostedContainerDirectory, hostedContainerOriginals, hostedContainerRevision, hostedContainerRun } from "./hosted-container-dispatch-evidence.mjs";
import { hostedContainerMembership, hostedContainerMembershipPath } from "./hosted-container-artifact-membership.mjs";
import { beforeHostedContainerInventorySource } from "./hosted-container-inventory-source-history.mjs";

const routes = ["ordinary-source", "reviewed-ir"];
export const hostedContainerObservationIds = ["python", "rust"].flatMap(host => [
	`native-fin-${host}-ordinary-source`, `reviewed-fin-${host}-scalar-containers`
]);
export const hostedContainerSelectionIds = ["python", "rust"].flatMap(host => routes.map(route => `hosted-container-${host}-${route}-dispatch`));
export const hostedContainerCounterScope = "Counters measure only FinContainers.mirrorAll and FinContainers.orDefault: nine public/raw rows and four source/adapter columns in the installed host process. Invalid public inputs enter neither function nor adapter; raw invalid calls enter the adapter but not the source; valid calls enter both. No product, field, callback, Subtype or other-export dispatch measurement is added.";

/** Authenticate immutable reports, original ZIP membership, jobs and source predecessors. */
export const hostedContainerReferences = async () => {
	const receiptPath = `${hostedContainerDirectory}/receipt.json`, receiptBytes = await readFile(receiptPath);
	assert.equal(sha256(receiptBytes), hostedContainerMembership.receipt.sha256);
	const receipt = JSON.parse(receiptBytes);
	await assertHostedContainerArchive(receipt);
	const references = [];
	for(const host of ["python", "rust"]) for(const [index, route] of routes.entries())
	{
		const name = `${host}-container-${index}.json`, reportPath = `${hostedContainerDirectory}/${name}`;
		const reportBytes = await readFile(reportPath); assert.equal(sha256(reportBytes), hostedContainerOriginals[name].sha256);
		const data = JSON.parse(reportBytes), report = data.reports[0];
		const command = `LEAN_BRIDGE_FIN_CONTAINER_PROFILES=${host} LEAN_BRIDGE_REVIEWED_FIN_CONTAINER_PROFILES=${host} node --test tests/native-fin-containers.test.mjs`;
		const log = await readFile(`${hostedContainerDirectory}/${host}.job.log`, "utf8");
		assert.ok(log.includes(command), "retain the actual hosted command");
		references.push({ id: `hosted-container-${host}-${route}-dispatch`
			, host, route
			, observationId: route === "ordinary-source" ? `native-fin-${host}-ordinary-source` : `reviewed-fin-${host}-scalar-containers`
			, revision: hostedContainerRevision, run: hostedContainerRun
			, job: host === "python" ? 113636827939 : 113636828054
			, command, checks: report.checks, consumerSha256: report.consumerSha256
			, probeSha256: report.dispatch.probeSha256
			, interposerSha256: report.dispatch.interposerSha256
			, receipt: { path: receiptPath, sha256: sha256(receiptBytes) }
			, report: { path: reportPath, sha256: sha256(reportBytes) }
			, membership: { path: hostedContainerMembershipPath, sha256: "37355957e057a395e4064e878f3841af310972c9550eb091ce5a3186fa1a599c" }
			, artifactMember: structuredClone(hostedContainerMembership.members.find(member => member.report === reportPath))
			, columns: report.dispatch.columns, rows: report.dispatch.observed
			, environment: host === "python"
				? "Successful ubuntu-24.04 Python job; the wheel retains its manylinux_2_38_x86_64 floor."
				: "Successful ubuntu-24.04 Rust job; the consumer compiles offline with Cargo, without Lean or producer tools."
			, boundaries: { installedTreeRelocation: false, overallWorkflowSucceeded: false, packageArchiveBytesRetained: false }
			, archives: data.archives });
	}
	return references;
};

/**
 * Reject relabeled, omitted, duplicated or widened selections against authenticated originals.
 *
 * @param references - Candidate four host/route selections.
 */
export const assertHostedContainerReferences = async references => {
	assert.deepEqual(references, await hostedContainerReferences(), "exactly four authenticated hosted container selections");
};

/**
 * Build four evidence entries with byte hashes, including binary ZIPs without text decoding.
 *
 * @param references - Authenticated selections.
 */
export const hostedContainerInventoryEvidence = async references => {
	await assertHostedContainerReferences(references);
	const receipt = JSON.parse(await readFile(hostedContainerMembership.receipt.path));
	const paths = ["tests/hosted-container-inventory.test.mjs"
		, "tests/helpers/hosted-container-inventory.mjs"
		, "tests/hosted-container-dispatch-evidence.test.mjs"
		, "tests/helpers/hosted-container-dispatch-evidence.mjs"
		, "tests/helpers/hosted-container-artifact-membership.mjs"
		, hostedContainerMembership.receipt.path
		, ...receipt.artifacts.map(file => file.path)
		, hostedContainerMembershipPath
		, ...hostedContainerMembership.artifacts.map(file => file.path)];
	assert.equal(new Set(paths).size, paths.length);
	const files = await Promise.all(paths.map(async path => {
		const bytes = await readFile(path);
		// Only text source files participate in history. ZIP identities always hash original bytes.
		const source = path.endsWith(".mjs") ? beforeHostedContainerInventorySource(path, bytes.toString("utf8")) : bytes;
		return { path, sha256: sha256(source) };
	}));
	return references.map(reference => ({ id: reference.id, kind: "installed"
		, revision: reference.revision
		, command: reference.command
		, scope: `${reference.route} ${reference.host}: ${reference.checks} public checks. ${hostedContainerCounterScope} ${reference.environment} GitHub run ${reference.run}, successful job ${reference.job}; the parent workflow was cancelled. Author sources were removed before offline installation; two author roots reproduced the package. No full installed-tree relocation claim. The retained CI ZIPs contain reports and logs, not package archives. Consumer SHA-256 ${reference.consumerSha256}; probe SHA-256 ${reference.probeSha256}; interposer SHA-256 ${reference.interposerSha256}. Source pins identify selected files, not a complete dependency closure.`
		, files: structuredClone(files)
		, artifacts: Object.entries(reference.archives).map(([path, sha256]) => ({ path: `${reference.id}/${path}`, sha256 })) }));
};

/**
 * Supplement only installed-execution evidence and its measurement notes, without new support cells.
 *
 * @param previous - Inventory at the exact predecessor.
 * @param references - Authenticated hosted selections.
 */
export const supplementHostedContainerInventory = async (previous, references) => {
	const added = await hostedContainerInventoryEvidence(references), inventory = structuredClone(previous);
	for(const reference of references)
	{
		const observation = inventory.observations.find(item => item.id === reference.observationId);
		assert.ok(observation); assert.deepEqual(observation.profiles, [reference.host]);
		assert.equal(observation.path, reference.route); assert.deepEqual(observation.shapes, ["fin"]);
		assert.deepEqual(observation.positions, ["parameter", "result"]);
		assert.ok(!observation.stages.installedExecution.evidence.includes(reference.id), `Already supplemented: ${reference.id}`);
		observation.stages.installedExecution.evidence.push(reference.id);
		observation.stages.installedExecution.note += ` Separately, hosted run ${reference.run}, job ${reference.job}, records ${reference.checks} public checks and host-process entry counters for this route. ${hostedContainerCounterScope} ${reference.environment} The earlier product and field reports keep their original unmeasured dispatch scope.`;
		observation.limitations.push(hostedContainerCounterScope);
	}
	for(const entry of added) assert.ok(!inventory.evidence.some(old => old.id === entry.id), `Already supplemented: ${entry.id}`);
	inventory.evidence.push(...added);
	return inventory;
};

/**
 * Refuse any inventory change outside the exact supplement and registered old source-pin refreshes.
 *
 * @param current - Candidate inventory.
 * @param previous - Authenticated predecessor inventory.
 * @param references - Authenticated selections.
 * @param updates - Exact source transitions.
 */
export const assertHostedContainerInventory = async (current, previous, references, updates) => {
	const expected = await supplementHostedContainerInventory(previous, references);
	for(const entry of expected.evidence.slice(0, previous.evidence.length)) for(const file of entry.files)
	{
		const update = updates.find(update => update.path === file.path && update.previousSha256 === file.sha256);
		if(update) file.sha256 = update.currentSha256;
	}
	assert.deepEqual(current, expected, "Only the hosted container supplement and exact old source-pin refreshes may change");
};
