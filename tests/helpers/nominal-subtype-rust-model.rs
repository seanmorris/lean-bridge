// Synthetic caller controls, not Lean compilation or installed acceptance.
// u128 covers this caller's 100-bit samples only. Real packages use num_bigint.
use std::ops::{Add, Shl};

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct BigUint(u128);
impl From<u64> for BigUint {
    fn from(value: u64) -> Self { Self(value.into()) }
}
impl Add<BigUint> for &BigUint {
    type Output = BigUint;
    fn add(self, other: BigUint) -> BigUint { BigUint(self.0 + other.0) }
}
impl Add<BigUint> for BigUint {
    type Output = BigUint;
    fn add(self, other: BigUint) -> BigUint { &self + other }
}
impl Shl<usize> for BigUint {
    type Output = BigUint;
    fn shl(self, bits: usize) -> BigUint { BigUint(self.0 << bits) }
}
impl BigUint {
    pub fn to_u32_digits(&self) -> Vec<u32> {
        let mut value = self.0;
        let mut limbs = vec![];
        while value != 0 {
            limbs.push(value as u32);
            value >>= 32;
        }
        limbs
    }
}

#[derive(Debug)]
pub enum Error { Native { code: u32, message: String }, Invalid }
#[derive(Clone, Debug)]
pub struct Envelope { pub payload: BigUint, pub digit: BigUint }
pub type EnvelopeAlias = Envelope;
#[derive(Clone, Debug)]
pub struct AliasPair { pub left: Vec<Option<Envelope>>, pub right: Vec<Option<Envelope>> }
#[derive(Clone, Debug)]
pub enum Event { Empty, Box { value: Envelope }, Choices { values: Vec<Option<Result<BigUint, BigUint>>> } }
#[cfg(not(feature = "result-only"))]
#[derive(Clone, Debug)]
pub struct Pair { pub left: Envelope, pub right: Envelope }

// Dishonest generated equality must not conceal faulty result payloads.
impl PartialEq for Envelope { fn eq(&self, _: &Self) -> bool { true } }
impl PartialEq for AliasPair { fn eq(&self, _: &Self) -> bool { true } }
impl PartialEq for Event { fn eq(&self, _: &Self) -> bool { true } }

fn mutant(name: &str) -> bool { std::env::var("NOMINAL_RUST_MUTANT").as_deref() == Ok(name) }
fn envelope(value: &BigUint) -> Envelope { Envelope { payload: value.clone(), digit: BigUint(2) } }
fn groups(value: &BigUint) -> Vec<Option<Envelope>> { vec![None, Some(envelope(&(value + BigUint(1))))] }

pub fn scalar(value: &BigUint) -> Result<BigUint, Error> {
    Ok(if mutant("scalar") { value.clone() } else { value + BigUint(1) })
}
pub fn produce_envelope(value: &BigUint) -> Result<Envelope, Error> {
    let value = value + BigUint(1);
    Ok(envelope(&if mutant("truncate-envelope") { BigUint(value.0 & u64::MAX as u128) } else { value }))
}
pub fn array_values(value: &BigUint) -> Result<Vec<BigUint>, Error> {
    Ok(if mutant("short-array") { vec![value + BigUint(1)] } else { vec![value + BigUint(1), value + BigUint(2)] })
}
pub fn list_values(value: &BigUint) -> Result<Vec<BigUint>, Error> { Ok(vec![value + BigUint(1), value + BigUint(2)]) }
pub fn optional(value: &BigUint) -> Result<Option<BigUint>, Error> { Ok(if value.0 == 0 { None } else { Some(value + BigUint(1)) }) }
pub fn product(value: &BigUint) -> Result<(BigUint, BigUint), Error> { Ok((value + BigUint(1), value + BigUint(2))) }
pub fn branch(value: &BigUint) -> Result<Result<BigUint, BigUint>, Error> { Ok(if value.0 == 0 { Err(value + BigUint(1)) } else { Ok(value + BigUint(1)) }) }
pub fn group_values(value: &BigUint) -> Result<Vec<Option<Envelope>>, Error> { Ok(groups(value)) }
pub fn pair_values(value: &BigUint) -> Result<AliasPair, Error> {
    let mut result = AliasPair { left: groups(value), right: groups(&(value + BigUint(1))) };
    if mutant("missing-pair-values") { result.right.clear(); }
    if mutant("swap-pair") { std::mem::swap(&mut result.left, &mut result.right); }
    Ok(result)
}
pub fn event_value(value: &BigUint) -> Result<Event, Error> {
    Ok(if mutant("missing-event-value") { Event::Empty } else { Event::Box { value: envelope(&(value + BigUint(1))) } })
}
pub fn event_empty(_: &BigUint) -> Result<Event, Error> { Ok(Event::Empty) }
pub fn event_choices(value: &BigUint) -> Result<Event, Error> {
    if mutant("missing-event-choices") { return Ok(Event::Empty); }
    Ok(Event::Choices { values: vec![None, Some(Ok(value + BigUint(1))), Some(if mutant("wrong-choice-tag") { Ok(value + BigUint(2)) } else { Err(value + BigUint(2)) })] })
}
pub fn no_items(_: &BigUint) -> Result<Vec<Option<Envelope>>, Error> { Ok(vec![]) }

