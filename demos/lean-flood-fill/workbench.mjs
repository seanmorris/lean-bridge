/**
 * Scoped flood-fill editor; React owns the surrounding page and controller lifetime.
 *
 * @file
 */

import * as runtimeModule from "./runtime.mjs";
import { measureSyncBenchmark } from "../shared/browser-benchmark.mjs";

/**
 * Mount the existing editor within one route-owned scaffold.
 *
 * @param root Workbench element containing the controls and drawing surfaces.
 * @param scope Resource lifetime, including late prepared Wasm handles.
 * @param saved Page-memory input snapshot, empty on a new document.
 */
export const mountWorkbench = async (root, scope, saved = {}) => {
	const {
		prepareCapabilityClosure, reachable, reachableWithCapabilities, ready
	} = scope.runtime(runtimeModule);
	const ROOM_WIDTH = 13;
	const ROOM_HEIGHT = 7;
	const ROOM_SIZE = ROOM_WIDTH * ROOM_HEIGHT;
	const ROOM_CENTER_X = Math.floor(ROOM_WIDTH / 2);
	const ROOM_CENTER_Y = Math.floor(ROOM_HEIGHT / 2);
	const ROOM_COLUMNS = 4;
	const ROOM_COUNT = 8;
	const CAPABILITY_COUNT = 4;
	const NONE = CAPABILITY_COUNT;
	const KEY_META = [
		{ name: "Fern key", short: "Fern", color: "#adf7b6", glyph: "◆" }
		, { name: "Tide key", short: "Tide", color: "#72d8ff", glyph: "●" }
		, { name: "Sun key", short: "Sun", color: "#ffd36e", glyph: "▲" }
		, { name: "Rose key", short: "Rose", color: "#ff9fba", glyph: "■" }
	];
	const DIRECTIONS = [
		{ key: "up", label: "↑", dx: 0, dy: -1 }
		, { key: "right", label: "→", dx: 1, dy: 0 }
		, { key: "down", label: "↓", dx: 0, dy: 1 }
		, { key: "left", label: "←", dx: -1, dy: 0 }
	];
	const LEDGE_MODES = [
		{ key: "up", label: "↑", directions: ["up"] }
		, { key: "right", label: "→", directions: ["right"] }
		, { key: "down", label: "↓", directions: ["down"] }
		, { key: "left", label: "←", directions: ["left"] }
		, { key: "down-left", label: "🭼", directions: ["down", "left"] }
		, { key: "up-left", label: "🭽", directions: ["up", "left"] }
		, { key: "up-right", label: "🭾", directions: ["up", "right"] }
		, { key: "down-right", label: "🭿", directions: ["down", "right"] }
	];
	const TOOL_HELP = {
		wall: "Drag from floor to paint walls; start on a wall to erase them. Every edit is solved immediately by Lean/Wasm."
		, key: "Choose a key, then click or drag to place it. Start on that key to erase keys across the stroke."
		, ledge: "Choose one cardinal edge or a two-edge corner. Paired arrows are two separate moves, never diagonal motion."
		, entrance: "Click or drag to move ◎, the flood-fill starting point. The final tile becomes the entrance."
	};

	const world = root.querySelector("#world");
	const roomGrid = root.querySelector("#room-grid");
	const roomName = root.querySelector("#room-name");
	const status = root.querySelector("#status");
	const reachableCount = root.querySelector("#reachable-count");
	const runtime = root.querySelector("#runtime");
	const keys = root.querySelector("#keys");
	const keyPicker = root.querySelector("#key-picker");
	const directionPicker = root.querySelector("#direction-picker");
	const seedButton = root.querySelector("#seed");
	const inventoryHelp = root.querySelector("#inventory-help");
	const resultTitle = root.querySelector("#result-title");
	const resultExplanation = root.querySelector("#result-explanation");
	const nextActions = root.querySelector("#next-actions");
	const editorDisclosure = root.querySelector(".editor-disclosure");
	const editorState = root.querySelector("#editor-state");
	const roomEditState = root.querySelector("#room-edit-state");
	const roomEditCopy = root.querySelector("#room-edit-copy");
	const editorToolHelp = root.querySelector("#editor-tool-help");

	let seed = 0;
	let rooms = [];
	let doors = [];
	let entrance = { room: 0, tile: 0 };
	let selectedRoom = 0;
	let editor = "wall";
	let selectedKey = 0;
	let ledgeMode = "down-right";
	let inventoryMode = "manual";
	let selectedKeys = new Set();
	let acquiredKeys = new Set();
	let reachableVertices = new Set();
	let solveVersion = 0;
	let solveFrame = 0;
	let dragState = null;
	scope.remember(() => ({
		seed, rooms, doors, entrance, selectedRoom, editor, selectedKey, ledgeMode
		, inventoryMode, selectedKeys, editorOpen: editorDisclosure.open
	}));

	const tileIndex = (x, y) => y * ROOM_WIDTH + x;
	const tilePoint = index => ({ x: index % ROOM_WIDTH, y: Math.floor(index / ROOM_WIDTH) });
	const vertexIndex = (room, tile) => room * ROOM_SIZE + tile;

	const seededRandom = initial => {
		let value = initial >>> 0;
		return () => {
			value ^= value << 13;
			value ^= value >>> 17;
			value ^= value << 5;
			return (value >>> 0) / 0x1_0000_0000;
		};
	};

	const generateMap = nextSeed => {
		seed = nextSeed >>> 0;
		const random = seededRandom(seed);
		rooms = Array.from({ length: ROOM_COUNT }, (_, id) => {
			const tiles = new Uint8Array(ROOM_SIZE);
			const grants = new Uint32Array(ROOM_SIZE);
			grants.fill(NONE);
			for(let y = 0; y < ROOM_HEIGHT; y += 1)
			{
				for(let x = 0; x < ROOM_WIDTH; x += 1)
				{
					const boundary = x === 0 || y === 0 || x === ROOM_WIDTH - 1 || y === ROOM_HEIGHT - 1;
					const corridor = x === ROOM_CENTER_X || y === ROOM_CENTER_Y;
					tiles[tileIndex(x, y)] = Number(!boundary && (corridor || random() > .13));
				}
			}
			return { id, name: `Room ${String(id + 1).padStart(2, "0")}`, tiles, grants, ledges: new Map() };
		});
		doors = [];
		const addDoor = (roomA, roomB, tileA, tileB, requirement) => {
			rooms[roomA].tiles[tileA] = 1;
			rooms[roomB].tiles[tileB] = 1;
			doors.push({ id: doors.length, roomA, roomB, tileA, tileB, requirement, closed: false });
		};
		for(let room = 0; room < ROOM_COUNT; room += 1)
		{
			const x = room % ROOM_COLUMNS;
			const y = Math.floor(room / ROOM_COLUMNS);
			if(x + 1 < ROOM_COLUMNS)
			{
				const child = room + 1;
				addDoor(room, child, tileIndex(ROOM_WIDTH - 1, ROOM_CENTER_Y),
					tileIndex(0, ROOM_CENTER_Y), room % CAPABILITY_COUNT);
			}
			if(y + 1 < ROOM_COUNT / ROOM_COLUMNS)
			{
				const child = room + ROOM_COLUMNS;
				const requirement = x === 0 ? 3 : (random() < .45 ? NONE : Math.floor(random() * CAPABILITY_COUNT));
				addDoor(room, child, tileIndex(ROOM_CENTER_X, ROOM_HEIGHT - 1),
					tileIndex(ROOM_CENTER_X, 0), requirement);
			}
		}
		for(let capability = 0; capability < CAPABILITY_COUNT; capability += 1)
		{
			const room = rooms[capability];
			const tile = tileIndex(2 + capability * 2, 2);
			room.tiles[tile] = 1;
			room.grants[tile] = capability;
		}
		entrance = { room: 0, tile: tileIndex(ROOM_CENTER_X, ROOM_CENTER_Y) };
		rooms[0].tiles[entrance.tile] = 1;
		selectedRoom = 0;
		selectedKeys = new Set();
		acquiredKeys = new Set();
		seedButton.textContent = seed.toString(16).padStart(8, "0");
	};

	const roomDoorsByTile = roomId => new Map(doors.flatMap(door => {
		if(door.roomA === roomId) return [[door.tileA, door]];
		if(door.roomB === roomId) return [[door.tileB, door]];
		return [];
	}));

	const doorDestination = (door, roomId) => door.roomA === roomId ? door.roomB : door.roomA;

	const doorState = door => {
		const key = door.requirement < CAPABILITY_COUNT ? KEY_META[door.requirement] : null;
		return {
			statusGlyph: door.closed ? "×" : "•"
			, statusLabel: door.closed ? "closed" : "open"
			, requirementGlyph: key?.glyph ?? "—"
			, requirementLabel: key ? `requires ${key.name}` : "requires no key"
			, color: key?.color ?? (door.closed ? "#73859a" : "#adf7b6")
		};
	};

	const cycleDoorRequirement = door => {
		if(door.requirement === NONE) door.requirement = 0;
		else if(door.requirement + 1 < CAPABILITY_COUNT) door.requirement += 1;
		else door.requirement = NONE;
		void solve();
	};

	const toggleDoor = door => {
		door.closed = !door.closed;
		void solve();
	};

	const svgElement = name => document.createElementNS("http://www.w3.org/2000/svg", name);

	const roomPreview = room => {
		const svg = svgElement("svg");
		svg.classList.add("room-preview");
		svg.setAttribute("viewBox", `0 0 ${ROOM_WIDTH} ${ROOM_HEIGHT}`);
		svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
		svg.setAttribute("aria-hidden", "true");
		const paths = { floor: [], wall: [] };
		for(let tile = 0; tile < ROOM_SIZE; tile += 1)
		{
			const point = tilePoint(tile);
			paths[room.tiles[tile] ? "floor" : "wall"].push(`M${point.x} ${point.y}h1v1h-1z`);
		}
		for(const kind of ["floor", "wall"])
		{
			const path = svgElement("path");
			path.classList.add(kind);
			path.setAttribute("d", paths[kind].join(""));
			svg.append(path);
		}
		return svg;
	};

	const renderConnections = () => {
		world.querySelector(".world-connections")?.remove();
		const bounds = world.getBoundingClientRect();
		if(bounds.width === 0 || bounds.height === 0) return;
		const svg = svgElement("svg");
		svg.classList.add("world-connections");
		svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
		svg.setAttribute("aria-hidden", "true");
		for(const door of doors)
		{
			const cardA = world.querySelector(`[data-room="${door.roomA}"]`);
			const cardB = world.querySelector(`[data-room="${door.roomB}"]`);
			if(!cardA || !cardB) continue;
			const rectA = cardA.getBoundingClientRect();
			const rectB = cardB.getBoundingClientRect();
			const x1 = rectA.left - bounds.left + rectA.width / 2;
			const y1 = rectA.top - bounds.top + rectA.height / 2;
			const x2 = rectB.left - bounds.left + rectB.width / 2;
			const y2 = rectB.top - bounds.top + rectB.height / 2;
			const group = svgElement("g");
			group.classList.add("room-connection");
			const state = doorState(door);
			const missingKey = door.requirement < CAPABILITY_COUNT && !acquiredKeys.has(door.requirement);
			group.classList.add(door.closed ? "closed" : "open",
				door.requirement < CAPABILITY_COUNT ? "keyed" : "unrestricted");
			if(missingKey) group.classList.add("missing-key");
			group.style.setProperty("--connection", state.color);
			const description = svgElement("title");
			description.textContent = `${state.statusLabel} door; ${state.requirementLabel}`
				+ (missingKey ? "; unavailable because that key is not held" : "");
			const line = svgElement("line");
			for(const [name, value] of Object.entries({ x1, y1, x2, y2 })) line.setAttribute(name, String(value));
			const centerX = (x1 + x2) / 2;
			const centerY = (y1 + y2) / 2;
			const markerGroup = svgElement("g");
			markerGroup.classList.add("door-marker-group");
			markerGroup.setAttribute("transform", `translate(${centerX} ${centerY})`);
			const marker = svgElement("circle");
			marker.classList.add("door-marker");
			marker.setAttribute("r", "9");
			const glyph = svgElement("text");
			glyph.classList.add("door-key-glyph");
			glyph.setAttribute("x", "0");
			glyph.setAttribute("y", "0");
			glyph.setAttribute("dy", ".34em");
			glyph.textContent = state.requirementGlyph;
			const statusMarker = svgElement("circle");
			statusMarker.classList.add("door-status-marker");
			statusMarker.setAttribute("cx", "8");
			statusMarker.setAttribute("cy", "-8");
			statusMarker.setAttribute("r", "5");
			const statusGlyph = svgElement("text");
			statusGlyph.classList.add("door-status-glyph");
			statusGlyph.setAttribute("x", "8");
			statusGlyph.setAttribute("y", "-8");
			statusGlyph.setAttribute("dy", ".34em");
			statusGlyph.textContent = state.statusGlyph;
			markerGroup.append(marker, glyph, statusMarker, statusGlyph);
			group.append(description, line, markerGroup);
			svg.append(group);
		}
		world.prepend(svg);
	};

	const renderWorld = () => {
		const counts = rooms.map(() => ({ open: 0, total: 0 }));
		for(const room of rooms)
		{
			for(let tile = 0; tile < ROOM_SIZE; tile += 1)
			{
				if(room.tiles[tile]) counts[room.id].total += 1;
				if(reachableVertices.has(vertexIndex(room.id, tile))) counts[room.id].open += 1;
			}
		}
		world.replaceChildren(...rooms.map(room => {
			const card = document.createElement("div");
			const roomIsOpen = counts[room.id].open > 0;
			card.className = `room-card${room.id === selectedRoom ? " active" : ""}${roomIsOpen ? " open" : " blocked"}`;
			card.tabIndex = 0;
			card.dataset.room = String(room.id);
			card.setAttribute("role", "button");
			card.setAttribute("aria-label", `${room.name}: ${roomIsOpen ? "reachable" : "not reachable"}`);
			card.append(roomPreview(room));
			const select = () => { selectedRoom = room.id; render(); };
			scope.listen(card, "click", select);
			scope.listen(card, "keydown", event => {
				if(event.target !== card) return;
				if(event.key === "Enter" || event.key === " ")
				{
					event.preventDefault();
					select();
				}
			});
			const heading = document.createElement("div");
			heading.className = "room-card-heading";
			const title = document.createElement("h3");
			title.textContent = room.name;
			const roomState = document.createElement("span");
			roomState.className = "room-state";
			roomState.textContent = roomIsOpen ? "reachable" : "blocked";
			heading.append(title, roomState);
			const detail = document.createElement("p");
			detail.textContent = roomIsOpen
				? `${counts[room.id].open} of ${counts[room.id].total} floor tiles reachable`
				: "No path from the entrance";
			card.append(heading, detail);
			return card;
		}));
		scope.requestAnimationFrame(renderConnections);
	};

	const ledgesAt = (room, tile) => {
		const ledges = [];
		for(const direction of DIRECTIONS)
		{
			const point = tilePoint(tile);
			const targetX = point.x + direction.dx;
			const targetY = point.y + direction.dy;
			if(targetX < 0 || targetX >= ROOM_WIDTH || targetY < 0 || targetY >= ROOM_HEIGHT) continue;
			const target = tileIndex(targetX, targetY);
			const key = `${tile}:${target}`;
			if(room.ledges.get(key)) ledges.push({ direction, key, target });
		}
		return ledges;
	};

	const deleteOutgoingLedges = (room, tile) => {
		for(const ledge of ledgesAt(room, tile)) room.ledges.delete(ledge.key);
	};

	const deleteTileLedges = (room, tile) => {
		for(const key of room.ledges.keys())
		{
			const [source, target] = key.split(":").map(Number);
			if(source === tile || target === tile) room.ledges.delete(key);
		}
	};

	const scheduleSolve = () => {
		if(solveFrame) return;
		solveFrame = scope.requestAnimationFrame(() => {
			solveFrame = 0;
			void solve();
		});
	};

	const editTile = (tile, gesture = null) => {
		const room = rooms[selectedRoom];
		if(roomDoorsByTile(selectedRoom).has(tile)) return;
		if(editor === "wall")
		{
			if(selectedRoom === entrance.room && tile === entrance.tile) return;
			if(gesture && gesture.wallValue === null) gesture.wallValue = Number(!room.tiles[tile]);
			room.tiles[tile] = gesture ? gesture.wallValue : Number(!room.tiles[tile]);
			if(!room.tiles[tile])
			{
				room.grants[tile] = NONE;
				deleteTileLedges(room, tile);
			}
		}
		else if(editor === "key")
		{
			room.tiles[tile] = 1;
			if(gesture && gesture.keyValue === null)
				gesture.keyValue = room.grants[tile] === selectedKey ? NONE : selectedKey;
			room.grants[tile] = gesture ? gesture.keyValue : room.grants[tile] === selectedKey ? NONE : selectedKey;
		}
		else if(editor === "entrance")
		{
			room.tiles[tile] = 1;
			entrance = { room: selectedRoom, tile };
		}
		else
		{
			if(gesture && gesture.ledgeAction === null)
				gesture.ledgeAction = ledgeMode === "erase" ? "remove" : "add";
			const removing = gesture ? gesture.ledgeAction === "remove" : ledgeMode === "erase";
			if(removing)
			{
				deleteOutgoingLedges(room, tile);
				scheduleSolve();
				return;
			}
			const mode = LEDGE_MODES.find(item => item.key === ledgeMode);
			if(!mode) return;
			const point = tilePoint(tile);
			const edges = mode.directions.map(directionKey => {
				const direction = DIRECTIONS.find(item => item.key === directionKey);
				const targetX = point.x + direction.dx;
				const targetY = point.y + direction.dy;
				if(targetX < 0 || targetX >= ROOM_WIDTH || targetY < 0 || targetY >= ROOM_HEIGHT) return null;
				const target = tileIndex(targetX, targetY);
				return { target, forward: `${tile}:${target}`, reverse: `${target}:${tile}` };
			});
			if(!room.tiles[tile] || edges.some(edge => !edge || !room.tiles[edge.target])) return;
			deleteOutgoingLedges(room, tile);
			for(const edge of edges)
			{
				if(!edge) return;
				room.ledges.delete(edge.reverse);
				room.ledges.set(edge.forward, true);
			}
		}
		scheduleSolve();
	};

	const renderRoom = () => {
		const room = rooms[selectedRoom];
		const roomDoors = roomDoorsByTile(selectedRoom);
		const editing = editorDisclosure.open;
		roomGrid.classList.toggle("editing", editing);
		roomName.textContent = room.name;
		let open = 0;
		roomGrid.replaceChildren(...Array.from({ length: ROOM_SIZE }, (_, tile) => {
			const door = roomDoors.get(tile);
			const button = door ? document.createElement("div") : document.createElement("button");
			if(button instanceof HTMLButtonElement) button.disabled = !editing;
			button.dataset.tile = String(tile);
			const reachableTile = reachableVertices.has(vertexIndex(selectedRoom, tile));
			if(reachableTile) open += 1;
			button.className = `tile ${room.tiles[tile] ? `floor ${reachableTile ? "reachable" : "unreachable"}` : "wall"}`;
			if(selectedRoom === entrance.room && tile === entrance.tile) button.classList.add("entrance");
			if(door) button.classList.add("door-tile");
			const glyph = document.createElement("span");
			glyph.className = "glyph";
			const grant = room.grants[tile];
			const ledges = ledgesAt(room, tile);
			if(ledges.length) button.classList.add("has-ledge");
			glyph.textContent = selectedRoom === entrance.room && tile === entrance.tile ? "◎"
				: grant < CAPABILITY_COUNT ? KEY_META[grant].glyph : "";
			if(grant < CAPABILITY_COUNT) glyph.style.color = KEY_META[grant].color;
			button.append(glyph);
			if(door)
			{
				const state = doorState(door);
				const control = document.createElement("div");
				control.className = "tile-door-control";
				control.style.setProperty("--door-state", state.color);
				const destination = document.createElement("span");
				destination.className = "door-destination";
				destination.textContent = `R${String(doorDestination(door, selectedRoom) + 1).padStart(2, "0")}`;
				const requirement = document.createElement("button");
				requirement.type = "button";
				requirement.className = "door-requirement";
				requirement.textContent = state.requirementGlyph;
				requirement.title = `${state.requirementLabel}. Click to change the required key.`;
				requirement.setAttribute("aria-label", requirement.title);
				scope.listen(requirement, "click", () => cycleDoorRequirement(door));
				const doorStatus = document.createElement("button");
				doorStatus.type = "button";
				doorStatus.className = `door-status ${door.closed ? "closed" : "open"}`;
				doorStatus.textContent = state.statusGlyph;
				doorStatus.title = `Door is ${state.statusLabel}. Click to ${door.closed ? "open" : "close"} it.`;
				doorStatus.setAttribute("aria-label", doorStatus.title);
				scope.listen(doorStatus, "click", () => toggleDoor(door));
				control.append(destination, requirement, doorStatus);
				button.append(control);
			}
			for(const ledge of ledges)
			{
				const rail = document.createElement("span");
				rail.className = `ledge-rail ${ledge.direction.key}`;
				const marker = document.createElement("span");
				marker.className = `ledge-marker ${ledge.direction.key}`;
				marker.textContent = ledge.direction.label;
				marker.setAttribute("aria-hidden", "true");
				button.append(rail, marker);
			}
			const features = [];
			if(selectedRoom === entrance.room && tile === entrance.tile) features.push("start");
			if(grant < CAPABILITY_COUNT) features.push(KEY_META[grant].name);
			if(ledges.length) features.push(`one-way ledge ${ledges.map(item => item.direction.key).join(" + ")}`);
			if(door)
			{
				const destination = rooms[doorDestination(door, selectedRoom)].name;
				const state = doorState(door);
				features.push(`door to ${destination}, ${state.statusLabel}, ${state.requirementLabel}`);
			}
			const tileState = room.tiles[tile] ? (reachableTile ? "reachable floor" : "unreachable floor") : "solid wall";
			button.title = `${room.name}, ${tileState}${features.length ? `, ${features.join(", ")}` : ""}`
				+ (door ? ". Use the key and status controls to edit this door."
					: editing ? ". Click or drag to edit." : ". Open Room tile editor to edit tiles.");
			button.setAttribute("aria-label", button.title);
			if(door) button.setAttribute("role", "group");
			else scope.listen(button, "click", event => {
				if(event.detail === 0) editTile(tile);
			});
			return button;
		}));
		reachableCount.textContent = String(open);
	};

	const renderKeys = () => {
		keys.replaceChildren(...KEY_META.map((key, index) => {
			const button = document.createElement("button");
			const selected = selectedKeys.has(index);
			const acquired = acquiredKeys.has(index);
			button.className = `key-toggle${selected ? " selected" : ""}${acquired ? " acquired" : ""}`;
			button.style.setProperty("--key", key.color);
			button.setAttribute("aria-pressed", String(selected));
			const keyLabel = document.createElement("span");
			keyLabel.className = "key-name";
			keyLabel.innerHTML = `<span style="color:${key.color}">${key.glyph}</span> ${key.name}`;
			const keyState = document.createElement("small");
			keyState.className = "key-state";
			keyState.textContent = selected ? (inventoryMode === "auto" ? "starts held" : "found")
				: acquired ? "auto-found" : "not found";
			button.append(keyLabel, keyState);
			scope.listen(button, "click", () => {
				if(selectedKeys.has(index)) selectedKeys.delete(index);
				else selectedKeys.add(index);
				void solve();
			});
			return button;
		}));
	};

	const render = () => { renderWorld(); renderRoom(); renderKeys(); };

	const reachableUnselectedKeys = () => {
		const available = new Set();
		for(const room of rooms)
		{
			for(let tile = 0; tile < ROOM_SIZE; tile += 1)
			{
				const grant = room.grants[tile];
				if(grant < CAPABILITY_COUNT && !selectedKeys.has(grant)
					&& reachableVertices.has(vertexIndex(room.id, tile))) available.add(grant);
			}
		}
		return [...available].sort();
	};

	const summaryAction = ({ text, action, key = null }) => {
		const button = document.createElement("button");
		button.textContent = text;
		button.dataset.action = action;
		if(key !== null)
		{
			button.dataset.key = String(key);
			button.style.setProperty("--key", KEY_META[key].color);
		}
		return button;
	};

	const renderResultSummary = (openRooms, result) => {
		const roomWord = openRooms === 1 ? "room" : "rooms";
		nextActions.hidden = false;
		if(inventoryMode === "auto")
		{
			const count = result.capabilities.length;
			resultTitle.textContent = `Auto-find reached ${openRooms} ${roomWord} and collected ${count} ${count === 1 ? "key" : "keys"}.`;
			resultExplanation.textContent = "Lean filled from ◎, collected keys on reachable tiles, enabled their doors, and repeated until no new tile or key could be added.";
			nextActions.replaceChildren(summaryAction({ text: "Reset to no keys", action: "reset" }));
		}
		else
		{
			const available = reachableUnselectedKeys();
			if(selectedKeys.size === 0) resultTitle.textContent = `No keys found: ${openRooms} ${roomWord} reachable.`;
			else
			{
				const held = [...selectedKeys].sort().map(index => KEY_META[index].short).join(", ");
				resultTitle.textContent = `With ${held}: ${openRooms} ${roomWord} reachable.`;
			}
			if(available.length)
			{
				const names = available.map(index => KEY_META[index].name).join(available.length === 2 ? " and " : ", ");
				resultExplanation.textContent = `${names} ${available.length === 1 ? "is" : "are"} now on reachable floor. Mark the next pickup found to unlock its matching doors.`;
				nextActions.replaceChildren(...available.map(key => summaryAction({
					text: `${KEY_META[key].glyph} Mark ${KEY_META[key].short} found`
					, action: "key", key
				})));
			}
			else
			{
				if(selectedKeys.size === CAPABILITY_COUNT)
				{
					resultTitle.textContent = `All keys found: ${openRooms} ${roomWord} reachable.`;
					resultExplanation.textContent = "Every pickup has been collected. The remaining dark tiles, if any, are blocked by walls, closed doors, or one-way ledges.";
					nextActions.replaceChildren(summaryAction({ text: "Clear keys", action: "reset" }));
				}
				else
				{
					resultExplanation.textContent = "No new key is currently reachable. Auto-find mode can confirm the complete collect-and-repeat closure from this inventory.";
					nextActions.replaceChildren(summaryAction({ text: "Let Lean auto-find pickups →", action: "auto" }));
				}
			}
		}
	};

	const buildGraph = () => {
		const vertexCount = ROOM_COUNT * ROOM_SIZE;
		const rows = Array.from({ length: vertexCount }, () => []);
		const addEdge = (source, target, requirement = NONE) => rows[source].push({ target, requirement });
		for(const room of rooms)
		{
			for(let tile = 0; tile < ROOM_SIZE; tile += 1)
			{
				const point = tilePoint(tile);
				for(const direction of DIRECTIONS)
				{
					const x = point.x + direction.dx;
					const y = point.y + direction.dy;
					if(x < 0 || x >= ROOM_WIDTH || y < 0 || y >= ROOM_HEIGHT) continue;
					const target = tileIndex(x, y);
					if(room.ledges.has(`${target}:${tile}`) && !room.ledges.has(`${tile}:${target}`)) continue;
					addEdge(vertexIndex(room.id, tile), vertexIndex(room.id, target));
				}
			}
		}
		for(const door of doors)
		{
			if(door.closed) continue;
			addEdge(vertexIndex(door.roomA, door.tileA), vertexIndex(door.roomB, door.tileB), door.requirement);
			addEdge(vertexIndex(door.roomB, door.tileB), vertexIndex(door.roomA, door.tileA), door.requirement);
		}
		const offsets = new Uint32Array(vertexCount + 1);
		const targets = [];
		const requirements = [];
		for(let source = 0; source < vertexCount; source += 1)
		{
			for(const edge of rows[source])
			{
				targets.push(edge.target);
				requirements.push(edge.requirement);
			}
			offsets[source + 1] = targets.length;
		}
		const allowedVertices = new Uint32Array(vertexCount);
		const grants = new Uint32Array(vertexCount);
		grants.fill(NONE);
		for(const room of rooms)
		{
			for(let tile = 0; tile < ROOM_SIZE; tile += 1)
			{
				const vertex = vertexIndex(room.id, tile);
				allowedVertices[vertex] = room.tiles[tile];
				grants[vertex] = room.grants[tile];
			}
		}
		return {
			vertexCount, offsets
			, targets: Uint32Array.from(targets)
			, requirements: Uint32Array.from(requirements)
			, allowedVertices, grants
			, start: vertexIndex(entrance.room, entrance.tile)
		};
	};

	const solve = async () => {
		const version = ++solveVersion;
		status.textContent = "Computing certified closure…";
		const graph = buildGraph();
		const started = performance.now();
		let result;
		if(inventoryMode === "auto")
		{
			result = await reachableWithCapabilities({
				...graph
				, capabilityCount: CAPABILITY_COUNT
				, initialCapabilities: Uint32Array.from([...selectedKeys].sort())
			});
		}
		else
		{
			const allowedEdges = Uint32Array.from(graph.requirements, requirement =>
				Number(requirement === NONE || selectedKeys.has(requirement)));
			result = {
				vertices: await reachable({ ...graph, allowedEdges })
				, capabilities: Uint32Array.from([...selectedKeys])
			};
		}
		if(version !== solveVersion) return;
		runtime.textContent = (performance.now() - started).toFixed(2);
		reachableVertices = new Set(result.vertices);
		acquiredKeys = new Set(result.capabilities);
		const openRooms = rooms.filter(room => [...Array(ROOM_SIZE).keys()]
			.some(tile => reachableVertices.has(vertexIndex(room.id, tile)))).length;
		status.textContent = `Lean/Wasm · ${openRooms}/${ROOM_COUNT} rooms · ${result.vertices.length} tiles`;
		renderResultSummary(openRooms, result);
		render();
	};

	const installPickers = () => {
		keyPicker.replaceChildren(...KEY_META.map((key, index) => {
			const button = document.createElement("button");
			button.textContent = key.glyph;
			button.title = `Place ${key.name}`;
			button.style.color = key.color;
			button.className = index === selectedKey ? "active" : "";
			scope.listen(button, "click", () => { selectedKey = index; installPickers(); });
			return button;
		}));
		directionPicker.replaceChildren(...LEDGE_MODES.map(mode => {
			const button = document.createElement("button");
			button.textContent = mode.label;
			const description = mode.directions.length === 1
				? `One edge: allow movement ${mode.key}`
				: `Corner: allow separate ${mode.directions.join(" and ")} moves`;
			button.title = description;
			button.setAttribute("aria-label", description);
			button.dataset.ledgeMode = mode.key;
			button.className = `${mode.key === ledgeMode ? "active" : ""}${mode.directions.length === 2 ? " corner" : ""}`.trim();
			scope.listen(button, "click", () => { ledgeMode = mode.key; installPickers(); });
			return button;
		}), (() => {
			const button = document.createElement("button");
			button.textContent = "× Erase";
			button.title = "Erase one-way ledges";
			button.className = ledgeMode === "erase" ? "active erase" : "erase";
			scope.listen(button, "click", () => { ledgeMode = "erase"; installPickers(); });
			return button;
		})());
		keyPicker.hidden = editor !== "key";
		directionPicker.hidden = editor !== "ledge";
	};

	const renderInventoryMode = () => {
		for(const candidate of root.querySelectorAll(".inventory-mode"))
		{
			const active = candidate.dataset.inventory === inventoryMode;
			candidate.classList.toggle("active", active);
			candidate.setAttribute("aria-checked", String(active));
		}
		inventoryHelp.textContent = inventoryMode === "auto"
			? "Selected keys are starting inventory. Lean also collects reachable pickups and repeats to a proven fixed point."
			: "Click the keys below to say exactly which ones the player has found.";
	};
	const setInventoryMode = mode => {
		inventoryMode = mode;
		renderInventoryMode();
		void solve();
	};

	for(const button of root.querySelectorAll(".inventory-mode"))
	{
		scope.listen(button, "click", () => setInventoryMode(button.dataset.inventory));
	}
	for(const button of root.querySelectorAll(".tool"))
	{
		scope.listen(button, "click", () => {
			editor = button.dataset.tool;
			editorToolHelp.textContent = TOOL_HELP[editor];
			for(const candidate of root.querySelectorAll(".tool"))
			{
				const active = candidate === button;
				candidate.classList.toggle("active", active);
				candidate.setAttribute("aria-checked", String(active));
			}
			installPickers();
		});
	}

	const applyDragTile = tile => {
		if(!dragState || dragState.visited.has(tile)) return;
		dragState.visited.add(tile);
		editTile(tile, dragState);
	};

	const tileUnderPointer = event => {
		const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".tile");
		if(!target || !roomGrid.contains(target) || target.disabled || target.classList.contains("door-tile")) return null;
		return Number(target.dataset.tile);
	};

	scope.listen(roomGrid, "pointerdown", event => {
		if(!event.isPrimary || event.button !== 0 || !editorDisclosure.open) return;
		const tile = tileUnderPointer(event);
		if(tile === null) return;
		event.preventDefault();
		dragState = {
			pointerId: event.pointerId
			, visited: new Set()
			, wallValue: null
			, keyValue: null
			, ledgeAction: null
		};
		roomGrid.setPointerCapture(event.pointerId);
		applyDragTile(tile);
	});
	scope.listen(roomGrid, "pointermove", event => {
		if(!dragState || dragState.pointerId !== event.pointerId) return;
		event.preventDefault();
		const tile = tileUnderPointer(event);
		if(tile !== null) applyDragTile(tile);
	});
	const finishDrag = event => {
		if(!dragState || dragState.pointerId !== event.pointerId) return;
		if(roomGrid.hasPointerCapture(event.pointerId)) roomGrid.releasePointerCapture(event.pointerId);
		dragState = null;
	};
	scope.listen(roomGrid, "pointerup", finishDrag);
	scope.listen(roomGrid, "pointercancel", finishDrag);
	scope.listen(roomGrid, "lostpointercapture", () => { dragState = null; });
	scope.listen(editorDisclosure, "toggle", () => {
		const editing = editorDisclosure.open;
		editorState.textContent = editing ? "Active" : "Paused";
		roomEditState.textContent = editing ? "Editing is active." : "Editing is paused.";
		roomEditCopy.textContent = editing
			? "Click or drag with the selected tool; gold door tiles have separate key and open/closed controls."
			: "Open Room tile editor to change walls, keys, ledges, or the starting point. Door locks remain interactive.";
		renderRoom();
	});
	scope.listen(nextActions, "click", event => {
		const button = event.target.closest("button");
		if(!button || !nextActions.contains(button)) return;
		if(button.dataset.action === "key")
		{
			selectedKeys.add(Number(button.dataset.key));
			void solve();
		}
		else if(button.dataset.action === "auto") setInventoryMode("auto");
		else
		{
			selectedKeys.clear();
			setInventoryMode("manual");
		}
	});
	scope.listen(root.querySelector("#new-map"), "click", () => {
		const values = new Uint32Array(1);
		crypto.getRandomValues(values);
		generateMap(values[0]);
		void solve();
	});
	scope.listen(root.querySelector("#reset-edits"), "click", () => { generateMap(seed); void solve(); });
	scope.listen(seedButton, "click", async () => {
		try
		{
			await navigator.clipboard.writeText(seed.toString(16).padStart(8, "0"));
			seedButton.textContent = "copied";
		}
		catch
		{
	if(!scope.active) return; seedButton.textContent = "copy unavailable"; }
		scope.setTimeout(() => { seedButton.textContent = seed.toString(16).padStart(8, "0"); }, 900);
	});
	const observeWorldSize = scope.resizeObserver(() => scope.requestAnimationFrame(renderConnections));
	observeWorldSize.observe(world);

	const makeBenchmarkRequest = variant => {
		const width = 32;
		const height = 24;
		const vertexCount = width * height;
		const offsets = new Uint32Array(vertexCount + 1);
		const targets = [];
		for(let y = 0; y < height; y += 1)
		{
			for(let x = 0; x < width; x += 1)
			{
				const source = y * width + x;
				if(x > 0) targets.push(source - 1);
				if(x + 1 < width) targets.push(source + 1);
				if(y > 0) targets.push(source - width);
				if(y + 1 < height) targets.push(source + width);
				offsets[source + 1] = targets.length;
			}
		}
		const targetArray = Uint32Array.from(targets);
		const allowedVertices = Uint32Array.from({ length: vertexCount }, (_, vertex) =>
			Number(vertex === 0 || (vertex + variant * 7) % 19 !== 0));
		const requirements = Uint32Array.from(targetArray, (_, edge) =>
			(edge + variant * 13) % 97 === 0 ? (edge + variant) % CAPABILITY_COUNT : CAPABILITY_COUNT);
		const grants = Uint32Array.from({ length: vertexCount }, (_, vertex) =>
			vertex > 0 && (vertex + variant * 17) % 211 === 0
				? (vertex + variant) % CAPABILITY_COUNT : CAPABILITY_COUNT);
		return {
			allowedVertices, capabilityCount: CAPABILITY_COUNT, grants
			, initialCapabilities: new Uint32Array(), offsets, requirements, start: 0
			, targets: targetArray, vertexCount
		};
	};

	const javascriptReachable = (request, allowedEdges) => {
		if(!request.allowedVertices[request.start]) return new Uint32Array();
		const visited = new Uint8Array(request.vertexCount);
		const queue = new Uint32Array(request.vertexCount);
		let head = 0;
		let tail = 1;
		queue[0] = request.start;
		visited[request.start] = 1;
		while(head < tail)
		{
			const source = queue[head++];
			for(let edge = request.offsets[source]; edge < request.offsets[source + 1]; edge += 1)
			{
				const target = request.targets[edge];
				if(allowedEdges[edge] && request.allowedVertices[target] && !visited[target])
				{
					visited[target] = 1;
					queue[tail++] = target;
				}
			}
		}
		return queue.slice(0, tail);
	};

	const javascriptCapabilityClosure = request => {
		const capabilities = new Uint8Array(request.capabilityCount);
		for(const capability of request.initialCapabilities) capabilities[capability] = 1;
		const allowedEdges = new Uint32Array(request.targets.length);
		let vertices;
		for(let round = 0; round <= request.capabilityCount; round += 1)
		{
			for(let edge = 0; edge < allowedEdges.length; edge += 1)
			{
				const requirement = request.requirements[edge];
				allowedEdges[edge] = Number(requirement === request.capabilityCount || capabilities[requirement]);
			}
			vertices = javascriptReachable(request, allowedEdges);
			let changed = false;
			for(const vertex of vertices)
			{
				const grant = request.grants[vertex];
				if(grant < request.capabilityCount && !capabilities[grant])
				{
					capabilities[grant] = 1;
					changed = true;
				}
			}
			if(!changed)
			{
				return {
					capabilities: Uint32Array.from(capabilities.keys()).filter(capability => capabilities[capability])
					, vertices
				};
			}
		}
		throw new Error("JavaScript capability closure did not stabilize");
	};

	const sameValues = (left, right) => {
		if(left.length !== right.length) return false;
		const leftValues = [...left].sort((first, second) => first - second);
		const rightValues = [...right].sort((first, second) => first - second);
		return leftValues.every((value, index) => value === rightValues[index]);
	};

	const benchmarkRequest = makeBenchmarkRequest(0);
	let benchmarkSolve;

	const initialSeed = new Uint32Array(1);
	crypto.getRandomValues(initialSeed);
	if(saved.rooms?.length)
	{
		({ seed, rooms, doors, entrance, selectedRoom, editor, selectedKey, ledgeMode, inventoryMode, selectedKeys } = saved);
		editorDisclosure.open = saved.editorOpen;
	}
	else generateMap(initialSeed[0]);
	seedButton.textContent = seed.toString(16).padStart(8, "0");
	renderInventoryMode();
	editorToolHelp.textContent = TOOL_HELP[editor];
	for(const button of root.querySelectorAll(".tool"))
	{
		const active = button.dataset.tool === editor;
		button.classList.toggle("active", active);
		button.setAttribute("aria-checked", String(active));
	}
	installPickers();
	render();
	const demoReady = ready().then(solve);
	let benchmarkReady;
	let benchmarkGeneration = 0;
	const prepareBenchmark = () => {
		const generation = benchmarkGeneration;
		benchmarkReady ??= demoReady.then(() => prepareCapabilityClosure(benchmarkRequest)).then(solver => {
			if(generation !== benchmarkGeneration) solver.dispose();
			else benchmarkSolve = solver;
		});
		return benchmarkReady;
	};
	demoReady.catch(error => {
	if(!scope.active) return;
	scope.fail(error);
		status.textContent = "Lean/Wasm failed to load";
		console.error(error);
	});

	scope.benchmark({
		root: root.querySelector("#browser-benchmark")
		, prepare: prepareBenchmark
		, sample: async () => {
			const request = benchmarkRequest;
			const lean = measureSyncBenchmark(() => benchmarkSolve());
			const javascript = measureSyncBenchmark(() => javascriptCapabilityClosure(request));
			if(!sameValues(lean.result.vertices, javascript.result.vertices)
				|| !sameValues(lean.result.capabilities, javascript.result.capabilities)) {
				throw new Error("Lean and JavaScript returned different capability closures");
				}
			return { javascriptMs: javascript.milliseconds, leanMs: lean.milliseconds };
		}
		, summarize: ({ javascriptMedian, leanMedian, trialCount }) => {
			const request = benchmarkRequest;
			return `${request.vertexCount} vertices · ${request.targets.length} directed edges · `
				+ `${trialCount} closures agreed · +${(leanMedian - javascriptMedian).toFixed(2)} ms`;
		}
	});
	scope.listen(globalThis, "pagehide", () => {
		solveVersion++;
		dragState = null;
		scope.cancelAnimationFrame(solveFrame);
		solveFrame = 0;
		benchmarkGeneration++;
		benchmarkReady = undefined;
		benchmarkSolve?.dispose();
		benchmarkSolve = undefined;
	});
	scope.listen(globalThis, "pageshow", event => {
		if(event.persisted) void solve();
	});
};
