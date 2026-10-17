//! Source-only recursive checked-record stand-in for exercising the immutable Rust caller.
//! It is never packaged or treated as installed Lean evidence.
pub use num_bigint::BigUint;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    Limit,
    Allocation,
    InvalidNative,
    Load(String),
    Native { code: i32, message: String },
}

#[cfg(not(feature = "mutual"))]
#[derive(Clone, Debug, PartialEq)]
pub struct Packet {
    pub value: BigUint,
    pub digit: BigUint,
    pub tail: Option<Box<Packet>>,
}
#[cfg(not(feature = "mutual"))]
pub type PacketAlias = Packet;

#[cfg(feature = "mutual")]
#[derive(Clone, Debug, PartialEq)]
pub struct Envelope {
    pub value: BigUint,
    pub mode: BigUint,
    pub next: Option<Box<Step>>,
}
#[cfg(feature = "mutual")]
pub type EnvelopeAlias = Envelope;

#[cfg(feature = "mutual")]
#[derive(Clone, Debug, PartialEq)]
pub enum Step {
    Stop,
    More { packet: Box<Envelope> },
}

#[cfg(not(feature = "mutual"))]
type Record = Packet;
#[cfg(feature = "mutual")]
type Record = Envelope;
#[cfg(not(feature = "mutual"))]
type GroupItem = Option<Box<Record>>;
#[cfg(feature = "mutual")]
type GroupItem = Option<Record>;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Site { Make, Normalize }

static POISONED: AtomicBool = AtomicBool::new(false);

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn fault(label: &str) -> bool {
    std::env::var("RECURSIVE_RUST_FAULT").map_or(false, |value| value == label)
}
fn lean_name() -> &'static str {
    if cfg!(feature = "mutual") { "MutualCheckedRecords" } else { "RecursiveCheckedRecords" }
}
fn make_name() -> &'static str {
    if cfg!(feature = "mutual") { "mkEnvelope" } else { "mkPacket" }
}
fn bound_name() -> &'static str { if cfg!(feature = "mutual") { "mode" } else { "digit" } }
fn link_path() -> &'static str {
    if cfg!(feature = "mutual") { ".next?.more.packet" } else { ".tail?" }
}
fn child_path(path: &str) -> String {
    if fault("wrong-path") { path.to_owned() } else { path.to_owned() + link_path() }
}
fn ensure_ready() -> Result<(), Error> {
    if fault("poison-after-reject") && POISONED.load(Ordering::Relaxed) {
        return Err(Error::Native { code: 1, message: "poisoned after rejection".into() });
    }
    Ok(())
}
fn reject(mut message: String) -> Error {
    POISONED.store(true, Ordering::Relaxed);
    if fault("wrong-error-kind") { return Error::InvalidNative; }
    if fault("diagnostic-suffix") { message.push('.'); }
    Error::Native { code: if fault("wrong-status") { 2 } else { 1 }, message }
}
fn limit() -> Error {
    if fault("limit-as-native") {
        Error::Native { code: 1, message: "depth was reported as a Lean refinement".into() }
    } else {
        Error::Limit
    }
}

#[cfg(not(feature = "mutual"))]
fn bound(value: &Record) -> &BigUint { &value.digit }
#[cfg(feature = "mutual")]
fn bound(value: &Record) -> &BigUint { &value.mode }

fn validate(value: &Record, path: &str, depth: usize) -> Result<(), Error> {
    if depth > 128 && !fault("depth-unbounded") { return Err(limit()); }
    if bound(value) >= &n(3) && !fault("missing-fin") {
        return Err(reject(format!("{path}.{} is not below its Fin 3 bound", bound_name())));
    }
    if fault("root-only") { return Ok(()); }
    #[cfg(not(feature = "mutual"))]
    if let Some(child) = value.tail.as_deref() {
        validate(child, &child_path(path), depth + 1)?;
    }
    #[cfg(feature = "mutual")]
    if let Some(Step::More { packet }) = value.next.as_deref() {
        validate(packet, &child_path(path), depth + 1)?;
    }
    Ok(())
}

#[cfg(not(feature = "mutual"))]
fn construct(value: &Record, path: &str, site: Site, depth: usize) -> Result<Record, Error> {
    let selected = if fault("conflated-constructor") { Site::Make } else { site };
    let (limit_value, plus, word) = match selected {
        Site::Make => (100, 1, "plusOne"),
        Site::Normalize => (90, 2, "plusTwo"),
    };
    if value.value >= n(limit_value) {
        return Err(reject(format!("{path}.value was rejected by {}.{word}", lean_name())));
    }
    let tail = if fault("root-only") {
        value.tail.clone()
    } else {
        match value.tail.as_deref() {
            None => None,
            Some(child) => Some(Box::new(construct(child, &child_path(path), site, depth + 1)?)),
        }
    };
    let plus = if fault("missing-normalization") { 0 } else { plus };
    let mut normalized = &value.value + n(plus);
    if selected == Site::Normalize {
        normalized = bound(value) + n(1);
        if fault("second-normalizes-root-only") && depth > 0 { normalized = value.value.clone(); }
    }
    if selected == Site::Make && bound(value) > &normalized {
        return Err(reject(format!("{path} was rejected by {}.{}", lean_name(), make_name())));
    }
    Ok(Packet {
        value: normalized,
        digit: value.digit.clone(),
        tail: if fault("echo-drops-tail") { None } else { tail },
    })
}

