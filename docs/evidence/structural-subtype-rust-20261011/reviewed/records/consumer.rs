use structuralsubtypes as api;
use api::{BigUint, Error};
use std::fmt::Debug;

#[derive(Default)]
struct Counts {
    checks: usize,
    rejections: usize,
    snapshot_controls: usize,
}

impl Counts {
    fn check(&mut self, condition: bool, label: &str) {
        assert!(condition, "failed: {label}");
        self.checks += 1;
    }

    fn refused<I: Clone + PartialEq + Debug, T>(
        &mut self,
        input: &I,
        call: impl FnOnce(&I) -> Result<T, Error>,
        expected: &str,
    ) {
        // These owned clones include every element, tag, limb and UTF-8 byte of BOTH inputs.
        let before = input.clone();
        match call(input) {
            Err(Error::Native { code, message }) => {
                self.check(code == 1 && message == expected, &format!("refusal: {expected}; got {message}"));
            }
            Err(error) => panic!("wrong error for {expected}: {error:?}"),
            Ok(_) => panic!("accepted: {expected}"),
        }
        self.check(*input == before, "complete rejected inputs unchanged");
        self.rejections += 1;
    }
}

fn n(value: u64) -> BigUint { BigUint::from(value) }
fn subtype(path: &str, constructor: &str) -> String {
    format!("{path} was rejected by StructuralSubtypes.{constructor}")
}
fn fin(path: &str, bound: &BigUint) -> String {
    format!("{path} is not below its Fin {bound} bound")
}

