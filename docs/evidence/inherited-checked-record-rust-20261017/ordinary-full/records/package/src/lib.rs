//! Typed copied-value functions from inheritedcheckedrecords@1.0.0.
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
pub struct Span {
    pub lo: BigUint,
    pub hi: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Ticket {
    pub to_span: Span,
    pub word: BigUint,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Stamped {
    pub to_ticket: Ticket,
    pub mark: BigUint,
}

pub type TicketAlias = Ticket;

/// Lean export: lean:InheritedCheckedRecords.aliased.
///
/// Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkTicket; arg0.toSpan checked by InheritedCheckedRecords.normalizeSpan; arg0.word checked by InheritedCheckedRecords.normalizeWord.
pub fn aliased(arg0: &TicketAlias) -> Result<BigUint, Error> {
    __runtime::call0(arg0)
}

/// Lean export: lean:InheritedCheckedRecords.echo.
///
/// Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.normalizeTicket; arg0.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.word checked by InheritedCheckedRecords.normalizeWord; result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.
pub fn echo(arg0: &Ticket) -> Result<Ticket, Error> {
    __runtime::call1(arg0)
}

/// Lean export: lean:InheritedCheckedRecords.first.
///
/// Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkTicket; arg0.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.word checked by InheritedCheckedRecords.mkWord.
pub fn first(arg0: &Ticket) -> Result<BigUint, Error> {
    __runtime::call2(arg0)
}

/// Lean export: lean:InheritedCheckedRecords.nested.
///
/// Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkStamped; arg0.toTicket checked by InheritedCheckedRecords.mkTicket; arg0.toTicket.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.toTicket.word checked by InheritedCheckedRecords.mkWord; arg0.mark < 8.
pub fn nested(arg0: &Stamped) -> Result<BigUint, Error> {
    __runtime::call3(arg0)
}

/// Lean export: lean:InheritedCheckedRecords.normalized.
///
/// Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.normalizeTicket; arg0.toSpan checked by InheritedCheckedRecords.normalizeSpan; arg0.word checked by InheritedCheckedRecords.normalizeWord.
pub fn normalized(arg0: &Ticket) -> Result<BigUint, Error> {
    __runtime::call4(arg0)
}

/// Lean export: lean:InheritedCheckedRecords.pair.
///
/// Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkTicket; arg0.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.word checked by InheritedCheckedRecords.mkWord; arg1 checked by InheritedCheckedRecords.normalizeTicket; arg1.toSpan checked by InheritedCheckedRecords.normalizeSpan; arg1.word checked by InheritedCheckedRecords.normalizeWord.
pub fn pair(arg0: &Ticket, arg1: &Ticket) -> Result<BigUint, Error> {
    __runtime::call5(arg0, arg1)
}

/// Lean export: lean:InheritedCheckedRecords.produce.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value.
pub fn produce(arg0: &BigUint) -> Result<Ticket, Error> {
    __runtime::call6(arg0)
}

/// Lean export: lean:InheritedCheckedRecords.produceStamped.
///
/// Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toTicket projects proof-backed record payload fields; result.toTicket.toSpan projects proof-backed record payload fields; result.toTicket.word projects the Subtype base value; result.mark < 8.
pub fn produce_stamped(arg0: &BigUint) -> Result<Stamped, Error> {
    __runtime::call7(arg0)
}
