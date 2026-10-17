// Independent public recursive checked-record caller. Generated source is not an oracle.
use checkedrecords as api;
use api::{BigUint, Error};

#[cfg(not(feature = "mutual"))]
use api::Packet as Record;
#[cfg(feature = "mutual")]
use api::Envelope as Record;
#[cfg(not(feature = "mutual"))]
type GroupItem = Option<Box<Record>>;
#[cfg(feature = "mutual")]
type GroupItem = Option<Record>;

#[derive(Default)]
struct Counts {
    checks: usize,
    rejections: usize,
    limit_rejections: usize,
    recoveries: usize,
    snapshots: usize,
    snapshot_controls: usize,
}

impl Counts {
    fn check(&mut self, condition: bool, label: &str) {
        assert!(condition, "failed: {label}");
        self.checks += 1;
    }

    fn unchanged<T: PartialEq>(&mut self, value: &T, before: &T) {
        self.snapshots += 1;
        self.check(value == before, "complete caller input unchanged");
    }

    fn call<I, O>(&mut self, input: &I, invoke: impl FnOnce(&I) -> Result<O, Error>, expected: O) -> O
    where
        I: Clone + PartialEq,
        O: PartialEq + std::fmt::Debug,
    {
        let before = input.clone();
        let output = invoke(input).unwrap_or_else(|error| {
            panic!("failed: valid public call refused: {error:?}")
        });
        self.check(output == expected, "exact independent result");
        self.unchanged(input, &before);
        output
    }

    fn refuse<I, O>(&mut self, input: &I, invoke: impl FnOnce(&I) -> Result<O, Error>, expected: &str)
    where
        I: Clone + PartialEq,
    {
        let before = input.clone();
        match invoke(input) {
            Err(Error::Native { code, message }) => self.check(
                code == 1 && message == expected,
                &format!("exact refusal: expected {expected}, got {code} {message}"),
            ),
            Err(error) => panic!("failed: wrong refusal: {error:?}"),
            Ok(_) => panic!("failed: accepted invalid input: {expected}"),
        }
        self.unchanged(input, &before);
        self.rejections += 1;
    }

    fn refuse_limit<I, O>(&mut self, input: &I, invoke: impl FnOnce(&I) -> Result<O, Error>)
    where
        I: Clone + PartialEq,
    {
        let before = input.clone();
        match invoke(input) {
            Err(Error::Limit) => self.check(true, "bounded recursive traversal"),
            Err(error) => panic!("failed: wrong depth refusal: {error:?}"),
            Ok(_) => panic!("failed: accepted over-depth recursive input"),
        }
        self.unchanged(input, &before);
        self.limit_rejections += 1;
    }

    fn distinct<T: PartialEq>(&mut self, left: T, right: T) {
        self.check(left != right, "independent snapshot mutation control");
        self.snapshot_controls += 1;
    }
}

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn huge() -> BigUint { n(1) << 100usize }

#[cfg(not(feature = "mutual"))]
fn record(value: BigUint, digit: u64, child: Option<Record>) -> Record {
    api::Packet { value, digit: n(digit), tail: child.map(Box::new) }
}

#[cfg(feature = "mutual")]
fn record(value: BigUint, digit: u64, child: Option<Record>) -> Record {
    api::Envelope {
        value,
        mode: n(digit),
        next: child.map(|packet| Box::new(api::Step::More { packet: Box::new(packet) })),
    }
}

fn node(value: u64, digit: u64, child: Option<Record>) -> Record {
    record(n(value), digit, child)
}

fn chain(values: &[(u64, u64)]) -> Record {
    let mut result = None;
    for &(value, digit) in values.iter().rev() {
        result = Some(node(value, digit, result));
    }
    result.expect("nonempty independent chain")
}

fn repeated_chain(count: usize) -> Record {
    let mut result = None;
    for index in (0..count).rev() {
        result = Some(node((index % 80) as u64 + 1, (index % 3) as u64, result));
    }
    result.expect("nonempty independent chain")
}

#[cfg(feature = "mutual")]
fn stop(value: u64, digit: u64) -> Record {
    api::Envelope { value: n(value), mode: n(digit), next: Some(Box::new(api::Step::Stop)) }
}

#[cfg(not(feature = "mutual"))]
fn group(value: Record) -> GroupItem { Some(Box::new(value)) }
#[cfg(feature = "mutual")]
fn group(value: Record) -> GroupItem { Some(value) }

#[cfg(not(feature = "mutual"))]
fn normalized(value: &Record, plus: u64) -> Record {
    record(
        if plus == 2 { &value.digit + n(1) } else { &value.value + n(plus) },
        value.digit.to_u64_digits().first().copied().unwrap_or(0),
        value.tail.as_deref().map(|child| normalized(child, plus)),
    )
}

