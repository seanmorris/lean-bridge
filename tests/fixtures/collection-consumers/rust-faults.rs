// Run only in a separate instrumented copy of the original compiled crate.
#[cfg(test)]
mod collection_native_faults {
    use super::*;

    fn faults(action: impl Fn() -> Result<(), Error>) -> usize {
        FAULT.with(|state| state.set((0, 0, false)));
        action().unwrap();
        let count = FAULT.with(|state| state.get().1);
        assert!(count > 0);
        assert_eq!(LIVE.with(|live| live.get()), 0);
        for panic in [false, true] {
            for target in 1..=count {
                let before = CLEARS.with(|clears| clears.get());
                FAULT.with(|state| state.set((target, 0, panic)));
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(&action));
                FAULT.with(|state| state.set((0, 0, false)));
                if panic { assert!(result.is_err()); }
                else { assert!(matches!(result.unwrap(), Err(Error::Allocation))); }
                assert_eq!(LIVE.with(|live| live.get()), 0);
                assert_eq!(CLEARS.with(|clears| clears.get()), before + 1);
                assert_eq!(crate::array_reverse_uint32(&[vec![1, 2]]).unwrap(), vec![vec![2, 1]]);
            }
        }
        count * 2
    }

    #[test]
    fn allocation_errors_and_panics_clear_native_outputs_once() {
        let natural = BigUint::from(1u8) << 5120usize;
        let value = Primitives {
            unit: (), flag: true, u8: 255, u16: 65535, u32: u32::MAX, u64: u64::MAX,
            i8: i8::MIN, i16: i16::MIN, i32: i32::MIN, i64: i64::MIN,
            natural: natural.clone(), integer: -BigInt::from(natural.clone()),
            f32: -0.0, f64: 3.25, text: "\u{feff}🌱\0".into(), bytes: vec![0, 255], char_: '🌱',
            usize: u64::MAX, isize: i64::MIN,
        };
        let packet = Packet {
            label: "parcel\0".into(), values: vec![vec![value.clone()], vec![], vec![value.clone(), value.clone()]],
            empty: Empty {}, single: Single { value: u64::MAX }, count: Count { value: natural.clone() },
            pair: Pair { first: 7, second: "a".into() }, reversed: Reversed { second: "b".into(), first: 9 },
        };
        let mut checks = 0;
        macro_rules! array {
            ($function:ident, $value:expr) => {{
                let input = vec![vec![$value], vec![]];
                checks += faults(|| { crate::$function(&input)?; Ok(()) });
            }};
        }
        array!(array_reverse_unit, ()); array!(array_reverse_bool, true);
        array!(array_reverse_uint8, u8::MAX); array!(array_reverse_uint16, u16::MAX);
        array!(array_reverse_uint32, u32::MAX); array!(array_reverse_uint64, u64::MAX);
        array!(array_reverse_int8, i8::MIN); array!(array_reverse_int16, i16::MIN);
        array!(array_reverse_int32, i32::MIN); array!(array_reverse_int64, i64::MIN);
        array!(array_reverse_nat, natural.clone()); array!(array_reverse_int, -BigInt::from(natural.clone()));
        array!(array_reverse_float32, -0.0f32); array!(array_reverse_float64, f64::NAN);
        array!(array_reverse_string, String::from("🌱\0")); array!(array_reverse_bytes, vec![0, 255]);
        array!(array_reverse_char, '🌱'); array!(array_reverse_usize, u64::MAX); array!(array_reverse_isize, i64::MIN);
        checks += faults(|| { crate::record_shuffle(&packet)?; Ok(()) });
        checks += faults(|| { crate::record_duplicate(&packet)?; Ok(()) });
        checks += faults(|| { crate::record_reverse(&[value.clone(), value.clone()])?; Ok(()) });
        checks += faults(|| { crate::array_duplicate(&[vec![0, 255], vec![], vec![128]])?; Ok(()) });
        checks += faults(|| { crate::array_words()?; Ok(()) });
        checks += faults(|| { crate::record_make()?; Ok(()) });
        checks += faults(|| { crate::generate(&BigUint::from(17u8))?; Ok(()) });
        macro_rules! nest {
            ($value:expr;) => { $value };
            ($value:expr; x $($rest:tt)*) => { vec![nest!($value; $($rest)*)] };
        }
        let deep = nest!(42u32; x x x x x x x x x x x x x x x x x x x x x x x x);
        checks += faults(|| { crate::deep(&deep)?; Ok(()) });
        println!("collection-native-faults:{}", checks);
    }
}
