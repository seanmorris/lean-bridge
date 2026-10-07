use subtypes as api;
use api::{BigInt, BigUint, Error};

fn rejected<T>(result: Result<T, Error>, message: &str) -> bool {
    matches!(result, Err(Error::Native { code: 1, message: m }) if m == message)
}

fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let n = |value: u64| BigUint::from(value);
    let i = |value: i64| BigInt::from(value);
    let hello = "h\u{e9}llo \u{1F642}";
    // Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected.
    check!(api::shout(hello).unwrap() == format!("{hello}!") && api::shout("a\0b").unwrap() == "a\0b!");
    check!(rejected(api::shout(""), "arg0 was rejected by Subtypes.checkedWord"));
    // Even Nat beyond 64 bits.
    check!(api::half(&n(42)).unwrap() == n(21) && api::half(&(BigUint::from(1u8) << 100usize)).unwrap() == BigUint::from(1u8) << 99usize);
    check!(rejected(api::half(&n(7)), "arg0 was rejected by Subtypes.checkedEven"));
    // Small Int after an unchecked argument.
    check!(api::scale(&i(-3), &i(-128)).unwrap() == i(384) && api::scale(&i(-3), &i(127)).unwrap() == i(-381));
    check!(rejected(api::scale(&i(-3), &i(128)), "arg1 was rejected by Subtypes.checkedSmall"));
    check!(rejected(api::scale(&i(-3), &i(-129)), "arg1 was rejected by Subtypes.checkedSmall"));
    // Nonempty ByteArray.
    check!(api::head(&[0, 255]).unwrap() == 0);
    check!(rejected(api::head(&[]), "arg0 was rejected by Subtypes.checkedPayload"));
    // A result-only subtype and two checked arguments.
    check!(api::pad(&n(21)).unwrap() == n(42));
    check!(api::join("ab", "cd").unwrap() == "abcd");
    check!(rejected(api::join("ab", ""), "arg1 was rejected by Subtypes.checkedWord"));
    check!(rejected(api::join("", "cd"), "arg0 was rejected by Subtypes.checkedWord"));
    // A normalizing constructor: the export sees the constructed value.
    check!(api::clamp(&n(250)).unwrap() == n(100) && api::clamp(&n(7)).unwrap() == n(7));
    // A checked constructor beside a Fin bound: the Fin precheck runs first.
    check!(api::mix(&n(4), &n(3)).unwrap() == n(7));
    check!(rejected(api::mix(&n(4), &n(10)), "arg1 is not below its Fin 10 bound"));
    check!(rejected(api::mix(&n(5), &n(10)), "arg1 is not below its Fin 10 bound"));
    check!(rejected(api::mix(&n(5), &n(3)), "arg0 was rejected by Subtypes.checkedEven"));
    for k in 0..1000u64 {
        assert!(rejected(api::half(&n(2 * k + 1)), "arg0 was rejected by Subtypes.checkedEven"), "invalid call accepted at {k}");
        assert!(api::half(&n(2 * k)).unwrap() == n(k), "valid call failed at {k}");
    }
    checks += 2000;
    println!("subtype-ok:{checks}");
}
