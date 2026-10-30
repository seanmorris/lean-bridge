/**
 * Advance only the documentation pins changed by complete HostNull publication.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

export const hostNullCompleteDocumentationPinTransitions = Object.freeze([
	["docs/php.md", "23e5ab850f1cfe5eacc50dc41bdd2fcf82ac32dd89684d3c71f754455ec1f92a", 6]
	, ["docs/consume/dotnet.md", "619e77cf4961aa1e81e72eacfc249820b8f5a474d92ff5c393bc8ad305598d78", 5]
	, ["docs/consume/java.md", "9f959559277efd04ccb8b59053e7af09fc8ba52b47ceaa0f6f44a5067d25bb52", 5]
	, ["docs/consume/kotlin.md", "d9bf9716935710c337a180fde224907f6f0f7a00f718f55e620e716fc9d351f6", 6]
	, ["docs/consume/ruby.md", "72b8981059dba65bbe181df31a607d30bb346283c910e98736098fb8d88c46c0", 1]
	, ["docs/consume/perl.md", "285f8aabbd0416ccf3eea53a160a052b7c484f37b980c6323777e99c6d6d2733", 1]
	, ["docs/consume/python.md", "248b2ed677ffa57803e3e6070e5d17ff3b0683bf2031695f2486a64c1b6ae1ed", 1]
	, ["docs/consume/rust.md", "2be0ad0bb044fe7ecfe93b08535274f1f66d6012811d5d400f011ab3f5d9f724", 1]
	, ["docs/consume/c.md", "3daef4a89119b01df40d6df61334d4fff5a2ae6dd7bc193b47f1cbb6089543ee", 1]
	, ["docs/consume/cpp.md", "e1c99d46d097bb3f0028bfe80204cef92d9a0fbe41213354eaf4d94fa77df3b7", 1]
	, ["docs/consume/wit-wasi.md", "31dbc3a2e67c47cd32735462850ea52866317629109bf04eff1ab6ab2a02737d", 2]
	, ["docs/lean/existing-package.md", "53950611d16fd5fc7941a39ab581a3f0f11eabd1d82834ff1cc08a01a9232bce", 18]
	, ["docs/lean/export-decisions.md", "ed562b41690511031b6655b2c775770a944c2e7f7c1d989bd9a76395f87a069c", 22]
].map(([path, previousSha256, pins]) => Object.freeze({
	path, previousSha256, pins
})));
export const hostNullCompleteDocumentationPinCount
	= hostNullCompleteDocumentationPinTransitions.reduce(
		(sum, transition) => sum + transition.pins, 0);
assert.equal(hostNullCompleteDocumentationPinCount, 70);

/**
 * Reconcile every exact generated-document pin without changing support.
 *
 * @param inventory - Promoted type-surface inventory.
 * @param documents - Final generated documentation bytes by path.
 */
export const reconcileHostNullCompleteDocumentationPins = (
	inventory, documents
) => {
	assert.ok(documents instanceof Map);
	assert.deepEqual([...documents.keys()].sort()
		, hostNullCompleteDocumentationPinTransitions.map(item => item.path).sort());
	const transitions = new Map(hostNullCompleteDocumentationPinTransitions.map(
		item => [item.path, { ...item, currentSha256: sha256(documents.get(item.path)) }]
	));
	const proposed = structuredClone(inventory);
	const seen = new Map(), refreshedEvidence = new Set();
	let refreshedPins = 0;
	for(const entry of proposed.evidence)
		for(const file of entry.files)
		{
			const transition = transitions.get(file.path);
			if(transition === undefined) continue;
			seen.set(file.path, (seen.get(file.path) ?? 0) + 1);
			assert.ok([transition.previousSha256, transition.currentSha256]
				.includes(file.sha256), file.path);
			if(file.sha256 === transition.currentSha256) continue;
			file.sha256 = transition.currentSha256;
			refreshedPins++; refreshedEvidence.add(entry.id);
		}
	for(const transition of transitions.values())
		assert.equal(seen.get(transition.path), transition.pins, transition.path);
	assert.ok(refreshedPins === 0
		|| refreshedPins === hostNullCompleteDocumentationPinCount);
	return Object.freeze({
		inventory: proposed, refreshedPins
		, refreshedEvidence: refreshedEvidence.size
	});
};