#[cfg(feature = "mutual")]
fn normalized(value: &Record, plus: u64) -> Record {
    let next = match value.next.as_deref() {
        None => None,
        Some(api::Step::Stop) => Some(Box::new(api::Step::Stop)),
        Some(api::Step::More { packet }) => Some(Box::new(api::Step::More {
            packet: Box::new(normalized(packet, plus)),
        })),
    };
    api::Envelope { value: &value.value + n(plus), mode: value.mode.clone(), next }
}

#[cfg(not(feature = "mutual"))]
fn normalized_group(value: &GroupItem, plus: u64) -> GroupItem {
    value.as_deref().map(|item| Box::new(normalized(item, plus)))
}
#[cfg(feature = "mutual")]
fn normalized_group(value: &GroupItem, plus: u64) -> GroupItem {
    value.as_ref().map(|item| normalized(item, plus))
}

fn produced(value: &BigUint) -> Record {
    record(value + n(1), 1, Some(record(value + n(2), 2, None)))
}

fn module_name() -> &'static str {
    if cfg!(feature = "mutual") { "mutual" } else { "recursive" }
}

fn lean_name() -> &'static str {
    if cfg!(feature = "mutual") { "MutualCheckedRecords" } else { "RecursiveCheckedRecords" }
}

fn make_name() -> &'static str {
    if cfg!(feature = "mutual") { "mkEnvelope" } else { "mkPacket" }
}

fn link_path() -> &'static str {
    if cfg!(feature = "mutual") { ".next?.more.packet" } else { ".tail?" }
}

fn bound_name() -> &'static str { if cfg!(feature = "mutual") { "mode" } else { "digit" } }

fn rejected(path: &str, constructor: &str) -> String {
    format!("arg0{path} was rejected by {}.{constructor}", lean_name())
}

fn fin(path: &str) -> String {
    format!("arg0{path}.{} is not below its Fin 3 bound", bound_name())
}

