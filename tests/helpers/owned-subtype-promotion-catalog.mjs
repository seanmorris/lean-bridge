/**
 * Closed archive identities and serial replay for owned-Subtype promotion.
 *
 * @file
 */
import assert from "node:assert/strict";

const remainingProducer = "390ae18d3a2607bc73463767a33fea0cfb9350b0";
export const ownedSubtypePromotionArchives = Object.freeze([
	{ lane: "javascript", date: "20261025"
		, profiles: ["node-javascript", "node-typescript", "browser-javascript"
			, "browser-react", "browser-worker"]
		, producer: "ab133c88b7fe0ec2c18cb453bccbde203968f7c6"
		, run: 40228624969, job: 121275380746 }
	, { lane: "native", date: "20261023", profiles: ["c", "cpp"]
		, producer: "c70a657c69b64d4ca53c28e2c9b84cae31dc1c8e"
		, run: 39957447434, job: 120426964753 }
	, { lane: "perl", date: "20261023", profiles: ["perl"]
		, producer: "23ae28e37befcdf245e94f5f841ed50254fc869c"
		, run: 39965393116, job: 120453800717 }
	, { lane: "languages", date: "20261023", profiles: ["python", "ruby", "rust"]
		, producer: "23ae28e37befcdf245e94f5f841ed50254fc869c"
		, run: 39965392366, job: 120453798428 }
	, { lane: "dotnet", date: "20261024", profiles: ["dotnet"]
		, producer: remainingProducer, run: 40047586162, job: 120732735924 }
	, { lane: "jvm", date: "20261024", profiles: ["java", "kotlin"]
		, producer: remainingProducer, run: 40047586162, job: 120732735830 }
	, { lane: "php-native", date: "20261024", profiles: ["php-native"]
		, producer: remainingProducer, run: 40047586162, job: 120732735535 }
	, { lane: "wit-wasi", date: "20261024", profiles: ["wit-wasi"]
		, producer: remainingProducer, run: 40047586162, job: 120732735801 }
].map(item => Object.freeze({ ...item, profiles: Object.freeze(item.profiles) })));

export const ownedSubtypePromotionLanes = Object.freeze(
	ownedSubtypePromotionArchives.map(({ lane, profiles }) =>
		Object.freeze({ lane, profiles }))
);

const definition = lane => {
	const selected = ownedSubtypePromotionArchives.find(item => item.lane === lane);
	assert.ok(selected, `Unknown owned-Subtype promotion lane: ${lane}`);
	return selected;
};

/**
 * Exact immutable archive root; never fall back to a local qualification.
 *
 * @param lane - Closed lane identity.
 */
export const ownedSubtypePromotionArchiveRoot = lane => {
	const item = definition(lane);
	return `docs/evidence/owned-subtype-${item.lane}-hosted-${item.date}`;
};

/**
 * Inventory identity for a complete hosted archive.
 *
 * @param lane - Closed lane identity.
 */
export const ownedSubtypePromotionEvidenceId = lane =>
	`owned-subtype-${definition(lane).lane}-hosted-installed`;

/**
 * Invoke a required replay directly; an absent archive cannot become a skip.
 *
 * @param lane - Closed lane identity.
 */
export const ownedSubtypePromotionReplayArgs = lane => [
	"scripts/check-owned-subtype-hosted-evidence.mjs"
	, "--lane", definition(lane).lane
];

/**
 * Render shell-safe arguments from the closed lane catalog.
 *
 * @param lane - Closed lane identity.
 */
export const ownedSubtypePromotionReplayCommand = lane =>
	`node ${ownedSubtypePromotionReplayArgs(lane).join(" ")}`;

/**
 * Require the selected producer and coverage after byte-level archive replay.
 * This metadata check does not replace checkOwnedSubtypeHostedEvidence.
 *
 * @param lane - Closed lane identity.
 * @param index - Independently replayed archive index.
 */
export const assertOwnedSubtypePromotionIndex = (lane, index) => {
	const item = definition(lane);
	assert.equal(index.kind, `owned-subtype-${lane}-hosted-v1`);
	assert.equal(index.lane, lane);
	assert.deepEqual(index.profiles, item.profiles);
	assert.equal(index.producerCommit, item.producer);
	assert.equal(index.hostedRun.runId, item.run);
	assert.equal(index.hostedRun.job.id, item.job);
	assert.equal(index.hostedRun.createdAt.slice(0, 10).replaceAll("-", ""), item.date);
	assert.equal(index.accepted.kind, "owned-subtype-hosted-replay");
	assert.equal(index.accepted.lane, lane);
	assert.deepEqual(index.accepted.profiles, item.profiles);
	assert.equal(index.accepted.producerCommit, item.producer);
	const accepted = index.accepted.accepted;
	if(lane === "javascript")
	{
		assert.equal(accepted.schemaVersion, 2);
		assert.equal(accepted.profile, "installed-owned-subtype-javascript");
		assert.equal(index.accepted.tests, 12);
		assert.deepEqual(accepted.routes.map(route => route.route), ["ordinary", "reviewed"]);
		for(const route of accepted.routes)
		{
			assert.equal(route.archives, 2);
			assert.ok(Number.isSafeInteger(route.archiveBytes) && route.archiveBytes > 0);
			assert.equal(route.browserExecutions, 12);
		}
	}
	else assert.deepEqual(accepted.routes, ["ordinary", "reviewed"]);
};

/**
 * Await each archive before starting another, including on rejection.
 *
 * @param replay - Lane replay visitor.
 */
export const mapOwnedSubtypePromotionLanes = async replay => {
	const references = [];
	for(const { lane } of ownedSubtypePromotionLanes)
		references.push(await replay(lane));
	return references;
};
