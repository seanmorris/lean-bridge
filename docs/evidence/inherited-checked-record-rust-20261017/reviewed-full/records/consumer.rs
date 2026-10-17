// Independent public inherited checked-record caller. Generated equality is not an oracle.
use inheritedcheckedrecords as api;
use api::{BigUint, Error, Span, Stamped, Ticket};

#[derive(Debug, PartialEq, Eq)]
enum Value {
    Nat(Vec<u32>),
    Node(&'static str, Vec<Value>),
}

trait Snapshot { fn snapshot(&self) -> Value; }
impl Snapshot for BigUint { fn snapshot(&self) -> Value { Value::Nat(self.to_u32_digits()) } }
impl<T: Snapshot + ?Sized> Snapshot for &T { fn snapshot(&self) -> Value { T::snapshot(*self) } }
impl<A: Snapshot, B: Snapshot> Snapshot for (A, B) {
    fn snapshot(&self) -> Value {
        Value::Node("Tuple", vec![self.0.snapshot(), self.1.snapshot()])
    }
}
impl Snapshot for Span {
    fn snapshot(&self) -> Value {
        let Span { lo, hi } = self;
        Value::Node("Span", vec![lo.snapshot(), hi.snapshot()])
    }
}
impl Snapshot for Ticket {
    fn snapshot(&self) -> Value {
        let Ticket { to_span, word } = self;
        Value::Node("Ticket", vec![to_span.snapshot(), word.snapshot()])
    }
}
impl Snapshot for Stamped {
    fn snapshot(&self) -> Value {
        let Stamped { to_ticket, mark } = self;
        Value::Node("Stamped", vec![to_ticket.snapshot(), mark.snapshot()])
    }
}

#[derive(Default)]
struct Counts {
    checks: usize,
    rejections: usize,
    recoveries: usize,
    snapshots: usize,
    snapshot_controls: usize,
}
impl Counts {
    fn check(&mut self, condition: bool, label: &str) {
        assert!(condition, "failed: {label}");
        self.checks += 1;
    }
    fn unchanged(&mut self, same: bool) {
        self.snapshots += 1;
        self.check(same, "complete caller inputs unchanged");
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
            Err(Error::Native { code, message }) => self.check(
                code == 1 && message == expected,
                &format!("exact refusal: expected {expected}, got {code} {message}"),
            ),
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
fn span(lo: u64, hi: u64) -> Span { Span { lo: n(lo), hi: n(hi) } }
fn ticket(lo: u64, hi: u64, word: u64) -> Ticket {
    Ticket { to_span: span(lo, hi), word: n(word) }
}
fn ticket_big(value: &BigUint, offset: u64) -> Ticket {
    Ticket {
        to_span: Span { lo: value.clone(), hi: value.clone() },
        word: value + n(offset),
    }
}
fn stamped(lo: u64, hi: u64, word: u64, mark: u64) -> Stamped {
    Stamped { to_ticket: ticket(lo, hi, word), mark: n(mark) }
}
fn stamped_big(value: &BigUint) -> Stamped {
    Stamped { to_ticket: ticket_big(value, 1), mark: n(0) }
}

#[cfg(not(feature = "result-only"))]
fn prefix() -> &'static str { if cfg!(feature = "reviewed") { "value" } else { "arg" } }
#[cfg(not(feature = "result-only"))]
fn rejected(path: &str, constructor: &str) -> String {
    format!("{}{path} was rejected by InheritedCheckedRecords.{constructor}", prefix())
}
#[cfg(not(feature = "result-only"))]
fn fin(path: &str) -> String {
    format!("{}{path}.mark is not below its Fin 8 bound", prefix())
}

fn main() {
    let mut c = Counts::default();
    c.distinct(ticket(0, 0, 1), ticket(0, 0, 2));
    c.distinct(ticket(0, 0, 1), ticket(0, 1, 1));
    c.distinct(stamped(0, 0, 1, 0), stamped(0, 0, 1, 1));
    c.distinct(n(0), huge());
    c.distinct(span(0, 1), ticket(0, 1, 1));
    c.distinct(ticket(0, 1, 1), stamped(0, 1, 1, 0));
    #[cfg(not(feature = "result-only"))]
    {
        c.distinct(ticket(1, 2, 3), ticket(2, 2, 3));
        c.distinct(stamped(1, 2, 3, 0), stamped(1, 2, 3, 7));
    }

    let zero = n(0);
    c.call(&zero, api::produce, ticket(0, 0, 1));
    c.call(&zero, api::produce_stamped, stamped(0, 0, 1, 0));
    for round in 0..256u64 {
        let value = huge() + n(round);
        let mut produced = c.call(&value, api::produce, ticket_big(&value, 1));
        produced.word = n(0);
        c.check(produced.to_span.lo == value, "returned ticket fields own independent storage");
        let mut marked = c.call(&value, api::produce_stamped, stamped_big(&value));
        marked.to_ticket.to_span.lo = n(0);
        c.check(marked.to_ticket.to_span.hi == value,
            "returned inherited fields own independent storage");
    }
    #[cfg(not(feature = "result-only"))]
    full(&mut c);
    println!(
        "{{\"checks\":{},\"rejections\":{},\"recoveries\":{},\"snapshots\":{},\"snapshotControls\":{},\"rounds\":256}}",
        c.checks, c.rejections, c.recoveries, c.snapshots, c.snapshot_controls,
    );
}

#[cfg(not(feature = "result-only"))]
fn full(c: &mut Counts) {
    c.call(&ticket(2, 3, 4), api::first, n(9));
    c.call(&ticket(4, 1, 0), api::normalized, n(11));
    c.call(&(ticket(2, 3, 4), ticket(4, 1, 999)),
        |v| api::pair(&v.0, &v.1), n(10));
    c.call(&ticket(4, 1, 4), api::aliased, n(5));
    c.call(&stamped(1, 2, 4, 3), api::nested, n(7));
    c.call(&ticket(1, 2, 0), api::echo, ticket(1, 2, 3));

    c.refuse(&ticket(4, 1, 5), api::first, &rejected("0.toSpan", "mkSpan"));
    c.refuse(&ticket(1, 2, 0), api::first, &rejected("0.word", "mkWord"));
    c.refuse(&ticket(1, 5, 3), api::first, &rejected("0", "mkTicket"));
    c.refuse(&stamped(1, 2, 9, 8), api::nested, &fin("0"));
    c.refuse(&stamped(1, 2, 4, 5), api::nested, &rejected("0", "mkStamped"));
    c.refuse(&ticket(1, 5, 3), api::aliased, &rejected("0", "mkTicket"));

    for round in 0..256u64 {
        let value = round + 10;
        let valid = ticket(value, value + 1, value + 2);
        c.call(&valid, api::first, n(3 * value + 3));
        c.call(&ticket(value + 2, value, 0), api::normalized, n(4 * value + 5));
        c.call(&(valid.clone(), ticket(value + 2, value, 0)),
            |v| api::pair(&v.0, &v.1), n(3 * value + 5));
        c.call(&ticket(value + 2, value, 2 * value + 1), api::aliased,
            n(2 * value + 2));
        let mark = round % 8;
        c.call(&stamped(mark, mark, mark + 1, mark), api::nested, n(2 * mark + 1));

        c.refuse(&ticket(value + 1, value, value + 2), api::first,
            &rejected("0.toSpan", "mkSpan"));
        c.refuse(&ticket(0, 1, 0), api::first, &rejected("0.word", "mkWord"));
        c.refuse(&ticket(0, value + 2, value + 1), api::first,
            &rejected("0", "mkTicket"));
        c.refuse(&stamped(0, 9, 9, 8), api::nested, &fin("0"));
        c.refuse(&stamped(0, 6, 6, 7), api::nested, &rejected("0", "mkStamped"));
        c.call(&valid, api::first, n(3 * value + 3));
        c.recoveries += 1;
    }
}
