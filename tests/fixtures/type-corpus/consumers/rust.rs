// JSON-safe observations of actual Rust values; no expected Lean values live here.
fn quote(value: &str) -> String {
    let mut result = String::from("\"");
    for ch in value.chars() {
        match ch {
            '"' => result.push_str("\\\""),
            '\\' => result.push_str("\\\\"),
            ch if ch < '\u{20}' => result.push_str(&format!("\\u{:04x}", ch as u32)),
            ch => result.push(ch),
        }
    }
    result.push('"');
    result
}
fn object(fields: &[(&str, String)]) -> String {
    format!("{{{}}}", fields.iter().map(|(key, value)| format!("{}:{}", quote(key), value)).collect::<Vec<_>>().join(","))
}
fn sequence(values: impl Iterator<Item = String>) -> String {
    format!("[{}]", values.collect::<Vec<_>>().join(","))
}
fn integer(value: &impl std::fmt::Display) -> String {
    object(&[("integer", quote(&value.to_string()))])
}
fn boolean(value: &bool) -> String {
    object(&[("bool", value.to_string())])
}
fn text(value: &str) -> String {
    object(&[("string", quote(value))])
}
fn unit(_: &()) -> String {
    object(&[("unit", "true".into())])
}
fn bytes(value: &[u8]) -> String {
    object(&[("bytes", format!("{value:?}"))])
}
fn float32(value: &f32) -> String {
    object(&[("float32", quote(&if value.is_nan() { "nan".into() } else { value.to_bits().to_string() }))])
}
fn float64(value: &f64) -> String {
    object(&[("float64", quote(&if value.is_nan() { "nan".into() } else { value.to_bits().to_string() }))])
}
