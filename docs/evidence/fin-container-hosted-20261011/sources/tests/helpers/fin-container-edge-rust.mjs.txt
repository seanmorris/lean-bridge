/**
 * Observe the full Rust consumer without replacing its generated API or original assertions.
 * BigUint and typed containers exclude Python/C-style malformed carriers from this host surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { finContainerEdgeColumns, finContainerEdgeEntries } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeConsumer, insertFinContainerEdgeFragment } from "./fin-container-edges.mjs";

/** Independently enumerate every original and additive Rust public call under observation. */
export const finContainerEdgeRustExpected = Object.freeze((() => {
	const rows = [], counts = Array(8).fill(0);
	const add = (method, accepted) => {
		const index = finContainerEdgeEntries.indexOf(method);
		if(accepted)
		{
			counts[index + 2]++;
			if(index >= 4) counts[index - 4]++;
		}
		rows.push(Object.freeze([rows.length + 1, method, accepted ? 0 : 1, Object.freeze([...counts])]));
	};
	for(const accepted of [true, false, true]) add("present", accepted);
	for(const accepted of [true, true, false]) add("flatten", accepted);
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, true);
	for(let value = 0; value < 3; value++) for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, false);
	for(let value = 0; value < 3; value++) add("optionalDigits", true);
	for(let row = 0; row < 3; row++)
	{
		add("present", false); add("optionalDigits", false);
		for(let column = 0; column < 3; column++) add("flatten", false);
	}
	add("present", true); add("flatten", true);
	for(let cycle = 0; cycle < 1000; cycle++)
		for(const method of ["emptyArray", "emptyList", "emptyOption", "present", "flatten", "optionalDigits"])
		{ add(method, false); add(method, true); }
	return rows;
})());

/**
 * Require the full ordered transcript and complete original Rust consumer success.
 *
 * @param stdout - Actual Rust process output.
 */
export const readFinContainerEdgeRust = stdout => {
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const lines = stdout.slice(0, -1).split("\n");
	assert.equal(lines.pop(), "fin-container-ok:14078");
	assert.equal(lines.length, finContainerEdgeRustExpected.length);
	return lines.map((line, index) => {
		assert.match(line, /^edge-rust [1-9][0-9]* [A-Za-z]+ [01](?: (?:0|[1-9][0-9]{0,14})){8}$/u);
		const [, step, method, status, ...counts] = line.split(" ");
		const row = [Number(step), method, Number(status), counts.map(Number)];
		assert.deepEqual(row, finContainerEdgeRustExpected[index], `Rust edge call ${index + 1}`);
		return row;
	});
};

/**
 * Add observer wrappers around the six normal public functions; retain the full consumer body.
 *
 * @param model - Verified native model.
 * @param component - Receipt component identity.
 */
export const finContainerEdgeRustProbe = async (model, component) => {
	finContainerEdgeColumns(model, component);
	const inputs = ["[BigUint]", "[BigUint]", "Option<BigUint>", "Option<Vec<BigUint>>", "[Option<BigUint>]", "[Vec<BigUint>]"];
	const outputs = ["Vec<BigUint>", "Vec<BigUint>", "Option<BigUint>", "Option<Vec<BigUint>>", "Vec<BigUint>", "Option<Vec<BigUint>>"];
	const wrappers = finContainerEdgeEntries.map((method, index) => {
		const name = method.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`);
		return `    pub fn ${name}(input: &${inputs[index]}) -> Result<${outputs[index]}, Error> {
        observe(${index}, "${method}", || fincontainers::${name}(input))
    }`;
	});
	const prelude = `mod edge_api {
    pub use fincontainers::*;
    use std::ffi::{c_char, c_void};
    use std::sync::{OnceLock, atomic::{AtomicUsize, Ordering}};
    #[link(name = "dl")]
    unsafe extern "C" { fn dlsym(handle: *mut c_void, name: *const c_char) -> *mut c_void; }
    type Counter = unsafe extern "C" fn(u32) -> u64;
    type Ready = unsafe extern "C" fn() -> i32;
    static STATE: OnceLock<(Counter, Ready)> = OnceLock::new();
    static STEP: AtomicUsize = AtomicUsize::new(0);
    fn state() -> &'static (Counter, Ready) {
        STATE.get_or_init(|| {
            let count = unsafe { dlsym(std::ptr::null_mut(), c"fin_container_edge_count".as_ptr()) };
            let ready = unsafe { dlsym(std::ptr::null_mut(), c"fin_container_edge_ready".as_ptr()) };
            if count.is_null() || ready.is_null() { eprintln!("edge interposer is not loaded"); std::process::exit(2); }
            unsafe { (std::mem::transmute::<*mut c_void, Counter>(count), std::mem::transmute::<*mut c_void, Ready>(ready)) }
        })
    }
    pub fn start() {
        let (count, ready) = state();
        if (0..8).any(|i| unsafe { count(i) != 0 }) || unsafe { ready() != 0 } {
            eprintln!("edge counters or bindings are not initially empty"); std::process::exit(3);
        }
    }
    fn observe<T>(index: usize, method: &str, call: impl FnOnce() -> Result<T, Error>) -> Result<T, Error> {
        let (count, ready) = state();
        let before: [u64; 8] = std::array::from_fn(|i| unsafe { count(i as u32) });
        let result = call();
        let status = match &result { Ok(_) => 0, Err(Error::Native { code: 1, .. }) => 1, _ => panic!("unexpected Rust edge outcome") };
        if unsafe { ready() } != 1 { eprintln!("Rust edge library identities are incomplete"); std::process::exit(4); }
        let after: [u64; 8] = std::array::from_fn(|i| unsafe { count(i as u32) });
        for i in 0..8 {
            let delta = u64::from(status == 0 && (i == index + 2 || (index >= 4 && i == index - 4)));
            if after[i] != before[i] + delta { eprintln!("wrong Rust edge dispatch count"); std::process::exit(5); }
        }
        print!("edge-rust {} {method} {status}", STEP.fetch_add(1, Ordering::Relaxed) + 1);
        for value in after { print!(" {value}"); }
        println!();
        result
    }
${wrappers.join("\n")}
}`;
	let source = insertFinContainerEdgeFragment(await finContainerEdgeConsumer("rust"), "use fincontainers as api;", prelude);
	source = source.replace("use fincontainers as api;", "use edge_api as api;");
	assert.equal(source.split("fn main() {").length, 2);
	return source.replace("fn main() {", "fn main() {\n    edge_api::start();");
};
