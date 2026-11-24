/** @file Execute the generated private member table on a real Perl interpreter. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { perlHostMembers } from "../../src/backends/perl/host-members.mjs";

const exec = promisify(execFile);
test("Perl dispatches a checked constructor, accessors and real application methods", async t => {
	const dir = await mkdtemp(join(tmpdir(), "perl-host-members-"));
	t.after(() => rm(dir, {recursive: true, force: true}));
	const ir = JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json", "utf8"));
	ir.types[0].host.targets = ["perl"];
	const pkg = "LeanBridge::Workshop", {slots, implementation} = perlHostMembers(ir, pkg);
	const suffixes = ["read", "create", "get_level", "set_level", "identity"];
	const indices = suffixes.map(s => slots.findIndex(m => m.symbol === "lean_bridge_host_perl_box_" + s));
	assert.equal(new Set(indices).size, 5); assert.ok(indices.every(i => i >= 0));
	const path = join(dir, "LeanBridge/Workshop"); await mkdir(path, {recursive: true});
	await writeFile(join(path, "_HostMembers.pm"), implementation, {flag: "wx"});
	const perl = process.env.LEAN_BRIDGE_PERL ?? "perl";
	const {stdout, stderr} = await exec(perl, ["-I" + dir, resolve("tests/fixtures/perl-host-meter/members.pl"), ...indices.map(String)]);
	assert.equal(stderr, ""); assert.match(stdout, /subclass, nominal identity, exception identity/u);
	const dynamic = structuredClone(ir); dynamic.types[0].host.dynamic = true;
	assert.throws(() => perlHostMembers(dynamic, pkg), /statically declared/u);
	const reserved = structuredClone(ir); reserved.declarations[0].name = "DESTROY";
	assert.throws(() => perlHostMembers(reserved, pkg), /invalid Perl selector/u);
	t.diagnostic(stdout.trim());
});
