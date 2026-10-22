/**
 * Source-only controls for compiler-derived owned PHP-Wasm entry selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createOwnedPhpWasmModel } from "../../src/build/php-wasm-owned-model.mjs";
import {
	phpWasmOwnedRefinementEntrySelection, phpWasmOwnedRefinementValidatorEntries
} from "./php-wasm-owned-refinement-entry-selection.mjs";

const transferInput = async () => JSON.parse(await readFile(
	"docs/evidence/owned-php-wasm-transfers-20260930.json", "utf8"
)).packages.observations[0].inputs;

test("owned entry selection binds public, native, Lean and transfer identities to the model", async () => {
	const model = createOwnedPhpWasmModel({ ...await transferInput()
		, hostCallbacks: false, transferredInputs: true });
	const sourceEntries = [
		{ symbol: "owned_probe_constructor", kind: "constructor", label: "Owned.checked" }
		, { symbol: "owned_probe_source", kind: "source", label: "Owned.transfer" }
	];
	const { selected, adapters, zend } = phpWasmOwnedRefinementEntrySelection(model, sourceEntries);
	assert.deepEqual(selected.slice(0, sourceEntries.length), sourceEntries);
	assert.equal(selected.filter(item => item.kind === "public").length, zend.functions.length);
	assert.equal(selected.filter(item => item.kind === "adapter"
		&& item.label.endsWith(":native")).length, zend.functions.length);
	assert.equal(selected.filter(item => item.kind === "adapter"
		&& item.label.endsWith(":lean")).length, model.exports.length);
	for(const fn of zend.functions)
	{
		const declaration = model.bindingIr.declarations.find(item => item.id === fn.id);
		assert.ok(selected.some(item => item.symbol === `lgo_call${fn.index}`
			&& item.kind === "public" && item.label === declaration.name));
		assert.ok(selected.some(item => item.symbol === fn.symbol
			&& item.label === `${declaration.name}:native`));
	}
	for(const item of model.exports)
	{
		const declaration = model.bindingIr.declarations.find(value => value.id === item.bindingId);
		assert.ok(selected.some(value => value.symbol === item.symbol
			&& value.label === `${declaration.name}:lean`));
		assert.match(adapters.leanSource, new RegExp(`^@\\[export ${item.symbol}\\]$`, "mu"));
	}
	assert.deepEqual(selected.filter(item => [
		"identity.borrow", "transfer.reserve", "transfer.begin", "transfer.commit"
		, "owner.move", "owner.consume", "transfer.finish"
	].includes(item.label)).map(item => item.label), [
		"identity.borrow", "transfer.reserve", "transfer.begin", "transfer.commit"
		, "owner.move", "owner.consume", "transfer.finish"
	]);
	assert.equal(selected.filter(item => item.kind === "validator").length, 0);
});

test("owned validator identities come only from exact generated export annotations", () => {
	const source = "@[export lean_bridge_owned_refine_bbbbbbbbbbbbbbbbbbbb]\n"
		+ "def second := 2\n"
		+ "@[export ordinary_export]\n"
		+ "def ordinary := 0\n"
		+ "@[export lean_bridge_owned_refine_aaaaaaaaaaaaaaaaaaaa]\n"
		+ "def first := 1\n";
	assert.deepEqual(phpWasmOwnedRefinementValidatorEntries(source), [
		{ symbol: "lean_bridge_owned_refine_aaaaaaaaaaaaaaaaaaaa", kind: "validator"
			, label: "owned:lean_bridge_owned_refine_aaaaaaaaaaaaaaaaaaaa" }
		, { symbol: "lean_bridge_owned_refine_bbbbbbbbbbbbbbbbbbbb", kind: "validator"
			, label: "owned:lean_bridge_owned_refine_bbbbbbbbbbbbbbbbbbbb" }
	]);
	assert.throws(() => phpWasmOwnedRefinementValidatorEntries(source
		+ "@[export lean_bridge_owned_refine_aaaaaaaaaaaaaaaaaaaa]\ndef duplicate := 3\n"));
});

test("owned selection rejects source-marker collisions instead of shadowing generated identities", async () => {
	const model = createOwnedPhpWasmModel({ ...await transferInput()
		, hostCallbacks: false, transferredInputs: true });
	const generated = phpWasmOwnedRefinementEntrySelection(model).selected[0];
	assert.throws(() => phpWasmOwnedRefinementEntrySelection(model, [{
		...generated, kind: "constructor", label: "Owned.collision"
	}]));
});
