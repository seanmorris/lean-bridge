//! Source-only inherited checked-record stand-in for testing the Rust caller.
//! It never executes a compiled Lean library or supports an installed-package claim.
pub use num_bigint::{BigInt, BigUint};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Limit,
    Allocation,
    InvalidNative,
    Load(String),
    Native { code: i32, message: String },
}

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

fn fault(label: &str) -> bool {
    std::env::var("INHERITED_RUST_FAULT").map_or(false, |value| value == label)
}

fn prefix() -> String {
    std::env::var("INHERITED_RUST_PREFIX").unwrap_or_else(|_| "arg".into())
}

fn path(tail: &str) -> String {
    if fault("wrong-path") { prefix() + "9" } else { prefix() + tail }
}

fn n(value: u64) -> BigUint { BigUint::from(value) }

#[derive(Clone, Copy, PartialEq)]
enum Choose { Make, Normalize }
use Choose::{Make, Normalize};

#[derive(Clone, Copy)]
struct Site { span: Choose, word: Choose, ticket: Choose }
const FIRST: Site = Site { span: Make, word: Make, ticket: Make };
const NORMALIZED: Site = Site {
    span: Normalize, word: Normalize, ticket: Normalize,
};
const ALIASED: Site = Site {
    span: Normalize, word: Normalize, ticket: Make,
};
const ECHO: Site = Site {
    span: Make, word: Normalize, ticket: Normalize,
};

fn selected(choice: Choose) -> Choose {
    if fault("conflated-constructor") { Make } else { choice }
}

fn reject(message: String) -> Error {
    if fault("wrong-error-kind") { return Error::InvalidNative; }
    let suffix = if fault("diagnostic-suffix") { "." } else { "" };
    Error::Native {
        code: if fault("wrong-status") { 2 } else { 1 },
        message: message + suffix,
    }
}

fn accept(value: &Ticket, at: &str, site: Site) -> Result<Ticket, Error> {
    let mut lo = value.to_span.lo.clone();
    let mut hi = value.to_span.hi.clone();
    let mut word = value.word.clone();

    match selected(site.span) {
        Normalize if !fault("missing-normalization") => {
            hi += &lo;
            lo = n(0);
        }
        Make if !fault("missing-span") && lo > hi => {
            return Err(reject(format!(
                "{at}.toSpan was rejected by InheritedCheckedRecords.mkSpan"
            )));
        }
        _ => {}
    }

    match selected(site.word) {
        Normalize if !fault("missing-normalization") => word += n(1),
        Make if !fault("missing-word") && word == n(0) => {
            return Err(reject(format!(
                "{at}.word was rejected by InheritedCheckedRecords.mkWord"
            )));
        }
        _ => {}
    }

    match selected(site.ticket) {
        Normalize if !fault("missing-normalization") => word = &hi + n(1),
        Make if !fault("missing-ticket") && hi > word => {
            return Err(reject(format!(
                "{at} was rejected by InheritedCheckedRecords.mkTicket"
            )));
        }
        _ => {}
    }

    Ok(Ticket { to_span: Span { lo, hi }, word })
}

fn produced(value: &BigUint) -> Ticket {
    let offset = if fault("produce-offset") { 2 } else { 1 };
    Ticket {
        to_span: Span { lo: value.clone(), hi: value.clone() },
        word: value + n(offset),
    }
}

pub fn first(value0: &Ticket) -> Result<BigUint, Error> {
    let value = accept(value0, &path("0"), FIRST)?;
    Ok(value.to_span.lo + value.to_span.hi + value.word)
}

pub fn normalized(value0: &Ticket) -> Result<BigUint, Error> {
    let value = accept(value0, &path("0"), NORMALIZED)?;
    Ok(value.to_span.lo + value.to_span.hi + value.word)
}

pub fn pair(value0: &Ticket, value1: &Ticket) -> Result<BigUint, Error> {
    let left = accept(value0, &path("0"), FIRST)?;
    let right = accept(value1, &path("1"), NORMALIZED)?;
    Ok(left.word + right.word)
}

pub fn aliased(value0: &TicketAlias) -> Result<BigUint, Error> {
    Ok(accept(value0, &path("0"), ALIASED)?.word)
}

pub fn nested(value0: &Stamped) -> Result<BigUint, Error> {
    let at = path("0");
    let ticket = accept(&value0.to_ticket, &at, FIRST)?;
    if !fault("missing-fin") && value0.mark >= n(8) {
        return Err(reject(format!("{at}.mark is not below its Fin 8 bound")));
    }
    if !fault("missing-stamped") && value0.mark > ticket.word {
        return Err(reject(format!(
            "{at} was rejected by InheritedCheckedRecords.mkStamped"
        )));
    }
    Ok(ticket.word + &value0.mark)
}

pub fn echo(value0: &Ticket) -> Result<Ticket, Error> {
    if fault("echo-raw") { return Ok(value0.clone()); }
    accept(value0, &path("0"), ECHO)
}

pub fn produce(value0: &BigUint) -> Result<Ticket, Error> {
    if fault("produce-refused") { return Err(Error::Limit); }
    Ok(produced(value0))
}

pub fn produce_stamped(value0: &BigUint) -> Result<Stamped, Error> {
    if fault("produce-refused") { return Err(Error::Limit); }
    Ok(Stamped {
        to_ticket: produced(value0),
        mark: n(if fault("produce-stamped-mark") { 1 } else { 0 }),
    })
}
