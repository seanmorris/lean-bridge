// Independent public nested checked-record caller. Generated equality is not an oracle.
use nestedcheckedrecords as api;
use api::{BigUint, Error, Packet};

#[derive(Debug, PartialEq, Eq)]
enum Value {
    Nat(Vec<u32>),
    Node(&'static str, Vec<Value>),
}

trait Snapshot { fn snapshot(&self) -> Value; }
impl Snapshot for BigUint { fn snapshot(&self) -> Value { Value::Nat(self.to_u32_digits()) } }
impl<T: Snapshot + ?Sized> Snapshot for &T { fn snapshot(&self) -> Value { T::snapshot(*self) } }
impl<T: Snapshot> Snapshot for [T] {
    fn snapshot(&self) -> Value { Value::Node("sequence", self.iter().map(Snapshot::snapshot).collect()) }
}
impl<T: Snapshot> Snapshot for Vec<T> { fn snapshot(&self) -> Value { self.as_slice().snapshot() } }
impl<T: Snapshot> Snapshot for Option<T> {
    fn snapshot(&self) -> Value {
        match self { None => Value::Node("none", vec![]), Some(value) => Value::Node("some", vec![value.snapshot()]) }
    }
}
impl<T: Snapshot, E: Snapshot> Snapshot for Result<T, E> {
    fn snapshot(&self) -> Value {
        match self { Ok(value) => Value::Node("ok", vec![value.snapshot()]), Err(value) => Value::Node("error", vec![value.snapshot()]) }
    }
}
impl<A: Snapshot, B: Snapshot> Snapshot for (A, B) {
    fn snapshot(&self) -> Value { Value::Node("product", vec![self.0.snapshot(), self.1.snapshot()]) }
}
impl Snapshot for Packet {
    fn snapshot(&self) -> Value {
        let Packet { digit, word } = self;
        Value::Node("Packet", vec![digit.snapshot(), word.snapshot()])
    }
}
#[cfg(not(feature = "result-only"))]
impl Snapshot for api::Holder {
    fn snapshot(&self) -> Value {
        let api::Holder { packet, tag } = self;
        Value::Node("Holder", vec![packet.snapshot(), tag.snapshot()])
    }
}
#[cfg(not(feature = "result-only"))]
impl Snapshot for api::Choice {
    fn snapshot(&self) -> Value {
        match self {
            api::Choice::Empty => Value::Node("Choice.empty", vec![]),
            api::Choice::Packet { value } => Value::Node("Choice.packet", vec![value.snapshot()]),
        }
    }
}

#[derive(Default)]
struct Counts { checks: usize, rejections: usize, recoveries: usize, snapshots: usize, snapshot_controls: usize }
impl Counts {
    fn check(&mut self, condition: bool, label: &str) {
        assert!(condition, "failed: {label}"); self.checks += 1;
    }
    fn unchanged(&mut self, same: bool) {
        self.snapshots += 1; self.check(same, "complete caller inputs unchanged");
    }
    fn call<I: Snapshot + ?Sized, O: Snapshot>(&mut self, input: &I,
        invoke: impl FnOnce(&I) -> Result<O, Error>, expected: O) -> O {
        let before = input.snapshot();
        let output = match invoke(input) {
            Ok(output) => output,
            Err(error) => panic!("failed: valid public call refused: {error:?}"),
        };
        self.check(output.snapshot() == expected.snapshot(), "exact independent result");
        self.unchanged(input.snapshot() == before);
        output
    }
    #[cfg(not(feature = "result-only"))]
    fn refuse<I: Snapshot + ?Sized, O>(&mut self, input: &I,
        invoke: impl FnOnce(&I) -> Result<O, Error>, expected: &str) {
        let before = input.snapshot();
        match invoke(input) {
            Err(Error::Native { code, message }) => self.check(code == 1 && message == expected,
                &format!("exact refusal: expected {expected}, got {code} {message}")),
            Err(error) => panic!("failed: wrong refusal: {error:?}"),
            Ok(_) => panic!("failed: accepted invalid input: {expected}"),
        }
        self.unchanged(input.snapshot() == before);
        self.rejections += 1;
    }
    fn distinct<A: Snapshot, B: Snapshot>(&mut self, left: A, right: B) {
        self.check(left.snapshot() != right.snapshot(), "independent snapshot mutation control");
        self.snapshot_controls += 1;
    }
}

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn huge() -> BigUint { n(1) << 100usize }
fn p(digit: u64, word: BigUint) -> Packet { Packet { digit: n(digit), word } }
fn ps(digit: u64, word: u64) -> Packet { p(digit, n(word)) }

#[cfg(not(feature = "result-only"))]
fn prefix() -> &'static str { if cfg!(feature = "reviewed") { "value" } else { "arg" } }
#[cfg(not(feature = "result-only"))]
fn rejected(path: &str, constructor: &str) -> String {
    format!("{}{path} was rejected by NestedCheckedRecords.{constructor}", prefix())
}
#[cfg(not(feature = "result-only"))]
fn fin(path: &str) -> String { format!("{}{path}.digit is not below its Fin 10 bound", prefix()) }

fn main() {
    let mut c = Counts::default();
    c.distinct(ps(0, 1), ps(0, 2)); c.distinct(ps(0, 1), ps(1, 1));
    c.distinct(None::<Packet>, Some(ps(0, 1)));
    c.distinct(Ok::<Packet, Packet>(ps(0, 1)), Err::<Packet, Packet>(ps(0, 1)));
    c.distinct(vec![ps(0, 1), ps(0, 1)], (ps(0, 1), ps(0, 1)));
    c.distinct(Vec::<Packet>::new(), vec![ps(0, 1)]);
    c.distinct(n(0), huge());
    #[cfg(not(feature = "result-only"))]
    {
        c.distinct(api::Choice::Empty, api::Choice::Packet { value: ps(0, 1) });
        c.distinct(api::Holder { packet: ps(0, 1), tag: n(1) }, (ps(0, 1), n(1)));
    }

    // Constructor-free results: 2^100 + round, with words one and two above it.
    c.call(&n(0), api::produce_option, Some(ps(0, 1)));
    c.call(&n(0), api::produce_array, vec![ps(0, 1), ps(0, 2)]);
    for round in 0..256u64 {
        let value = huge() + n(round);
        c.call(&value, api::produce_option, Some(p(0, &value + n(1))));
        let mut returned = c.call(&value, api::produce_array, vec![p(0, &value + n(1)), p(0, &value + n(2))]);
        returned[0].word = n(0);
        c.check(returned[1].word == &value + n(2), "returned packets own independent storage");
    }
    #[cfg(not(feature = "result-only"))]
    full(&mut c);
    println!("{{\"checks\":{},\"recoveries\":{},\"rejections\":{},\"rounds\":256,\"snapshotControls\":{},\"snapshots\":{}}}",
        c.checks, c.recoveries, c.rejections, c.snapshot_controls, c.snapshots);
}

#[cfg(not(feature = "result-only"))]
fn full(c: &mut Counts) {
    use api::{Choice, Holder};
    c.call(&ps(2, 3), api::first, n(3));
    c.call(&ps(7, 0), api::second, n(8));
    c.call(&(ps(2, 3), ps(7, 0)), |v| api::pair(&v.0, &v.1), n(11));
    c.call(&vec![ps(1, 2), ps(3, 5)], |v| api::in_array(v), n(7));
    c.call(&Vec::<Packet>::new(), |v| api::in_array(v), n(0));
    c.call(&vec![ps(1, 0), ps(3, 100)], |v| api::in_list(v), n(6));
    c.call(&Vec::<Packet>::new(), |v| api::in_list(v), n(0));
    c.call(&None, api::in_option, n(0));
    c.call(&Some(ps(1, 2)), api::in_option, n(3));
    c.call(&(ps(1, 2), ps(3, 0)), api::in_product, n(6));
    c.call(&Ok(ps(2, 9)), api::in_except, n(3));
    c.call(&Err(ps(1, 2)), api::in_except, n(3));
    c.call(&Holder { packet: ps(3, 1), tag: n(9) }, api::in_holder, n(13));
    c.call(&Choice::Empty, api::in_choice, n(0));
    c.call(&Choice::Packet { value: ps(2, 4) }, api::in_choice, n(5));
    let echoed = vec![ps(2, 3), p(1, huge())];
    let mut returned = c.call(&echoed, |v| api::echo_array(v), echoed.clone());
    returned[0].word = n(0);
    c.check(echoed[0].word == n(3), "returned echo owns independent storage");
    c.call(&Vec::<Packet>::new(), |v| api::echo_array(v), vec![]);

    // Exact late-field and constructor paths through every carrier.
    c.refuse(&ps(0, 0), api::first, &rejected("0.word", "mkWord"));
    c.refuse(&ps(4, 2), api::first, &rejected("0", "mkPacket"));
    c.refuse(&ps(10, 12), api::first, &fin("0"));
    c.refuse(&(ps(2, 3), ps(10, 0)), |v| api::pair(&v.0, &v.1), &fin("1"));
    c.refuse(&vec![ps(2, 3), ps(1, 0)], |v| api::in_array(v), &rejected("0[1].word", "mkWord"));
    c.refuse(&vec![ps(2, 3), ps(5, 2)], |v| api::in_array(v), &rejected("0[1]", "mkPacket"));
    c.refuse(&vec![ps(2, 3), ps(10, 12)], |v| api::in_array(v), &fin("0[1]"));
    c.refuse(&Some(ps(5, 2)), api::in_option, &rejected("0?", "mkPacket"));
    c.refuse(&(ps(1, 2), ps(10, 0)), api::in_product, &fin("0.1"));
    c.refuse(&Ok(ps(10, 0)), api::in_except, &fin("0.ok"));
    c.refuse(&Err(ps(3, 1)), api::in_except, &rejected("0.error", "mkPacket"));
    c.refuse(&Holder { packet: ps(10, 0), tag: n(9) }, api::in_holder, &fin("0.packet"));
    c.refuse(&Choice::Packet { value: ps(3, 1) }, api::in_choice, &rejected("0.packet.value", "mkPacket"));

    // Rejection never poisons later calls: each refusal is followed by a success.
    for round in 0..256u64 {
        c.call(&ps(round % 10, round + 10), api::first, n(round + 10));
        c.refuse(&ps(2, 1), api::first, &rejected("0", "mkPacket"));
        c.call(&ps(round % 10, 0), api::second, n(round % 10 + 1));
        c.refuse(&vec![ps(round % 10, round + 10), ps(1, 0)], |v| api::in_array(v), &rejected("0[1].word", "mkWord"));
        c.call(&vec![ps(round % 10, round + 10), ps(2, 3)], |v| api::in_array(v), n(round + 13));
        c.recoveries += 1;
    }
}
