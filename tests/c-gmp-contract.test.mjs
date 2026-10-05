/**
 * Public C/GMP spelling and separation from the shared raw adapter.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { gmpIdentity, gmpSource } from "../src/backends/c/gmp.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("GMP source is pinned to the authenticated upstream release", async () => {
	assert.equal((await gmpSource()).length, 2094196);
	assert.equal(gmpIdentity.version, "6.3.0");
});

test("GMP initializer and dependency-header collisions reject at admission", () => {
	const ir = callableReviewedIr();
	ir.declarations[0].name = "natInit";
	assert.throws(() => generateGmpProjection(ir), /generated GMP aggregate initializer/);
	const named = callableReviewedIr(); named.component.name = "gmp"; named.component.id = "gmp@1.0.0";
	assert.throws(() => generateGmpProjection(named), /supplied gmp.h/);
});

test("C/GMP headers and trampolines compile without changing the private C projection", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-c-gmp-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = callableReviewedIr();
	ir.declarations.find(fn => fn.name === "callNat").parameters[0].name = "result";
	const raw = generateCBindingPackage(ir), generated = generateGmpProjection(ir);
	assert.deepEqual(raw, generateCBindingPackage(ir));
	assert.match(generated.files["include/callables.h"], /mpz_srcptr _lb_arg0/);
	assert.match(generated.files["include/detail/callables_gmp.h"], /typedef mpz_t callables_gmp_nat/);
	assert.match(raw["include/callables.h"], /const uint32_t \*data/);
	for(const [path, text] of Object.entries(raw)) await saveLakeFile(root, `raw/${path}`, text);
	for(const [path, text] of Object.entries(generated.files)) await saveLakeFile(root, `public/${path}`, text);
	try
{ await access("/usr/include/x86_64-linux-gnu/gmp.h"); await access("/usr/bin/cc"); }
	catch
{ t.diagnostic("System GMP development header unavailable; installed suites compile the packaged header instead."); return; }
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-I", join(root, "raw/include"), "-I", join(root, "public/include")];
	await runCopied("/usr/bin/cc", [...flags, "-c", join(root, "public/src/callables_gmp.c"), "-o", join(root, "facade.o")], root, { PATH: "/usr/bin:/bin" });
	await saveLakeFile(root, "public.c", '#include "callables.h"\nint main(void) { mpz_t value; mpz_init(value); callables_nat_clear(value); mpz_clear(value); }\n');
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-I", join(root, "public/include"), "-c", "public.c", "-o", "public.o"], root, { PATH: "/usr/bin:/bin" });
});
