# 8 Puzzle Game

A beautifully designed, interactive 8-puzzle sliding tile game built with HTML, CSS, and JavaScript. Solve the puzzle by arranging the tiles in numerical order!

## 🌟 Features

*   **Interactive Gameplay:** Click or use keyboard arrow keys to slide tiles into the empty space.
*   **Difficulty Levels:** Choose between Easy, Medium, and Hard. The shuffle depth adjusts based on your chosen difficulty.
*   **Auto-Solver (A* Algorithm):** Stuck? Watch the game solve itself using the A* search algorithm with a Manhattan distance heuristic.
*   **Hint System:** Get a nudge in the right direction. The game highlights the next best move to help you progress.
*   **Solvability Guarantee:** Every generated puzzle is mathematically guaranteed to be solvable (parity check).
*   **Real-time Stats:** Track your current moves and time.
*   **Best Score Tracking:** Your best (fewest) moves for each difficulty are saved locally in your browser.
*   **Visual Cues:** Tiles in their correct positions are highlighted for easier visual tracking.
*   **Keyboard Support:** Play seamlessly using the Arrow keys (`Up`, `Down`, `Left`, `Right`).
*   **Responsive Design:** Beautiful, modern UI with a clean layout and visual effects.

## 🚀 How to Play

1.  **Start:** The board starts shuffled based on the selected difficulty. The timer starts on your first move.
2.  **Move:** Click an adjacent tile to slide it into the empty space, or use your keyboard's arrow keys.
3.  **Goal:** Arrange the tiles in order from 1 to 8, with the empty space at the very end. A preview of the goal state is shown on the screen.
4.  **Win:** Once the tiles are in the correct order, a victory screen will appear showing your stats!

### Controls
*   **Mouse/Touch:** Click or tap a tile adjacent to the empty space to move it.
*   **Keyboard:** Use arrow keys to slide tiles towards the empty space. (e.g., `Up Arrow` slides the tile *below* the empty space upwards).

## 🛠️ Built With

*   **HTML5**
*   **CSS3** (Custom properties, Flexbox, CSS Grid, Animations)
*   **JavaScript (ES6+)** (Vanilla JS, DOM Manipulation, A* Pathfinding Algorithm)

## 💻 Installation & Usage

This game requires no installation or build steps. It runs entirely in your web browser.

1.  Clone this repository or download the files.
2.  Open `index.html` in your favorite modern web browser (Chrome, Firefox, Safari, Edge).
3.  Enjoy the game!

## 🧠 Technical Details

*   **A* Solver:** The auto-solve and hint features utilize the A* search algorithm. It uses the **Manhattan Distance** as its heuristic to efficiently find the optimal path to the solution without exploring unnecessary states.
*   **Solvability Check:** The game calculates the number of "inversions" during the shuffle phase. An 8-puzzle is only solvable if the number of inversions is even. The game ensures every puzzle presented is solvable.
