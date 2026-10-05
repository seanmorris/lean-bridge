#[cfg(test)]
mod list_faults {
    use super::*;
    fn faults(action: impl Fn() -> Result<(), Error>) -> usize {
        FAULT.set((0, 0, false));
        action().unwrap();
        let count = FAULT.get().1;
        assert!(count > 0);
        for panic in [false, true] {
            for target in 1..=count {
                let before = CLEARS.get();
                FAULT.set((target, 0, panic));
                let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(&action));
                FAULT.set((0, 0, false));
                if panic { assert!(outcome.is_err()); }
                else { assert!(matches!(outcome.unwrap(), Err(Error::Allocation))); }
                assert_eq!(LIVE.get(), 0);
                assert_eq!(CLEARS.get(), before + 1);
                assert_eq!(crate::reverse_uint32(&[1, 2, 3]).unwrap(), vec![3, 2, 1]);
            }
        }
        count * 2
    }
    macro_rules! nest {
        ($value:expr;) => { $value };
        ($value:expr; x $($rest:tt)*) => { vec![nest!($value; $($rest)*)] };
    }
    #[test]
    fn list_errors_and_panics_release_scratch_and_outputs() {
        let huge = BigUint::from(1u8) << 4096usize;
        let packet = crate::Packet {
            sequences: vec![vec![1, 2, 3], vec![], vec![4]],
            branches: vec![Some(Ok((huge.clone(), ()))), Some(Err("bad\0λ".into())), None],
            buffers: vec![vec![0, 255], vec![], vec![1]],
            arrays: vec![vec![(true, '🌿'), (false, '\0')], vec![]],
        };
        let deep = nest!(42u32; x x x x x x x x x x x x x x x x x x x x x x x x);
        let checks = faults(|| { crate::transform(&packet)?; Ok(()) })
            + faults(|| { crate::duplicate(&[0, 255])?; Ok(()) })
            + faults(|| { crate::reverse_nat(&[huge.clone(), BigUint::from(42u8)])?; Ok(()) })
            + faults(|| { crate::nest(&Some(vec![Ok(vec![(), ()]), Err("bad".into()), Ok(vec![])]))?; Ok(()) })
            + faults(|| { let _ = crate::swap(&Ok((vec![huge.clone()], vec![1, 2])))?; Ok(()) })
            + faults(|| { let _ = crate::swap(&Err(vec!["first".into(), "last".into()]))?; Ok(()) })
            + faults(|| { crate::deep(&deep)?; Ok(()) });
        println!("list-faults:{checks}");
    }
}
