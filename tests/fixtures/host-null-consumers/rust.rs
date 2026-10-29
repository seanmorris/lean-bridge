//! Independent installed Rust consumer using only the generated crate API.
use host_null_demo::{self as api, Packet};

fn check(value: bool, checks: &mut u32) {
    *checks += 1;
    assert!(value);
}

fn main() {
    let mut checks = 0;
    check(api::echo(&None).unwrap() == None, &mut checks);
    check(api::echo(&Some(42)).unwrap() == Some(42), &mut checks);
    for value in [None, Some(None), Some(Some(42))] {
        check(api::nullable_option(&value).unwrap() == value, &mut checks);
    }
    for value in [None, Some(None), Some(Some(42))] {
        check(api::optional_nullable(&value).unwrap() == value, &mut checks);
    }
    let packet = Packet {
        direct: None,
        nullable_option: Some(None),
        optional_nullable: Some(None),
    };
    check(api::echo_packet(&packet).unwrap() == packet, &mut checks);

    let mut callback_calls = 0;
    let first = api::call_host(&None, |value| {
        callback_calls += 1;
        assert_eq!(value, None);
        Ok(Some(None))
    }).unwrap();
    check(first == Some(None), &mut checks);
    let second = api::call_host(&Some(42), |value| {
        callback_calls += 1;
        assert_eq!(value, Some(42));
        Ok(Some(Some(43)))
    }).unwrap();
    check(second == Some(Some(43)), &mut checks);
    check(callback_calls == 2, &mut checks);

    let closure = api::make_closure(&Some(Some(77))).unwrap();
    check(!closure.is_closed(), &mut checks);
    check(closure.call(&None).unwrap() == Some(Some(77)), &mut checks);
    check(closure.call(&Some(2)).unwrap() == Some(Some(77)), &mut checks);
    closure.close().unwrap();
    check(closure.is_closed(), &mut checks);
    check(closure.call(&None).is_err(), &mut checks);

    println!("host-null-rust:{checks}");
}
