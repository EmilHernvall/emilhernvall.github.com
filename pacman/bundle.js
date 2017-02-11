/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var newMapFromImage = __webpack_require__(1).newMapFromImage,
	    createGameState = __webpack_require__(2),
	    createGui = __webpack_require__(4);

	var runGame = function runGame(gameMap) {
	    var gameState = createGameState(gameMap);
	    var gui = createGui(document.querySelector("#game"));

	    var tick = function tick() {
	        gameState = gameState.tick(gui.keyMap);

	        gui.drawMap(gameMap);
	        gui.drawState(gameState);

	        if (gameState.isGameOver()) {
	            gui.drawGameOver(gameState);
	            console.log("Game Over!");
	            return;
	        }

	        requestAnimationFrame(tick);
	    };

	    gui.onClick = function () {
	        if (gameState.isGameOver()) {
	            gameState = createGameState(gameMap);
	            tick();
	        }
	    };

	    tick();
	};

	window.addEventListener("load", function (e) {
	    console.log("Initializing pacman");
	    console.log("Loading map...");
	    var imageOfMap = new Image();
	    imageOfMap.addEventListener("load", function (e) {
	        console.log("Map loaded:", "width =", imageOfMap.width, "height =", imageOfMap.height);

	        var map = newMapFromImage(imageOfMap);

	        runGame(map);
	    });
	    imageOfMap.src = "map.png";
	});

