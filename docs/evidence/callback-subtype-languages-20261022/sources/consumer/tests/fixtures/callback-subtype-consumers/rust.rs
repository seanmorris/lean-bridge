// Installed Rust acceptance for directional callback Subtypes.
use callback_subtypes as api;
use api::{BigUint, Error};

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn check(checks: &mut usize, value: bool, label: &str) {
    assert!(value, "{label}");
    *checks += 1;
}
fn invalid(result: Result<BigUint, Error>) -> Error {
    match result { Err(error) => error, Ok(value) => panic!("accepted invalid value {value}") }
}

fn main() -> Result<(), Error> {
    let mut checks = 0usize;
    let mut calls = 0usize;
    check(&mut checks, api::call_host(api::with_recovery(|value| {
        calls += 1; Ok(value + n(1))
    }, n(1)))? == n(2), "valid host result");
    let before = calls;
    let error = invalid(api::call_host(api::with_recovery(|value| {
        calls += 1; Ok(value)
    }, n(0))));
    check(&mut checks, matches!(error, Error::Native { code: 1, .. }), "invalid recovery status");
    check(&mut checks, calls == before, "invalid recovery stops callback");
    let error = invalid(api::call_host(api::with_recovery(|_value| Ok(n(0)), n(1))));
    check(&mut checks, matches!(error, Error::Native { code: 1, .. }), "invalid host result status");
    check(&mut checks, api::call_host(api::with_recovery(|value| Ok(value), n(1)))? == n(1),
        "host recovery reuse");
    check(&mut checks, api::call_host_mixed(api::with_recovery(|marker, value| Ok(marker - n(5) + value), n(1)))? == n(3),
        "mixed host result");

    let closure = api::make_closure(&n(9))?;
    check(&mut checks, closure.call(&n(2))? == n(2), "closure result");
    let error = invalid(closure.call(&n(0)));
    check(&mut checks, matches!(error, Error::Native { code: 1, .. }), "closure argument status");
    check(&mut checks, closure.call(&n(3))? == n(3), "closure recovery");
    closure.close()?;
    closure.close()?;
    check(&mut checks, closure.is_closed(), "closure closes idempotently");

    let mixed = api::make_mixed_closure(&n(0))?;
    check(&mut checks, mixed.call(&n(9), &n(2))? == n(2), "mixed closure result");
    let error = invalid(mixed.call(&n(9), &n(0)));
    check(&mut checks, matches!(error, Error::Native { code: 1, .. }), "mixed closure argument status");
    check(&mut checks, mixed.call(&n(9), &n(3))? == n(3), "mixed closure recovery");
    mixed.close()?;

	let nested = api::call_host_container(api::with_recovery(
		|value: Option<BigUint>| Ok(if value.is_none() { Ok(Some(n(2))) } else { Err("unexpected".into()) }),
        Ok(Some(n(1)))))?;
    check(&mut checks, nested == Ok(Some(n(2))), "nested host result");
    let container = api::make_container_closure(&n(0))?;
    check(&mut checks, container.call(&[None])?.is_none(), "nested closure result");
    match container.call(&[Some(n(0))]) {
        Err(Error::Native { code: 1, .. }) => check(&mut checks, true, "nested closure argument status"),
        other => panic!("unexpected nested rejection: {other:?}"),
    }
    check(&mut checks, container.call(&[])?.is_none(), "nested closure recovery");
    container.close()?;

    println!("callback-subtype-language-ok:{checks}");
    Ok(())
}
