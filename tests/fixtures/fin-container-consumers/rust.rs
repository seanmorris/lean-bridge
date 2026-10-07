use fincontainers as api;
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
    let huge = BigUint::from(1u8) << 70usize;
    let word = BigUint::from(1u8) << 32usize;
    let digits: Vec<BigUint> = (0..10u64).map(n).collect();
    // Array (Fin 10): every element is checked; results stay below the bound.
    check!(api::mirror_all(&digits).unwrap() == (0..10u64).map(|i| n(9 - i)).collect::<Vec<_>>());
    check!(api::mirror_all(&[]).unwrap().is_empty());
    for position in 0..3 {
        let mut bad = vec![n(1), n(2), n(3)];
        bad[position] = n(10);
        check!(rejected(api::mirror_all(&bad), "arg0", "10"));
        check!(bad[position] == n(10));
    }
    check!(rejected(api::mirror_all(&[word.clone(), n(1), n(2)]), "arg0", "10"));
    // Array (Fin 0): only the empty array has values.
    check!(api::count_none(&[]).unwrap() == n(0));
    check!(rejected(api::count_none(&[n(0)]), "arg0", "0"));
    // List Huge: a 2^70 bound compared limb by limb.
    let last = &huge - 1u8;
    check!(api::sum_huge(&[word.clone(), last.clone()]).unwrap() == &word + &last);
    check!(api::sum_huge(&[]).unwrap() == n(0));
    check!(rejected(api::sum_huge(&[word.clone(), huge.clone()]), "arg0", &huge.to_string()));
    // Option (Fin 1): none is valid; a present value is checked.
    check!(api::or_default(&None).unwrap() == n(7) && api::or_default(&Some(n(0))).unwrap() == n(0));
    check!(rejected(api::or_default(&Some(n(1))), "arg0", "1"));
    // Array (Option Digit): only present elements are checked.
    let mut mixed = vec![Some(n(1)), None, Some(n(9))];
    check!(api::present(&mixed).unwrap() == vec![n(1), n(9)]);
    mixed[2] = Some(n(10));
    check!(rejected(api::present(&mixed), "arg0", "10"));
    mixed[2] = None;
    check!(api::present(&mixed).unwrap().len() == 1);
    // List (Array Digit) -> Option (List Digit): nested rows.
    let mut rows = vec![vec![n(1), n(2)], vec![n(3)]];
    check!(api::flatten(&rows).unwrap() == Some(vec![n(1), n(2), n(3)]));
    check!(api::flatten(&[]).unwrap().is_none());
    rows[1][0] = n(10);
    check!(rejected(api::flatten(&rows), "arg0", "10"));
    // A late refined argument after an unrefined one.
    let names = ["a".to_string(), "b".to_string()];
    check!(api::label(&names, &[n(1), n(3)]).unwrap() == "a:1,b:3");
    check!(rejected(api::label(&names, &[n(1), n(4)]), "arg1", "4"));
    check!(names[1] == "b");
    // A result-only container refinement projects each element after Lean returns.
    check!(api::wrap_all(&[n(100), huge.clone()]).unwrap() == vec![n(2), n(2)]);
    check!(api::wrap_all(&[]).unwrap().is_empty());
    // Repeated invalid and valid calls recover without retiring the runtime.
    for i in 0..1000u64 {
        assert!(rejected(api::mirror_all(&[n(10 + i % 5)]), "arg0", "10"), "invalid call accepted at {i}");
        assert!(api::mirror_all(&[n(i % 10)]).unwrap() == vec![n(9 - i % 10)], "valid call failed at {i}");
    }
    checks += 2000;
    println!("fin-container-ok:{checks}");
}
