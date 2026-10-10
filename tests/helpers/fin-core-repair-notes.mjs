/**
 * Restore Perl option construction guidance without changing acceptance claims.
 *
 * @file
 */
import assert from "node:assert/strict";

export const perlFinOptionNoteIds = [
	"reviewed-fin-perl-scalar-containers", "perl-fin-containers-ordinary-source"
	, "native-nominal-fin-perl-ordinary-source"
	, "native-nominal-fin-perl-reviewed-ir"
];
const previous = "Use Math::BigInt with the exact closed bound, including inside Array/List/Option/Prod/Except compositions, plain records and active variant fields. Empty containers, absent options and inactive Fin 0 branches are valid; present Fin 0 values are rejected. Rejections preserve caller values and name the failing path and bound.";
export const perlFinOptionNote = previous + " For Option, use undef for absence and the generated Some->new(value) for presence.";

/**
 * Copy the exact four existing conversion notes; leave support and evidence intact.
 *
 * @param original - Inventory before the documentation repair.
 */
export const restorePerlFinOptionNotes = original => {
	const inventory = structuredClone(original);
	for(const id of perlFinOptionNoteIds)
	{
		const matches = inventory.observations.filter(item => item.id === id);
		assert.equal(matches.length, 1, id);
		const [item] = matches;
		assert.deepEqual(item.profiles, ["perl"]);
		assert.deepEqual(item.shapes, ["fin"]);
		assert.equal(item.conversionNotes.fin, previous, id);
		item.conversionNotes.fin = perlFinOptionNote;
	}
	return inventory;
};
