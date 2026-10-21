// Independent Rust caller for proof-erased zero-payload checked records. It
// uses only the generated public crate surface.
use zeropayloadcheckedrecords as api;
use api::{BigUint, Mark, Marker, Token, Witness};
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
        assert!(condition, "zero-payload assertion failed: {label}");
        self.checks += 1;
    }

    #[cfg(not(feature = "result-only"))]
    fn call<I, O>(
        &mut self,
        input: &I,
        invoke: impl FnOnce(&I) -> Result<O, Error>,
        expected: O,
    ) where
        I: Clone + PartialEq,
        O: PartialEq + std::fmt::Debug,
    {
        let before = input.clone();
        self.calls += 1;
        let result = invoke(input)
            .unwrap_or_else(|error| panic!("valid public call refused: {error:?}"));
        self.check(result == expected, "exact public result");
        self.check(input == &before, "caller input remains unchanged");
        self.snapshots += 1;
    }

    #[cfg(not(feature = "result-only"))]
    fn refuse<I, O>(
        &mut self,
        input: &I,
        invoke: impl FnOnce(&I) -> Result<O, Error>,
        expected: &str,
    ) where
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
            Ok(_) => panic!("accepted the deliberately refusing constructor"),
        }
        self.check(input == &before, "rejected caller input remains unchanged");
        self.rejections += 1;
        self.snapshots += 1;
    }
}

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn witness() -> Witness { Witness {} }
fn token() -> Token { Token { tag: () } }
fn marker() -> Marker { Marker {} }
fn blank() -> Mark { Mark::Blank }
fn marked() -> Mark { Mark::Marked { witness: witness() } }

#[cfg(not(feature = "result-only"))]
fn rejection() -> String {
    let parameter = if cfg!(feature = "reviewed") { "value" } else { "arg" };
    format!("{parameter}0 was rejected by ZeroPayloadCheckedRecords.mkAbsent")
}

fn main() {
    let mut counts = Counts::default();
    counts.check(std::mem::size_of::<Witness>() == 0, "Witness has no runtime payload");
    counts.check(std::mem::size_of::<Token>() == 0, "Unit-bearing Token has no data bytes");
    counts.check(std::mem::size_of::<Marker>() == 0, "plain Marker has no runtime payload");
    counts.check(std::mem::size_of::<Mark>() > 0, "Mark preserves its branch discriminant");
    #[cfg(not(feature = "result-only"))]
    full(&mut counts);
    results(&mut counts);
    let expected = if cfg!(feature = "result-only") {
        (9, 13, 0, 0, 0)
    } else {
        (16, 27, 1, 1, 7)
    };
    counts.check(
        (counts.calls, counts.checks, counts.recoveries, counts.rejections, counts.snapshots)
            == expected,
        "exact caller totals",
    );
    println!(
        "{{\"calls\":{},\"checks\":{},\"recoveries\":{},\"rejections\":{},\"snapshots\":{}}}",
        counts.calls, counts.checks, counts.recoveries, counts.rejections, counts.snapshots,
    );
}

#[cfg(not(feature = "result-only"))]
fn full(counts: &mut Counts) {
    counts.call(&witness(), api::witness_count, n(1));
    counts.refuse(&witness(), api::absent_count, &rejection());
    counts.call(&token(), api::token_tag, ());
    counts.call(&marker(), api::marker_count, n(0));
    counts.call(&blank(), api::mark_count, n(0));
    counts.call(&marked(), api::mark_count, n(1));
    counts.call(&witness(), api::witness_count, n(1));
    counts.recoveries += 1;
}

fn results(counts: &mut Counts) {
    counts.calls += 1;
    counts.check(api::produce_witness().unwrap() == witness(), "produce_witness exact result");
    counts.calls += 1;
    counts.check(api::produce_token().unwrap() == token(), "produce_token exact result");
    counts.calls += 1;
    counts.check(api::witnesses(&n(0)).unwrap().is_empty(), "empty Witness array");
    counts.calls += 1;
    counts.check(api::witnesses(&n(3)).unwrap() == vec![witness(), witness(), witness()], "Witness array identity");
    counts.calls += 1;
    counts.check(api::maybe_witness(false).unwrap().is_none(), "Option Witness none");
    counts.calls += 1;
    counts.check(api::maybe_witness(true).unwrap() == Some(witness()), "Option Witness some");
    counts.calls += 1;
    counts.check(api::produce_marker().unwrap() == marker(), "produce_marker exact result");
    counts.calls += 1;
    counts.check(api::produce_mark(false).unwrap() == blank(), "inactive Mark branch");
    counts.calls += 1;
    counts.check(api::produce_mark(true).unwrap() == marked(), "active Mark branch");
}