#[cfg(not(feature = "result-only"))]
mod full {
    use super::*;
    fn path(index: usize) -> String {
        format!("{}{index}", if std::env::var("NOMINAL_RUST_ROUTE").as_deref() == Ok("reviewed") { "value" } else { "arg" })
    }
    fn error(message: String) -> Error {
        Error::Native { code: 1, message: if mutant("wrong-error-path") { "wrong path".into() } else { message } }
    }
    fn fin(value: &BigUint, path: &str) -> Result<(), Error> {
        if value.0 >= 3 { Err(error(format!("{path} is not below its Fin 3 bound"))) } else { Ok(()) }
    }
    fn check_envelope(item: &Envelope, path: &str) -> Result<(), Error> { fin(&item.digit, &format!("{path}.digit")) }
    fn check_groups(items: &[Option<Envelope>], path: &str) -> Result<(), Error> {
        for (index, item) in items.iter().enumerate() {
            if let Some(value) = item { check_envelope(value, &format!("{path}[{index}]?"))?; }
        }
        Ok(())
    }
    fn normalize(value: &BigUint, path: &str, amount: u128) -> Result<BigUint, Error> {
        let (limit, name) = if amount == 1 { (100, "plusOne") } else { (90, "plusTwo") };
        if value.0 >= limit { Err(error(format!("{path} was rejected by NominalSubtypes.{name}"))) } else { Ok(value + BigUint(amount)) }
    }
    fn transform(item: &Envelope, path: &str, amount: u128) -> Result<Envelope, Error> {
        Ok(Envelope { payload: normalize(&item.payload, &format!("{path}.payload"), amount)?, digit: item.digit.clone() })
    }
    fn transform_groups(items: &[Option<Envelope>], path: &str, amount: u128) -> Result<Vec<Option<Envelope>>, Error> {
        items.iter().enumerate().map(|(index, item)| item.as_ref().map(|value| transform(value, &format!("{path}[{index}]?"), amount)).transpose()).collect()
    }
    fn sum(items: &[Option<Envelope>]) -> BigUint { BigUint(items.iter().flatten().map(|value| value.payload.0).sum()) }

