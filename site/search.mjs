/**
 * Rank documentation results without loading guide modules or changing the index.
 *
 * @file
 */

/**
 * Normalize text while preserving language names such as C++, C#, and .NET.
 *
 * @param {string} value Search query or indexed text.
 */
const normalize = value => value.trim().toLowerCase().replace(/\s+/gu, " ").replace(/\s*\/\s*/gu, "/");

/**
 * Prefer a named guide over earlier pages that mention the same language.
 *
 * @template {{ title: string, searchText: string, searchAliases?: string[] }} T
 * @param {T[]} entries Validated search index entries.
 * @param {string} query Reader's search text.
 * @param {number} limit Maximum number of displayed results.
 * @returns {T[]} Original entries ranked by title relevance and stable index order.
 */
export const searchDocumentation = (entries, query, limit = 6) => {
	const needle = normalize(query);
	if(!needle) return [];
	return entries.map((entry, index) => {
		const titles = [entry.title, ...(entry.searchAliases ?? [])].map(normalize);
		const words = titles.flatMap(title => title.match(/[\p{L}\p{N}_+#.]+/gu) ?? []);
		const rank = titles.includes(needle) ? 0
			: titles.some(title => title.startsWith(needle) || title.includes(` ${needle}`)) || words.includes(needle) ? 1
				: titles.some(title => title.includes(needle)) || normalize(entry.searchText).includes(needle) ? 2 : 3;
		return { entry, index, rank };
	}).filter(result => result.rank < 3)
		.sort((left, right) => left.rank - right.rank || left.index - right.index)
		.slice(0, limit).map(result => result.entry);
};