fn main() {
    let mut c = Counts::default();
    c.check(matches!(if cfg!(feature = "reviewed") { "reviewed" } else { "ordinary" },
        "ordinary" | "reviewed"), "closed source route");

    // Transparent aliases retain the exact public record identity.
    #[cfg(not(feature = "mutual"))]
    { let _: api::PacketAlias = node(1, 0, None); }
    #[cfg(feature = "mutual")]
    { let _: api::EnvelopeAlias = node(1, 0, None); }
    c.check(true, "transparent alias identity");

    c.distinct(node(1, 0, None), node(2, 0, None));
    c.distinct(node(1, 0, None), node(1, 1, None));
    c.distinct(node(1, 0, Some(node(2, 0, None))), node(1, 0, None));
    c.distinct(None::<GroupItem>, Some(group(node(1, 0, None))));
    c.distinct(n(0), huge());
    #[cfg(feature = "mutual")]
    c.distinct(stop(1, 0), node(1, 0, None));

    // Constructor-free results keep arbitrary precision and independent ownership.
    for value in [n(0), n(5)].into_iter().chain((0..64u64).map(|round| huge() + n(round))) {
        let mut output = c.call(&value, api::produce, produced(&value));
        #[cfg(not(feature = "mutual"))]
        if let Some(child) = output.tail.as_deref_mut() { child.value = n(0); }
        #[cfg(feature = "mutual")]
        if let Some(api::Step::More { packet }) = output.next.as_deref_mut() { packet.value = n(0); }
        c.check(output != produced(&value), "returned recursive nodes own mutable storage");
    }

    let root = chain(&[(40, 2), (80, 1)]);
    c.call(&root, api::first, n(41));
    c.call(&node(0, 1, None), api::first, n(1));
    c.call(&chain(&[(99, 2), (0, 0), (7, 1)]), api::first, n(100));
    c.call(&root, api::second, if cfg!(feature = "mutual") { n(42) } else { n(3) });
    c.call(&chain(&[(89, 2), (0, 1)]), api::second,
        if cfg!(feature = "mutual") { n(91) } else { n(3) });
    let mut echoed = c.call(&root, api::echo, normalized(&root, 1));
    #[cfg(not(feature = "mutual"))]
    { echoed.value = n(0); }
    #[cfg(feature = "mutual")]
    { echoed.value = n(0); }
    c.check(root.value == n(40), "echo result owns independent storage");

    let deep = repeated_chain(40);
    c.call(&deep, api::first, n(2));
    c.call(&deep, api::echo, normalized(&deep, 1));
    c.call(&deep, api::second, if cfg!(feature = "mutual") { n(3) } else { n(1) });

    let groups = vec![group(node(5, 1, None)), None, group(node(5, 1, None))];
    c.call(&groups, |values| api::groups(values), n(3));
    c.call(&Vec::<GroupItem>::new(), |values| api::groups(values), n(0));
    let echoed_groups = vec![group(root.clone()), None, group(node(5, 1, None))];
    let expected_groups = echoed_groups.iter().map(|item| normalized_group(item, 2)).collect();
    c.call(&echoed_groups, |values| api::echo_groups(values), expected_groups);
    c.call(&Vec::<GroupItem>::new(), |values| api::echo_groups(values), vec![]);

    #[cfg(feature = "mutual")]
    {
        c.call(&stop(40, 2), api::first, n(41));
        c.call(&stop(40, 2), api::echo, normalized(&stop(40, 2), 1));
        c.call(&node(1, 0, Some(stop(2, 1))), api::second, n(3));
    }

    // Exact late-field, constructor and active-branch diagnostics.
    c.refuse(&node(100, 0, None), api::first, &rejected(".value", "plusOne"));
    c.refuse(&record(n(1) << 100usize, 0, None), api::first, &rejected(".value", "plusOne"));
    c.refuse(&chain(&[(40, 2), (100, 1)]), api::first,
        &rejected(&(link_path().to_owned() + ".value"), "plusOne"));
    c.refuse(&chain(&[(40, 2), (40, 2), (100, 1)]), api::first,
        &rejected(&(link_path().repeat(2) + ".value"), "plusOne"));
    c.refuse(&node(40, 3, None), api::first, &fin(""));
    c.refuse(&chain(&[(40, 2), (80, 3)]), api::first, &fin(link_path()));
    c.refuse(&node(0, 2, None), api::first, &rejected("", make_name()));
    c.refuse(&chain(&[(40, 2), (0, 2)]), api::first, &rejected(link_path(), make_name()));
    c.refuse(&chain(&[(40, 2), (0, 2)]), api::echo, &rejected(link_path(), make_name()));
    c.refuse(&node(90, 0, None), api::second, &rejected(".value", "plusTwo"));
    c.refuse(&chain(&[(1, 0), (90, 0)]), api::second,
        &rejected(&(link_path().to_owned() + ".value"), "plusTwo"));
    c.refuse(&vec![None, group(node(100, 0, None))], |values| api::groups(values),
        &rejected("[1]?.value", "plusOne"));
    c.refuse(&vec![group(root.clone()), group(node(0, 2, None))], |values| api::groups(values),
        &rejected("[1]?", make_name()));
    c.refuse(&vec![group(node(1, 3, None))], |values| api::groups(values), &fin("[0]?"));
    c.refuse(&vec![group(node(90, 0, None))], |values| api::echo_groups(values),
        &rejected("[0]?.value", "plusTwo"));
    c.refuse(&vec![None, group(chain(&[(1, 0), (95, 1)]))], |values| api::echo_groups(values),
        &rejected(&("[1]?".to_owned() + link_path() + ".value"), "plusTwo"));

    // Safe Rust represents these recursive carriers as finite owned trees. Excessive
    // but acyclic depth is therefore the runtime host-shape refusal to exercise.
    let over_depth = repeated_chain(140);
    c.refuse_limit(&over_depth, api::first);
    c.call(&node(1, 0, None), api::first, n(2));

    // Every refusal is followed by valid calls to prove recovery and immutable inputs.
    for round in 0..64u64 {
        let value = round % 80;
        c.call(&chain(&[(value, value % 3), (99 - value, 0)]), api::first, n(value + 1));
        c.refuse(&chain(&[(value, value % 3), (100 + round, 0)]), api::first,
            &rejected(&(link_path().to_owned() + ".value"), "plusOne"));
        c.call(&node(value, round % 3, None), api::second,
            if cfg!(feature = "mutual") { n(value + 2) } else { n(round % 3 + 1) });
        c.refuse(&vec![group(node(value, 0, None)), group(node(0, 2, None))],
            |values| api::groups(values), &rejected("[1]?", make_name()));
        let repeated = vec![group(node(value, 0, None)); (round % 4) as usize];
        c.call(&repeated, |values| api::groups(values), n(round % 4));
        c.recoveries += 1;
    }

    println!(
        "{{\"checks\":{},\"limitRejections\":{},\"module\":\"{}\",\"recoveries\":{},\"rejections\":{},\"rounds\":64,\"snapshotControls\":{},\"snapshots\":{}}}",
        c.checks, c.limit_rejections, module_name(), c.recoveries, c.rejections,
        c.snapshot_controls, c.snapshots,
    );
}
