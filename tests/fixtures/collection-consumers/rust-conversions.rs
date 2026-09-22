// Host-side adapter tests. These tests do not invoke Lean.
#[cfg(test)]
mod collection_conversions {
    use super::*;
    {{CONVERTERS}}

    trait Same {
        fn same(&self, other: &Self) -> bool;
    }
    macro_rules! same_types {
        ($($t:ty),*) => { $(impl Same for $t {
            fn same(&self, other: &Self) -> bool { self == other }
        })* };
    }
    same_types!((), bool, u8, u16, u32, u64, i8, i16, i32, i64, BigUint, BigInt, String, char);
    impl Same for f32 {
        fn same(&self, other: &Self) -> bool {
            self.to_bits() == other.to_bits() || self.is_nan() && other.is_nan()
        }
    }
    impl Same for f64 {
        fn same(&self, other: &Self) -> bool {
            self.to_bits() == other.to_bits() || self.is_nan() && other.is_nan()
        }
    }
    impl<T: Same> Same for Vec<T> {
        fn same(&self, other: &Self) -> bool {
            self.len() == other.len() && self.iter().zip(other).all(|(a, b)| a.same(b))
        }
    }
    macro_rules! arrays {
        ($encode:ident, $decode:ident, $values:expr) => {{
            let values = $values;
            for iteration in 0..32 {
                let first = values[iteration % values.len()].clone();
                let next = values[(iteration + 1) % values.len()].clone();
                let input = vec![vec![first.clone(), next, first.clone()], vec![], vec![first]];
                let mut scope = Scope::new();
                let encoded = $encode(&input, &mut scope).unwrap();
                let output = $decode(&encoded, &mut scope).unwrap();
                assert!(output.same(&input));
                drop(scope);
                assert_eq!(LIVE.with(|live| live.get()), 0);
            }
            let mut scope = Scope::new();
            let encoded = $encode(&[], &mut scope).unwrap();
            assert!($decode(&encoded, &mut scope).unwrap().is_empty());
        }};
    }

    #[test]
    fn every_primitive_array_preserves_bits_and_owned_values() {
        let huge = (BigUint::from(1u8) << 5120usize) + BigUint::from(17u8);
        arrays!(encode_unit, decode_unit, vec![()]);
        arrays!(encode_bool, decode_bool, vec![false, true]);
        arrays!(encode_uint8, decode_uint8, vec![0u8, 1, u8::MAX]);
        arrays!(encode_uint16, decode_uint16, vec![0u16, 1, u16::MAX]);
        arrays!(encode_uint32, decode_uint32, vec![0u32, 1, u32::MAX]);
        arrays!(encode_uint64, decode_uint64, vec![0u64, 1, (1 << 53) + 1, u64::MAX]);
        arrays!(encode_int8, decode_int8, vec![i8::MIN, -1, 0, i8::MAX]);
        arrays!(encode_int16, decode_int16, vec![i16::MIN, -1, 0, i16::MAX]);
        arrays!(encode_int32, decode_int32, vec![i32::MIN, -1, 0, i32::MAX]);
        arrays!(encode_int64, decode_int64, vec![i64::MIN, -1, 0, i64::MAX]);
        arrays!(encode_nat, decode_nat, vec![BigUint::from(0u8), huge.clone()]);
        arrays!(encode_int, decode_int, vec![BigInt::from(0u8), BigInt::from(huge.clone()), -BigInt::from(huge)]);
        arrays!(encode_float32, decode_float32, vec![0.0f32, -0.0, f32::from_bits(1), f32::from_bits(0x007fffff), f32::MAX, f32::INFINITY, f32::NEG_INFINITY, f32::NAN]);
        arrays!(encode_float64, decode_float64, vec![0.0f64, -0.0, f64::from_bits(1), f64::from_bits(0x000fffffffffffff), f64::MAX, f64::INFINITY, f64::NEG_INFINITY, f64::NAN]);
        arrays!(encode_string, decode_string, vec![String::new(), "A\0🌱".into(), "\u{feff}e\u{301}".into()]);
        arrays!(encode_bytes, decode_bytes, vec![vec![], vec![0u8, 255], (0u8..=255).collect()]);
        arrays!(encode_char, decode_char, vec!['\0', '🌱', '\u{d7ff}', '\u{e000}', '\u{10ffff}']);
        arrays!(encode_usize, decode_usize, vec![0u64, (1 << 53) + 1, u64::MAX]);
        arrays!(encode_isize, decode_isize, vec![i64::MIN, -((1 << 53) + 1), 0, i64::MAX]);
        println!("collection-conversions-primitives:19");
    }

    fn packet() -> Packet {
        let value = Primitives {
            unit: (), flag: true, u8: u8::MAX, u16: u16::MAX, u32: u32::MAX,
            u64: u64::MAX, i8: i8::MIN, i16: i16::MIN, i32: i32::MIN, i64: i64::MIN,
            natural: BigUint::from(1u8) << 5120usize,
            integer: -(BigInt::from(1u8) << 5120usize), f32: -0.0, f64: 3.25,
            text: "\u{feff}🌱\0".into(), bytes: vec![0, 255, 128], char_: '🌱',
            usize: u64::MAX, isize: i64::MIN,
        };
        Packet {
            label: "parcel\0".into(), values: vec![vec![value.clone()], vec![], vec![value.clone(), value]],
            empty: Empty {}, single: Single { value: u64::MAX },
            count: Count { value: BigUint::from(1u8) << 5120usize },
            pair: Pair { first: 17, second: "first\0".into() },
            reversed: Reversed { second: "second\0".into(), first: 23 },
        }
    }

