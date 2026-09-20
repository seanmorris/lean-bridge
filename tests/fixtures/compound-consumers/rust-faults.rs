#[cfg(test)]
mod compound_faults {
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
                assert_eq!(crate::classify(&Some(Some(()))).unwrap(), 2);
            }
        }
        count * 2
    }
    #[test]
    fn compound_errors_and_panics_release_scratch_and_outputs() {
        let huge = BigUint::from(1u8) << 4096usize;
        let packet = crate::Packet {
            choice: Some(Ok((huge.clone(), ()))), products: ((42, "copied\0λ".into()), (true, '🌱')),
            rows: vec![Some(Err((vec![0,255], -BigInt::from(huge.clone())))), Some(Ok(("row".into(), u64::MAX))), None],
            nested: Ok(Some(Err("nested".into())))
        };
        let checks = faults(|| { crate::transform(&packet)?; Ok(()) })
            + faults(|| { let _ = crate::duplicate(&Some(vec![0,255]))?; Ok(()) })
            + faults(|| { crate::option_nat(&Some(huge.clone()))?; Ok(()) })
            + faults(|| { let _ = crate::result_string(&Ok("success".into()))?; Ok(()) })
            + faults(|| { let _ = crate::result_string(&Err("error".into()))?; Ok(()) })
            + faults(|| { crate::tuple_string(&("left".into(), "right".into()))?; Ok(()) });
        println!("compound-faults:{checks}");
    }
}
