//! Typed copied-value functions from nominalsubtypes@1.0.0.
#[cfg(not(all(target_os = "linux", target_arch = "x86_64", target_env = "gnu")))]
compile_error!("This Lean crate requires Linux x86-64 with glibc");
pub use num_bigint::{BigInt, BigUint};
mod __runtime;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Limit,
    Allocation,
    InvalidNative,

    Load(String),
    Native { code: i32, message: String },
}
impl std::fmt::Display for Error {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Limit => formatter.write_str("16 MiB conversion limit exceeded"),
            Self::Allocation => formatter.write_str("Conversion allocation failed"),
            Self::InvalidNative => formatter.write_str("Native result violates its copied-value contract"),

            Self::Load(message) => formatter.write_str(message),
            Self::Native { code, message } => write!(formatter, "Lean native error {code}: {message}"),
        }
    }
}
impl std::error::Error for Error {}


#[derive(Clone, Debug, PartialEq)]
pub struct Envelope {
    pub payload: BigUint,
    pub digit: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Event {
    Empty,
    Box { value: Envelope },
    Choices { values: Vec<Option<Result<BigUint, BigUint>>> },
}

#[derive(Clone, Debug, PartialEq)]
pub struct AliasPair {
    pub left: Vec<Option<EnvelopeAlias>>,
    pub right: Vec<Option<EnvelopeAlias>>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Pair {
    pub left: Envelope,
    pub right: Envelope,
}

pub type EnvelopeAlias = Envelope;

/// Lean export: lean:NominalSubtypes.aliases.
///
/// Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; arg1[*]?.payload checked by NominalSubtypes.plusTwo; arg1[*]?.digit < 3.
pub fn aliases(arg0: &[Option<EnvelopeAlias>], arg1: &[Option<EnvelopeAlias>]) -> Result<BigUint, Error> {
    __runtime::call0(arg0, arg1)
}

/// Lean export: lean:NominalSubtypes.arrayValues.
///
/// Checked Lean Fin bounds: result[*] projects the Subtype base value.
pub fn array_values(arg0: &BigUint) -> Result<Vec<BigUint>, Error> {
    __runtime::call1(arg0)
}

/// Lean export: lean:NominalSubtypes.branch.
///
/// Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value.
pub fn branch(arg0: &BigUint) -> Result<Result<BigUint, BigUint>, Error> {
    __runtime::call2(arg0)
}

/// Lean export: lean:NominalSubtypes.combine.
///
/// Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; arg1.payload checked by NominalSubtypes.plusTwo; arg1.digit < 3.
pub fn combine(arg0: &Envelope, arg1: &Envelope) -> Result<BigUint, Error> {
    __runtime::call3(arg0, arg1)
}

/// Lean export: lean:NominalSubtypes.echo.
///
/// Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; result.payload projects the Subtype base value; result.digit < 3.
pub fn echo(arg0: &Envelope) -> Result<Envelope, Error> {
    __runtime::call4(arg0)
}

/// Lean export: lean:NominalSubtypes.echoEvent.
///
/// Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
pub fn echo_event(arg0: &Event) -> Result<Event, Error> {
    __runtime::call5(arg0)
}

/// Lean export: lean:NominalSubtypes.echoGroups.
///
/// Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; result[*]?.payload projects the Subtype base value; result[*]?.digit < 3.
pub fn echo_groups(arg0: &[Option<EnvelopeAlias>]) -> Result<Vec<Option<EnvelopeAlias>>, Error> {
    __runtime::call6(arg0)
}

/// Lean export: lean:NominalSubtypes.echoPair.
///
/// Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3.
pub fn echo_pair(arg0: &AliasPair) -> Result<AliasPair, Error> {
    __runtime::call7(arg0)
}

/// Lean export: lean:NominalSubtypes.eventChoices.
///
/// Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
pub fn event_choices(arg0: &BigUint) -> Result<Event, Error> {
    __runtime::call8(arg0)
}

/// Lean export: lean:NominalSubtypes.eventEmpty.
///
/// Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
pub fn event_empty(arg0: &BigUint) -> Result<Event, Error> {
    __runtime::call9(arg0)
}

/// Lean export: lean:NominalSubtypes.eventFirst.
///
/// Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo.
pub fn event_first(arg0: &Event) -> Result<BigUint, Error> {
    __runtime::call10(arg0)
}

/// Lean export: lean:NominalSubtypes.eventSecond.
///
/// Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusTwo; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; arg0.choices.values[*]?.error checked by NominalSubtypes.plusOne.
pub fn event_second(arg0: &Event) -> Result<BigUint, Error> {
    __runtime::call11(arg0)
}

/// Lean export: lean:NominalSubtypes.eventValue.
///
/// Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value.
pub fn event_value(arg0: &BigUint) -> Result<Event, Error> {
    __runtime::call12(arg0)
}

/// Lean export: lean:NominalSubtypes.first.
///
/// Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3.
pub fn first(arg0: &Envelope) -> Result<BigUint, Error> {
    __runtime::call13(arg0)
}

/// Lean export: lean:NominalSubtypes.groupValues.
///
/// Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3.
pub fn group_values(arg0: &BigUint) -> Result<Vec<Option<EnvelopeAlias>>, Error> {
    __runtime::call14(arg0)
}

/// Lean export: lean:NominalSubtypes.inspectAliasPair.
///
/// Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3.
pub fn inspect_alias_pair(arg0: &AliasPair) -> Result<BigUint, Error> {
    __runtime::call15(arg0)
}

/// Lean export: lean:NominalSubtypes.listValues.
///
/// Checked Lean Fin bounds: result[*] projects the Subtype base value.
pub fn list_values(arg0: &BigUint) -> Result<Vec<BigUint>, Error> {
    __runtime::call16(arg0)
}

/// Lean export: lean:NominalSubtypes.nested.
///
/// Checked Lean Fin bounds: arg0.left.payload checked by NominalSubtypes.plusOne; arg0.left.digit < 3; arg0.right.payload checked by NominalSubtypes.plusTwo; arg0.right.digit < 3.
pub fn nested(arg0: &Pair) -> Result<BigUint, Error> {
    __runtime::call17(arg0)
}

/// Lean export: lean:NominalSubtypes.noItems.
///
/// Checked Lean Fin bounds: result[*] projects the Subtype base value.
pub fn no_items(arg0: &BigUint) -> Result<Vec<BigUint>, Error> {
    __runtime::call18(arg0)
}

/// Lean export: lean:NominalSubtypes.optional.
///
/// Checked Lean Fin bounds: result? projects the Subtype base value.
pub fn optional(arg0: &BigUint) -> Result<Option<BigUint>, Error> {
    __runtime::call19(arg0)
}

/// Lean export: lean:NominalSubtypes.pairValues.
///
/// Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3.
pub fn pair_values(arg0: &BigUint) -> Result<AliasPair, Error> {
    __runtime::call20(arg0)
}

/// Lean export: lean:NominalSubtypes.plainFin.
///
/// Checked Lean Fin bounds: arg0 < 3.
pub fn plain_fin(arg0: &BigUint) -> Result<BigUint, Error> {
    __runtime::call21(arg0)
}

/// Lean export: lean:NominalSubtypes.produceEnvelope.
///
/// Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit < 3.
pub fn produce_envelope(arg0: &BigUint) -> Result<Envelope, Error> {
    __runtime::call22(arg0)
}

/// Lean export: lean:NominalSubtypes.product.
///
/// Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value.
pub fn product(arg0: &BigUint) -> Result<(BigUint, BigUint), Error> {
    __runtime::call23(arg0)
}

/// Lean export: lean:NominalSubtypes.scalar.
///
/// Checked Lean Fin bounds: result projects the Subtype base value.
pub fn scalar(arg0: &BigUint) -> Result<BigUint, Error> {
    __runtime::call24(arg0)
}

/// Lean export: lean:NominalSubtypes.second.
///
/// Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusTwo; arg0.digit < 3.
pub fn second(arg0: &Envelope) -> Result<BigUint, Error> {
    __runtime::call25(arg0)
}