fn main() {
    let mut c = Counts::default();
    let huge = n(1) << 100usize;
    let wide = (n(10) << 64usize) + n(10);
    let original = (vec![Some(huge.clone()), None], vec![Some((255u8, "a\0tail".to_owned()))]);
    let mut mutations = vec![original.clone(); 6];
    mutations[0].0[0] = Some(&huge + n(1));
    mutations[1].0[0] = None;
    mutations[2].0.push(None);
    mutations[3].1[0].as_mut().unwrap().0 = 254;
    mutations[4].1[0].as_mut().unwrap().1 = "a\0changed".to_owned();
    mutations[5].1[0] = None;
    for changed in mutations {
        c.check(changed != original, "snapshot mutation control");
        c.snapshot_controls += 1;
    }

    c.check(api::scalar(&huge).unwrap() == huge, "wide Nat");
    c.refused(&n(0), api::scalar, &subtype("value0", "checkedPositive"));
    type Sequence = fn(&[BigUint]) -> Result<Vec<BigUint>, Error>;
    for (name, call) in [("arrays", api::arrays as Sequence), ("lists", api::lists as Sequence), ("specialized", api::specialized as Sequence)] {
        c.check(call(&[]).unwrap().is_empty(), name);
        let values = vec![n(1), huge.clone(), n(3)];
        c.check(call(&values).unwrap() == values, "wide sequence");
        for position in 0..3 {
            let mut bad = values.clone();
            bad[position] = n(0);
            c.refused(&bad, |v| call(v), &subtype(&format!("value0[{position}]"), "checkedPositive"));
        }
        c.check(call(&values).unwrap() == values, "sequence recovery");
    }

    c.check(api::options(&None).unwrap().is_none(), "absent option");
    c.check(api::options(&Some(huge.clone())).unwrap() == Some(huge.clone()), "present option");
    c.refused(&Some(n(0)), api::options, &subtype("value0?", "checkedPositive"));
    let text = "h\u{e9}llo\0tail\u{1F642}".to_owned();
    let pair = (huge.clone(), text.clone());
    c.check(api::product(&pair).unwrap() == pair, "Unicode and complete NUL suffix");
    c.refused(&(n(0), text.clone()), api::product, &subtype("value0.0", "checkedPositive"));
    c.refused(&(huge.clone(), String::new()), api::product, &subtype("value0.1", "checkedWord"));
    c.check(api::branch(&Ok(huge.clone())).unwrap() == Ok(huge.clone()), "active ok");
    c.check(api::branch(&Err(text.clone())).unwrap() == Err(text), "active error");
    c.refused(&Ok(n(0)), api::branch, &subtype("value0.ok", "checkedPositive"));
    c.refused(&Err(String::new()), api::branch, &subtype("value0.error", "checkedWord"));

    let bytes = vec![None, Some((255u8, huge.clone()))];
    c.check(api::byte_branches(&bytes).unwrap() == bytes, "UInt8 and Nat");
    c.refused(&vec![None, Some((0u8, huge.clone()))], |v| api::byte_branches(v), &subtype("value0[1]?.0", "checkedByte"));
    c.refused(&vec![None, Some((1u8, n(0)))], |v| api::byte_branches(v), &subtype("value0[1]?.1", "checkedPositive"));
    let nested = vec![vec![None, Some((huge.clone(), &wide - n(1)))], vec![], vec![Some((n(2), n(3)))]];
    c.check(api::nested(&nested).unwrap() == n(3), "nested valid");
    for row in 0..3 {
        for column in 0..3 {
            let mut rows = vec![vec![Some((huge.clone(), &wide - n(1))); 3]; 3];
            rows[row][column] = Some((n(0), wide.clone()));
            c.refused(&rows, |v| api::nested(v), &fin(&format!("value0[{row}][{column}]?.1"), &wide));
            rows[row][column] = Some((n(0), &wide - n(1)));
            c.refused(&rows, |v| api::nested(v), &subtype(&format!("value0[{row}][{column}]?.0"), "checkedPositive"));
            rows[row][column] = Some((n(1), &wide - n(1)));
            c.check(api::nested(&rows).unwrap() == n(3), "nested recovery");
        }
    }

    let first = vec![Some(n(1)), None, Some(huge.clone())];
    let second = vec![Some(huge.clone()), Some(n(3)), None];
    let normalized = vec![Some(&huge + n(1)), Some(n(4)), None];
    let joined: Vec<_> = first.iter().chain(&normalized).cloned().collect();
    c.check(api::alias_pair(&(first.clone(), second.clone())).unwrap() == (first.clone(), normalized), "per-site alias constructors");
    c.check(api::alias_arguments(&first, &second).unwrap() == joined, "per-parameter constructors");
    c.check(api::plain_fin(&[None, Some(n(0)), Some(n(9))]).unwrap() == n(3), "Fin endpoints");
    c.refused(&vec![Some(n(10))], |v| api::plain_fin(v), &fin("value0[0]?", &n(10)));
    for position in 0..3 {
        let mut left = vec![Some(n(1)), Some(huge.clone()), Some(n(3))];
        left[position] = Some(n(0));
        c.refused(&(left, second.clone()), api::alias_pair, &subtype(&format!("value0.0[{position}]?"), "checkedPositive"));
        let mut right = vec![Some(huge.clone()), Some(n(3)), Some(n(4))];
        right[position] = Some(n(0));
        c.refused(&(first.clone(), right), api::alias_pair, &subtype(&format!("value0.1[{position}]?"), "normalizePositive"));
    }

    for round in 0..1000 {
        let mut late = vec![Some(huge.clone()), Some(n(3)), Some(n(4))];
        let position = round % 3;
        late[position] = Some(n(0));
        c.refused(&(first.clone(), late), |v| api::alias_arguments(&v.0, &v.1), &subtype(&format!("value1[{position}]?"), "normalizePositive"));
        let before = (first.clone(), second.clone());
        c.check(api::alias_arguments(&first, &second).unwrap() == joined, "late recovery");
        c.check((&first, &second) == (&before.0, &before.1), "normalization does not mutate either input");
    }
    println!("{{\"checks\":{},\"rejections\":{},\"snapshotControls\":{}}}", c.checks, c.rejections, c.snapshot_controls);
}