    pub fn first(item: &Envelope) -> Result<BigUint, Error> {
        check_envelope(item, &path(0))?;
        if mutant("first") { return Ok(item.payload.clone()); }
        Ok(transform(item, &path(0), 1)?.payload)
    }
    pub fn second(item: &Envelope) -> Result<BigUint, Error> {
        check_envelope(item, &path(0))?;
        Ok(transform(item, &path(0), if mutant("second") { 1 } else { 2 })?.payload)
    }
    pub fn echo(item: &Envelope) -> Result<Envelope, Error> { check_envelope(item, &path(0))?; transform(item, &path(0), 1) }
    pub fn combine(left: &Envelope, right: &Envelope) -> Result<BigUint, Error> {
        if mutant("fin-after-subtype") { transform(left, &path(0), 1)?; }
        check_envelope(left, &path(0))?; check_envelope(right, &path(1))?;
        let left = transform(left, &path(0), 1)?.payload;
        let right = transform(right, &path(1), 2)?.payload;
        Ok(BigUint(left.0 * if mutant("combine") { 1 } else { 100 } + right.0))
    }
    pub fn nested(item: &Pair) -> Result<BigUint, Error> {
        let left_path = format!("{}.left", path(0));
        let right_path = format!("{}.right", path(0));
        check_envelope(&item.left, &left_path)?; check_envelope(&item.right, &right_path)?;
        let left = transform(&item.left, &left_path, 1)?.payload;
        let right = transform(&item.right, &right_path, 2)?.payload;
        Ok(BigUint(left.0 * if mutant("nested") { 1 } else { 100 } + right.0))
    }
    pub fn aliases(left: &[Option<Envelope>], right: &[Option<Envelope>]) -> Result<BigUint, Error> {
        check_groups(left, &path(0))?; check_groups(right, &path(1))?;
        Ok(sum(&transform_groups(left, &path(0), 1)?) + sum(&transform_groups(right, &path(1), 2)?))
    }
    pub fn echo_groups(items: &[Option<Envelope>]) -> Result<Vec<Option<Envelope>>, Error> {
        check_groups(items, &path(0))?; transform_groups(items, &path(0), 1)
    }
    pub fn echo_pair(item: &AliasPair) -> Result<AliasPair, Error> {
        let left_path = format!("{}.left", path(0));
        let right_path = format!("{}.right", path(0));
        check_groups(&item.left, &left_path)?; check_groups(&item.right, &right_path)?;
        Ok(AliasPair { left: transform_groups(&item.left, &left_path, 1)?, right: transform_groups(&item.right, &right_path, 2)? })
    }
    pub fn inspect_alias_pair(item: &AliasPair) -> Result<BigUint, Error> {
        let result = echo_pair(item)?; Ok(sum(&result.left) + sum(&result.right))
    }
    fn event(item: &Event, one: u128, two: u128) -> Result<Event, Error> {
        Ok(match item {
            Event::Empty => Event::Empty,
            Event::Box { value } => {
                let path = format!("{}.box.value", path(0));
                check_envelope(value, &path)?;
                Event::Box { value: transform(value, &path, one)? }
            }
            Event::Choices { values } => Event::Choices { values: values.iter().enumerate().map(|(index, item)| {
                item.as_ref().map(|branch| {
                    let (value, label, amount) = match branch { Ok(value) => (value, "ok", one), Err(value) => (value, "error", two) };
                    let value = normalize(value, &format!("{}.choices.values[{index}]?.{label}", path(0)), amount)?;
                    Ok(match branch { Ok(_) => Ok(value), Err(_) => Err(value) })
                }).transpose()
            }).collect::<Result<_, Error>>()? },
        })
    }
    fn event_sum(item: Event) -> BigUint {
        match item {
            Event::Empty => BigUint(0), Event::Box { value } => value.payload,
            Event::Choices { values } => BigUint(values.into_iter().flatten().map(|value| match value { Ok(value) | Err(value) => value.0 }).sum()),
        }
    }
    pub fn event_first(item: &Event) -> Result<BigUint, Error> { Ok(event_sum(event(item, 1, 2)?)) }
    pub fn event_second(item: &Event) -> Result<BigUint, Error> { Ok(event_sum(event(item, 2, 1)?)) }
    pub fn echo_event(item: &Event) -> Result<Event, Error> { event(item, 1, 2) }
    pub fn plain_fin(value: &BigUint) -> Result<BigUint, Error> {
        if !mutant("plain-fin") { fin(value, &path(0))?; }
        Ok(value.clone())
    }
}
#[cfg(not(feature = "result-only"))]
pub use full::*;
