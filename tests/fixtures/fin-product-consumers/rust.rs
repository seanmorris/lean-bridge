use finproducts as api;
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
    let wide = (n(10) << 64usize) + n(10);
    // Fin 10 × Nat: only the first component is bounded.
    for d in 0..10u64 { check!(api::first(&(n(d), n(1000))).unwrap() == (n(9 - d), n(1001))); }
    check!(rejected(api::first(&(n(10), n(0))), "arg0", "10"));
    check!(rejected(api::first(&(n(1) << 70usize, n(0))), "arg0", "10"));
    check!(api::first(&(n(3), n(1) << 200usize)).unwrap() == (n(6), (n(1) << 200usize) + n(1)));
    // Nat × Fin 1, and a bound wider than 64 bits beside Fin 10.
    check!(api::second(&(n(41), n(0))).unwrap() == n(41));
    check!(rejected(api::second(&(n(41), n(1))), "arg0", "1"));
    check!(api::wide(&(&wide - n(1), n(9))).unwrap() == &wide + n(8));
    check!(rejected(api::wide(&(wide.clone(), n(9))), "arg0", "184467440737095516170"));
    check!(rejected(api::wide(&(&wide - n(1), n(10))), "arg0", "10"));
    // Option (Fin 0 × Nat): only none is valid.
    check!(api::never(&None).unwrap() == n(7));
    check!(rejected(api::never(&Some((n(0), n(0)))), "arg0", "0"));
    // Except String (Fin 10): the ok branch is bounded; an inactive branch is never read.
    check!(api::ok_only(&Ok(n(9))).unwrap() == n(9));
    check!(rejected(api::ok_only(&Ok(n(10))), "arg0", "10"));
    check!(api::ok_only(&Err("four".to_string())).unwrap() == n(104));
    // Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid.
    check!(api::error_only(&Ok(n(1) << 100usize)).unwrap() == n(1) << 100usize);
    check!(api::error_only(&Err(n(4))).unwrap() == n(104));
    check!(rejected(api::error_only(&Err(n(5))), "arg0", "5"));
    // Except (Fin 3) (Fin 7): only the active branch is checked.
    check!(api::both(&Ok(n(6))).unwrap() == n(6));
    check!(rejected(api::both(&Ok(n(7))), "arg0", "7"));
    check!(api::both(&Err(n(2))).unwrap() == n(102));
    check!(rejected(api::both(&Err(n(3))), "arg0", "3"));
    // List (Option (Fin 3 × Except (Fin 2) Nat)): every present element, both levels.
    let rows = vec![None, Some((n(2), Ok(n(50)))), Some((n(1), Err(n(1))))];
    check!(api::nested(&rows).unwrap() == n(54));
    check!(rejected(api::nested(&[None, Some((n(2), Ok(n(50)))), Some((n(1), Err(n(2))))]), "arg0", "2"));
    check!(rejected(api::nested(&[None, Some((n(3), Ok(n(50)))), Some((n(1), Err(n(1))))]), "arg0", "3"));
    check!(api::nested(&rows).unwrap() == n(54));
    // DigitPair := Digit × Digit through the alias.
    check!(api::aliased(&(n(1), n(9))).unwrap() == (n(9), n(1)));
    check!(rejected(api::aliased(&(n(1), n(10))), "arg0", "10"));
    // Results carrying bounds are produced by Lean and arrive below them.
    check!(api::produce(&n(4)).unwrap() == Err(n(4)));
    check!(api::produce(&n(23)).unwrap().is_ok());
    check!(api::pair_up(&n(23)).unwrap() == (n(3), n(23)));
    for i in 0..1000u64 {
        assert!(api::first(&(n(i % 10), n(i))).unwrap().0 == n(9 - i % 10), "round {i} failed");
        assert!(rejected(api::first(&(n(10 + i), n(i))), "arg0", "10"), "rejection round {i} failed");
    }
    checks += 2000;
    println!("fin-product-ok:{checks}");
}
