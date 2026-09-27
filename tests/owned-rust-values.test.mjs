/**
 * Execute generated Rust aggregate conversions over actual compiled Lean.
 * These are native boundary probes, not installed Cargo package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedRustCallables } from "../src/backends/rust/owned-callables.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const wrappers = generated => {
	const nodes = new Map(generated.types.map(node => [node.id, node]));
	return generated.calls.map(root => {
		const params = root.parameters.map(id => nodes.get(id)), result = nodes.get(root.result);
		return `unsafe extern "C" { fn ${root.cName}(${["session: *mut c_void", ...params.map((node, i) => `a${i}: ${node.leaf ? "" : "*const "}${node.raw}`), `out: *mut ${result.raw}`, "owner: *mut *mut c_void"].join(", ")}) -> u32; }
#[allow(dead_code)]
fn call_${root.name}(${params.map((node, i) => `a${i}: &${node.input}`).join(", ")}) -> Result<${result.hostName}, Error> {
    unsafe { owned_call_${root.name}(${root.cName}${params.map((_, i) => `, a${i}`).join("")}) }
}`;
	}).join("\n");
};

const abiProbe = generated => {
	const pairs = [];
	for(const node of generated.types)
	{
		pairs.push([`sizeof(${node.cName})`, `std::mem::size_of::<${node.raw}>()`], [`_Alignof(${node.cName})`, `std::mem::align_of::<${node.raw}>()`]);
		if(node.scalar || node.integer || node.identity) continue;
		const field = (c, rust) => pairs.push([`offsetof(${node.cName}, ${c})`, `std::mem::offset_of!(${node.raw}, ${rust})`]);
		if(node.kind === "primitive" || node.element)
		{ field("data", "data"); field("length", "length"); }
		else if(node.kind === "variant")
		{
			field("kind", "kind"); field("cases", "cases");
			node.cases.forEach((branch, i) => branch.fields.forEach((item, j) => field(`cases.${branch.name}.${item.name}`, `cases.case${i}.field${j}`)));
		}
		else
		{
			if(node.kind === "option") field("has_value", "has_value");
			if(node.kind === "result") field("is_ok", "is_ok");
			node.fields.forEach((item, index) => field(item.name, `field${index}`));
		}
	}
	for(const node of generated.types.filter(node => node.kind === "callback"))
	{
		pairs.push([`sizeof(${node.cName}_host)`, `std::mem::size_of::<OwnedHost${node.index}>()`]
			, [`_Alignof(${node.cName}_host)`, `std::mem::align_of::<OwnedHost${node.index}>()`]);
		for(const name of ["call", "context", "closure", "recovery"])
			pairs.push([`offsetof(${node.cName}_host, ${name})`, `std::mem::offset_of!(OwnedHost${node.index}, ${name})`]);
	}
	pairs.push(["sizeof(__mpz_struct)", "std::mem::size_of::<OwnedMpz>()"], ["_Alignof(__mpz_struct)", "std::mem::align_of::<OwnedMpz>()"]);
	for(const [c, rust] of [["_mp_alloc", "allocated"], ["_mp_size", "size"], ["_mp_d", "data"]])
		pairs.push([`offsetof(__mpz_struct, ${c})`, `std::mem::offset_of!(OwnedMpz, ${rust})`]);
	return { c: `size_t owned_test_abi(size_t index) { const size_t values[] = {${pairs.map(pair => pair[0]).join(", ")}}; return index < sizeof(values) / sizeof(values[0]) ? values[index] : SIZE_MAX; }`
		, rust: `fn test_abi() {\n${pairs.map((pair, index) => `    check!(unsafe { owned_test_abi(${index}) } == ${pair[1]});`).join("\n")}\n}` };
};

const malformedProbe = generated => {
	const primitive = name => generated.types.find(node => node.kind === "primitive" && node.name === name);
	const tree = generated.types.find(node => node.name === "Tree"), branch = tree.cases.find(item => item.name === "branch");
	const children = generated.types.find(node => node.id === branch.fields[0].type);
	const option = generated.types.find(node => node.kind === "option"), string = primitive("string"), nat = primitive("nat");
	const body = [];
	const rejects = (node, setup, error = "MalformedResult") => body.push("    {"
		, "        let mut scope = OwnedScope::new(OwnedBudget::new());"
		, "        let mut output = OwnedOutput::borrowed(Rc::clone(&state), Rc::clone(&frame.lease));"
		, `        ${setup}`
		, `        check!(unsafe { owned_from${node.index}(&value, 0, &mut scope, &mut output) } == Err(Error::${error}));`, "    }");
	rejects(string, `let value = ${string.raw} { data: std::ptr::null(), length: 1 };`);
	rejects(string, `let value = ${string.raw} { data: b"\\xc0\\x80".as_ptr(), length: 2 };`);
	rejects(string, `let value = ${string.raw} { data: std::ptr::null(), length: usize::MAX };`, "Limit");
	rejects(nat, "let raw = OwnedMpz { allocated: 0, size: -1, data: &1 }; let value = &raw as *const _;");
	rejects(nat, "let raw = OwnedMpz { allocated: 0, size: i32::MIN, data: std::ptr::null() }; let value = &raw as *const _;", "Limit");
	rejects(nat, "let raw = OwnedMpz { allocated: 0, size: 1, data: &0 }; let value = &raw as *const _;");
	rejects(nat, "let raw = OwnedMpz { allocated: 1, size: 2, data: [1, 1].as_ptr() }; let value = &raw as *const _;");
	rejects(nat, "let raw = OwnedMpz { allocated: 0, size: 1, data: 1usize as *const u64 }; let value = &raw as *const _;");
	rejects(option, `let value = ${option.raw} { has_value: 2, ..Default::default() };`);
	rejects(tree, `let value = ${tree.raw}::default();`);
	rejects(children, `let value = ${children.raw} { data: std::ptr::null(), length: 1 };`);
	rejects(children, `let value = ${children.raw} { data: std::ptr::null(), length: usize::MAX };`, "Limit");
	rejects(tree, `let mut value = ${tree.raw}::default(); let children = ${children.raw} { data: std::ptr::addr_of!(value), length: 1 }; value.kind = 1; value.cases = OwnedUnion${tree.index} { case1: OwnedCase${tree.index}_1 { field0: &children } };`, "Limit");
	for(const name of ["bool", "unit"]) rejects(primitive(name), "let value = 2;");
	rejects(primitive("char"), "let value = 0xd800;");
	const resource = generated.types.find(node => node.name === "Ticket");
	rejects(resource, "let value = std::ptr::null_mut();");
	const mixed = generated.types.find(node => node.name === "Mixed");
	const markers = mixed.fields.findIndex(field => field.publicName === "markers");
	const echo = generated.calls.find(item => item.name === "echo_mixed");
	return `fn test_malformed(ticket: &Ticket, mixed: &Mixed) {
    let state = current_state().unwrap(); let frame = owned_runtime::BorrowFrame::new(&state).unwrap();
    let before = baseline();
${body.join("\n")}
    {
        let mut input_scope = OwnedScope::new(OwnedBudget::new());
        let input = owned_to${mixed.index}(mixed, &mut input_scope, &state).unwrap();
        let mut raw = ${mixed.raw}::default(); let mut output = OwnedOutput::new(Rc::clone(&state));
        checked(unsafe { ${echo.cName}(state.require().unwrap(), &input, &mut raw, &mut output.owner.value) }).unwrap();
        let mut broken = unsafe { *raw.field${markers} };
        broken.data = std::ptr::null(); broken.length = 1; raw.field${markers} = &broken;
        let mut result_scope = OwnedScope::new(OwnedBudget::new());
        check!(unsafe { owned_from${mixed.index}(&raw, 0, &mut result_scope, &mut output) } == Err(Error::MalformedResult));
        // The first resource field acquired this real native owner before the
        // later malformed field failed. Dropping the partial output must free it.
        check!(output.lease.is_some() && output.owner.value.is_null());
    }
    check!(baseline() == before);
    unsafe extern "C" fn reject_after_publication(session: *mut c_void, input: *const ${mixed.raw}, out: *mut ${mixed.raw}, owner: *mut *mut c_void) -> u32 {
        let status = unsafe { ${echo.cName}(session, input, out, owner) };
        if status == 0 { 9 } else { status }
    }
    check!(unsafe { owned_call_echo_mixed(reject_after_publication, mixed) } == Err(Error::MalformedResult));
    check!(baseline() == before); check!(call_serial(ticket).is_ok());
}`;
};

test("owned Rust projections are deterministic and preserve native host types", () => {
	const ir = ownedCppCompositionReviewedIr(), before = structuredClone(ir), generated = generateOwnedRustCallables(ir);
	assert.deepEqual(ir, before);
	const reverse = structuredClone(ir); reverse.types.reverse();
	const other = generateOwnedRustCallables(reverse);
	assert.equal(other.source, generated.source); assert.equal(other.valuesSource, generated.valuesSource);
	assert.equal(other.apiSource, generated.apiSource);
	assert.match(generated.valuesSource, /pub enum Chain/u);
	assert.match(generated.valuesSource, /Option<Box<Chain>>/u);
	assert.match(generated.valuesSource, /pub type Ticket = Resource</u);
	assert.match(generated.valuesSource, /Result<Bundle, Ticket>/u);
	for(const name of ["Resource", "Error", "Self", "OwnedRaw0"])
	{
		const invalid = structuredClone(ir); invalid.types.find(node => node.name === "Payload").name = name;
		assert.throws(() => generateOwnedRustCallables(invalid));
	}
});

for(const reviewed of [false, true]) test(`owned Rust values round-trip compiled Lean (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: "owned-cpp-composition", hostCallbacks: true
		, ...(reviewed ? { reviewedIr: ownedCppCompositionReviewedIr() } : {}) });
	const native = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const generated = generateOwnedRustCallables(native.layout.model.bindingIr), abi = abiProbe(generated);
	const implementation = `#include <stdlib.h>
#include <stddef.h>
static size_t live = 0, attempts = 0; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  ++attempts;
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${native.source}
size_t owned_test_live(void) { return live; }
size_t owned_test_attempts(void) { return attempts; }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; attempts = 0; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
_Static_assert(GMP_NUMB_BITS == 64 && sizeof(mp_limb_t) == 8 && sizeof(int) == 4, "Rust GMP ABI requires nail-free 64-bit limbs and 32-bit counts");
${abi.c}
`;
	for(const [path, source] of Object.entries(native.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	const environment = { PATH: "/usr/bin:/bin" };
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall", "-Wextra"
		, "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include")
		, "public-api.c", "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp", "-Wl,--no-undefined"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-rust-values.so"], compiled.directory, environment);
	const template = await readFile("tests/fixtures/structured-types/owned-rust-values.rs", "utf8")
		+ await readFile("tests/fixtures/structured-types/owned-rust-callables.rs", "utf8");
	await saveLakeFile(compiled.directory, "Cargo.toml", '[package]\nname="owned-rust-values"\nversion="1.0.0"\nedition="2021"\n[dependencies]\nnum-bigint="=0.4.6"\n[profile.dev]\ndebug=0\nincremental=false\n');
	await saveLakeFile(compiled.directory, "src/lib.rs", generated.apiSource + "\nmod owned_values;\n");
	await saveLakeFile(compiled.directory, "src/owned_values.rs", generated.source + `\n#[cfg(test)] mod tests { use super::*;\n${template}\n${wrappers(generated)}\n${abi.rust}\n${malformedProbe(generated)}\n}`);
	const env = { ...environment, RUSTC: resolve(process.env.LEAN_BRIDGE_RUSTC ?? ".toolchains/rust-1.90.0/bin/rustc")
		, RUSTFLAGS: `-Dwarnings -Lnative=${compiled.directory} -ldylib=owned-rust-values -Clink-arg=-Wl,-rpath,${compiled.directory}`
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied")
		, CARGO_NET_OFFLINE: "true", CARGO_INCREMENTAL: "0" };
	const cargo = resolve(process.env.LEAN_BRIDGE_CARGO ?? ".toolchains/rust-1.90.0/bin/cargo");
	await runCopied(cargo, ["generate-lockfile", "--offline"], compiled.directory, env);
	const result = await runCopied(cargo, ["test", "--offline", "--locked", "--lib", "--", "--nocapture", "--test-threads=1"], compiled.directory, env);
	assert.match(result.stdout, /1 passed; 0 failed/u);
	const match = result.stdout.match(/owned-rust-values:(\d+):(\d+):(\d+):0:0/u); assert.ok(match, result.stdout);
	const observed = { checks: Number(match[1]), rustFaults: Number(match[2]), nativeFaults: Number(match[3]), live: 0, identities: 0 };
	assert.ok(observed.checks > 400 && observed.rustFaults > 50 && observed.nativeFaults > 20);
	const rejected = [];
	for(const [name, source, diagnostic] of [
		["missing-recovery", "fn main() { let _ = factory(|()| Ok(Ticket::default())); }", /OwnedCallback/u]
		, ["wrong-callback-result", "fn invalid(value: Bundle) { let _ = callback_record(&value, |_: Bundle| Ok(Ticket::default())); } fn main() {}", /OwnedCallback/u]
		, ["wrong-resource-kind", "fn main() { let other = identity_closure(()).unwrap(); let _ = serial(&other); }", /mismatched types/u]
	]) {
		await saveLakeFile(compiled.directory, `src/bin/${name}.rs`, "use owned_rust_values::*;\n" + source);
		await assert.rejects(runCopied(cargo, ["check", "--offline", "--locked", "--bin", name], compiled.directory, env), error => {
			assert.match(error.details?.stderr ?? "", diagnostic); return true;
		});
		rejected.push(name);
	}
	await saveLakeFile(resolve("build/owned-rust-values"), `${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		result: observed, compiledLean: true, installedPackage: false
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, valuesSha256: sha256(generated.valuesSource)
		, apiSha256: sha256(generated.apiSource)
		, conversionsSha256: sha256(generated.source)
		, probeSha256: sha256(template), nativeSha256: sha256(implementation)
		, rejected
	}));
	t.diagnostic(JSON.stringify(observed));
});
