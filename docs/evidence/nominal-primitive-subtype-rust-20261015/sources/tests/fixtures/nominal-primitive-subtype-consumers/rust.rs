// Independent public caller. Generated equality and serialization are not oracles.
use nominalprimitivesubtypes as api;
use api::{BigInt, BigUint, Error};

#[derive(Debug, PartialEq, Eq)]
enum Value {
    Unit,
    Bool(bool),
    Fixed(&'static str, Vec<u8>),
    Nat(Vec<u32>),
    Int(Vec<u8>),
    Text(Vec<u8>),
    Node(&'static str, Vec<Value>),
}

trait Snapshot { fn snapshot(&self) -> Value; }
impl Snapshot for () { fn snapshot(&self) -> Value { Value::Unit } }
impl Snapshot for bool { fn snapshot(&self) -> Value { Value::Bool(*self) } }
macro_rules! fixed_snapshot {
    ($($kind:ty),+) => { $(impl Snapshot for $kind {
        fn snapshot(&self) -> Value { Value::Fixed(stringify!($kind), self.to_le_bytes().to_vec()) }
    })+ };
}
fixed_snapshot!(u8, u16, u32, u64, i8, i16, i32, i64, usize, isize);
impl Snapshot for f32 { fn snapshot(&self) -> Value { Value::Fixed("f32", self.to_bits().to_le_bytes().to_vec()) } }
impl Snapshot for f64 { fn snapshot(&self) -> Value { Value::Fixed("f64", self.to_bits().to_le_bytes().to_vec()) } }
impl Snapshot for char { fn snapshot(&self) -> Value { Value::Fixed("char", (*self as u32).to_le_bytes().to_vec()) } }
impl Snapshot for BigUint { fn snapshot(&self) -> Value { Value::Nat(self.to_u32_digits()) } }
impl Snapshot for BigInt { fn snapshot(&self) -> Value { Value::Int(self.to_signed_bytes_le()) } }
impl Snapshot for String { fn snapshot(&self) -> Value { Value::Text(self.as_bytes().to_vec()) } }
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
macro_rules! packet_snapshot {
    ($kind:ident) => { impl Snapshot for api::$kind {
        fn snapshot(&self) -> Value {
            let api::$kind { unit_value, bool_value, uint8_value, uint16_value, uint32_value, uint64_value,
                int8_value, int16_value, int32_value, int64_value, nat_value, int_value, float32_value,
                float64_value, text_value, bytes_value, char_value, usize_value, isize_value, digit } = self;
            Value::Node(stringify!($kind), vec![unit_value.snapshot(), bool_value.snapshot(),
                uint8_value.snapshot(), uint16_value.snapshot(), uint32_value.snapshot(), uint64_value.snapshot(),
                int8_value.snapshot(), int16_value.snapshot(), int32_value.snapshot(), int64_value.snapshot(),
                nat_value.snapshot(), int_value.snapshot(), float32_value.snapshot(), float64_value.snapshot(),
                text_value.snapshot(), bytes_value.snapshot(), char_value.snapshot(), usize_value.snapshot(),
                isize_value.snapshot(), digit.snapshot()])
        }
    } };
}
packet_snapshot!(Packet);
packet_snapshot!(RawPacket);
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
struct Counts { checks: usize, rejections: usize, snapshot_controls: usize }
impl Counts {
    fn check(&mut self, condition: bool, label: &str) {
        assert!(condition, "failed: {label}"); self.checks += 1;
    }
    fn call<I: Snapshot + ?Sized, O: Snapshot>(&mut self, input: &I,
        invoke: impl FnOnce(&I) -> Result<O, Error>, expected: O) -> O {
        let before = input.snapshot();
        let output = invoke(input).expect("valid public call");
        self.check(output.snapshot() == expected.snapshot(), "exact independent result");
        self.check(input.snapshot() == before, "complete accepted inputs unchanged");
        output
    }
    #[cfg(not(feature = "result-only"))]
    fn refuse<I: Snapshot + ?Sized, O>(&mut self, input: &I,
        invoke: impl FnOnce(&I) -> Result<O, Error>, expected: &str) {
        let before = input.snapshot();
        match invoke(input) {
            Err(Error::Native { code, message }) => self.check(code == 1 && message == expected,
                &format!("exact refusal: expected {expected}, got {message}")),
            Err(error) => panic!("wrong refusal: {error:?}"),
            Ok(_) => panic!("accepted invalid input: {expected}"),
        }
        self.check(input.snapshot() == before, "complete refused inputs unchanged");
        self.rejections += 1;
    }
    fn distinct<A: Snapshot, B: Snapshot>(&mut self, left: A, right: B) {
        self.check(left.snapshot() != right.snapshot(), "independent snapshot mutation control");
        self.snapshot_controls += 1;
    }
}

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn huge() -> BigUint { n(1) << 100usize }
fn packet() -> api::Packet {
    api::Packet { unit_value: (), bool_value: true,
        uint8_value: 42, uint16_value: 42, uint32_value: 42, uint64_value: 42,
        int8_value: -42, int16_value: -42, int32_value: -42, int64_value: -42,
        nat_value: n(42), int_value: BigInt::from(-42), float32_value: 1.5, float64_value: 1.5,
        text_value: "a".into(), bytes_value: vec![0, 128, 255], char_value: 'a',
        usize_value: 42, isize_value: -42, digit: n(2) }
}
fn raw(value: api::Packet) -> api::RawPacket {
    let api::Packet { unit_value, bool_value, uint8_value, uint16_value, uint32_value, uint64_value,
        int8_value, int16_value, int32_value, int64_value, nat_value, int_value, float32_value,
        float64_value, text_value, bytes_value, char_value, usize_value, isize_value, digit } = value;
    api::RawPacket { unit_value, bool_value, uint8_value, uint16_value, uint32_value, uint64_value,
        int8_value, int16_value, int32_value, int64_value, nat_value, int_value, float32_value,
        float64_value, text_value, bytes_value, char_value, usize_value, isize_value, digit }
}
fn produced() -> api::Packet {
    api::Packet { uint8_value: 200, uint16_value: 200, uint32_value: 200, uint64_value: 200,
        int8_value: 120, int16_value: 120, int32_value: 120, int64_value: 120,
        nat_value: huge(), int_value: -BigInt::from(huge()), float32_value: 12.5, float64_value: 12.5,
        text_value: "long λ text".into(), bytes_value: vec![0, 1, 2, 3, 4, 5, 128, 254, 255],
        char_value: 'λ', usize_value: 200, isize_value: 200, ..packet() }
}
#[cfg(not(feature = "result-only"))]
fn normalized() -> api::Packet {
    api::Packet { uint8_value: 44, uint16_value: 44, uint32_value: 44, uint64_value: 44,
        int8_value: -40, int16_value: -40, int32_value: -40, int64_value: -40,
        nat_value: n(44), int_value: BigInt::from(-40), float32_value: -1.5, float64_value: -1.5,
        text_value: "a!".into(), bytes_value: vec![0, 128, 255, 255], char_value: 'b',
        usize_value: 44, isize_value: -40, ..packet() }
}
fn bad_values() -> Vec<(&'static str, &'static str, api::Packet)> {
    let mut values = vec![];
    macro_rules! bad {
        ($field:ident, $label:literal, $constructor:literal, $value:expr) => {
            values.push(($label, $constructor, api::Packet { $field: $value, ..packet() }));
        };
    }
    bad!(bool_value, "boolValue", "boolA", false);
    bad!(uint8_value, "uint8Value", "uint8A", 43);
    bad!(uint16_value, "uint16Value", "uint16A", 43);
    bad!(uint32_value, "uint32Value", "uint32A", 43);
    bad!(uint64_value, "uint64Value", "uint64A", 43);
    bad!(int8_value, "int8Value", "int8A", -43);
    bad!(int16_value, "int16Value", "int16A", -43);
    bad!(int32_value, "int32Value", "int32A", -43);
    bad!(int64_value, "int64Value", "int64A", -43);
    bad!(nat_value, "natValue", "natA", n(43));
    bad!(int_value, "intValue", "intA", BigInt::from(-43));
    bad!(float32_value, "float32Value", "float32A", f32::INFINITY);
    bad!(float64_value, "float64Value", "float64A", f64::INFINITY);
    bad!(text_value, "textValue", "textA", String::new());
    bad!(bytes_value, "bytesValue", "bytesA", vec![]);
    bad!(char_value, "charValue", "charA", '\0');
    bad!(usize_value, "usizeValue", "usizeA", 43);
    bad!(isize_value, "isizeValue", "isizeA", -43);
    bad!(digit, "digit", "", n(3));
    values
}

#[cfg(not(feature = "result-only"))]
fn prefix() -> &'static str { if cfg!(feature = "reviewed") { "value" } else { "arg" } }
#[cfg(not(feature = "result-only"))]
fn subtype(path: &str, constructor: &str) -> String {
    format!("{path} was rejected by NominalPrimitiveSubtypes.{constructor}")
}
#[cfg(not(feature = "result-only"))]
fn fin(path: &str) -> String { format!("{path} is not below its Fin 3 bound") }

fn main() {
    let mut c = Counts::default();
    c.check(usize::BITS == 64 && isize::BITS == 64, "native machine-word width");
    c.call(&(), |_| api::word_bits(), 64u32);
    for (_, _, changed) in bad_values() { c.distinct(packet(), changed); }
    c.distinct((), None::<()>); c.distinct(None::<()>, Some(()));
    c.distinct(0u8, 0u16); c.distinct(n(0), BigInt::from(0));
    c.distinct(0.0f32, -0.0f32); c.distinct(0.0f64, -0.0f64);
    c.distinct("a\0λ😀".to_string(), "aλ😀".to_string());
    c.distinct(packet(), raw(packet()));
    c.distinct(vec![None, Some(packet())], vec![Some(packet()), None]);
    c.distinct(Ok::<_, api::Packet>(packet()), Err::<api::Packet, _>(packet()));
    c.distinct(api::Event::Box { value: packet() }, api::Event::Choices { values: vec![Some(Ok(packet()))] });
    let out = produced();
    c.call(&raw(produced()), api::produce, Some(out.clone()));
    c.call(&raw(produced()), api::produce_group, vec![None, Some(out.clone())]);
    c.call(&raw(produced()), api::produce_pair, api::Pair {
        left: vec![None, Some(out.clone())], right: vec![None, Some(out.clone())] });
    c.call(&raw(produced()), api::produce_event, api::Event::Box { value: out.clone() });
    c.call(&raw(produced()), api::produce_choices, api::Event::Choices {
        values: vec![None, Some(Ok(out.clone())), Some(Err(out))] });
    for (_field, _constructor, changed) in bad_values() {
        c.call(&raw(changed.clone()), api::produce, None);
        #[cfg(not(feature = "result-only"))]
        c.refuse(&changed, api::echo_a, &if _field == "digit" { fin(&format!("{}0.digit", prefix())) }
            else { subtype(&format!("{}0.{_field}", prefix()), _constructor) });
    }
    let absent = raw(api::Packet { nat_value: n(43), ..packet() });
    c.call(&absent, api::produce_group, vec![None]);
    c.call(&absent, api::produce_pair, api::Pair { left: vec![None], right: vec![None] });
    c.call(&absent, api::produce_event, api::Event::Empty);
    c.call(&absent, api::produce_choices, api::Event::Choices { values: vec![None] });
    #[cfg(feature = "result-only")]
    for round in 0..256u64 {
        let item = api::Packet { nat_value: huge() + n(round * 2), ..produced() };
        c.call(&raw(item.clone()), api::produce, Some(item));
    }
    #[cfg(not(feature = "result-only"))]
    full(&mut c);
    println!("{{\"checks\":{},\"rejections\":{},\"snapshotControls\":{},\"rounds\":256,\"wordBits\":64}}",
        c.checks, c.rejections, c.snapshot_controls);
}

#[cfg(not(feature = "result-only"))]
fn full(c: &mut Counts) {
    let a = packet(); let b = api::Packet { bool_value: false, ..packet() }; let n = normalized();
    let mut returned = c.call(&a, api::echo_a, a.clone());
    returned.text_value.push('x'); returned.bytes_value[0] = 17;
    c.check(a.snapshot() == packet().snapshot(), "returned mutable buffers own independent storage");
    c.call(&b, api::echo_b, n.clone());
    macro_rules! strict_constructor {
        ($field:ident, $value:expr, $diagnostic:literal, $constructor:literal) => {{
            let input = api::Packet { $field: $value, ..a.clone() };
            c.call(&raw(input.clone()), api::produce, Some(input.clone()));
            c.refuse(&input, api::echo_a, &subtype(&format!("{}0.{}", prefix(), $diagnostic), $constructor));
        }};
    }
    strict_constructor!(uint8_value, 100, "uint8Value", "uint8A");
    strict_constructor!(uint16_value, 100, "uint16Value", "uint16A");
    strict_constructor!(uint32_value, 100, "uint32Value", "uint32A");
    strict_constructor!(uint64_value, 100, "uint64Value", "uint64A");
    strict_constructor!(int8_value, 100, "int8Value", "int8A");
    strict_constructor!(int16_value, 100, "int16Value", "int16A");
    strict_constructor!(int32_value, 100, "int32Value", "int32A");
    strict_constructor!(int64_value, 100, "int64Value", "int64A");
    strict_constructor!(nat_value, BigUint::from(100u8), "natValue", "natA");
    strict_constructor!(int_value, BigInt::from(100u8), "intValue", "intA");
    strict_constructor!(float32_value, 12.5, "float32Value", "float32A");
    strict_constructor!(float64_value, 12.5, "float64Value", "float64A");
    strict_constructor!(text_value, "long λ text".into(), "textValue", "textA");
    strict_constructor!(bytes_value, (0u8..8).collect(), "bytesValue", "bytesA");
    strict_constructor!(char_value, 'λ', "charValue", "charA");
    strict_constructor!(usize_value, 100, "usizeValue", "usizeA");
    strict_constructor!(isize_value, 100, "isizeValue", "isizeA");
    c.refuse(&a, api::refuse_unit, &subtype(&format!("{}0.unitValue", prefix()), "unitReject"));
    c.call(&(&a, &b), |v| api::combine(v.0, v.1), (a.clone(), n.clone()));
    c.call(&api::Pair { left: vec![None, Some(a.clone())], right: vec![Some(b.clone())] }, api::echo_pair,
        api::Pair { left: vec![None, Some(a.clone())], right: vec![Some(n.clone())] });
    c.call(&(vec![None, Some(a.clone())], vec![Some(b.clone()), None]), |v| api::aliases(&v.0, &v.1),
        vec![None, Some(a.clone()), Some(n.clone()), None]);
    c.call(&api::Event::Empty, api::echo_event_a, api::Event::Empty);
    c.call(&api::Event::Empty, api::echo_event_b, api::Event::Empty);
    c.call(&api::Event::Box { value: a.clone() }, api::echo_event_a, api::Event::Box { value: a.clone() });
    c.call(&api::Event::Box { value: b.clone() }, api::echo_event_b, api::Event::Box { value: n.clone() });
    c.call(&api::Event::Choices { values: vec![None, Some(Ok(a.clone())), Some(Err(b.clone()))] }, api::echo_event_a,
        api::Event::Choices { values: vec![None, Some(Ok(a.clone())), Some(Err(n.clone()))] });
    c.call(&api::Event::Choices { values: vec![None, Some(Ok(b.clone())), Some(Err(a.clone()))] }, api::echo_event_b,
        api::Event::Choices { values: vec![None, Some(Ok(n.clone())), Some(Err(a.clone()))] });
    for second in [false, true] {
        let echo: fn(&api::Event) -> Result<api::Event, Error> = if second { api::echo_event_b } else { api::echo_event_a };
        let (first_input, last_input, first_output, last_output) = if second { (&b, &a, &n, &a) } else { (&a, &b, &a, &n) };
        c.refuse(&api::Event::Box { value: api::Packet { nat_value: BigUint::from(43u8), ..first_input.clone() } }, echo,
            &subtype(&format!("{}0.box.value.natValue", prefix()), if second { "natB" } else { "natA" }));
        c.call(&api::Event::Box { value: first_input.clone() }, echo, api::Event::Box { value: first_output.clone() });
        for branch in [false, true] {
            let mut values = vec![None, Some(Ok(first_input.clone())), Some(Err(last_input.clone()))];
            let selected = if branch { last_input } else { first_input };
            let bad = api::Packet { nat_value: BigUint::from(43u8), ..selected.clone() };
            let position = if branch { 2 } else { 1 };
            values[position] = Some(if branch { Err(bad) } else { Ok(bad) });
            c.refuse(&api::Event::Choices { values }, echo,
                &subtype(&format!("{}0.choices.values[{position}]?.{}.natValue", prefix(), if branch { "error" } else { "ok" }),
                    if second != branch { "natB" } else { "natA" }));
            c.call(&api::Event::Choices { values: vec![None, Some(Ok(first_input.clone())), Some(Err(last_input.clone()))] }, echo,
                api::Event::Choices { values: vec![None, Some(Ok(first_output.clone())), Some(Err(last_output.clone()))] });
        }
    }
    macro_rules! edge {
        ($field:ident, $input:expr, $output:expr) => {
            c.call(&api::Packet { $field: $input, ..b.clone() }, api::echo_b,
                api::Packet { $field: $output, ..n.clone() });
        };
    }
    edge!(uint8_value, u8::MAX - 1, 0); edge!(uint16_value, u16::MAX - 1, 0);
    edge!(uint32_value, u32::MAX - 1, 0); edge!(uint64_value, u64::MAX - 1, 0);
    edge!(int8_value, i8::MAX - 1, i8::MIN); edge!(int16_value, i16::MAX - 1, i16::MIN);
    edge!(int32_value, i32::MAX - 1, i32::MIN); edge!(int64_value, i64::MAX - 1, i64::MIN);
    edge!(usize_value, u64::MAX - 1, 0); edge!(isize_value, i64::MAX - 1, i64::MIN);
    edge!(nat_value, huge(), huge() + BigUint::from(2u8));
    edge!(int_value, -BigInt::from(huge()), -BigInt::from(huge()) + 2);
    edge!(float32_value, 0.0, -0.0); edge!(float64_value, 0.0, -0.0);
    edge!(float32_value, -0.0, 0.0); edge!(float64_value, -0.0, 0.0);
    edge!(text_value, "a\0λ😀".into(), "a\0λ😀!".into());
    edge!(bytes_value, vec![], vec![255]); edge!(char_value, '😀', '😀');
    for value in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
        c.refuse(&api::Packet { float32_value: value, ..b.clone() }, api::echo_b,
            &subtype(&format!("{}0.float32Value", prefix()), "float32B"));
        c.call(&raw(api::Packet { float32_value: value, ..packet() }), api::produce, None);
    }
    for value in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        c.refuse(&api::Packet { float64_value: value, ..b.clone() }, api::echo_b,
            &subtype(&format!("{}0.float64Value", prefix()), "float64B"));
        c.call(&raw(api::Packet { float64_value: value, ..packet() }), api::produce, None);
    }
    c.refuse(&(api::Packet { nat_value: BigUint::from(43u8), ..a.clone() }, api::Packet { digit: BigUint::from(3u8), ..b.clone() }),
        |v| api::combine(&v.0, &v.1), &fin(&format!("{}1.digit", prefix())));
    for round in 0..256 {
        let position = round % 3; let mut right = vec![Some(b.clone()), None, Some(b.clone())];
        right[position] = Some(api::Packet { nat_value: BigUint::from(43u8), ..b.clone() });
        c.refuse(&api::Pair { left: vec![Some(a.clone())], right }, api::echo_pair,
            &subtype(&format!("{}0.right[{position}]?.natValue", prefix()), "natB"));
        c.call(&b, api::echo_b, n.clone());
    }
}
