use glyphs_char as api;
fn main() {
    let points: &[u32] = &[__POINTS__];
    let values: Vec<char> = points.iter().map(|&p| char::from_u32(p).unwrap()).collect();
    let mut checks = 0;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let _: fn(char) -> Result<char, api::Error> = api::keep;
    for &value in &values {
        check!(api::keep(value).unwrap() == value);
        check!(api::point(value).unwrap() == value as u32);
        check!(api::text(value).unwrap() == value.to_string());
        check!(api::choose(true, value, 'x').unwrap() == value);
        check!(api::choose(false, 'x', value).unwrap() == value);
        check!(api::keep_array(&values).unwrap() == values);
        let label = api::keep_label(&api::Label { marker: value, line: values.clone() }).unwrap();
        check!(label.marker == value && label.line == values);
        let rows = vec![values.clone(), vec![], vec![value]];
        check!(api::keep_rows(&rows).unwrap() == rows);
    }
    check!(api::sprout().unwrap() == '🌱');
    check!(api::keep_array(&[]).unwrap().is_empty());
    for bad in [0xd800, 0xdfff, 0x110000, 0xffffffff] { check!(char::from_u32(bad).is_none()); }
    for _ in 0..1000 { check!(api::keep_rows(&[values.clone(), values.clone()]).unwrap()[1] == values); }
    println!("char-ok:{checks}");
}