    macro_rules! nest {
        ($value:expr;) => { $value };
        ($value:expr; x $($rest:tt)*) => { vec![nest!($value; $($rest)*)] };
    }
    macro_rules! empty_levels {
        ($value:expr;) => {};
        ($value:expr; x $($rest:tt)*) => {
            {
                let value = $value;
                let mut scope = Scope::new();
                let encoded = encode_deep(&value, &mut scope).unwrap();
                assert_eq!(decode_deep(&encoded, &mut scope).unwrap(), value);
            }
            empty_levels!(vec![$value]; $($rest)*);
        };
    }

    #[test]
    fn records_and_deep_arrays_own_independent_values() {
        let mut input = packet();
        let original = input.clone();
        let mut scope = Scope::new();
        let encoded = encode_packet(&input, &mut scope).unwrap();
        let mut output = decode_packet(&encoded, &mut scope).unwrap();
        assert_eq!(output, original);
        assert_eq!(output.values[0][0].f32.to_bits(), (-0.0f32).to_bits());
        drop(scope);
        assert_eq!(LIVE.with(|live| live.get()), 0);
        input.label.clear(); input.values[0][0].text.clear(); input.count.value += BigUint::from(1u8);
        assert_eq!(output, original);
        output.values[0][0].bytes[0] = 7;
        output.values[0][0].natural += BigUint::from(1u8);
        assert_eq!(output.values[2][0], original.values[2][0]);
        assert_eq!(output.values[2][1], original.values[2][1]);
        assert_eq!(input.values[0][0].bytes[0], 0);
        let deepest = nest!(42u32; x x x x x x x x x x x x x x x x x x x x x x x x);
        let mut scope = Scope::new();
        let encoded = encode_deep(&deepest, &mut scope).unwrap();
        assert_eq!(decode_deep(&encoded, &mut scope).unwrap(), deepest);
        drop(scope);
        empty_levels!(vec![]; x x x x x x x x x x x x x x x x x x x x x x x x);
        assert_eq!(LIVE.with(|live| live.get()), 0);
        println!("collection-conversions-records:7:depth:24");
    }

    #[test]
    fn malformed_buffers_and_copy_limits_reject_before_reads() {
        for length in [1, usize::MAX] {
            let value = NativeWords { data: std::ptr::null(), length, ..Default::default() };
            assert!(matches!(decode_words(&value, &mut Scope::new()), Err(Error::InvalidNative)));
        }
        let backing = [1u32, 2, 3, 4];
        let value = NativeWords {
            data: backing.as_ptr().cast::<u8>().wrapping_add(1).cast(), length: 1, ..Default::default()
        };
        assert!(matches!(decode_words(&value, &mut Scope::new()), Err(Error::InvalidNative)));
        let value = NativeWords { data: std::ptr::dangling(), length: 0, ..Default::default() };
        assert!(decode_words(&value, &mut Scope::new()).unwrap().is_empty());
        let value = NativeWords { data: std::ptr::dangling(), length: usize::MAX, ..Default::default() };
        assert!(matches!(decode_words(&value, &mut Scope::new()), Err(Error::InvalidNative)));
        let invalid_utf8 = [0xffu8];
        let value = NativeText { data: invalid_utf8.as_ptr(), length: 1, ..Default::default() };
        assert!(matches!(decode_text(&value, &mut Scope::new()), Err(Error::InvalidNative)));
        for value in [0xd800, 0xdfff, 0x110000] {
            assert!(matches!(decode_scalar_char(&value, &mut Scope::new()), Err(Error::InvalidNative)));
        }
        assert!(matches!(encode_unit(&[vec![(); 2_097_153]], &mut Scope::new()), Err(Error::Limit)));
        let bytes = vec![vec![vec![0u8; 16 * 1024 * 1024]]];
        assert!(matches!(encode_bytes(&bytes, &mut Scope::new()), Err(Error::Limit)));
        assert_eq!(LIVE.with(|live| live.get()), 0);
    }

    #[test]
    fn allocation_errors_and_unwinding_release_every_scope_owner() {
        let input = packet();
        FAULT.with(|state| state.set((0, 0, false)));
        {
            let mut scope = Scope::new();
            let encoded = encode_packet(&input, &mut scope).unwrap();
            assert_eq!(decode_packet(&encoded, &mut scope).unwrap(), input);
        }
        let checkpoints = FAULT.with(|state| state.get().1);
        assert!(checkpoints > 40);
        for panic in [false, true] {
            for target in 1..=checkpoints {
                FAULT.with(|state| state.set((target, 0, panic)));
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    let mut scope = Scope::new();
                    let encoded = encode_packet(&input, &mut scope)?;
                    decode_packet(&encoded, &mut scope)
                }));
                FAULT.with(|state| state.set((0, 0, false)));
                assert_eq!(LIVE.with(|live| live.get()), 0);
                if panic { assert!(result.is_err()); }
                else { assert!(matches!(result, Ok(Err(Error::Allocation)))); }
                let mut scope = Scope::new();
                let encoded = encode_packet(&input, &mut scope).unwrap();
                assert_eq!(decode_packet(&encoded, &mut scope).unwrap(), input);
            }
        }
        assert_eq!(LIVE.with(|live| live.get()), 0);
        println!("collection-conversions-checkpoints:{}", checkpoints);
    }
}
