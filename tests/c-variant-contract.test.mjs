/**
 * Public C tags and active-branch GMP ownership before installed execution.
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
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { nativeVariantReviewedIr } from "./helpers/native-variant-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

test("C/GMP variants use named tags, initialized payloads and active-case conversion", () => {
	const ir = nativeVariantReviewedIr(), raw = generateCBindingPackage(ir), gmp = generateGmpProjection(ir);
	assert.match(raw["include/variants.h"], /VARIANTS_SIGNAL_KIND_DATA/);
	assert.match(raw["include/variants.h"], /variants_signal_select\(variants_signal \*value, uint32_t kind\)/);
	assert.match(gmp.files["include/variants.h"], /#define VARIANTS_SIGNAL_KIND_DATA VARIANTS_GMP_SIGNAL_KIND_DATA/);
	assert.match(gmp.files["include/detail/variants_gmp.h"], /variants_gmp_nat natural;/);
	assert.match(gmp.files["src/variants_gmp.c"], /switch \(value->kind\)/);
	assert.match(gmp.files["src/variants_gmp.c"], /mpz_import/);
	assert.doesNotMatch(gmp.files["src/variants_gmp.c"], /lean_ctor_|lean_obj_tag/);
});

test("C variant tag and selector collisions reject before compilation", () => {
	for(const name of ["signalInit", "signalSelect", "signalTag"])
	{
		const ir = nativeVariantReviewedIr(); ir.declarations[0].name = name;
		assert.throws(() => generateGmpProjection(ir), /generated or reserved identifier/);
	}
	const ir = nativeVariantReviewedIr(); ir.types.find(type => type.name === "Packet").name = "SignalTag";
	assert.throws(() => compilePrimitiveCSurface(ir, { variants: true, compounds: true, lists: true }), /collides with another generated type/);
});

test("public GMP names cannot collide with the private C transport", () => {
	for(const name of ["GmpSignal", "GmpStatus"])
	{
		const ir = nativeVariantReviewedIr(); ir.types.find(type => type.name === "Packet").name = name;
		assert.throws(() => generateGmpProjection(ir), /public GMP name collides with the private C transport/);
	}
	const ir = nativeVariantReviewedIr(); ir.declarations.find(fn => fn.name === "next").name = "gmpEcho";
	assert.throws(() => generateGmpProjection(ir), /public GMP name collides with the private C transport/);
	const aliases = nativeVariantReviewedIr(), signal = aliases.types.find(type => type.name === "Signal"); signal.name = "SignalT";
	aliases.types.push({ ...signal, id: "lean:Variants.GmpSignal", name: "GmpSignal", kind: "alias", cases: [], target: { kind: "primitive", name: "uint32" } });
	assert.throws(() => generateGmpProjection(aliases), /public GMP name collides with the private C transport/);
});

test("C/GMP selectors release branches and initialize first-case integer payloads", async t => {
	try
	{ await access("/usr/include/x86_64-linux-gnu/gmp.h"); await access("/usr/bin/cc"); }
	catch
	{ t.skip("The installed suite verifies the packaged GMP header; no system development header here."); return; }
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-c-variant-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = nativeVariantReviewedIr(); ir.types.find(type => type.name === "Scalars").cases.reverse();
	const raw = generateCBindingPackage(ir), gmp = generateGmpProjection(ir);
	for(const [path, contents] of Object.entries(raw)) await saveLakeFile(root, `raw/${path}`, contents);
	for(const [path, contents] of Object.entries(gmp.files)) await saveLakeFile(root, `public/${path}`, contents);
	await saveLakeFile(root, "consumer.c", `#include "variants.h"
#include <assert.h>
#include <stdlib.h>
#include <string.h>
int main(void) {
  variants_scalars value; variants_scalars_init(&value);
  assert(value.kind == VARIANTS_SCALARS_KIND_ALL);
  for (unsigned i = 0; i < 1000; ++i) {
    mpz_setbit(value.cases.all.natural, 5120); mpz_set_si(value.cases.all.integer, -91);
    assert(variants_scalars_select(&value, VARIANTS_SCALARS_KIND_ABSENT) == VARIANTS_STATUS_OK);
    assert(variants_scalars_select(&value, VARIANTS_SCALARS_KIND_ALL) == VARIANTS_STATUS_OK);
    assert(mpz_sgn(value.cases.all.natural) == 0 && mpz_sgn(value.cases.all.integer) == 0);
    mpz_setbit(value.cases.all.natural, 128);
    assert(variants_scalars_select(&value, UINT32_MAX) == VARIANTS_STATUS_INVALID_ARGUMENT);
    assert(mpz_tstbit(value.cases.all.natural, 128));
    variants_scalars_clear(&value); variants_scalars_clear(&value);
    assert(value.kind == VARIANTS_SCALARS_KIND_ALL && mpz_sgn(value.cases.all.natural) == 0);
  }
  variants_scalars_clear(&value);
  variants_signal signal; variants_signal_init(&signal);
  assert(variants_signal_select(NULL, VARIANTS_SIGNAL_KIND_DATA) == VARIANTS_STATUS_INVALID_ARGUMENT);
  assert(variants_signal_select(&signal, VARIANTS_SIGNAL_KIND_DATA) == VARIANTS_STATUS_OK);
  void* owned = malloc(4); assert(owned); memcpy(owned, "data", 4);
  signal.cases.data.label = (variants_string){owned, 4, owned, free};
  assert(variants_signal_select(&signal, VARIANTS_SIGNAL_KIND_MARKER) == VARIANTS_STATUS_OK);
  assert(signal.cases.marker.value == 0); variants_signal_clear(&signal); variants_signal_clear(&signal);
}
`);
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-no-pie"];
	const environment = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	await runCopied("/usr/bin/cc", [...flags, "-I", join(root, "raw/include"), "-I", join(root, "raw/internal"), "-I", join(root, "public/include"), "-c", "public/src/variants_gmp.c", "-o", "facade.o"], root, environment);
	await runCopied("/usr/bin/cc", [...flags, "-I", join(root, "raw/include"), "-I", join(root, "raw/internal"), "-c", "raw/src/variants.c", "-o", "raw.o"], root, environment);
	await runCopied("/usr/bin/cc", [...flags, "-I", join(root, "public/include"), "consumer.c", "facade.o", "raw.o", "-lgmp", "-o", "consumer"], root, environment);
	const executed = await runCopied(join(root, "consumer"), [], root, { ...copiedCleanEnvironment, ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1" });
	assert.equal(executed.stdout, ""); assert.equal(executed.stderr, "");
});
