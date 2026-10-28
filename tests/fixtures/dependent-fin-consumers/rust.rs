use dependentfin as api;
use api::{BigUint, Error};

fn rejected<T>(result: Result<T, Error>, parameter: &str, bound: &str) -> bool {
    match result {
        Err(Error::Native { code: 1, message }) => message == format!("{parameter} is not below its dependent Fin bound {bound}"),
        _ => false,
    }
}

fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let n = |value: u64| BigUint::from(value);
    let huge = BigUint::from(1u8) << 70usize;
    let word = BigUint::from(1u8) << 32usize;
    // Fin 0: the live bound zero has no values.
    check!(rejected(api::mirror(&n(0), &n(0)), "arg1", "arg0"));
    check!(rejected(api::mirror(&n(0), &n(1)), "arg1", "arg0"));
    // Fin 1: only zero.
    check!(api::mirror(&n(1), &n(0)).unwrap() == n(0));
    check!(rejected(api::mirror(&n(1), &n(1)), "arg1", "arg0"));
    // The exact endpoints of a small live bound.
    check!(api::mirror(&n(10), &n(0)).unwrap() == n(9) && api::mirror(&n(10), &n(9)).unwrap() == n(0));
    for value in [n(10), n(11), word.clone(), huge.clone()] {
        check!(rejected(api::mirror(&n(10), &value), "arg1", "arg0"));
    }
    // Live bounds wider than a machine word are compared limb by limb.
    let below_word = &word - 1u8;
    check!(api::mirror(&word, &below_word).unwrap() == n(0) && api::mirror(&(&word + 1u8), &word).unwrap() == n(0));
    check!(rejected(api::mirror(&word, &word), "arg1", "arg0"));
    let last = &huge - 1u8;
    check!(api::mirror(&huge, &last).unwrap() == n(0) && api::mirror(&huge, &n(0)).unwrap() == last);
    check!(api::mirror(&(&huge + 1u8), &huge).unwrap() == n(0));
    for value in [huge.clone(), &huge + 1u8, BigUint::from(1u8) << 128usize] {
        check!(rejected(api::mirror(&huge, &value), "arg1", "arg0"));
    }
    // The bound is the argument of this call, never a frozen constant.
    for bound in 0..12u64 {
        if bound > 5 {
            check!(api::mirror(&n(bound), &n(5)).unwrap() == n(bound - 6));
        } else {
            check!(rejected(api::mirror(&n(bound), &n(5)), "arg1", "arg0"));
        }
    }
    // Only the named earlier parameter bounds the value, not an unrelated earlier Nat.
    let slot = String::from("slot");
    check!(api::label(&n(100), &n(3), &n(2), &slot).unwrap() == "slot:102");
    check!(rejected(api::label(&n(100), &n(3), &n(3), &slot), "arg2", "arg1"));
    check!(rejected(api::label(&n(100), &n(0), &n(0), &slot), "arg2", "arg1"));
    check!(api::label(&n(0), &huge, &last, &String::from("x")).unwrap() == format!("x:{last}"));
    // Rejection leaves borrowed caller data unchanged.
    let (start, bound, value, name) = (n(7), n(4), n(4), String::from("slot"));
    check!(rejected(api::label(&start, &bound, &value, &name), "arg2", "arg1"));
    check!(start == n(7) && bound == n(4) && value == n(4) && name == "slot");
    check!(api::label(&start, &bound, &n(3), &name).unwrap() == "slot:10");
    // Repeated invalid and valid calls recover; the bound changes every call.
    for i in 0..1000u64 {
        assert!(rejected(api::mirror(&n(10), &n(10 + i % 5)), "arg1", "arg0"), "invalid call accepted at {i}");
        assert!(api::mirror(&n(i % 7 + 1), &n(i % 7)).unwrap() == n(0) && api::mirror(&n(10), &n(i % 10)).unwrap() == n(9 - i % 10), "valid call failed at {i}");
    }
    checks += 2000;
    println!("dependent-fin-ok:{checks}");
}
