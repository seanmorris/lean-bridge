// Independent public caller. Generated equality and serialization are not oracles.
use nominalsubtypes as api;
use api::{BigUint, Error};

#[derive(Debug, PartialEq, Eq)]
enum Value {
    Nat(Vec<u32>),
    Node(&'static str, Vec<Value>),
}

trait Snapshot {
    fn snapshot(&self) -> Value;
}

impl Snapshot for BigUint {
    fn snapshot(&self) -> Value { Value::Nat(self.to_u32_digits()) }
}
impl<T: Snapshot + ?Sized> Snapshot for &T {
    fn snapshot(&self) -> Value { (*self).snapshot() }
}
impl<T: Snapshot> Snapshot for [T] {
    fn snapshot(&self) -> Value {
        Value::Node("sequence", self.iter().map(Snapshot::snapshot).collect())
    }
}
impl<T: Snapshot> Snapshot for Vec<T> {
    fn snapshot(&self) -> Value { self.as_slice().snapshot() }
}
impl<T: Snapshot> Snapshot for Option<T> {
    fn snapshot(&self) -> Value {
        match self {
            None => Value::Node("none", vec![]),
            Some(value) => Value::Node("some", vec![value.snapshot()]),
        }
    }
}
impl<T: Snapshot, E: Snapshot> Snapshot for Result<T, E> {
    fn snapshot(&self) -> Value {
        match self {
            Ok(value) => Value::Node("ok", vec![value.snapshot()]),
            Err(value) => Value::Node("error", vec![value.snapshot()]),
        }
    }
}
impl<A: Snapshot, B: Snapshot> Snapshot for (A, B) {
    fn snapshot(&self) -> Value {
        Value::Node("product", vec![self.0.snapshot(), self.1.snapshot()])
    }
}
impl Snapshot for api::Envelope {
    fn snapshot(&self) -> Value {
        let api::Envelope { payload, digit } = self;
        Value::Node("Envelope", vec![payload.snapshot(), digit.snapshot()])
    }
}
impl Snapshot for api::AliasPair {
    fn snapshot(&self) -> Value {
        let api::AliasPair { left, right } = self;
        Value::Node("AliasPair", vec![left.snapshot(), right.snapshot()])
    }
}
#[cfg(not(feature = "result-only"))]
impl Snapshot for api::Pair {
    fn snapshot(&self) -> Value {
        let api::Pair { left, right } = self;
        Value::Node("Pair", vec![left.snapshot(), right.snapshot()])
    }
}
impl Snapshot for api::Event {
    fn snapshot(&self) -> Value {
        match self {
            api::Event::Empty => Value::Node("Event.empty", vec![]),
            api::Event::Box { value } => Value::Node("Event.box", vec![value.snapshot()]),
            api::Event::Choices { values } => Value::Node("Event.choices", vec![values.snapshot()]),
        }
    }
}

#[derive(Default)]
struct Counts {
    checks: usize,
    rejections: usize,
    snapshot_controls: usize,
}
impl Counts {
    fn check(&mut self, condition: bool, message: &str) {
        assert!(condition, "failed: {message}");
        self.checks += 1;
    }
    fn call<I: Snapshot + ?Sized, O: Snapshot>(
        &mut self, input: &I, call: impl FnOnce(&I) -> Result<O, Error>, expected: O,
    ) -> O {
        let before = input.snapshot();
        let output = call(input).expect("valid public call");
        self.check(output.snapshot() == expected.snapshot(), "exact copied result");
        self.check(input.snapshot() == before, "complete accepted input unchanged");
        output
    }
    #[cfg(not(feature = "result-only"))]
    fn refused<I: Snapshot + ?Sized, O>(
        &mut self, input: &I, call: impl FnOnce(&I) -> Result<O, Error>, expected: &str,
    ) {
        let before = input.snapshot();
        match call(input) {
            Err(Error::Native { code, message }) => {
                self.check(code == 1 && message == expected, &format!("refusal: {expected}; got {message}"));
            }
            Err(error) => panic!("wrong rejection: {error:?}"),
            Ok(_) => panic!("accepted: {expected}"),
        }
        self.check(input.snapshot() == before, "complete rejected input unchanged");
        self.rejections += 1;
    }
}

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn envelope(payload: BigUint, digit: u64) -> api::Envelope {
    api::Envelope { payload, digit: n(digit) }
}
#[cfg(not(feature = "result-only"))]
fn wrap(value: u64) -> api::Envelope { envelope(n(value), 2) }
fn values(value: &BigUint) -> Vec<Option<api::EnvelopeAlias>> {
    vec![None, Some(envelope(value + n(1), 2))]
}

fn main() {
    let mut c = Counts::default();
    let huge = n(1) << 100usize;
    let original = api::Event::Choices { values: vec![None, Some(Ok(huge.clone()))] };
    let mutations = [
        api::Event::Choices { values: vec![None, Some(Ok(&huge + n(1)))] },
        api::Event::Choices { values: vec![None, Some(Err(huge.clone()))] },
        api::Event::Choices { values: vec![Some(Ok(huge.clone())), None] },
        api::Event::Choices { values: vec![None, None] },
        api::Event::Choices { values: vec![None, Some(Ok(huge.clone())), None] },
        api::Event::Box { value: envelope(huge.clone(), 2) },
        api::Event::Empty,
        api::Event::Choices { values: vec![None, Some(Ok(n(1) << 99usize))] },
    ];
    for changed in mutations {
        c.check(changed.snapshot() != original.snapshot(), "independent snapshot mutation control");
        c.snapshot_controls += 1;
    }
    for value in [n(0), n(40), huge.clone()] {
        let one = &value + n(1);
        let two = &value + n(2);
        c.call(&value, api::scalar, one.clone());
        c.call(&value, api::produce_envelope, envelope(one.clone(), 2));
        c.call(&value, api::array_values, vec![one.clone(), two.clone()]);
        c.call(&value, api::list_values, vec![one.clone(), two.clone()]);
        c.call(&value, api::optional, if value == n(0) { None } else { Some(one.clone()) });
        c.call(&value, api::product, (one.clone(), two.clone()));
        let _ = c.call(&value, api::branch, if value == n(0) { Err(one.clone()) } else { Ok(one.clone()) });
        c.call(&value, api::group_values, values(&value));
        c.call(&value, api::pair_values, api::AliasPair { left: values(&value), right: values(&one) });
        c.call(&value, api::event_value, api::Event::Box { value: envelope(one.clone(), 2) });
        c.call(&value, api::event_empty, api::Event::Empty);
        c.call(&value, api::event_choices, api::Event::Choices { values: vec![None, Some(Ok(one)), Some(Err(two))] });
        c.call(&value, api::no_items, vec![]);
    }
    #[cfg(feature = "result-only")]
    for round in 0..1000 {
        let value = &huge + n(round);
        c.call(&value, api::pair_values, api::AliasPair { left: values(&value), right: values(&(&value + n(1))) });
    }
    #[cfg(not(feature = "result-only"))]
    full(&mut c);
    println!("{{\"checks\":{},\"rejections\":{},\"snapshotControls\":{}}}", c.checks, c.rejections, c.snapshot_controls);
}

#[cfg(not(feature = "result-only"))]
fn subtype(path: &str, amount: u64) -> String {
    format!("{path} was rejected by NominalSubtypes.{}", if amount == 1 { "plusOne" } else { "plusTwo" })
}
#[cfg(not(feature = "result-only"))]
fn fin(path: &str) -> String { format!("{path} is not below its Fin 3 bound") }

#[cfg(not(feature = "result-only"))]
fn full(c: &mut Counts) {
    let item = wrap(40);
    c.call(&item, api::first, n(41));
    c.call(&item, api::second, n(42));
    c.call(&(&item, &item), |v| api::combine(v.0, v.1), n(4142));
    c.call(&api::Pair { left: wrap(40), right: wrap(40) }, api::nested, n(4142));
    c.call(&wrap(99), api::first, n(100));
    c.call(&wrap(89), api::second, n(91));
    c.call(&wrap(90), api::first, n(91));
    c.refused(&wrap(100), api::first, &subtype("arg0.payload", 1));
    c.refused(&wrap(90), api::second, &subtype("arg0.payload", 2));
    c.refused(&(wrap(100), wrap(40)), |v| api::combine(&v.0, &v.1), &subtype("arg0.payload", 1));
    c.refused(&(wrap(40), wrap(90)), |v| api::combine(&v.0, &v.1), &subtype("arg1.payload", 2));
    c.refused(&api::Pair { left: wrap(100), right: wrap(40) }, api::nested, &subtype("arg0.left.payload", 1));
    c.refused(&api::Pair { left: wrap(40), right: wrap(90) }, api::nested, &subtype("arg0.right.payload", 2));
    c.call(&item, api::echo, wrap(41));
    type EventCall = fn(&api::Event) -> Result<BigUint, Error>;
    for (call, one, two) in [(api::event_first as EventCall, 1, 2), (api::event_second as EventCall, 2, 1)] {
        c.call(&api::Event::Empty, call, n(0));
        c.call(&api::Event::Box { value: wrap(40) }, call, n(40 + one));
        c.call(&api::Event::Choices { values: vec![] }, call, n(0));
        c.call(&api::Event::Choices { values: vec![None] }, call, n(0));
        c.call(&api::Event::Choices { values: vec![None, Some(Ok(n(40)))] }, call, n(40 + one));
        c.call(&api::Event::Choices { values: vec![Some(Err(n(40))), None] }, call, n(40 + two));
        for (label, good, amount) in [("ok", true, one), ("error", false, two)] {
            for position in 0..3 {
                let mut items = vec![Some(Ok(n(40))), None, Some(Err(n(40)))];
                items[position] = Some(if good { Ok(n(100)) } else { Err(n(100)) });
                c.refused(&api::Event::Choices { values: items }, call, &subtype(&format!("arg0.choices.values[{position}]?.{label}"), amount));
            }
        }
    }
    let left = vec![None, Some(wrap(40)), Some(envelope(n(1), 0))];
    let right = vec![Some(envelope(n(2), 1)), None];
    let normalized_left = vec![None, Some(wrap(41)), Some(envelope(n(2), 0))];
    let normalized_right = vec![Some(envelope(n(4), 1)), None];
    c.call(&(&left, &right), |v| api::aliases(v.0, v.1), n(47));
    c.call(&api::AliasPair { left: left.clone(), right: right.clone() }, api::inspect_alias_pair, n(47));
    c.call(&left, |v| api::echo_groups(v), normalized_left.clone());
    let projected = c.call(&api::AliasPair { left: left.clone(), right: right.clone() }, api::echo_pair,
        api::AliasPair { left: normalized_left.clone(), right: normalized_right.clone() });
    c.call(&projected, api::echo_pair, api::AliasPair {
        left: vec![None, Some(wrap(42)), Some(envelope(n(3), 0))], right: vec![Some(envelope(n(6), 1)), None],
    });
    c.call(&api::Event::Choices { values: vec![None, Some(Ok(n(40))), Some(Err(n(40)))] }, api::echo_event,
        api::Event::Choices { values: vec![None, Some(Ok(n(41))), Some(Err(n(42)))] });
    c.call(&api::Event::Empty, api::echo_event, api::Event::Empty);
    c.call(&api::Event::Box { value: wrap(40) }, api::echo_event, api::Event::Box { value: wrap(41) });
    c.call(&vec![], |v| api::echo_groups(v), vec![]);
    c.call(&api::AliasPair { left: vec![], right: vec![None] }, api::echo_pair, api::AliasPair { left: vec![], right: vec![None] });
    for position in 0..3 {
        let mut bad = vec![Some(wrap(40)), None, Some(wrap(40))];
        bad[position] = Some(wrap(100));
        c.refused(&bad, |v| api::echo_groups(v), &subtype(&format!("arg0[{position}]?.payload"), 1));
        c.refused(&api::AliasPair { left: bad.clone(), right: right.clone() }, api::inspect_alias_pair, &subtype(&format!("arg0.left[{position}]?.payload"), 1));
        c.refused(&api::AliasPair { left: left.clone(), right: bad }, api::inspect_alias_pair, &subtype(&format!("arg0.right[{position}]?.payload"), 2));
    }
    // All Fin bounds precede even an earlier rejected Subtype constructor.
    c.refused(&(wrap(100), envelope(n(40), 3)), |v| api::combine(&v.0, &v.1), &fin("arg1.digit"));
    c.refused(&api::Pair { left: wrap(100), right: envelope(n(40), 3) }, api::nested, &fin("arg0.right.digit"));
    c.refused(&(vec![Some(wrap(100))], vec![None, Some(envelope(n(40), 3))]), |v| api::aliases(&v.0, &v.1), &fin("arg1[1]?.digit"));
    c.refused(&api::Event::Box { value: envelope(n(100), 3) }, api::echo_event, &fin("arg0.box.value.digit"));
    c.call(&n(2), api::plain_fin, n(2));
    c.refused(&n(3), api::plain_fin, &fin("arg0"));
    for round in 0..1000 {
        let position = round % 3;
        let mut bad = vec![None, Some(wrap(1)), None];
        bad[position] = Some(wrap(90));
        c.refused(&api::AliasPair { left: left.clone(), right: bad }, api::echo_pair, &subtype(&format!("arg0.right[{position}]?.payload"), 2));
        c.call(&api::AliasPair { left: left.clone(), right: right.clone() }, api::echo_pair,
            api::AliasPair { left: normalized_left.clone(), right: normalized_right.clone() });
    }
}