#[cfg(feature = "mutual")]
fn construct(value: &Record, path: &str, site: Site, depth: usize) -> Result<Record, Error> {
    let selected = if fault("conflated-constructor") { Site::Make } else { site };
    let (limit_value, plus, word) = match selected {
        Site::Make => (100, 1, "plusOne"),
        Site::Normalize => (90, 2, "plusTwo"),
    };
    if value.value >= n(limit_value) {
        return Err(reject(format!("{path}.value was rejected by {}.{word}", lean_name())));
    }
    let next = if fault("root-only") {
        value.next.clone()
    } else {
        match value.next.as_deref() {
            None => None,
            Some(Step::Stop) => if fault("stop-as-none") { None } else { Some(Box::new(Step::Stop)) },
            Some(Step::More { packet }) => Some(Box::new(Step::More {
                packet: Box::new(construct(packet, &child_path(path), site, depth + 1)?),
            })),
        }
    };
    let plus = if fault("missing-normalization") { 0 } else { plus };
    let normalized = &value.value + n(plus);
    if selected == Site::Make && bound(value) > &normalized {
        return Err(reject(format!("{path} was rejected by {}.{}", lean_name(), make_name())));
    }
    if selected == Site::Normalize && bound(value) > &normalized {
        return Err(reject(format!("{path} was rejected by {}.normalizeEnvelope", lean_name())));
    }
    let _ = depth;
    Ok(Envelope {
        value: normalized,
        mode: value.mode.clone(),
        next: if fault("echo-drops-tail") { None } else { next },
    })
}

fn accepted(value: &Record, path: &str, site: Site) -> Result<Record, Error> {
    ensure_ready()?;
    validate(value, path, 0)?;
    construct(value, path, site, 0)
}

#[cfg(not(feature = "mutual"))]
fn group_value(value: &GroupItem) -> Option<&Record> { value.as_deref() }
#[cfg(feature = "mutual")]
fn group_value(value: &GroupItem) -> Option<&Record> { value.as_ref() }

#[cfg(not(feature = "mutual"))]
fn group(value: Record) -> GroupItem { Some(Box::new(value)) }
#[cfg(feature = "mutual")]
fn group(value: Record) -> GroupItem { Some(value) }

fn accepted_groups(values: &[GroupItem], site: Site) -> Result<Vec<GroupItem>, Error> {
    ensure_ready()?;
    for (index, item) in values.iter().enumerate() {
        if let Some(value) = group_value(item) {
            validate(value, &format!("arg0[{index}]?"), 0)?;
        }
    }
    values.iter().enumerate().map(|(index, item)| match group_value(item) {
        None => Ok(None),
        Some(value) => Ok(group(construct(value, &format!("arg0[{index}]?"), site, 0)?)),
    }).collect()
}

#[cfg(not(feature = "mutual"))]
fn produced(value: &BigUint) -> Record {
    let offset = if fault("produce-offset") { 0 } else { 1 };
    let digits = if fault("produce-digits") { (2, 1) } else { (1, 2) };
    Packet {
        value: value + n(offset),
        digit: n(digits.0),
        tail: if fault("produce-single") { None } else { Some(Box::new(Packet {
            value: value + n(offset + 1), digit: n(digits.1), tail: None,
        })) },
    }
}

#[cfg(feature = "mutual")]
fn produced(value: &BigUint) -> Record {
    let offset = if fault("produce-offset") { 0 } else { 1 };
    let digits = if fault("produce-digits") { (2, 1) } else { (1, 2) };
    Envelope {
        value: value + n(offset),
        mode: n(digits.0),
        next: if fault("produce-single") { None } else { Some(Box::new(Step::More {
            packet: Box::new(Envelope {
                value: value + n(offset + 1), mode: n(digits.1), next: None,
            }),
        })) },
    }
}

pub fn first(arg0: &Record) -> Result<BigUint, Error> {
    Ok(accepted(arg0, "arg0", Site::Make)?.value)
}
pub fn second(arg0: &Record) -> Result<BigUint, Error> {
    Ok(accepted(arg0, "arg0", Site::Normalize)?.value)
}
pub fn echo(arg0: &Record) -> Result<Record, Error> { accepted(arg0, "arg0", Site::Make) }
pub fn groups(arg0: &[GroupItem]) -> Result<BigUint, Error> {
    let values = accepted_groups(arg0, Site::Make)?;
    let count = if fault("groups-drop-none") { values.iter().filter(|item| item.is_some()).count() }
        else { values.len() };
    Ok(BigUint::from(count))
}
pub fn echo_groups(arg0: &[GroupItem]) -> Result<Vec<GroupItem>, Error> {
    let mut values = accepted_groups(arg0, Site::Normalize)?;
    if fault("echo-groups-drops-none") { values.retain(Option::is_some); }
    Ok(values)
}
pub fn produce(arg0: &BigUint) -> Result<Record, Error> {
    ensure_ready()?;
    Ok(produced(arg0))
}
