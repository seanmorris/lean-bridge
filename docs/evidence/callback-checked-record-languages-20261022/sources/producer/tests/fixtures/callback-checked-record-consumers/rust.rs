// Installed Rust acceptance for directional callback checked records.
use callback_checked_records as api;
use api::{BigUint, Error, Interval, Weighted};

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn interval(lo: u64, hi: u64) -> Interval { Interval { lo: n(lo), hi: n(hi) } }
fn weighted(weight: u64, limit: u64) -> Weighted {
    Weighted { weight: n(weight), limit: n(limit) }
}
fn check(checks: &mut usize, value: bool, label: &str) {
    assert!(value, "{label}");
    *checks += 1;
}
fn refused<T>(result: Result<T, Error>) -> Error {
    match result {
        Err(error) => error,
        Ok(_) => panic!("accepted invalid callback checked record"),
    }
}
fn native(error: &Error) -> bool {
    matches!(error, Error::Native { code: 1 | 5, .. })
}

fn main() -> Result<(), Error> {
    let mut checks = 0usize;
    let mut calls = 0usize;
    check(&mut checks, api::call_host(api::with_recovery(|value: Interval| {
        calls += 1;
        assert_eq!(value, interval(1, 3));
        Ok(interval(1, 4))
    }, interval(1, 3)))? == n(3), "valid host reply");
    let before = calls;
    let error = refused(api::call_host(api::with_recovery(|value: Interval| {
        calls += 1;
        Ok(value)
    }, interval(3, 1))));
    check(&mut checks, native(&error), "invalid recovery status");
    check(&mut checks, calls == before, "invalid recovery stops callback");
    let error = refused(api::call_host(api::with_recovery(
        |_value: Interval| Ok(interval(5, 2)), interval(1, 3))));
    check(&mut checks, native(&error), "invalid host reply status");
    check(&mut checks, api::call_host(api::with_recovery(
        |value: Interval| Ok(value), interval(1, 3)))? == n(2), "host recovery reuse");
    check(&mut checks, api::call_host_mixed(api::with_recovery(
        |marker: BigUint, value: Interval| Ok(Interval {
            lo: value.lo, hi: value.hi + marker - n(5)
        }),
        interval(1, 3)))? == n(4), "mixed host reply");

    let closure = api::make_closure(&n(9))?;
    check(&mut checks, closure.call(&interval(2, 5))? == n(3), "closure result");
    check(&mut checks, native(&refused(closure.call(&interval(5, 2)))),
        "closure argument status");
    check(&mut checks, closure.call(&interval(3, 3))? == n(0), "closure recovery");
    closure.close()?;
    closure.close()?;
    check(&mut checks, closure.is_closed(), "closure closes idempotently");

    let mixed = api::make_mixed_closure(&n(0))?;
    check(&mut checks, mixed.call(&n(9), &interval(2, 5))? == interval(2, 5),
        "mixed closure result");
    check(&mut checks, native(&refused(mixed.call(&n(9), &interval(5, 2)))),
        "mixed closure argument status");
    check(&mut checks, mixed.call(&n(9), &interval(3, 4))? == interval(3, 4),
        "mixed closure recovery");
    mixed.close()?;

    check(&mut checks, api::call_host_container(api::with_recovery(
        |value: Option<Interval>| Ok(if value.is_none() { Ok(Some(interval(1, 4))) }
            else { Err("unexpected".into()) }), Ok(None)))? == n(3),
        "container host reply");
    let error = refused(api::call_host_container(api::with_recovery(
        |_value: Option<Interval>| Ok(Ok(Some(interval(4, 1)))), Ok(None))));
    check(&mut checks, native(&error), "container host reply status");
    let container = api::make_container_closure(&n(0))?;
    check(&mut checks, container.call(&[None, Some(interval(2, 5))])?.is_none(),
        "container closure result");
    check(&mut checks, native(&refused(container.call(&[Some(interval(5, 2))]))),
        "container closure argument status");
    check(&mut checks, container.call(&[])?.is_none(), "container closure recovery");
    container.close()?;

    let mut reply_weight = 2u64;
    let mut reply_limit = 5u64;
    check(&mut checks, api::call_host_nested(api::with_recovery(|value: Weighted| {
        calls += 1;
        assert_eq!(value, weighted(1, 2));
        Ok(weighted(reply_weight, reply_limit))
    }, weighted(1, 2)))? == n(3), "weighted host reply");
    reply_weight = 0;
    let error = refused(api::call_host_nested(api::with_recovery(
        |_value: Weighted| Ok(weighted(reply_weight, reply_limit)), weighted(1, 2))));
    check(&mut checks, native(&error), "zero weight status");
    reply_weight = 6;
    let error = refused(api::call_host_nested(api::with_recovery(
        |_value: Weighted| Ok(weighted(reply_weight, reply_limit)), weighted(1, 2))));
    check(&mut checks, native(&error), "weight above limit status");
    let before = calls;
    let error = refused(api::call_host_nested(api::with_recovery(|value: Weighted| {
        calls += 1;
        Ok(value)
    }, weighted(0, 2))));
    check(&mut checks, native(&error), "invalid weighted recovery status");
    check(&mut checks, calls == before, "invalid weighted recovery stops callback");
    reply_weight = 2;
    reply_limit = 5;
    check(&mut checks, api::call_host_nested(api::with_recovery(
        |_value: Weighted| Ok(weighted(reply_weight, reply_limit)), weighted(1, 2)))? == n(3),
        "weighted host recovery");

    let nested = api::make_nested_closure(&n(0))?;
    check(&mut checks, nested.call(&weighted(2, 5))? == n(3),
        "weighted closure result");
    check(&mut checks, native(&refused(nested.call(&weighted(0, 5)))),
        "weighted closure zero status");
    check(&mut checks, native(&refused(nested.call(&weighted(6, 5)))),
        "weighted closure bound status");
    check(&mut checks, nested.call(&weighted(5, 5))? == n(0),
        "weighted closure recovery");
    nested.close()?;

    println!("callback-checked-record-language-ok:{checks}");
    Ok(())
}
