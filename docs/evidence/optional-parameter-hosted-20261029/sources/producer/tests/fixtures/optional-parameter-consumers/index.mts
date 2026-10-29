/**
 * Check optional-parameter declarations under strict TypeScript.
 *
 * @file
 */
import * as api from "optional-parameters";

const word: number = api.word();
const explicitWord: number = api.word(11);
const natural: bigint = api.natural();
const text: string = api.text();
const character: string = api.character("猫");
const none = api.maybe({ tag: "none" });
const some = api.present({ tag: "some", value: 11 });
const unit: void = api.unitValue();
api.unitValue(undefined);

// @ts-expect-error Explicit null is not omission or Unit.
api.unitValue(null);
// @ts-expect-error Option.none is the tagged public value, not host null.
api.present(null);
// @ts-expect-error Nat uses exact bigint values in JavaScript.
api.natural(11);

void [word, explicitWord, natural, text, character, none, some, unit];
