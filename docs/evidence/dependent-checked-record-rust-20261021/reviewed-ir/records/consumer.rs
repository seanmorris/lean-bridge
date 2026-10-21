// Independent Rust caller for a proof-erased dependent checked record.
use dependentrecords as api;
use api::{BigUint, Dependent};
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
        assert!(condition, "dependent-record assertion failed: {label}");
        self.checks += 1;
    }

    #[cfg(not(feature = "result-only"))]
    fn call<I, O>(
        &mut self,
        input: &I,
        invoke: impl FnOnce(&I) -> Result<O, Error>,
        expected: O,
        label: &str,
    ) where
        I: Clone + PartialEq,
        O: PartialEq + std::fmt::Debug,
    {
        let before = input.clone();
        self.calls += 1;
        let result = invoke(input)
            .unwrap_or_else(|error| panic!("valid public call refused: {error:?}"));
        self.check(result == expected, &format!("{label} exact result"));
        self.check(input == &before, &format!("{label} preserves caller input"));
        self.snapshots += 1;
    }

    #[cfg(not(feature = "result-only"))]
    fn refuse(&mut self, input: &Dependent, label: &str) {
        let before = input.clone();
        self.calls += 1;
        match api::dependent_total(input) {
            Err(Error::Native { code, message }) => self.check(
                code == 1 && message == rejection(),
                &format!("{label} exact checked-record refusal: {code} {message}"),
            ),
            Err(error) => panic!("wrong checked-record refusal: {error:?}"),
            Ok(_) => panic!("accepted invalid dependent record: {label}"),
        }
        self.check(input == &before, &format!("{label} preserves rejected input"));
        self.rejections += 1;
        self.snapshots += 1;
    }
}

fn n(value: u64) -> BigUint {
    BigUint::from(value)
}

fn dependent(bound: BigUint, below: BigUint) -> Dependent {
    Dependent { bound, below }
}

#[cfg(not(feature = "result-only"))]
fn rejection() -> String {
    let parameter = if cfg!(feature = "reviewed") { "value" } else { "arg" };
    format!("{parameter}0 was rejected by DependentRecords.mkDependent")
}

fn main() {
    let mut counts = Counts::default();
    counts.check(true, "dependent_total export selection");
    counts.check(true, "dependent_roundtrip export selection");
    counts.check(true, "dependent_result export selection");
    results(&mut counts);
    #[cfg(not(feature = "result-only"))]
    full(&mut counts);
    let expected = if cfg!(feature = "result-only") {
        (513, 516, 0, 0, 513)
    } else {
        (1289, 2068, 258, 258, 1289)
    };
    assert_eq!(
        (
            counts.calls,
            counts.checks,
            counts.recoveries,
            counts.rejections,
            counts.snapshots,
        ),
        expected,
        "dependent-record exact caller totals",
    );
    println!(
        "{{\"calls\":{},\"checks\":{},\"recoveries\":{},\"rejections\":{},\"snapshots\":{}}}",
        counts.calls,
        counts.checks,
        counts.recoveries,
        counts.rejections,
        counts.snapshots,
    );
}

fn results(counts: &mut Counts) {
    for index in 0u64..512 {
        let seed = n(index);
        counts.calls += 1;
        let value = api::dependent_result(&seed)
            .unwrap_or_else(|error| panic!("dependent_result refused: {error:?}"));
        counts.check(
            value == dependent(n(index + 1), seed),
            &format!("result {index} exact result"),
        );
        counts.snapshots += 1;
    }
    let huge = n(1) << 130usize;
    counts.calls += 1;
    let value = api::dependent_result(&huge)
        .unwrap_or_else(|error| panic!("huge dependent_result refused: {error:?}"));
    counts.check(
        value == dependent(huge.clone() + n(1), huge),
        "huge result exact result",
    );
    counts.snapshots += 1;
}

#[cfg(not(feature = "result-only"))]
fn full(counts: &mut Counts) {
    let recover = |counts: &mut Counts| {
        counts.call(
            &dependent(n(2), n(1)),
            api::dependent_total,
            n(3),
            "recovery",
        );
        counts.recoveries += 1;
    };

    counts.call(
        &dependent(n(3), n(2)),
        api::dependent_total,
        n(5),
        "valid total",
    );
    counts.refuse(&dependent(n(2), n(2)), "equal fields");
    recover(counts);
    counts.refuse(&dependent(n(0), n(0)), "zero bound");
    recover(counts);
    let valid = dependent(n(3), n(2));
    counts.call(
        &valid,
        api::dependent_roundtrip,
        valid.clone(),
        "roundtrip",
    );
    let huge = n(1) << 130usize;
    let below = huge.clone() - n(1);
    counts.call(
        &dependent(huge.clone(), below.clone()),
        api::dependent_total,
        huge.clone() + below.clone(),
        "huge total",
    );
    let huge_record = dependent(huge, below);
    counts.call(
        &huge_record,
        api::dependent_roundtrip,
        huge_record.clone(),
        "huge roundtrip",
    );
    for index in 0u64..256 {
        let bound = index + 1;
        counts.call(
            &dependent(n(bound), n(index)),
            api::dependent_total,
            n(2 * index + 1),
            &format!("loop total {index}"),
        );
        counts.refuse(
            &dependent(n(bound), n(bound)),
            &format!("loop refusal {index}"),
        );
        recover(counts);
    }
}
