/**
 * Eight public checks per host, added to its unchanged ordinary Subtype corpus.
 * Names and representations follow the generated host API, not an FFI substitute.
 *
 * @file
 */
export const reviewedSubtypeHostSupplements = Object.freeze({
	python: `check(api.byte_value(255) == 255, 'byte endpoint')
check(rejected(lambda: api.byte_value(0), 'arg0', 'Subtypes.checkedByte'), 'zero byte')
check(api.first_even(6) == 6, 'checked generic')
input_even = 7
check(rejected(lambda: api.first_even(input_even), 'arg0', 'Subtypes.checkedEven') and input_even == 7, 'generic rejection preserves input')
check(api.second_even(input_even) == 14 and input_even == 7, 'normalizing generic preserves input')
check(api.second_even(2**100) == 2**101, 'large normalization')
check(api.zero_even() == 0, 'zero-argument result')
left_word = 'ab'
check(rejected(lambda: api.join(left_word, ''), 'arg1', 'Subtypes.checkedWord') and left_word == 'ab', 'late rejection preserves input')
`
	, rust: `    check!(api::byte_value(255).unwrap() == 255);
    check!(rejected(api::byte_value(0), "arg0 was rejected by Subtypes.checkedByte"));
    check!(api::first_even(&n(6)).unwrap() == n(6));
    let input_even = n(7);
    check!(rejected(api::first_even(&input_even), "arg0 was rejected by Subtypes.checkedEven") && input_even == n(7));
    check!(api::second_even(&input_even).unwrap() == n(14) && input_even == n(7));
    check!(api::second_even(&(BigUint::from(1u8) << 100usize)).unwrap() == BigUint::from(1u8) << 101usize);
    check!(api::zero_even().unwrap() == n(0));
    let left_word = String::from("ab");
    check!(rejected(api::join(&left_word, ""), "arg1 was rejected by Subtypes.checkedWord") && left_word == "ab");
`
	, dotnet: `        Check(Api.ByteValue(255) == 255, "byte endpoint");
        Check(Rejected(() => Api.ByteValue(0), "arg0 was rejected by Subtypes.checkedByte"), "zero byte");
        Check(Api.FirstEven(N(6)) == N(6), "checked generic");
        var inputEven = N(7);
        Check(Rejected(() => Api.FirstEven(inputEven), "arg0 was rejected by Subtypes.checkedEven") && inputEven == N(7), "generic rejection preserves input");
        Check(Api.SecondEven(inputEven) == N(14) && inputEven == N(7), "normalizing generic preserves input");
        Check(Api.SecondEven(BigInteger.One << 100) == BigInteger.One << 101, "large normalization");
        Check(Api.ZeroEven() == N(0), "zero-argument result");
        string leftWord = "ab";
        Check(Rejected(() => Api.Join(leftWord, ""), "arg1 was rejected by Subtypes.checkedWord") && leftWord == "ab", "late rejection preserves input");
`
	, java: `        check(Api.byteValue(255) == 255, "byte endpoint");
        check(rejected(() -> Api.byteValue(0), "arg0 was rejected by Subtypes.checkedByte"), "zero byte");
        check(Api.firstEven(n(6)).equals(n(6)), "checked generic");
        final BigInteger inputEven = n(7);
        check(rejected(() -> Api.firstEven(inputEven), "arg0 was rejected by Subtypes.checkedEven") && inputEven.equals(n(7)), "generic rejection preserves input");
        check(Api.secondEven(inputEven).equals(n(14)) && inputEven.equals(n(7)), "normalizing generic preserves input");
        check(Api.secondEven(BigInteger.ONE.shiftLeft(100)).equals(BigInteger.ONE.shiftLeft(101)), "large normalization");
        check(Api.zeroEven().equals(n(0)), "zero-argument result");
        final String leftWord = "ab";
        check(rejected(() -> Api.join(leftWord, ""), "arg1 was rejected by Subtypes.checkedWord") && leftWord.equals("ab"), "late rejection preserves input");
`
	, kotlin: `    check(Api.byteValue(255) == 255, "byte endpoint")
    check(rejected("arg0 was rejected by Subtypes.checkedByte") { Api.byteValue(0) }, "zero byte")
    check(Api.firstEven(n(6)) == n(6), "checked generic")
    val inputEven = n(7)
    check(rejected("arg0 was rejected by Subtypes.checkedEven") { Api.firstEven(inputEven) } && inputEven == n(7), "generic rejection preserves input")
    check(Api.secondEven(inputEven) == n(14) && inputEven == n(7), "normalizing generic preserves input")
    check(Api.secondEven(BigInteger.ONE.shiftLeft(100)) == BigInteger.ONE.shiftLeft(101), "large normalization")
    check(Api.zeroEven() == n(0), "zero-argument result")
    val leftWord = "ab"
    check(rejected("arg1 was rejected by Subtypes.checkedWord") { Api.join(leftWord, "") } && leftWord == "ab", "late rejection preserves input")
`
	, ruby: `check(API.byte_value(255) == 255, "byte endpoint")
check(rejected("arg0", "Subtypes.checkedByte") { API.byte_value(0) }, "zero byte")
check(API.first_even(6) == 6, "checked generic")
input_even = 7
check(rejected("arg0", "Subtypes.checkedEven") { API.first_even(input_even) } && input_even == 7, "generic rejection preserves input")
check(API.second_even(input_even) == 14 && input_even == 7, "normalizing generic preserves input")
check(API.second_even(2**100) == 2**101, "large normalization")
check(API.zero_even() == 0, "zero-argument result")
left_word = "ab"
check(rejected("arg1", "Subtypes.checkedWord") { API.join(left_word, "") } && left_word == "ab", "late rejection preserves input")
`
	, "php-native": `check(LeanSubtypes\\byte_value(255) === 255, 'byte endpoint');
check(rejected(fn() => LeanSubtypes\\byte_value(0), 'arg0 was rejected by Subtypes.checkedByte'), 'zero byte');
check(LeanSubtypes\\first_even(n(6))->isEqualTo(6), 'checked generic');
$inputEven = n(7);
check(rejected(fn() => LeanSubtypes\\first_even($inputEven), 'arg0 was rejected by Subtypes.checkedEven') && $inputEven->isEqualTo(7), 'generic rejection preserves input');
check(LeanSubtypes\\second_even($inputEven)->isEqualTo(14) && $inputEven->isEqualTo(7), 'normalizing generic preserves input');
check(LeanSubtypes\\second_even(n(2)->power(100))->isEqualTo(n(2)->power(101)), 'large normalization');
check(LeanSubtypes\\zero_even()->isEqualTo(0), 'zero-argument result');
$leftWord = 'ab';
check(rejected(fn() => join($leftWord, ''), 'arg1 was rejected by Subtypes.checkedWord') && $leftWord === 'ab', 'late rejection preserves input');
`
	, perl: `check(LeanBridge::Subtypes::byte_value(255) == 255, 'byte endpoint');
check(rejected(sub { LeanBridge::Subtypes::byte_value(0) }, 'arg0', 'Subtypes.checkedByte'), 'zero byte');
check(LeanBridge::Subtypes::first_even(n(6))->bstr eq '6', 'checked generic');
my $input_even = n(7);
check(rejected(sub { LeanBridge::Subtypes::first_even($input_even) }, 'arg0', 'Subtypes.checkedEven') && $input_even->bstr eq '7', 'generic rejection preserves input');
check(LeanBridge::Subtypes::second_even($input_even)->bstr eq '14' && $input_even->bstr eq '7', 'normalizing generic preserves input');
check(LeanBridge::Subtypes::second_even(Math::BigInt->new(2)->bpow(100))->bstr eq Math::BigInt->new(2)->bpow(101)->bstr, 'large normalization');
check(LeanBridge::Subtypes::zero_even()->bstr eq '0', 'zero-argument result');
my $left_word = 'ab';
check(rejected(sub { LeanBridge::Subtypes::join($left_word, '') }, 'arg1', 'Subtypes.checkedWord') && $left_word eq 'ab', 'late rejection preserves input');
`
	, "wit-wasi": `  args[0] = (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = 255}; out = call("byte-value", args, 1); CHECK(out.kind == WASMTIME_COMPONENT_U8 && out.of.u8 == 255); clear(&out);
  args[0] = (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = 0}; CHECK(rejected("byte-value", args, 1, "arg0 was rejected by Subtypes.checkedByte"));
  args[0] = small(6); out = call("first-even", args, 1); CHECK(is_small(&out, 6)); clear(&out);
  { args[0] = small(7); out = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991}; wasmtime_error_t *error = subtypes_wasmtime_call(session, "first-even", args, 1, &out); wasm_name_t message = {0}; if (error) wasmtime_error_message(error, &message); char *copy = calloc(message.size + 1, 1); if (!copy) exit(1); if (message.size) memcpy(copy, message.data, message.size); CHECK(error && strstr(copy, "arg0 was rejected by Subtypes.checkedEven") && is_small(&args[0], 7) && out.kind == WASMTIME_COMPONENT_U32 && out.of.u32 == 991); free(copy); wasm_name_delete(&message); wasmtime_error_delete(error); clear(&args[0]); clear(&out); }
  { args[0] = small(7); out = (value){0}; wasmtime_error_t *error = subtypes_wasmtime_call(session, "second-even", args, 1, &out); CHECK(!error && is_small(&out, 14) && is_small(&args[0], 7)); clear(&args[0]); clear(&out); }
  args[0] = nat(big, 4); out = call("second-even", args, 1); CHECK(out.kind == WASMTIME_COMPONENT_LIST && out.of.list.size == 4 && out.of.list.data[0].of.u32 == 0 && out.of.list.data[1].of.u32 == 0 && out.of.list.data[2].of.u32 == 0 && out.of.list.data[3].of.u32 == 32); clear(&out);
  out = call("zero-even", args, 0); CHECK(is_small(&out, 0)); clear(&out);
  { args[0] = text("ab", 2); args[1] = text("", 0); out = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991}; wasmtime_error_t *error = subtypes_wasmtime_call(session, "join", args, 2, &out); wasm_name_t message = {0}; if (error) wasmtime_error_message(error, &message); char *copy = calloc(message.size + 1, 1); if (!copy) exit(1); if (message.size) memcpy(copy, message.data, message.size); CHECK(error && strstr(copy, "arg1 was rejected by Subtypes.checkedWord") && is_text(&args[0], "ab", 2) && args[1].kind == WASMTIME_COMPONENT_STRING && args[1].of.string.size == 0 && out.kind == WASMTIME_COMPONENT_U32 && out.of.u32 == 991); free(copy); wasm_name_delete(&message); wasmtime_error_delete(error); clear(&args[0]); clear(&args[1]); clear(&out); }
`
});
