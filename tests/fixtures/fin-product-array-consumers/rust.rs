use finproductarrays as api;
use api::{BigUint, Error};

fn rejected<T>(result: Result<T, Error>, parameter: &str, bound: &str) -> bool {
    match result {
        Err(Error::Native { code: 1, message }) => message == format!("{parameter} is not below its Fin {bound} bound"),
        _ => false,
    }
}

fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let n = |value: u64| BigUint::from(value);
    // (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to.
    let valid = vec![(n(0), Ok(n(1) << 100usize)), (n(2), Err(n(5))), (n(3), Ok(n(6)))];
    let expected = (n(1) << 100usize) + n(1016);
    // An empty array is valid, in and out.
    check!(api::rows(&[]).unwrap() == n(0));
    check!(api::reversed(&[]).unwrap().is_empty());
    let mut rows = valid.clone();
    check!(api::rows(&rows).unwrap() == expected);
    // A component at its bound is rejected in the first, middle and last element.
    for k in 0..3 {
        rows[k].0 = n(4);
        let before = rows.clone();
        check!(rejected(api::rows(&rows), &format!("arg0[{k}].0"), "4") && rows == before);
        rows[k].0 = valid[k].0.clone();
    }
    // The active error branch is bounded: error 6 is rejected, while ok 6 in the last row passed above.
    rows[1].1 = Err(n(6));
    let before = rows.clone();
    check!(rejected(api::rows(&rows), "arg0[1].1.error", "6") && rows == before);
    rows[1].1 = Err(n(5));
    // A valid call recovers.
    check!(rows == valid);
    check!(api::rows(&rows).unwrap() == expected);
    // Lean returns the rows reversed, each below its bounds.
    check!(api::reversed(&rows).unwrap() == valid.iter().rev().cloned().collect::<Vec<_>>());
    for i in 0..1000u64 {
        assert!(api::rows(&rows).unwrap() == expected, "round {i} failed");
        rows[2].0 = n(4 + i);
        assert!(rejected(api::rows(&rows), "arg0[2].0", "4"), "rejection round {i} failed");
        rows[2].0 = n(3);
    }
    checks += 2000;
    println!("fin-product-array-ok:{checks}");
}