/***/ },
/* 1 */
/***/ function(module, exports) {

	"use strict";

	var BITS_PER_COORDINATE = 5,
	    MAX_MAP_WIDTH = 1 << 5,
	    MAX_MAP_HEIGHT = 1 << 5,
	    BUFFER_SLOTS = 1 << 2 * BITS_PER_COORDINATE,
	    COORDINATE_BIT_MASK = (1 << 5) - 1;

	var SLOTTYPE_EMPTY = 0,
	    SLOTTYPE_WALL = 1,
	    SLOTTYPE_PLAYERSTART = 2,
	    SLOTTYPE_GHOSTSTART = 3,
	    SLOTTYPE_GHOSTESCAPE = 4,
	    SLOTTYPE_PELLET = 5,
	    SLOTTYPE_SUPERPILL = 6;

	var packCoords = function packCoords(x, y) {
	    return (x & COORDINATE_BIT_MASK) << BITS_PER_COORDINATE | y & COORDINATE_BIT_MASK;
	};

	var unpackCoords = function unpackCoords(c) {
	    var x = c >> BITS_PER_COORDINATE & COORDINATE_BIT_MASK,
	        y = c & COORDINATE_BIT_MASK;

	    return { x: x, y: y };
	};

	var newMapFromImage = function newMapFromImage(imageOfMap) {
	    var width = imageOfMap.width,
	        height = imageOfMap.height;

	    var localCanvas = document.createElement("CANVAS");
	    localCanvas.width = width;
	    localCanvas.height = height;

	    var ctx = localCanvas.getContext("2d");
	    ctx.drawImage(imageOfMap, 0, 0, width, height);

	    var data = ctx.getImageData(0, 0, width, height).data;
	    var mapData = new Uint8Array(BUFFER_SLOTS);
	    for (var idx = 0; idx < data.length; idx += 4) {
	        var properIdx = idx / 4,
	            x = properIdx % width,
	            y = properIdx / width | 0,
	            newIdx = packCoords(x, y),
	            r = data[idx + 0],
	            g = data[idx + 1],
	            b = data[idx + 2],
	            c = r << 16 | g << 8 | b;

	        if (c === 0xFFFFFF) {
	            mapData[newIdx] = SLOTTYPE_EMPTY;
	        } else if (c === 0xFF0000) {
	            mapData[newIdx] = SLOTTYPE_GHOSTSTART;
	        } else if (c === 0x00FF00) {
	            mapData[newIdx] = SLOTTYPE_PLAYERSTART;
	        } else if (c === 0x0000FF) {
	            mapData[newIdx] = SLOTTYPE_GHOSTESCAPE;
	        } else if (c === 0xFFFF00) {
	            mapData[newIdx] = SLOTTYPE_PELLET;
	        } else if (c === 0xFF00FF) {
	            mapData[newIdx] = SLOTTYPE_SUPERPILL;
	        } else {
	            mapData[newIdx] = SLOTTYPE_WALL;
	        }
	    }

	    return createMap(width, height, mapData);
	};

	var createMap = function createMap(width, height, buffer) {
	    return {
	        width: width,
	        height: height,
	        buffer: buffer,
	        getAdjacentPaths: function getAdjacentPaths(x, y) {
	            var _this = this;

	            var paths = [];

	            paths.push({ x: x, y: y - 1 }); // Above
	            paths.push({ x: x - 1, y: y }); // Left
	            paths.push({ x: x + 1, y: y }); // Right
	            paths.push({ x: x, y: y + 1 }); // Below

	            return paths.filter(function (p) {
	                return !_this.isWall(p.x, p.y) || _this.isGhostEscape(p.x, p.y);
	            });
	        },
	        getAdjacentWalls: function getAdjacentWalls(x, y) {
	            var adjacent = {};

	            adjacent.top = this.isWall(x, y - 1);
	            adjacent.left = this.isWall(x - 1, y);
	            adjacent.right = this.isWall(x + 1, y);
	            adjacent.bottom = this.isWall(x, y + 1);

	            return adjacent;
	        },
	        isWall: function isWall(x, y) {
	            var c = this.buffer[packCoords(x, y)];
	            return c === SLOTTYPE_WALL || c == SLOTTYPE_GHOSTESCAPE;
	        },
	        isGhostEscape: function isGhostEscape(x, y) {
	            var c = this.buffer[packCoords(x, y)];
	            return c == SLOTTYPE_GHOSTESCAPE;
	        },
	        getBlocksBySlotType: function getBlocksBySlotType(type) {
	            var result = [];
	            for (var i = 0; i < buffer.length; i++) {
	                var c = buffer[i];
	                if (c == type) {
	                    result.push(unpackCoords(i));
	                }
	            }

	            return result;
	        },
	        getPlayerStart: function getPlayerStart() {
	            return this.getBlocksBySlotType(SLOTTYPE_PLAYERSTART)[0];
	        },
	        getGhostStarts: function getGhostStarts() {
	            return this.getBlocksBySlotType(SLOTTYPE_GHOSTSTART);
	        },
	        getPellets: function getPellets() {
	            return this.getBlocksBySlotType(SLOTTYPE_PELLET);
	        },
	        getSuperPills: function getSuperPills() {
	            return this.getBlocksBySlotType(SLOTTYPE_SUPERPILL);
	        }
	    };
	};

	module.exports = {
	    BUFFER_SLOTS: BUFFER_SLOTS,
	    MAX_MAP_WIDTH: MAX_MAP_WIDTH,
	    MAX_MAP_HEIGHT: MAX_MAP_HEIGHT,
	    SLOTTYPE_EMPTY: SLOTTYPE_EMPTY,
	    SLOTTYPE_WALL: SLOTTYPE_WALL,
	    SLOTTYPE_PLAYERSTART: SLOTTYPE_PLAYERSTART,
	    SLOTTYPE_GHOSTSTART: SLOTTYPE_GHOSTSTART,
	    SLOTTYPE_GHOSTESCAPE: SLOTTYPE_GHOSTESCAPE,
	    unpackCoords: unpackCoords,
	    packCoords: packCoords,
	    newMapFromImage: newMapFromImage,
	    createMap: createMap
	};

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var findClosestPath = __webpack_require__(3).findClosestPath;

	var TICKS_PER_PLAYER_MOVE = 15,
	    TICKS_PER_GHOST_MOVE = 30,
	    TICKS_PER_RETURNING_GHOST_MOVE = 15,
	    SUPER_MODE_DURATION = 600;

	var createEntity = function createEntity(pos, den) {
	    return {
	        x: pos.x,
	        y: pos.y,
	        px: pos.x,
	        py: pos.y,
	        ticks: 0,
	        den: den,
	        returnToCage: false
	    };
	};

	var copyGhosts = function copyGhosts(ghosts) {
	    return ghosts.map(function (ghost) {
	        return {
	            x: ghost.x,
	            y: ghost.y,
	            px: ghost.px,
	            py: ghost.py,
	            ticks: ghost.ticks,
	            den: ghost.den,
	            returnToCage: ghost.returnToCage
	        };
	    });
	};

	var contains = function contains(set, pos) {
	    return set.filter(function (p) {
	        return p.x == pos.x && p.y == pos.y;
	    }).length > 0;
	};

	// Update the number of ticks for which each key has been pressed
	var calculateKeyCounters = function calculateKeyCounters(keyCounters, keyMap) {
	    return {
	        up: keyMap.up ? keyCounters.up + 1 : -1,
	        down: keyMap.down ? keyCounters.down + 1 : -1,
	        left: keyMap.left ? keyCounters.left + 1 : -1,
	        right: keyMap.right ? keyCounters.right + 1 : -1
	    };
	};

	// Calculate a new player position based on key counters
	var calculatePlayerStep = function calculatePlayerStep(map, player, keyCounters, ticks) {
	    var x = player.x,
	        y = player.y;

	    // We require that each key has been pressed for a certain number of ticks
	    // before making a change in position
	    var changed = false;
	    if (keyCounters.up % TICKS_PER_PLAYER_MOVE == 0) {
	        y--;changed = true;
	    } else if (keyCounters.down % TICKS_PER_PLAYER_MOVE == 0) {
	        y++;changed = true;
	    } else if (keyCounters.left % TICKS_PER_PLAYER_MOVE == 0) {
	        x--;changed = true;
	    } else if (keyCounters.right % TICKS_PER_PLAYER_MOVE == 0) {
	        x++;changed = true;
	    }

	    if (map.isWall(x, y)) {
	        return player;
	    }

	    // Handle teleportation tunnels
	    if (x >= map.width) {
	        x = 0;changed = false;
	    } else if (x < 0) {
	        x = map.width - 1;changed = false;
	    }

	    return {
	        x: x,
	        y: y,
	        px: changed ? player.x : player.px,
	        py: changed ? player.y : player.py,
	        ticks: changed ? ticks : player.ticks,
	        den: player.den
	    };
	};

	var calculateGhostStep = function calculateGhostStep(map, ghosts, playerPosition, ticks, superMode) {
	    var ghostStarts = map.getGhostStarts();
	    for (var i = 0; i < ghosts.length; i++) {
	        var ghost = ghosts[i],
	            start = ghostStarts[i];

	        // Wait until some time has passed before the ghosts awake
	        if (ticks < 5 * TICKS_PER_GHOST_MOVE) {
	            continue;
	        }

	        // Ghosts only mov on certain time steps, so for the most part
	        // we keep them still
	        if (ticks % TICKS_PER_GHOST_MOVE != 0 && !ghost.returnToCage) {
	            continue;
	        } else if (ticks % TICKS_PER_RETURNING_GHOST_MOVE != 0 && ghost.returnToCage) {
	            continue;
	        }

	        var bestPath = void 0;
	        // The ghost has been touched by the player in super mode, and is
	        // returning to the cage
	        if (ghost.returnToCage) {
	            bestPath = findClosestPath(map, ghost, start);
	            if (bestPath.length == 0) {
	                ghost.returnToCage = false;
	                ghost.den = TICKS_PER_GHOST_MOVE;
	            }
	        }
	        // When the player is in supermode, the ghosts are afraid of the player
	        // and wants to get as far away as possible
	        else if (superMode) {
	                (function () {

	                    // We do this by enumerating the four corners of the map, and
	                    // ranking them based on how far away they are from the player.
	                    var corners = [];
	                    corners.push({ x: 1, y: 1 });
	                    corners.push({ x: map.width - 2, y: 1 });
	                    corners.push({ x: 1, y: map.height - 2 });
	                    corners.push({ x: map.width - 2, y: map.height - 2 });

	                    var distanceFromPlayer = function distanceFromPlayer(p) {
	                        return Math.abs(p.x - playerPosition.x) + Math.abs(p.y - playerPosition.y);
	                    };
	                    corners.sort(function (a, b) {
	                        return distanceFromPlayer(b) - distanceFromPlayer(a);
	                    });

	                    // Then we successively try different corners until we find one
	                    // with a path that doesn't intersect the player position.
	                    var _iteratorNormalCompletion = true;
	                    var _didIteratorError = false;
	                    var _iteratorError = undefined;

	                    try {
	                        for (var _iterator = corners[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
	                            var corner = _step.value;

	                            bestPath = findClosestPath(map, ghost, corner);
	                            if (!contains(bestPath, playerPosition)) {
	                                break;
	                            }
	                        }
	                    } catch (err) {
	                        _didIteratorError = true;
	                        _iteratorError = err;
	                    } finally {
	                        try {
	                            if (!_iteratorNormalCompletion && _iterator.return) {
	                                _iterator.return();
	                            }
	                        } finally {
	                            if (_didIteratorError) {
	                                throw _iteratorError;
	                            }
	                        }
	                    }
	                })();
	            }
	            // Normally the ghosts will move towarsd the player
	            else {
	                    // Perform an A* search for a path to the player
	                    bestPath = findClosestPath(map, ghost, playerPosition);
	                }

	        // If we're at our target, don't move
	        if (bestPath.length == 0) {
	            continue;
	        }

	        // Limit the chance of ghosts escaping the cage
	        var ghostEscapeDisallowed = Math.random() * 100 < 90;

	        // Check if the escape hatch is in the path of the active route
	        var ghostEscapeInPath = bestPath.filter(function (p) {
	            return map.isGhostEscape(p.x, p.y);
	        }).length > 0;

	        // Tentative step towards the player, popped after we check the ghost
	        // escape path in case the next step is the escape hatch
	        var nextStep = bestPath.pop();

	        // If:
	        //  * The ghost is in the cage...
	        //  * ...which implies that it isn't returning _to_ the cage...
	        //  * ...and ghost escape isn't allowed...
	        // the ghost will shuffle around randomly.
	        if (ghostEscapeInPath && ghostEscapeDisallowed && !ghost.returnToCage) {

	            // Pick a random move towards a position that is unoccupied
	            var adj = map.getAdjacentPaths(ghost.x, ghost.y).filter(function (p) {
	                return !map.isGhostEscape(p.x, p.y) && !contains(ghosts, p);
	            });
	            if (adj.length > 0) {
	                nextStep = adj[Math.random() * adj.length | 0];
	            } else {
	                continue;
	            }
	        }

	        // Otherwise, perform normal path finding.
	        else {
	                // ...unless the block is already occupied
	                if (contains(ghosts, nextStep) && !ghost.returnToCage) {
	                    continue;
	                }
	            }

	        ghost.px = ghost.x;
	        ghost.py = ghost.y;
	        ghost.x = nextStep.x;
	        ghost.y = nextStep.y;
	        ghost.ticks = ticks;
	    }

	    return ghosts;
	};

	var createGameState = function createGameState(map) {
	    return {
	        map: map,
	        playerPositionPrev: null,
	        playerPosition: createEntity(map.getPlayerStart(), TICKS_PER_PLAYER_MOVE),
	        ghosts: map.getGhostStarts().map(function (p) {
	            return createEntity(p, TICKS_PER_GHOST_MOVE);
	        }),
	        pellets: map.getPellets(),
	        superPills: map.getSuperPills(),
	        ticks: 0,
	        score: 0,
	        superModeTick: -SUPER_MODE_DURATION,
	        keyCounters: {
	            up: -1,
	            down: -1,
	            left: -1,
	            right: -1
	        },
	        tick: function tick(keyMap) {
	            var score = this.score;

	            var keyCounters = calculateKeyCounters(this.keyCounters, keyMap);

	            var playerPosition = calculatePlayerStep(map, this.playerPosition, keyCounters, this.ticks);

	            var ghosts = calculateGhostStep(this.map, copyGhosts(this.ghosts), this.playerPosition, this.ticks, this.isSuperMode());

	            // When in supermode, a collision causes the ghosts to return to
	            // their starting position
	            if (this.isSuperMode()) {
	                var _iteratorNormalCompletion2 = true;
	                var _didIteratorError2 = false;
	                var _iteratorError2 = undefined;

	                try {
	                    for (var _iterator2 = ghosts[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
	                        var ghost = _step2.value;

	                        if (ghost.x == playerPosition.x && ghost.y == playerPosition.y) {

	                            ghost.returnToCage = true;
	                            ghost.den = TICKS_PER_RETURNING_GHOST_MOVE;
	                            score += 10;
	                            console.log("Ghost beaten! score=" + score);
	                        }
	                    }
	                } catch (err) {
	                    _didIteratorError2 = true;
	                    _iteratorError2 = err;
	                } finally {
	                    try {
	                        if (!_iteratorNormalCompletion2 && _iterator2.return) {
	                            _iterator2.return();
	                        }
	                    } finally {
	                        if (_didIteratorError2) {
	                            throw _iteratorError2;
	                        }
	                    }
	                }
	            }

	            // Check if on pellet
	            var pellets = this.pellets;
	            if (contains(pellets, playerPosition)) {
	                pellets = pellets.filter(function (p) {
	                    return p.x != playerPosition.x || p.y != playerPosition.y;
	                });
	                score++;
	                console.log("Pellet taken! Score: " + score);
	            }

	            var superPills = this.superPills;
	            var superModeTick = this.superModeTick;
	            if (contains(superPills, playerPosition)) {
	                superPills = superPills.filter(function (p) {
	                    return p.x != playerPosition.x || p.y != playerPosition.y;
	                });
	                superModeTick = this.ticks;
	                console.log("Super pill taken!");
	            }

	            return {
	                map: map,
	                playerPosition: playerPosition,
	                ghosts: ghosts,
	                keyCounters: keyCounters,
	                pellets: pellets,
	                superPills: superPills,
	                score: score,
	                superModeTick: superModeTick,
	                ticks: this.ticks + 1,
	                tick: this.tick,
	                isGameOver: this.isGameOver,
	                isSuperMode: this.isSuperMode
	            };
	        },
	        isSuperMode: function isSuperMode() {
	            return this.superModeTick + SUPER_MODE_DURATION > this.ticks;
	        },
	        isGameOver: function isGameOver() {
	            return !this.isSuperMode() && contains(this.ghosts, this.playerPosition);
	        }
	    };
	};

	module.exports = createGameState;

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";

	var mapModule = __webpack_require__(1),
	    packCoords = mapModule.packCoords,
	    unpackCoords = mapModule.unpackCoords;

	var NODE_OPEN = 1,
	    NODE_CLOSED = 2;

	var createNodeMap = function createNodeMap() {
	    return {
	        nodes: {},
	        set: function set(node, value) {
	            var c = packCoords(node.x, node.y);
	            this.nodes[c] = value;
	        },
	        get: function get(node) {
	            var c = packCoords(node.x, node.y);
	            return this.nodes[c];
	        },
	        getDefault: function getDefault(node, d) {
	            var c = packCoords(node.x, node.y);
	            var r = this.nodes[c];
	            return typeof r != "undefined" ? r : d;
	        },
	        contains: function contains(node) {
	            var c = packCoords(node.x, node.y);
	            return typeof this.nodes[c] !== "undefined";
	        }
	    };
	};

	var reconstructPath = function reconstructPath(cameFrom, current) {
	    var totalPath = [current];
	    while (cameFrom.contains(current)) {
	        current = cameFrom.get(current);
	        totalPath.push(current);
	    }

	    // remove start point
	    totalPath.pop();

	    return totalPath;
	};

	var costEstimate = function costEstimate(start, goal) {
	    return Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y);
	};

	var findShortest = function findShortest(nodeStateMap, scores) {
	    var bestNode = null,
	        minScore = Number.POSITIVE_INFINITY;
	    for (var idx in nodeStateMap.nodes) {
	        var value = nodeStateMap.nodes[idx],
	            score = scores.get(unpackCoords(idx));

	        if (value !== NODE_OPEN) {
	            continue;
	        }

	        if (score < minScore) {
	            bestNode = idx;
	            minScore = score;
	        }
	    }

	    return unpackCoords(bestNode);
	};

	var nodesRemaining = function nodesRemaining(nodeStateMap) {
	    return Object.values(nodeStateMap.nodes).filter(function (x) {
	        return x === NODE_OPEN;
	    }).length;
	};

	var findClosestPath = function findClosestPath(map, start, goal) {
	    var nodeStateMap = createNodeMap();
	    nodeStateMap.set(start, NODE_OPEN);

	    var cameFrom = createNodeMap();

	    var gScore = createNodeMap();
	    gScore.set(start, 0);

	    var fScore = createNodeMap();
	    fScore.set(start, costEstimate(start, goal));

	    while (nodesRemaining(nodeStateMap)) {
	        var current = findShortest(nodeStateMap, fScore);
	        if (current.x == goal.x && current.y == goal.y) {
	            return reconstructPath(cameFrom, current);
	        }

	        nodeStateMap.set(current, NODE_CLOSED);

	        var neighbors = map.getAdjacentPaths(current.x, current.y);
	        for (var i = 0; i < neighbors.length; i++) {
	            var neighbor = neighbors[i];
	            if (nodeStateMap.contains(neighbor)) {
	                continue;
	            }

	            var newScore = gScore.getDefault(current, Number.POSITIVE_INFINITY) + 1;
	            if (!nodeStateMap.contains(neighbor)) {
	                nodeStateMap.set(neighbor, NODE_OPEN);
	            } else if (newScore >= gScore.getDefault(neighbor, Number.POSITIVE_INFINITY)) {
	                continue;
	            }

	            cameFrom.set(neighbor, current);
	            gScore.set(neighbor, newScore);
	            fScore.set(neighbor, newScore + costEstimate(neighbor, goal));
	        }
	    }

	    return [];
	};

	module.exports = {
	    findClosestPath: findClosestPath
	};

/***/ },
/* 4 */
/***/ function(module, exports) {

	"use strict";

	var SCALEFACTOR = 30;

	module.exports = function (container) {

	    var canvas = document.createElement("CANVAS");
	    container.appendChild(canvas);

	    var result = {
	        canvas: canvas,
	        keyMap: {
	            left: false,
	            right: false,
	            up: false,
	            down: false
	        },
	        drawMap: function drawMap(map) {
	            var s = SCALEFACTOR,
	                width = s * map.width,
	                height = s * map.height;

	            this.canvas.width = width;
	            this.canvas.height = height;

	            var ctx = this.canvas.getContext("2d");

	            ctx.clearRect(0, 0, width, height);

	            var WALL_WIDTH = 2;
	            for (var y = 0; y < map.height; y++) {
	                for (var x = 0; x < map.width; x++) {
	                    if (map.isGhostEscape(x, y)) {
	                        ctx.fillStyle = "rgb(0,0,255)";
	                        ctx.fillRect(s * x, s * y, s, s);
	                    } else if (map.isWall(x, y)) {

	                        ctx.fillStyle = "#555555";
	                        ctx.fillRect(s * x, s * y, s, s);

	                        var adj = map.getAdjacentWalls(x, y);
	                        ctx.fillStyle = "#cccccc";

	                        var blockWidth = s - 2 * WALL_WIDTH,
	                            blockHeight = s - 2 * WALL_WIDTH;
	                        if (adj.left) {
	                            blockWidth += WALL_WIDTH;
	                        }
	                        if (adj.right) {
	                            blockWidth += WALL_WIDTH;
	                        }
	                        if (adj.top) {
	                            blockHeight += WALL_WIDTH;
	                        }
	                        if (adj.bottom) {
	                            blockHeight += WALL_WIDTH;
	                        }

	                        var blockLeft = s * x + WALL_WIDTH,
	                            blockTop = s * y + WALL_WIDTH;
	                        if (adj.left) {
	                            blockLeft -= WALL_WIDTH;
	                        }
	                        if (adj.top) {
	                            blockTop -= WALL_WIDTH;
	                        }
	                        ctx.fillRect(blockLeft, blockTop, blockWidth, blockHeight);
	                    }
	                }
	            }
	        },
	        drawState: function drawState(state) {
	            var s = SCALEFACTOR,
	                player = state.playerPosition;

	            var ctx = this.canvas.getContext("2d");

	            // Draw pellets
	            ctx.fillStyle = "rgb(255,255,0)";
	            state.pellets.forEach(function (pellet) {
	                var x = pellet.x,
	                    y = pellet.y;

	                ctx.beginPath();
	                ctx.arc(s * (x + 1 / 2), s * (y + 1 / 2), s / 5, 0, 2 * Math.PI, false);
	                ctx.fill();
	            });

	            // Draw super pills
	            ctx.fillStyle = "rgb(255,0,255)";
	            state.superPills.forEach(function (pill) {
	                var x = pill.x,
	                    y = pill.y;

	                ctx.beginPath();
	                ctx.arc(s * (x + 1 / 2), s * (y + 1 / 2), s / 4, 0, 2 * Math.PI, false);
	                ctx.fill();
	            });

	            // Draw player
	            var playerX = player.px,
	                playerY = player.py;
	            if (player.ticks + player.den < state.ticks) {
	                playerX = player.x;
	                playerY = player.y;
	            } else {
	                var progress = (state.ticks - player.ticks) / player.den,
	                    dx = progress * (player.x - player.px),
	                    dy = progress * (player.y - player.py);
	                playerX += dx;
	                playerY += dy;
	            }

	            if (state.isSuperMode()) {
	                ctx.fillStyle = "rgb(0,0,0)";
	            } else {
	                ctx.fillStyle = "rgb(0,255,0)";
	            }
	            ctx.beginPath();
	            ctx.arc(s * (playerX + 1 / 2), s * (playerY + 1 / 2), s / 2.5, 0, 2 * Math.PI, false);
	            ctx.fill();

	            // Draw ghosts
	            state.ghosts.forEach(function (ghost) {
	                var x = ghost.px,
	                    y = ghost.py;

	                if (ghost.ticks + ghost.den < state.ticks) {
	                    x = ghost.x;
	                    y = ghost.y;
	                } else {
	                    var _progress = (state.ticks - ghost.ticks) / ghost.den,
	                        _dx = _progress * (ghost.x - ghost.px),
	                        _dy = _progress * (ghost.y - ghost.py);
	                    x += _dx;
	                    y += _dy;
	                }

	                if (ghost.returnToCage) {
	                    ctx.fillStyle = "rgb(255,200,200)";
	                } else {
	                    ctx.fillStyle = "rgb(255,0,0)";
	                }

	                ctx.beginPath();
	                ctx.arc(s * (x + 1 / 2), s * (y + 1 / 2), s / 2.5, 0, 2 * Math.PI, false);
	                ctx.fill();
	            });
	        },
	        drawGameOver: function drawGameOver(state) {
	            var ctx = this.canvas.getContext("2d");
	            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
	            ctx.fillRect(0, 0, canvas.width, canvas.height);
	            ctx.fillStyle = "rgba(255, 100, 100, 1)";
	            ctx.font = "48px sans-serif";
	            ctx.textAlign = "center";
	            ctx.textBaseline = "middle";
	            ctx.fillText("GAME OVER", canvas.width / 2, 1 * canvas.height / 3);

	            ctx.font = "20px sans-serif";
	            ctx.textAlign = "center";
	            ctx.textBaseline = "middle";
	            ctx.fillStyle = "rgba(255, 255, 255, 1)";
	            ctx.fillText("Your score was: " + state.score, canvas.width / 2, canvas.height / 2);

	            ctx.font = "24px sans-serif";
	            ctx.textAlign = "center";
	            ctx.textBaseline = "middle";
	            ctx.fillStyle = "rgba(100, 255, 100, 1)";
	            ctx.fillText("Click to Retry", canvas.width / 2, 2 * canvas.height / 3);
	        }
	    };

	    canvas.addEventListener("click", function () {
	        if (result.onClick) {
	            result.onClick();
	        }
	    });

	    window.addEventListener("keydown", function (e) {
	        switch (e.keyCode) {
	            case 37:
	                this.keyMap.left = true;break;
	            case 38:
	                this.keyMap.up = true;break;
	            case 39:
	                this.keyMap.right = true;break;
	            case 40:
	                this.keyMap.down = true;break;
	        }
	    }.bind(result));

	    window.addEventListener("keyup", function (e) {
	        switch (e.keyCode) {
	            case 37:
	                this.keyMap.left = false;break;
	            case 38:
	                this.keyMap.up = false;break;
	            case 39:
	                this.keyMap.right = false;break;
	            case 40:
	                this.keyMap.down = false;break;
	        }
	    }.bind(result));

	    return result;
	};

/***/ }
/******/ ]);