/* ============================================================
   8 PUZZLE GAME — script.js
   Features:
   • Solvability check (parity)
   • Difficulty-based shuffle depth
   • A* solver with Manhattan distance heuristic
   • Hint system (highlights next best move)
   • Move counter, live timer, best score (localStorage)
   • Tile correct-position highlighting
   • Win overlay with stats
   • Notifications
   ============================================================ */

(function () {
    'use strict';

    // ── Constants ──────────────────────────────────────────────
    const GOAL = [1, 2, 3, 4, 5, 6, 7, 8, 0]; // 0 = empty
    const GOAL_STR = GOAL.join(',');
    const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];  // up,down,left,right

    const SHUFFLE_MOVES = { easy: 15, medium: 40, hard: 80 };
    const SOLVE_STEP_MS = 250; // ms per auto-solve step

    // ── DOM ────────────────────────────────────────────────────
    const boardEl = document.getElementById('puzzle-board');
    const goalBoardEl = document.getElementById('goal-board');
    const moveCountEl = document.getElementById('move-count');
    const timerEl = document.getElementById('timer');
    const bestMovesEl = document.getElementById('best-moves');
    const winOverlay = document.getElementById('win-overlay');
    const winMovesEl = document.getElementById('win-moves');
    const winTimeEl = document.getElementById('win-time');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const solveBtn = document.getElementById('solve-btn');
    const hintBtn = document.getElementById('hint-btn');
    const playAgainBtn = document.getElementById('play-again-btn');
    const diffBtns = document.querySelectorAll('.diff-btn');

    // ── State ──────────────────────────────────────────────────
    let state = [...GOAL];   // current board (flat array)
    let moves = 0;
    let timerSec = 0;
    let timerInterval = null;
    let difficulty = 'easy';
    let isSolving = false;
    let solveTimeout = null;
    let gameWon = false;
    let started = false;      // first move flag
    let notifTimeout = null;

    // ── Storage keys ───────────────────────────────────────────
    const key = (d) => `8puzzle_best_${d}`;

    // ===========================================================
    //  UTILS
    // ===========================================================

    function posOf(arr, val) {
        return arr.indexOf(val);
    }

    function rc(idx) {
        return { r: Math.floor(idx / 3), c: idx % 3 };
    }

    function idx(r, c) {
        return r * 3 + c;
    }

    function swapArr(arr, i, j) {
        const a = [...arr];
        [a[i], a[j]] = [a[j], a[i]];
        return a;
    }

    function isGoal(arr) {
        return arr.join(',') === GOAL_STR;
    }

    // Manhattan distance heuristic
    function heuristic(arr) {
        let h = 0;
        for (let i = 0; i < 9; i++) {
            const v = arr[i];
            if (v === 0) continue;
            const goalIdx = GOAL.indexOf(v);
            const cur = rc(i), goal = rc(goalIdx);
            h += Math.abs(cur.r - goal.r) + Math.abs(cur.c - goal.c);
        }
        return h;
    }

    // Count inversions to check solvability
    function countInversions(arr) {
        let inv = 0;
        const flat = arr.filter(x => x !== 0);
        for (let i = 0; i < flat.length; i++)
            for (let j = i + 1; j < flat.length; j++)
                if (flat[i] > flat[j]) inv++;
        return inv;
    }

    function isSolvable(arr) {
        return countInversions(arr) % 2 === 0;
    }

    // ===========================================================
    //  TIMER
    // ===========================================================

    function startTimer() {
        if (timerInterval) return;
        timerInterval = setInterval(() => {
            timerSec++;
            timerEl.textContent = formatTime(timerSec);
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function resetTimer() {
        stopTimer();
        timerSec = 0;
        timerEl.textContent = '00:00';
    }

    function formatTime(s) {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const ss = (s % 60).toString().padStart(2, '0');
        return `${m}:${ss}`;
    }

    // ===========================================================
    //  BEST SCORE
    // ===========================================================

    function loadBest() {
        const v = localStorage.getItem(key(difficulty));
        return v ? parseInt(v) : null;
    }

    function saveBest(m) {
        const best = loadBest();
        if (best === null || m < best) {
            localStorage.setItem(key(difficulty), m);
            return true;
        }
        return false;
    }

    function renderBest() {
        const b = loadBest();
        bestMovesEl.textContent = b !== null ? b : '--';
    }

    // ===========================================================
    //  NOTIFICATION TOAST
    // ===========================================================

    function showNotification(msg) {
        let notif = document.querySelector('.notification');
        if (!notif) {
            notif = document.createElement('div');
            notif.className = 'notification';
            document.body.appendChild(notif);
        }
        notif.textContent = msg;
        clearTimeout(notifTimeout);
        notif.classList.remove('show');
        void notif.offsetWidth; // reflow
        notif.classList.add('show');
        notifTimeout = setTimeout(() => notif.classList.remove('show'), 2200);
    }

    // ===========================================================
    //  RENDER
    // ===========================================================

    function render(animate = false) {
        boardEl.innerHTML = '';
        state.forEach((val, i) => {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.setAttribute('role', 'gridcell');
            tile.dataset.index = i;
            tile.dataset.value = val;

            if (val === 0) {
                tile.classList.add('empty');
            } else {
                tile.textContent = val;

                // Mark tiles in correct position
                if (GOAL[i] === val) {
                    tile.classList.add('correct');
                }

                if (animate) {
                    tile.classList.add('moving');
                    tile.addEventListener('animationend', () => tile.classList.remove('moving'), { once: true });
                }

                tile.addEventListener('click', () => onTileClick(i));
            }
            boardEl.appendChild(tile);
        });
    }

    function renderGoalBoard() {
        goalBoardEl.innerHTML = '';
        GOAL.forEach(val => {
            const t = document.createElement('div');
            t.className = 'goal-tile' + (val === 0 ? ' goal-empty' : '');
            if (val !== 0) t.textContent = val;
            goalBoardEl.appendChild(t);
        });
    }

    // ===========================================================
    //  TILE INTERACTION
    // ===========================================================

    function onTileClick(clickedIdx) {
        if (isSolving || gameWon) return;

        const emptyIdx = posOf(state, 0);
        const { r: cr, c: cc } = rc(clickedIdx);
        const { r: er, c: ec } = rc(emptyIdx);

        // Only adjacent tiles (same row/col, distance 1) can slide
        const adjacent =
            (Math.abs(cr - er) === 1 && cc === ec) ||
            (Math.abs(cc - ec) === 1 && cr === er);

        if (!adjacent) return;

        // Start timer on first move
        if (!started) {
            started = true;
            startTimer();
        }

        state = swapArr(state, clickedIdx, emptyIdx);
        moves++;
        moveCountEl.textContent = moves;

        render(true);

        if (isGoal(state)) {
            handleWin();
        }
    }

    // ===========================================================
    //  WIN
    // ===========================================================

    function handleWin() {
        stopTimer();
        gameWon = true;
        const isNew = saveBest(moves);
        renderBest();

        winMovesEl.textContent = moves;
        winTimeEl.textContent = formatTime(timerSec);

        setTimeout(() => {
            winOverlay.classList.add('visible');
            if (isNew) {
                showNotification('🏆 New Best Score!');
            }
        }, 300);
    }

    // ===========================================================
    //  SHUFFLE
    // ===========================================================

    function shuffle() {
        cancelSolve();
        stopTimer();
        resetTimer();
        gameWon = false;
        started = false;
        moves = 0;
        moveCountEl.textContent = 0;
        winOverlay.classList.remove('visible');

        const depth = SHUFFLE_MOVES[difficulty];
        let cur = [...GOAL];
        let lastEmpty = posOf(cur, 0);
        let prevEmpty = -1;

        for (let i = 0; i < depth; i++) {
            const { r, c } = rc(lastEmpty);
            const neighbors = DIRS
                .map(([dr, dc]) => ({ ni: idx(r + dr, c + dc), r: r + dr, c: c + dc }))
                .filter(({ ni, r: nr, c: nc }) => nr >= 0 && nr < 3 && nc >= 0 && nc < 3 && ni !== prevEmpty);

            const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
            prevEmpty = lastEmpty;
            cur = swapArr(cur, lastEmpty, pick.ni);
            lastEmpty = pick.ni;
        }

        // Guarantee solvability (should always be, but safeguard)
        if (!isSolvable(cur)) {
            // Swap first two non-zero tiles
            const [a, b] = cur.reduce((acc, v, i) => v !== 0 && acc.length < 2 ? [...acc, i] : acc, []);
            cur = swapArr(cur, a, b);
        }

        state = cur;
        render();
        renderBest();
        showNotification('🎲 Board shuffled! Good luck!');
    }

    // ===========================================================
    //  A* SOLVER
    // ===========================================================

    function aStar(initial) {
        const startStr = initial.join(',');
        if (startStr === GOAL_STR) return [];

        // Priority queue (min-heap via sorted array for simplicity)
        const open = [];
        const gScore = new Map();
        const parent = new Map();
        const fScore = new Map();

        gScore.set(startStr, 0);
        const h0 = heuristic(initial);
        fScore.set(startStr, h0);
        open.push({ f: h0, g: 0, state: initial, str: startStr });

        while (open.length > 0) {
            // Find node with lowest f
            let minIdx = 0;
            for (let i = 1; i < open.length; i++) {
                if (open[i].f < open[minIdx].f) minIdx = i;
            }
            const current = open[minIdx];
            open.splice(minIdx, 1);

            if (current.str === GOAL_STR) {
                // Reconstruct path
                const path = [];
                let cur = current.str;
                while (parent.has(cur)) {
                    const { prev, move } = parent.get(cur);
                    path.unshift(move);
                    cur = prev;
                }
                return path;
            }

            const emptyPos = posOf(current.state, 0);
            const { r, c } = rc(emptyPos);

            for (const [dr, dc] of DIRS) {
                const nr = r + dr, nc = c + dc;
                if (nr < 0 || nr >= 3 || nc < 0 || nc >= 3) continue;

                const neighborIdx = idx(nr, nc);
                const nextState = swapArr(current.state, emptyPos, neighborIdx);
                const nextStr = nextState.join(',');
                const tentativeG = current.g + 1;

                if (!gScore.has(nextStr) || tentativeG < gScore.get(nextStr)) {
                    gScore.set(nextStr, tentativeG);
                    const h = heuristic(nextState);
                    const f = tentativeG + h;
                    fScore.set(nextStr, f);
                    parent.set(nextStr, { prev: current.str, move: neighborIdx });
                    open.push({ f, g: tentativeG, state: nextState, str: nextStr });
                }
            }

            // Safety limit to prevent infinite loop on large boards
            if (open.length > 100000) return null;
        }
        return null;
    }

    // ===========================================================
    //  AUTO SOLVE
    // ===========================================================

    function autoSolve() {
        if (isSolving || gameWon) return;
        if (isGoal(state)) {
            showNotification('✅ Already solved!');
            return;
        }

        showNotification('✨ Solving with A*…');
        isSolving = true;
        solveBtn.disabled = true;
        hintBtn.disabled = true;
        shuffleBtn.disabled = true;
        boardEl.classList.add('solving');

        // Run solver asynchronously after a tiny delay to let UI update
        setTimeout(() => {
            const path = aStar(state);

            if (!path || path === null) {
                isSolving = false;
                cancelSolve();
                showNotification('❌ Could not find a solution');
                return;
            }

            let stepIdx = 0;

            if (!started) {
                started = true;
                startTimer();
            }

            function step() {
                if (stepIdx >= path.length) {
                    finishSolve();
                    return;
                }
                const targetIdx = path[stepIdx++];
                const emptyIdx = posOf(state, 0);
                state = swapArr(state, emptyIdx, targetIdx);
                moves++;
                moveCountEl.textContent = moves;
                render(true);

                if (isGoal(state)) {
                    finishSolve();
                    return;
                }
                solveTimeout = setTimeout(step, SOLVE_STEP_MS);
            }

            step();
        }, 50);
    }

    function finishSolve() {
        isSolving = false;
        boardEl.classList.remove('solving');
        solveBtn.disabled = false;
        hintBtn.disabled = false;
        shuffleBtn.disabled = false;
        if (isGoal(state)) handleWin();
    }

    function cancelSolve() {
        if (solveTimeout) {
            clearTimeout(solveTimeout);
            solveTimeout = null;
        }
        isSolving = false;
        boardEl.classList.remove('solving');
        solveBtn.disabled = false;
        hintBtn.disabled = false;
        shuffleBtn.disabled = false;
    }

    // ===========================================================
    //  HINT
    // ===========================================================

    function showHint() {
        if (isSolving || gameWon) return;
        if (isGoal(state)) {
            showNotification('✅ Already solved!');
            return;
        }

        const path = aStar(state);
        if (!path || path.length === 0) {
            showNotification('🤔 No hint available');
            return;
        }

        // The next tile to move is the tile currently at path[0]
        const nextTileIdx = path[0];
        const tiles = boardEl.querySelectorAll('.tile');
        tiles.forEach(t => t.classList.remove('hint-tile'));

        const hintTile = tiles[nextTileIdx];
        if (hintTile) {
            hintTile.classList.add('hint-tile');
            hintTile.addEventListener('animationend', () => {
                hintTile.classList.remove('hint-tile');
            }, { once: true });
        }

        showNotification('💡 Hint: highlighted tile should move next!');
    }

    // ===========================================================
    //  DIFFICULTY
    // ===========================================================

    function setDifficulty(d) {
        difficulty = d;
        diffBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.diff === d);
        });
        renderBest();
    }

    // ===========================================================
    //  KEYBOARD SUPPORT
    // ===========================================================

    document.addEventListener('keydown', (e) => {
        if (isSolving || gameWon) return;

        const emptyIdx = posOf(state, 0);
        const { r: er, c: ec } = rc(emptyIdx);

        let targetR = er, targetC = ec;

        switch (e.key) {
            case 'ArrowUp': targetR = er + 1; break; // tile below slides up
            case 'ArrowDown': targetR = er - 1; break; // tile above slides down
            case 'ArrowLeft': targetC = ec + 1; break;
            case 'ArrowRight': targetC = ec - 1; break;
            default: return;
        }

        e.preventDefault();

        if (targetR < 0 || targetR >= 3 || targetC < 0 || targetC >= 3) return;
        onTileClick(idx(targetR, targetC));
    });

    // ===========================================================
    //  EVENT LISTENERS
    // ===========================================================

    shuffleBtn.addEventListener('click', shuffle);
    solveBtn.addEventListener('click', autoSolve);
    hintBtn.addEventListener('click', showHint);
    playAgainBtn.addEventListener('click', shuffle);

    diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setDifficulty(btn.dataset.diff);
            shuffle();
        });
    });

    // ===========================================================
    //  INIT
    // ===========================================================

    function init() {
        renderGoalBoard();
        renderBest();
        shuffle();
    }

    init();

})();
