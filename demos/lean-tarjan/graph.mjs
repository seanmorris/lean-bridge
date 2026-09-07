/**
 * Module graph samples and presentation data derived from Lean component labels.
 *
 * @file
 */

/** Colors identify component membership throughout the graph and inspector. */
export const GROUP_COLORS = ["#d3b2ff", "#f2bf82", "#89d9cd", "#91baff", "#e9a8c5", "#c6db85", "#e6d79b", "#9ed6ec"];

/**
 * Create an editable module graph with or without mutually dependent groups.
 *
 * @param kind Sample name, either groups or acyclic.
 */
export const createPreset = (kind = "groups") => ({
	nodes: [
		["Interface", .10, .50], ["Routes", .31, .26], ["Auth", .31, .72]
		, ["Accounts", .54, .20], ["Store", .66, .47], ["Cache", .54, .78]
		, ["Log", .88, .30], ["Metrics", .88, .73]
	].map(([name, x, y], id) => ({ id, name, x, y }))
	, edges: kind === "acyclic"
		? [[0, 1], [1, 2], [1, 3], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]]
		: [[0, 1], [1, 2], [2, 1], [2, 3], [3, 4], [4, 5], [5, 3], [5, 6], [6, 7], [7, 6]]
	, feedback: [7, 1], nextId: 8, kind
});

/**
 * Build a finite generic CSR graph from stable editor node identifiers.
 *
 * @param scene Editable nodes and directed import pairs.
 */
export const buildGraphRequest = scene => {
	const indexOf = new Map(scene.nodes.map((node, index) => [node.id, index]));
	const adjacent = scene.nodes.map(() => new Set());
	for(const [source, target] of scene.edges)
		if(indexOf.has(source) && indexOf.has(target)) adjacent[indexOf.get(source)].add(indexOf.get(target));
	const offsets = new Uint32Array(scene.nodes.length + 1);
	const targets = [];
	adjacent.forEach((neighbors, index) => {
		offsets[index] = targets.length;
		targets.push(...neighbors);
	});
	offsets[scene.nodes.length] = targets.length;
	return { vertexCount: scene.nodes.length, offsets, targets: Uint32Array.from(targets) };
};

/**
 * Describe groups and their connecting edges using Lean's original-vertex labels.
 *
 * @param scene Editable nodes and directed import pairs.
 * @param labels Component representative for each original vertex.
 */
export const describePartition = (scene, labels) => {
	if(labels.length !== scene.nodes.length) throw new Error("Lean returned the wrong number of component labels");
	const members = new Map();
	labels.forEach((representative, vertex) => {
		if(!members.has(representative)) members.set(representative, []);
		members.get(representative).push(scene.nodes[vertex]);
	});
	const usedColors = new Set();
	const groupColor = id => {
		if(id < GROUP_COLORS.length) return GROUP_COLORS[id];
		let hue = Math.round((id - GROUP_COLORS.length) * 137.508 + 20) % 360;
		while(usedColors.has(`hsl(${hue} 75% 68%)`)) hue = (hue + 23) % 360;
		const color = `hsl(${hue} 75% 68%)`;
		usedColors.add(color);
		return color;
	};
	const groups = [...members].sort((left, right) => left[1][0].id - right[1][0].id)
		.map(([representative, nodes], index) => ({
			representative, nodes, index, number: index + 1
			, color: groupColor(nodes[0].id)
			, cyclic: nodes.length > 1 || scene.edges.some(([source, target]) => source === nodes[0].id && target === source)
		}));
	const nodeGroups = new Map();
	for(const group of groups)
		for(const node of group.nodes) nodeGroups.set(node.id, group.index);
	const links = [];
	const seen = new Set();
	for(const [source, target] of scene.edges)
	{
		const from = nodeGroups.get(source);
		const to = nodeGroups.get(target);
		if(from === undefined || to === undefined || from === to || seen.has(`${from}:${to}`)) continue;
		seen.add(`${from}:${to}`);
		links.push([from, to]);
	}
	return { groups, nodeGroups, links };
};

/**
 * Arrange the condensed graph by dependency depth while preserving all groups.
 *
 * @param partition Group descriptions and inter-group links.
 */
export const collapsedLayout = partition => {
	const count = partition.groups.length;
	const rowHeight = 184;
	const bandGap = 24;
	if(partition.links.length === 0)
	{
		const columns = Math.max(1, Math.min(4, count));
		const rows = Math.ceil(count / columns);
		const height = Math.max(495, rows * rowHeight + 80);
		const top = (height - rows * rowHeight) / 2;
		const positions = partition.groups.map((_, index) => ({
			x: columns === 1 ? .5 : .13 + .74 * (index % columns) / (columns - 1)
			, y: (top + (Math.floor(index / columns) + .5) * rowHeight) / height
		}));
		return { height, positions };
	}
	const levels = new Uint32Array(count);
	const indegree = new Uint32Array(count);
	const outgoing = Array.from({ length: count }, () => []);
	for(const [source, target] of partition.links)
	{
		outgoing[source].push(target);
		indegree[target] += 1;
	}
	const queue = [...indegree.keys()].filter(index => indegree[index] === 0);
	for(let head = 0; head < queue.length; head += 1)
		for(const target of outgoing[queue[head]])
		{
			levels[target] = Math.max(levels[target], levels[queue[head]] + 1);
			if(--indegree[target] === 0) queue.push(target);
		}
	const maximum = Math.max(0, ...levels);
	const ranks = new Map();
	levels.forEach((level, index) => {
		if(!ranks.has(level)) ranks.set(level, []);
		ranks.get(level).push(index);
	});
	const bandRows = Array.from({ length: Math.ceil((maximum + 1) / 4) }, (_, band) =>
		Math.max(...Array.from({ length: 4 }, (_, column) => ranks.get(band * 4 + column)?.length || 0)));
	const contentHeight = bandRows.reduce((total, rows) => total + rows * rowHeight, 0) + (bandRows.length - 1) * bandGap;
	const height = Math.max(495, contentHeight + 80);
	const starts = [];
	let top = (height - contentHeight) / 2;
	for(const rows of bandRows)
	{
		starts.push(top);
		top += rows * rowHeight + bandGap;
	}
	const positions = partition.groups.map((_, index) => {
		const rank = ranks.get(levels[index]);
		const band = Math.floor(levels[index] / 4);
		return {
			x: .13 + .74 * (levels[index] % 4) / Math.min(maximum, 3)
			, y: (starts[band] + (rank.indexOf(index) + .5) / rank.length * bandRows[band] * rowHeight) / height
		};
	});
	return { height, positions };
};
