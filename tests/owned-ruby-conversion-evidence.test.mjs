/**
 * Source-bound Ruby observations and explicit rejection of inflated claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertOwnedRubyConversions } from "./helpers/owned-ruby-conversion-evidence.mjs";

test("Ruby conversion evidence requires compiled failures, complete paths and current generators", async () => {
	const record = JSON.parse(await readFile("docs/evidence/owned-ruby-conversions-20260927.json"));
	await assertOwnedRubyConversions(record);
	for(const mutate of [
		value => { value.scope.installedPackage = true; }
		, value => { value.scope.typeSurfacePromotions = 1; }
		, value => { value.reports.pop(); }
		, value => { value.reports[0].report.observations[0].live = 1; }
		, value => { value.reports[0].report.observations[2].rubyFaults = 0; }
		, value => { value.reports[0].report.observations[2].nativeFaults = 0; }
		, value => { value.reports[2].report.observations[0].primitives = 18; }
		, value => { value.reports[0].report.boundarySha256 = "0".repeat(64); }
		, value => { value.sources[0].sha256 = "0".repeat(64); }
		, value => { value.foundation.runtimeUpdate.before += "unrecorded change"; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		for(const entry of changed.reports)
		{
			const source = canonicalJson(entry.report);
			entry.bytes = Buffer.byteLength(source); entry.sha256 = sha256(source);
		}
		await assert.rejects(() => assertOwnedRubyConversions(changed));
	}
});
