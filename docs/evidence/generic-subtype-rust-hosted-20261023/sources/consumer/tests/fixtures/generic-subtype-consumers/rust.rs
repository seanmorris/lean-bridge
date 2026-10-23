// Independent installed Rust checks for closed generic Subtype compositions.
use nominalsubtypes as api;
use api::{BigUint, Error};

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn generic(value: u64, marker: u64) -> api::GenericNat {
    api::GenericNat { value: n(value), marker: n(marker) }
}
fn snapshot(value: &api::GenericNat) -> (Vec<u32>, Vec<u32>) {
    (value.value.to_u32_digits(), value.marker.to_u32_digits())
}

#[derive(Default)]
struct Counts { checks: usize, rejections: usize }
impl Counts {
    fn check(&mut self, condition: bool, message: &str) {
        assert!(condition, "failed: {message}");
        self.checks += 1;
    }
    fn call(&mut self, name: &str, input: &api::GenericNat,
        call: impl FnOnce(&api::GenericNat) -> Result<api::GenericNat, Error>, expected: api::GenericNat) {
        let before = snapshot(input);
        let output = call(input).expect("valid generic public call");
        self.check(snapshot(&output) == snapshot(&expected), &format!("{name} exact copied result"));
        self.check(snapshot(input) == before, &format!("{name} input unchanged"));
    }
    fn scalar(&mut self, input: &api::GenericNat, expected: BigUint) {
        let before = snapshot(input);
        let output = api::generic_use(input).expect("valid generic_use");
        self.check(output == expected, "generic_use exact result");
        self.check(snapshot(input) == before, "generic_use input unchanged");
    }
    fn refused<T>(&mut self, name: &str, input: &api::GenericNat,
        call: impl FnOnce(&api::GenericNat) -> Result<T, Error>, constructor: &str) {
        let before = snapshot(input);
        let expected = format!("arg0.value was rejected by NominalSubtypes.{constructor}");
        match call(input) {
            Err(Error::Native { code, message }) =>
                self.check(code == 1 && message == expected, &format!("{name} exact refusal")),
            Err(error) => panic!("wrong rejection: {error:?}"),
            Ok(_) => panic!("accepted: {expected}"),
        }
        self.check(snapshot(input) == before, &format!("{name} rejected input unchanged"));
        self.rejections += 1;
    }
}

fn main() {
    let mut c = Counts::default();
    c.scalar(&generic(40, 2), n(43));
    c.call("echo_generic_first", &generic(40, 2), api::echo_generic_first, generic(41, 2));
    c.call("echo_generic_second", &generic(40, 2), api::echo_generic_second, generic(42, 2));
    c.scalar(&generic(99, 7), n(107));
    c.call("echo_generic_first", &generic(99, 7), api::echo_generic_first, generic(100, 7));
    c.refused("generic_use", &generic(100, 2), api::generic_use, "plusOne");
    c.refused("echo_generic_first", &generic(100, 2), api::echo_generic_first, "plusOne");
    c.refused("echo_generic_second", &generic(90, 2), api::echo_generic_second, "plusTwo");
    c.call("echo_generic_second", &generic(40, 2), api::echo_generic_second, generic(42, 2));
    println!("{{\"checks\":{},\"rejections\":{}}}", c.checks, c.rejections);
}
