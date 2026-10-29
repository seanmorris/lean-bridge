/**
 * Independent reviews retain host-null semantics while Lean authenticates the wrapper.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";

import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertReviewedSourceConfiguration,
	reconcileReviewedSource,
	reviewedSourceSelection,
} from "../src/analyze/reviewed-source.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";

const projection = {
	name: "Alpha.HostNull"
	, nullConstructor: "Alpha.HostNull.null"
	, valueConstructor: "Alpha.HostNull.value"
};
const configuration = {
	schemaVersion: 1
	, modules: ["Alpha"]
	, hostProjections: [projection]
};
const hostNull = argument => ({
	kind: "apply"
	, constructor: "host-null"
	, arguments: [argument]
});
const option = argument => ({
	kind: "apply"
	, constructor: "option"
	, arguments: [argument]
});

const reviewedDocument = async () => {
	const document = corpusReviewedIr(
		{ id: "host-null" },
		[{ name: "Alpha.roundTrip", parameters: ["uint32"], result: "uint32" }],
	);
	const declaration = document.declarations.find(item => item.name === "roundTrip");
	declaration.parameters[0].type = hostNull(option({ kind: "primitive", name: "uint32" }));
	declaration.result.type = option(hostNull({ kind: "primitive", name: "uint32" }));
	validateBindingIr(document);
	return document;
};
const reviewInput = document => {
	const source = canonicalJson(document);
	return {
		schemaVersion: 1
		, path: "api.binding-ir.json"
		, source
		, sourceSha256: sha256(source)
		, semanticSha256: hashBindingIr(document)
	};
};
const sourceIdentity = (review, request = {}) => ({
	request: {
		modules: ["Alpha"]
		, exportModules: ["Alpha"]
		, resources: []
		, ...reviewedSourceSelection(review)
		, hostProjections: [projection]
		, ...request
	}
	, exportConfigurationSource: canonicalJson(configuration)
	, exportConfigurationSha256: sha256(canonicalJson(configuration))
});

test("reviewed host-null contracts reconcile only with the authenticated projection", async () => {
	assertReviewedSourceConfiguration(configuration);
	const document = await reviewedDocument();
	const review = reviewInput(document);
	assert.equal(
		reconcileReviewedSource(review, structuredClone(document), sourceIdentity(review)).declarations.length,
		document.declarations.length,
	);

	for(const hostProjections of [undefined, [], [{
		...projection
		, nullConstructor: "Alpha.HostNull.missing"
	}]]) {
		assert.throws(
			() => reconcileReviewedSource(
				review,
				structuredClone(document),
				sourceIdentity(review, { hostProjections }),
			),
			{ code: "reviewed-ir-source-mismatch" },
		);
	}

	const collapsed = structuredClone(document);
	const declaration = collapsed.declarations.find(item => item.name === "roundTrip");
	declaration.parameters[0].type = option({ kind: "primitive", name: "uint32" });
	assert.throws(
		() => reconcileReviewedSource(review, collapsed, sourceIdentity(review)),
		error => error.code === "reviewed-ir-source-mismatch"
			&& /parameters\[0\]\.type/u.test(error.details.field),
	);
});
