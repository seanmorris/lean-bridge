/**
 * Refuse host contracts which do not have an unambiguous Ruby projection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateRubyHostProvider } from "../../src/backends/ruby/host-provider.mjs";

const source = new URL("../fixtures/ruby-host-meter/lean-bridge.hosts.json", import.meta.url);
const contract = async () => JSON.parse(await readFile(source, "utf8"));
const generate = (ir, entries = []) => generateRubyHostProvider({
	ir, entries, modules: ["Workshop"]
	, namespace: "Workshop", extension: "libworkshop", identity: "a".repeat(64)
});

test("Ruby binder keywords, operations and member dispatch cannot silently collide", async () => {
	const ir = await contract(), box = ir.types[0];
	ir.types.push({ ...box, id: "host:second.BOX", name: "BOX", resource: { ...box.resource, kindId: "resource:second.BOX" } });
	assert.throws(() => generate(ir), /duplicate Ruby binder keyword/u);
	ir.types.pop();
	assert.throws(() => generate(ir, [{ name: "wait_for" }, { name: "wait_for" }]), /duplicate Ruby public operation/u);
	assert.throws(() => generate(ir, [{ name: "bind_hosts" }]), /reserved public operation/u);
	const ctor = ir.declarations.find(d => d.kind === "constructor");
	ir.declarations.push({ ...ctor, name: "new", id: "host:meter.Box.new", kind: "static-method" });
	assert.throws(() => generate(ir), /ambiguous Ruby member new/u);
});

test("Ruby borrowers need a real nominal anchor; dynamic or worker imports cannot use the synchronous provider", async () => {
	const ir = await contract(), identity = ir.declarations.find(d => d.name === "identity");
	identity.result = { ...identity.result, ownership: "borrow", lifetime: { scope: "parameter", anchor: "missing" } };
	assert.throws(() => generate(ir), /unanchored borrowed result/u);
	identity.result.lifetime = { scope: "receiver", anchor: "receiver" };
	assert.doesNotThrow(() => generate(ir));
	identity.resultMode = "promise";
	assert.throws(() => generate(ir), /synchronous member/u);
	identity.resultMode = "value";
	ir.types[0].host.dynamic = true;
	assert.throws(() => generate(ir), /statically declared host classes/u);
});
