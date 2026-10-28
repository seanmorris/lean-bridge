// Installed Rust acceptance for checked Fin callbacks and Lean closures.
use reviewedcallbacks as api;
use api::{BigUint, Error, Tile};

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn check(checks: &mut usize, value: bool, label: &str) {
    assert!(value, "{label}");
    *checks += 1;
}
fn refused<T>(result: Result<T, Error>) -> Error {
    match result {
        Err(error) => error,
        Ok(_) => panic!("accepted an invalid checked Fin value"),
    }
}
fn native(error: &Error) -> bool {
    matches!(error, Error::Native { code: 1 | 5, .. })
}

fn main() -> Result<(), Error> {
    let mut checks = 0usize;

    let scaler = api::scaler(&n(3))?;
    check(&mut checks, scaler.call(&n(4))? == n(12), "bounded closure argument");
    check(&mut checks, native(&refused(scaler.call(&n(10)))), "Fin 10 is refused");
    check(&mut checks, scaler.call(&n(9))? == n(27), "closure remains usable");

    let counter = api::counter(&n(8))?;
    check(&mut checks, counter.call(&n(4))? == n(2), "Lean-produced Fin result");

    let mut calls = 0usize;
    let visited = api::visit(api::with_recovery(|value: BigUint| {
        calls += 1;
        assert!(value < n(5), "Lean supplied an invalid Fin");
        Ok(value)
    }, n(0)))?;
    check(&mut checks, visited == n(10), "checked host callback arguments");
    check(&mut checks, calls == 5, "host receives every Fin 5 value");
    check(&mut checks, api::apply(|value: BigUint| Ok(value + n(1)), &n(2))? == n(3),
        "unrefined callback stays direct");

    let digits = api::digits(())?;
    check(&mut checks, digits.call(&[n(1), n(2)])? == n(5),
        "nested Fin callback argument");
    check(&mut checks, native(&refused(digits.call(&[n(3)]))),
        "nested bound is refused");
    check(&mut checks, digits.call(&[])? == n(0), "nested closure remains usable");

    let tiles = api::tiles(())?;
    check(&mut checks, tiles.call(&[Tile { digit: n(4), count: n(2) }])? == n(402),
        "nominal Fin callback field");
    check(&mut checks, native(&refused(tiles.call(
        &[Tile { digit: n(5), count: n(2) }]))), "nominal Fin field is refused");

    let tile_maker = api::tile_maker(&n(3))?;
    check(&mut checks, tile_maker.call(&n(4))? == Tile { digit: n(2), count: n(4) },
        "Lean-produced nominal Fin field");

    for closure in [&scaler, &counter] {
        closure.close()?;
        closure.close()?;
        check(&mut checks, closure.is_closed(), "scalar closure closes idempotently");
    }
    digits.close()?;
    tiles.close()?;
    tile_maker.close()?;

    println!("callback-fin-language-ok:{checks}");
    Ok(())
}
