// Independent Rust caller for proof-erased checked records with closed value
// indices. It uses only the generated public crate surface.
use checkedrecordvalueindices as api;
use api::{Ab, BigUint, EmptySized, EmptyToken, Off, On, UnicodeToken, WideToken, ZeroToken};
#[cfg(not(feature = "result-only"))]
use api::Error;

#[derive(Default)]
struct Counts {
    calls: usize,
    checks: usize,
    recoveries: usize,
    rejections: usize,
    snapshots: usize,
}

impl Counts {
    fn check(&mut self, condition: bool, label: &str) {
        assert!(condition, "value-index assertion failed: {label}");
        self.checks += 1;
    }

    #[cfg(not(feature = "result-only"))]
    fn call<I, O>(&mut self, input: &I, invoke: impl FnOnce(&I) -> Result<O, Error>, expected: O)
    where
        I: Clone + PartialEq,
        O: PartialEq + std::fmt::Debug,
    {
        let before = input.clone();
        self.calls += 1;
        let result = invoke(input).unwrap_or_else(|error| panic!("valid public call refused: {error:?}"));
        self.check(result == expected, "exact public result");
        self.check(input == &before, "caller input remains unchanged");
        self.snapshots += 1;
    }

    #[cfg(not(feature = "result-only"))]
    fn refuse<I, O>(&mut self, input: &I, invoke: impl FnOnce(&I) -> Result<O, Error>, expected: &str)
    where
        I: Clone + PartialEq,
    {
        let before = input.clone();
        self.calls += 1;
        match invoke(input) {
            Err(Error::Native { code, message }) => self.check(
                code == 1 && message == expected,
                &format!("exact checked-record refusal: expected {expected}, got {code} {message}"),
            ),
            Err(error) => panic!("wrong checked-record refusal: {error:?}"),
            Ok(_) => panic!("accepted invalid value-index input: {expected}"),
        }
        self.check(input == &before, "rejected caller input remains unchanged");
        self.rejections += 1;
        self.snapshots += 1;
    }
}

fn n(value: u64) -> BigUint { BigUint::from(value) }
#[cfg(not(feature = "result-only"))]
fn wide() -> BigUint { (n(1) << 128usize) + n(1) }
fn produced_wide() -> BigUint { (n(1) << 100usize) + n(17) }
fn on(count: u64) -> On { On { count: n(count) } }
fn off(count: u64) -> Off { Off { count: n(count) } }
fn ab(size: u64) -> Ab { Ab { size: n(size) } }
fn empty_token(count: u64) -> EmptyToken { EmptyToken { count: n(count) } }
fn unicode_token(count: u64) -> UnicodeToken { UnicodeToken { count: n(count) } }
fn empty_sized(data: Vec<u64>) -> EmptySized {
    EmptySized { data: data.into_iter().map(n).collect() }
}
fn zero_token(count: u64) -> ZeroToken { ZeroToken { count: n(count) } }
fn wide_token(count: BigUint) -> WideToken { WideToken { count } }

#[cfg(not(feature = "result-only"))]
fn rejection(constructor: &str) -> String {
    let parameter = if cfg!(feature = "reviewed") { "value" } else { "arg" };
    format!("{parameter}0 was rejected by CheckedRecordValueIndices.{constructor}")
}

fn main() {
    let mut counts = Counts::default();
    #[cfg(not(feature = "result-only"))]
    full(&mut counts);
    results(&mut counts);
    let expected = if cfg!(feature = "result-only") { (8, 8, 0, 0, 0) } else { (24, 40, 4, 4, 16) };
    counts.check(
        (counts.calls, counts.checks, counts.recoveries, counts.rejections, counts.snapshots) == expected,
        "exact caller totals",
    );
    println!(
        "{{\"calls\":{},\"checks\":{},\"recoveries\":{},\"rejections\":{},\"snapshots\":{}}}",
        counts.calls, counts.checks, counts.recoveries, counts.rejections, counts.snapshots,
    );
}

#[cfg(not(feature = "result-only"))]
fn full(counts: &mut Counts) {
    counts.call(&on(0), api::true_bool_index, n(0));
    counts.call(&off(1), api::false_bool_index, n(1));
    counts.call(&ab(2), api::ab_string_index, n(2));
    counts.call(&empty_token(9), api::empty_string_index, n(9));
    counts.call(&unicode_token(10), api::unicode_string_index, n(10));
    counts.call(&empty_sized(vec![]), api::empty_sized_index, n(0));
    counts.call(&zero_token(11), api::zero_nat_index, n(11));
    let huge = wide();
    counts.call(&wide_token(huge.clone()), api::wide_nat_index, huge);

    counts.refuse(&ab(1), api::ab_string_index, &rejection("mkAb"));
    counts.call(&zero_token(99), api::zero_nat_index, n(99));
    counts.recoveries += 1;
    counts.refuse(&empty_sized(vec![1]), api::empty_sized_index, &rejection("mkEmptySized"));
    counts.call(&zero_token(99), api::zero_nat_index, n(99));
    counts.recoveries += 1;
    counts.refuse(&on(1), api::true_bool_index, &rejection("mkOn"));
    counts.call(&zero_token(99), api::zero_nat_index, n(99));
    counts.recoveries += 1;
    counts.refuse(&off(0), api::false_bool_index, &rejection("mkOff"));
    counts.call(&zero_token(99), api::zero_nat_index, n(99));
    counts.recoveries += 1;
}

fn results(counts: &mut Counts) {
    counts.calls += 1;
    counts.check(api::produce_true_bool().unwrap() == on(0), "produce_true_bool exact result");
    counts.calls += 1;
    counts.check(api::produce_false_bool().unwrap() == off(1), "produce_false_bool exact result");
    counts.calls += 1;
    counts.check(api::produce_ab().unwrap() == ab(2), "produce_ab exact result");
    counts.calls += 1;
    counts.check(api::produce_empty_string(&n(23)).unwrap() == empty_token(23), "produce_empty_string exact result");
    counts.calls += 1;
    counts.check(api::produce_unicode_string(&n(24)).unwrap() == unicode_token(24), "produce_unicode_string exact result");
    counts.calls += 1;
    counts.check(api::produce_empty_sized().unwrap() == empty_sized(vec![]), "produce_empty_sized exact result");
    counts.calls += 1;
    counts.check(api::produce_zero_nat(&n(25)).unwrap() == zero_token(25), "produce_zero_nat exact result");
    let wide = produced_wide();
    counts.calls += 1;
    counts.check(api::produce_wide_nat(&wide).unwrap() == wide_token(wide), "produce_wide_nat exact result");
}
