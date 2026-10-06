/**
 * Installed Rust consumers for checked top-level Fin sites.
 *
 * @file
 */
import { nativeFinSymbol } from "./native-fin-consumers.mjs";

/** Public API cases: exact bounds, Error::Native identity, cleanup and recovery. */
export const rustFinConsumer = () => `use native_fin as api;
use api::{BigUint, Error};

fn rejected<T>(result: Result<T, Error>, parameter: &str, bound: &str) -> bool {
    match result {
        Err(Error::Native { code: 1, message }) => message == format!("{parameter} is not below its Fin {bound} bound"),
        _ => false,
    }
}

fn main() {
    let mut checks = 0usize;
    macro_rules! require {
        ($condition:expr) => {
            if !$condition {
                eprintln!("failed at line {}: {}", line!(), stringify!($condition));
                std::process::exit(1);
            }
            checks += 1;
        };
    }
    let n = |value: u64| BigUint::from(value);
    let huge = BigUint::from(1u8) << 70usize;
    let word = BigUint::from(1u8) << 32usize;

    // Fin 0 is uninhabited: every input is rejected by the native bound check.
    require!(rejected(api::impossible(&n(0)), "arg0", "0"));
    require!(rejected(api::impossible(&n(1)), "arg0", "0"));

    // Fin 1 admits only zero.
    require!(api::only(&n(0)).unwrap() == n(7));
    require!(rejected(api::only(&n(1)), "arg0", "1"));

    // Fin 10 with a Fin result: endpoints and beyond-bound inputs.
    require!(api::mirror(&n(0)).unwrap() == n(9) && api::mirror(&n(9)).unwrap() == n(0));
    for value in [n(10), n(11), word.clone(), huge.clone()] {
        require!(rejected(api::mirror(&value), "arg0", "10"));
    }

    // A transparent alias keeps its exact bound.
    require!(api::twice(&n(299)).unwrap() == n(598));
    require!(rejected(api::twice(&n(300)), "arg0", "300"));
    require!(rejected(api::twice(&n(301)), "arg0", "300"));

    // 2^70 exceeds every machine word.
    require!(api::succ_huge(&word).unwrap() == &word + 1u8);
    let below = &huge - 2u8;
    let last = &huge - 1u8;
    require!(api::succ_huge(&below).unwrap() == last && api::succ_huge(&last).unwrap() == last);
    let bound = huge.to_string();
    for value in [huge.clone(), &huge + 1u8, BigUint::from(1u8) << 128usize] {
        require!(rejected(api::succ_huge(&value), "arg0", &bound));
    }

    // A result-only refinement returns a BigUint below its bound.
    require!(api::wrap(&n(100)).unwrap() == n(2) && api::wrap(&huge).unwrap() == n(2) && api::wrap(&n(0)).unwrap() == n(0));

    // Multiargument calls reject the Fin argument and leave borrowed inputs unchanged.
    let base = n(5);
    let name = String::from("slot");
    require!(api::label(&base, &n(3), &name).unwrap() == "slot:8");
    require!(rejected(api::label(&base, &n(4), &name), "arg1", "4"));
    require!(base == n(5) && name == "slot" && api::label(&base, &n(0), &name).unwrap() == "slot:5");

    // Repeated invalid and valid calls recover without retiring the runtime.
    for i in 0..1000u64 {
        if !rejected(api::mirror(&n(10 + i)), "arg0", "10") {
            eprintln!("invalid call accepted at {i}");
            std::process::exit(1);
        }
        if api::mirror(&n(i % 10)).unwrap() != n(9 - i % 10) {
            eprintln!("valid call failed at {i}");
            std::process::exit(1);
        }
    }
    checks += 2000;

    println!("rust-fin-ok:{checks}");
}
`;

/** Signed or primitive inputs are compile-time type errors; there is no runtime negative path. */
export const rustFinInvalid = [
	{ name: "signed_literal", statement: "let _ = api::mirror(&-1i64);", code: "E0308" }
	, { name: "machine_word", statement: "let _ = api::mirror(&5u64);", code: "E0308" }
];

