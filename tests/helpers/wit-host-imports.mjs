/** @file Verify both source routes for WIT resource member imports. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { witApplicationHostImports } from "../../src/backends/wit/application-host-imports.mjs";
import { checkNativeHostImports } from "./native-host-import-check.mjs";
checkNativeHostImports("wit-wasi");

test("object interface identity binds ownership without depending on documentation", async () => {
	const ir = JSON.parse(await readFile("tests/fixtures/c-host-members/lean-bridge.hosts.json", "utf8"));
	assert.throws(() => witApplicationHostImports(ir), /WIT\/WASI classes/u);
	ir.types[0].host.targets = ["wit-wasi"];
	const a = witApplicationHostImports(ir);
	ir.types[0].documentation.summary = "An unrelated description.";
	assert.deepEqual(witApplicationHostImports(ir), a);
	const d = ir.declarations.find(x => x.id.endsWith(".identity"));
	d.result.ownership = "borrow"; d.result.lifetime = {scope: "receiver", anchor: "receiver"};
	const changed = witApplicationHostImports(ir), member = changed.contract.methods.find(m => m.id === d.id);
	assert.notEqual(changed.interfaceName, a.interfaceName);
	assert.equal(member.anchor, 0); assert.equal(member.resultOwnership, "borrow");
	// The guest returns a fresh owner in both cases; only the semantic
	// descriptor can distinguish a borrowed result anchored to self.
	assert.equal(changed.wit.split("\n").slice(1).join("\n"), a.wit.split("\n").slice(1).join("\n"));
	d.result.lifetime = {scope: "parameter", anchor: "absent"};
	assert.throws(() => witApplicationHostImports(ir));
});