/**
 * Count source and adapter dispatch from the installed Rust process; the
 * LD_PRELOAD interposer from the C acceptance provides the counters.
 */
export const rustFinDispatchProbe = () => `use native_fin as api;
use api::{BigUint, Error};
use std::ffi::{c_char, c_void, CString};

unsafe extern "C" {
    fn dlsym(handle: *mut c_void, name: *const c_char) -> *mut c_void;
}

fn symbol(name: &str) -> *mut c_void {
    let name = CString::new(name).unwrap();
    let value = unsafe { dlsym(std::ptr::null_mut(), name.as_ptr()) };
    if value.is_null() {
        eprintln!("missing dynamic symbol {}", name.to_str().unwrap());
        std::process::exit(1);
    }
    value
}

fn status<T>(result: &Result<T, Error>) -> String {
    match result {
        Ok(_) => "ok".into(),
        Err(Error::Native { code, .. }) => format!("Native{code}"),
        Err(_) => "Other".into(),
    }
}

type Raw = extern "C" fn(*mut c_void) -> *mut c_void;

fn main() {
    let count: extern "C" fn(u32) -> u64 = unsafe { std::mem::transmute(symbol("native_fin_dispatch_count")) };
    let report = |step: &str, outcome: &str| {
        print!("{step} {outcome}");
        for index in 0..6 { print!(" {}", count(index)); }
        println!();
    };
    let n = |value: u64| BigUint::from(value);
    report("start", "ok");
    report("public-valid-mirror", &status(&api::mirror(&n(3))));
    report("public-invalid-mirror", &status(&api::mirror(&n(10))));
    report("public-invalid-impossible", &status(&api::impossible(&n(0))));
    report("public-invalid-label", &status(&api::label(&n(5), &n(4), "slot")));
    report("public-valid-label", &status(&api::label(&n(5), &n(3), "slot")));
    // Exported adapters consume a boxed scalar and return an owned Option.
    let mirror: Raw = unsafe { std::mem::transmute(symbol("${nativeFinSymbol("NativeFin.mirror")}")) };
    let impossible: Raw = unsafe { std::mem::transmute(symbol("${nativeFinSymbol("NativeFin.impossible")}")) };
    let release: extern "C" fn(*mut c_void) = unsafe { std::mem::transmute(symbol("lean_dec_ref_cold")) };
    let boxed = |value: usize| ((value << 1) | 1) as *mut c_void;
    let rejected = |adapter: Raw, value: usize| if adapter(boxed(value)) as usize & 1 == 1 { "1" } else { "0" };
    report("raw-invalid-mirror", rejected(mirror, 10));
    report("raw-invalid-impossible", rejected(impossible, 0));
    let result = mirror(boxed(3)) as usize;
    let accepted = result & 1 == 0 && {
        let field = unsafe { *((result + 8) as *const usize) };
        let counter = result as *mut i32;
        unsafe {
            if *counter > 1 { *counter -= 1; } else if *counter != 0 { release(result as *mut c_void); }
        }
        field == (6 << 1) | 1
    };
    report("raw-valid-mirror", if accepted { "1" } else { "0" });
    report("raw-invalid-mirror-large", rejected(mirror, 1000));
}
`;

// Columns: source mirror, source impossible, source label, then their exported adapters.
export const rustFinDispatchExpected = [
	["start", "ok", [0, 0, 0, 0, 0, 0]]
	, ["public-valid-mirror", "ok", [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-mirror", "Native1", [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-impossible", "Native1", [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-label", "Native1", [1, 0, 0, 1, 0, 0]]
	, ["public-valid-label", "ok", [1, 0, 1, 1, 0, 1]]
	, ["raw-invalid-mirror", "1", [1, 0, 1, 2, 0, 1]]
	, ["raw-invalid-impossible", "1", [1, 0, 1, 2, 1, 1]]
	, ["raw-valid-mirror", "1", [2, 0, 1, 3, 1, 1]]
	, ["raw-invalid-mirror-large", "1", [2, 0, 1, 4, 1, 1]]
];
