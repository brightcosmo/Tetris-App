/*---------------------------------------------------------------------
|  Import statements
*-------------------------------------------------------------------*/
import { normalizeArray } from "discord.js";
import "./style.css";

import { fromEvent, interval, merge, Observable, switchMap, tap } from "rxjs";
import { map, filter, scan } from "rxjs/operators";

/*---------------------------------------------------------------------
|  Constants provided by the template
*-------------------------------------------------------------------*/

const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
  PREVIEW_WIDTH: 160,
  PREVIEW_HEIGHT: 80,
} as const;

const Constants = {
  TICK_RATE_MS: 500,
  BOARD_WIDTH: 10,
  BOARD_HEIGHT: 20,
  SCORE_PER_ROW: 10,
  BONUS_SCORE: 100,
} as const;

const BlockConstants = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.BOARD_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.BOARD_HEIGHT,
};

/*---------------------------------------------------------------------
|  Accepted keys and events
*-------------------------------------------------------------------*/
type Key = "KeyS" | "KeyA" | "KeyD" | "KeyR" | "KeyW" | "KeyH";

type Event = "keydown" | "keyup" | "keypress";

/*---------------------------------------------------------------------
|  Random generation of blocks
*-------------------------------------------------------------------*/
interface LazySequence<T> {
  value: T;
  next(): LazySequence<T>;
}

// an iterator which returns random numbers via next()
class RandomNumberSequence implements LazySequence<number> {
  private m = 0x80000000;
  private a = 1103515245;
  private c = 12345;

  private hash = (seed: number) => (this.a * seed + this.c) % this.m;
  private scale = (hash: number) => hash / (this.m - 1);

  private seed: number;

  // number range is integers from 1-7
  constructor(seed: number) {
    this.seed = seed;
    this.value = Math.floor(this.scale(this.hash(this.seed)) * 7) + 1; 
  }
  value: number;

  next(): RandomNumberSequence {
    this.seed = this.hash(this.seed);
    return new RandomNumberSequence(this.seed);
  }
}

// Math.random() is impure but allowed according to https://edstem.org/au/courses/11819/discussion/1508117
const seed = Math.random();
const sequence: LazySequence<number> = new RandomNumberSequence(seed);

const getNextBlock = (): BlockGroup => {
  const num = sequence.next().value;
  switch (num) {
    case 1:
      return IBLOCK;
    case 2:
      return OBLOCK;
    case 3:
      return TBLOCK;
    case 4:
      return JBLOCK;
    case 5:
      return LBLOCK;
    case 6:
      return SBLOCK;
    default:
      return ZBLOCK;
  }
};

/*---------------------------------------------------------------------
|  Types and Constants - includes state, blocks, etc
*-------------------------------------------------------------------*/
type State = Readonly<{
  gameEnd: boolean;
  boardState: number[][];
  currentBlock: BlockGroup;
  nextBlock: BlockGroup;
  heldBlock: BlockGroup | null;
  holdStatus: boolean;
  RNG: LazySequence<number>;
  score: number;
  highScore: number;
  level: number;
}>;

type Block = Readonly<{
  x: number;
  y: number;
}>;

type BlockGroup = Readonly<{
  group: Block[];
  currentRotation: number;
  name: string;
  style: string;
}>;

const STYLES = {
  aqua: "fill: #00ffff; stroke: black; stroke-width: 2px; z-index: 2",
  yellow: "fill: #ffff00; stroke: black; stroke-width: 2px; z-index: 2",
  purple: "fill: #ff00ff; stroke: black; stroke-width: 2px; z-index: 2",
  blue: "fill: #0000ff; stroke: black; stroke-width: 2px; z-index: 2",
  orange: "fill: #ff8100; stroke: black; stroke-width: 2px; z-index: 2",
  green: "fill: #00ff00; stroke: black; stroke-width: 2px; z-index: 2",
  red: "fill: #ff0000; stroke: black; stroke-width: 2px; z-index: 2",
  grey: "fill: #808080; stroke: black; stroke-width: 2px; z-index: 2",
};

const IBLOCK: BlockGroup = {
  style: STYLES.aqua,
  group: [
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 5, y: 0 },
    { x: 6, y: 0 },
  ],
  name: "IBLOCK",
  currentRotation: 1,
};

const OBLOCK: BlockGroup = {
  style: STYLES.yellow,
  group: [
    { x: 4, y: 0 },
    { x: 5, y: 0 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ],
  name: "OBLOCK",
  currentRotation: 1,
};

const TBLOCK: BlockGroup = {
  style: STYLES.purple,
  group: [
    { x: 4, y: 0 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ],
  name: "TBLOCK",
  currentRotation: 1,
};

const JBLOCK: BlockGroup = {
  style: STYLES.blue,
  group: [
    { x: 3, y: 0 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ],
  name: "JBLOCK",
  currentRotation: 1,
};

const LBLOCK: BlockGroup = {
  style: STYLES.orange,
  group: [
    { x: 5, y: 0 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ],
  name: "LBLOCK",
  currentRotation: 1,
};

const SBLOCK: BlockGroup = {
  style: STYLES.green,
  group: [
    { x: 4, y: 0 },
    { x: 5, y: 0 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ],
  name: "SBLOCK",
  currentRotation: 1,
};

const ZBLOCK: BlockGroup = {
  style: STYLES.red,
  group: [
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ],
  name: "ZBLOCK",
  currentRotation: 1,
};

type RotationLookupTable = {
  [tetromino: string]: {
    [rotation: number]: Block[];
  };
};

// numbers correspond to rotation configurations
const BlockCoordinates: RotationLookupTable = {
  IBLOCK: {
    1: [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 0 },
    ],
    2: [
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 4, y: 3 },
    ],
    3: [
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 6, y: 1 },
    ],
    4: [
      { x: 5, y: 0 },
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ],
  },
  OBLOCK: {
    1: [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
    2: [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
    3: [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
    4: [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
  },
  TBLOCK: {
    1: [
      { x: 4, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
    2: [
      { x: 4, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ],
    3: [
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 4, y: 2 },
    ],
    4: [
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 5, y: 1 },
    ],
  },
  JBLOCK: {
    1: [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
    2: [
      { x: 4, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ],
    3: [
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 2 },
    ],
    4: [
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ],
  },
  LBLOCK: {
    1: [
      { x: 5, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
    2: [
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ],
    3: [
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 3, y: 2 },
    ],
    4: [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ],
  },
  SBLOCK: {
    1: [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ],
    2: [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ],
    3: [
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ],
    4: [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
    ],
  },
  ZBLOCK: {
    1: [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
    2: [
      { x: 4, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 3, y: 2 },
    ],
    3: [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
    4: [
      { x: 4, y: 0 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 3, y: 2 },
    ],
  },
};

const board: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/*---------------------------------------------------------------------
|  Functions for moving blocks
*-------------------------------------------------------------------*/
const moveDown = ({ x, y }: Block): Block => ({ x: x, y: y + 1 });
const moveUp = ({ x, y }: Block): Block => ({ x: x, y: y - 1 });
const moveLeft = ({ x, y }: Block): Block => ({ x: x - 1, y: y });
const moveRight = ({ x, y }: Block): Block => ({ x: x + 1, y: y });

// higher order function, mapping the movement to all blocks in the group
const updateBlock = (blockGroup: BlockGroup, movement: (block: Block) => Block) => ({
  ...blockGroup,
  group: blockGroup.group.map(movement),
});

// moves the block to the board, shifting it up
const moveToBoard = (blockGroup: BlockGroup): BlockGroup => {
  return updateBlock(blockGroup, moveUp);
};

const updateBoard = (board: number[][], blockGroup: BlockGroup): number[][] => {
  return board.map((row: number[], rowIndex: number) =>
    row.map((cell: number, columnIndex: number) =>
      blockGroup.group.some(
        (block) => block.x === columnIndex && block.y === rowIndex
      ) ? 1 : cell
    )
  );
};

/*---------------------------------------------------------------------
|  Initial state
*-------------------------------------------------------------------*/
const BEGINNING_STATE: State = {
  gameEnd: false,
  boardState: board,
  currentBlock: moveToBoard(getNextBlock()),
  nextBlock: getNextBlock(),
  heldBlock: null,
  holdStatus: false,
  RNG: sequence.next(),
  score: 0,
  highScore: 0,
  level: 1,
} as const;

/*---------------------------------------------------------------------
|  Basic Functions for detecting collisions
*-------------------------------------------------------------------*/

// this converts (initial) y coordinates to 0 if they are negative, to prevent indexing errors
const convertNegatives = (num: number): number => (num < 0 ? 0 : num);

const checkBlockCollision = (board: number[][], block: BlockGroup): boolean =>
  block.group.some(
    (block: Block) => board[convertNegatives(block.y)][block.x] === 1
  );

const checkSideCollision = (block: BlockGroup): boolean =>
  block.group.some(
    (block: Block) => 0 > block.x || block.x >= Constants.BOARD_WIDTH
  );

const checkBottomCollision = (block: BlockGroup): boolean =>
  block.group.some((block: Block) => block.y >= Constants.BOARD_HEIGHT);

const checkTopCollision = (block: BlockGroup): boolean =>
  block.group.some((block: Block) => 0 > block.y);

/*---------------------------------------------------------------------
|  Specialized functions (combining the collision detection above)
*-------------------------------------------------------------------*/
const checkEndGame = (movedBlock: BlockGroup, board: number[][]) => {
  return checkTopCollision(movedBlock) && checkBlockCollision(board, movedBlock);
}

const cantMoveDown = (movedBlock: BlockGroup, board: number[][]) => {
  return checkBottomCollision(movedBlock) || checkBlockCollision(board, movedBlock);
}

const cantRotate = (movedBlock: BlockGroup, board: number[][]) => {
  return checkBlockCollision(board, movedBlock) ||
  checkBottomCollision(movedBlock) ||
  checkSideCollision(movedBlock) ||
  checkTopCollision(movedBlock)
}

const cantMoveSideways = (movedBlock: BlockGroup, board: number[][]) => {
  return checkBlockCollision(board, movedBlock) || checkSideCollision(movedBlock);
}

/*---------------------------------------------------------------------
|  Action classes and related functions
*-------------------------------------------------------------------*/
interface Action {
  apply(s: State): State;
}

// block moves downwards each tick; speed depends on level
class Tick implements Action {
  constructor(private level: number) {}

  apply(s: State): State {
    if (s.level === this.level) {
      return new MoveDownwards().apply(s);
    }
    return s;
  }
}

class Rotate implements Action {
  apply(s: State): State {
    const rotatedBlock = this.rotateBlock(s.currentBlock);

    // no wallkicks - only perform rotations that don't result in collisions
    if (cantRotate(rotatedBlock, s.boardState)) {
      return s;
    }
    return { ...s, currentBlock: rotatedBlock };
  }

  // since rotated blocks are stored as constants...
  // to rotate the block, calculate the x,y distance this block travelled
  // and translate its rotated version to the same distance
  rotateBlock(block: BlockGroup): BlockGroup {
    const originalCoordinates =
      BlockCoordinates[block.name][block.currentRotation];

    const distX: number = block.group[0].x - originalCoordinates[0].x;
    const distY: number = block.group[0].y - originalCoordinates[0].y;

    const newRotation: number = this.toggleRotation(block.currentRotation);

    const rotatedCoordinates = BlockCoordinates[block.name][newRotation].map(
      ({ x, y }) => ({ x: distX + x, y: distY + y })
    );
    return {
      ...block,
      group: rotatedCoordinates,
      currentRotation: newRotation,
    };
  }

  toggleRotation = (current: number): number => {
    switch (current) {
      case 1:
        return 2;
      case 2:
        return 3;
      case 3:
        return 4;
      default:
        return 1;
    }
  };
}

// return to beginning, keeping only high score and randomizing blocks
class Reset implements Action {
  apply(s: State): State {
    if (s.gameEnd) {
      return {
        ...BEGINNING_STATE,
        currentBlock: moveToBoard(getNextBlock()),
        nextBlock: getNextBlock(),
        highScore: s.highScore,
      };
    }
    return s;
  }
}

class MoveSideways implements Action {
  // change will be the function to move left or right
  constructor(public readonly change: (block: Block) => Block) {}

  apply(s: State): State {
    const movedBlock: BlockGroup = updateBlock(s.currentBlock, this.change);
    if (cantMoveSideways(movedBlock, s.boardState)) {
      return s;
    }
    return { ...s, currentBlock: movedBlock };
  }
}

class MoveDownwards implements Action {
  apply(s: State): State {
    // check if we should end the game and update the high score
    if (checkEndGame(s.currentBlock, s.boardState)) {
      const newHighScore: number =
        s.score > s.highScore ? s.score : s.highScore;
      return { ...s, gameEnd: true, highScore: newHighScore };
    }

    const movedBlock: BlockGroup = updateBlock(s.currentBlock, moveDown);

    // stop moving the block - check if any rows were cleared and adjust score
    if (cantMoveDown(movedBlock, s.boardState)) {
      const newBoard: number[][] = updateBoard(s.boardState, s.currentBlock);
      const clearedRows: number = this.countClearedRows(newBoard);
      const nextBlock: BlockGroup = getNextBlock();

      // update the board and the score if rows were cleared
      if (clearedRows) {
        const clearedBoard: number[][] = this.replaceClearedRows(
          newBoard,
          clearedRows
        );
        const newScore: number = this.updateScore(s.score, clearedRows);
        const newLevel: number = this.updateLevel(newScore);
        return {
          ...s,
          boardState: clearedBoard,
          currentBlock: moveToBoard(s.nextBlock),
          nextBlock: nextBlock,
          holdStatus: false,
          score: newScore,
          level: newLevel,
        };
      } else {
        // stop block without clearing rows
        return {
          ...s,
          boardState: newBoard,
          currentBlock: moveToBoard(s.nextBlock),
          nextBlock: nextBlock,
          holdStatus: false,
        };
      }
    }

    // just move the block if no collision
    return { ...s, currentBlock: movedBlock };
  }

  updateScore = (currentScore: number, rowsCleared: number): number => {
    return currentScore + Constants.SCORE_PER_ROW * rowsCleared;
  };

  updateLevel = (score: number): number => {
    if (score < 100) {
      return 1;
    } else if (score <= 200) {
      return 2;
    }
    return 3;
  };

  // count rows of 1's
  countClearedRows = (board: number[][]): number => {
    return board.filter((row) => row.every((block) => block === 1)).length;
  };

  replaceClearedRows = (board: number[][], clearedRows: number): number[][] => {
    const clearedBoard = board.filter(
      (row) => !row.every((block) => block === 1)
    );

    const newRows = Array.from({ length: clearedRows }, () => [
      ...Array(10).map(() => 0),
    ]);

    return [...newRows, ...clearedBoard];
  };
}

// temporarily store a block
class HoldBlock implements Action {
  apply(s: State): State {
    // check if we already held
    if (s.holdStatus) {
      return s;
    }

    // reset the coordinates of the current block to be held
    const currentBlock: BlockGroup = {
      ...s.currentBlock,
      group: BlockCoordinates[s.currentBlock.name][1],
    };

    // reset coordinates/orientation and swap
    if (s.heldBlock) {
      const heldBlock: BlockGroup = {
        ...s.heldBlock,
        group: BlockCoordinates[s.heldBlock.name][1],
      };
      return {
        ...s,
        currentBlock: heldBlock,
        heldBlock: currentBlock,
        holdStatus: true,
      };
    }

    // no block is held yet, so just add the current one
    return {
      ...s,
      currentBlock: getNextBlock(),
      heldBlock: currentBlock,
      holdStatus: true,
    };
  }
}

/*---------------------------------------------------------------------
|  Rendering (the only section with side effects apart from Math.random())
*-------------------------------------------------------------------*/
/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
  elem.setAttribute("visibility", "visible");
  elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {}
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};

const createBlock = (
  x: number,
  y: number,
  style: string,
  namespace: string | null
): SVGElement =>
  createSvgElement(namespace, "rect", {
    height: `${BlockConstants.HEIGHT}`,
    width: `${BlockConstants.WIDTH}`,
    x: `${BlockConstants.WIDTH * x}`,
    y: `${BlockConstants.HEIGHT * y}`,
    style: `${style}`,
    id: `block`,
  });

// render the currently moving block
const renderBlock = (
  blockGroup: BlockGroup,
  namespace: string | null,
  svg: SVGGraphicsElement & HTMLElement
) => {
  blockGroup.group.forEach((block: Block) =>
    svg.appendChild(createBlock(block.x, block.y, blockGroup.style, namespace))
  );
};

// render the next/held blocks, with slightly modified coordinates
const renderPreview = (
  blockGroup: BlockGroup,
  namespace: string | null,
  svg: SVGGraphicsElement & HTMLElement
) => {
  blockGroup.group.forEach((block: Block) =>
    svg.appendChild(
      createBlock(block.x - 1, block.y + 1, blockGroup.style, namespace)
    )
  );
};

// render the board (all non-moving blocks) as grey
const renderboard = (
  board: number[][],
  namespace: string | null,
  svg: SVGGraphicsElement & HTMLElement
) => {
  board.forEach((row: number[], rowIndex: number) =>
    row.forEach((square: number, columnIndex: number) => {
      if (board[rowIndex][columnIndex] === 1) {
        svg.appendChild(
          createBlock(columnIndex, rowIndex, STYLES.grey, namespace)
        );
      }
    })
  );
};

// clear the blocks from the previous rendering
const clearHTML = (svg: SVGGraphicsElement & HTMLElement) => {
  const blocks = svg.querySelectorAll('[id="block"]');
  blocks.forEach((block) => {
    svg.removeChild(block);
  });
};

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main() {
  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;
  const holdPreview = document.querySelector(
    "#holdPreview"
  ) as SVGGraphicsElement & HTMLElement;
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);
  holdPreview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  holdPreview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

  // Text fields
  const levelText = document.querySelector("#levelText") as HTMLElement;
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;

  /** User input */
  const key$ = fromEvent<KeyboardEvent>(document, "keypress");

  const fromKey = (keyCode: Key, change: () => Action) =>
    key$.pipe(
      filter(({ code }) => code === keyCode),
      filter(({ repeat }) => !repeat),
      map(change)
    );

  const left$: Observable<Action> = fromKey("KeyA",() => new MoveSideways(moveLeft));
  const right$: Observable<Action> = fromKey("KeyD",() => new MoveSideways(moveRight));
  const down$: Observable<Action> = fromKey("KeyS", () => new MoveDownwards());
  const reset$: Observable<Action> = fromKey("KeyR", () => new Reset());
  const rotate$: Observable<Action> = fromKey("KeyW", () => new Rotate());
  const hold$: Observable<Action> = fromKey("KeyH", () => new HoldBlock());

  /** Observables */

  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */
  const render = (s: State) => {
    clearHTML(svg);
    clearHTML(preview);
    clearHTML(holdPreview);

    levelText.innerText = `${s.level}`;
    scoreText.innerText = `${s.score}`;
    highScoreText.innerText = `${s.highScore}`;

    renderboard(s.boardState, svg.namespaceURI, svg);
    renderBlock(s.currentBlock, svg.namespaceURI, svg);
    renderPreview(s.nextBlock, preview.namespaceURI, preview);
    if (s.heldBlock) {
      renderPreview(s.heldBlock, holdPreview.namespaceURI, holdPreview);
    }
  };
  
  // higher order function to create the various tickstreams
  function createTickObservable(level: number, tickRateMultiplier: number): Observable<Action> {
    return interval(Constants.TICK_RATE_MS * tickRateMultiplier).pipe(
      map((_: number) => new Tick(level))
    );
  }
  
  const tick$: Observable<Action> = createTickObservable(1, 1);
  const tick2$: Observable<Action> = createTickObservable(2, 0.8);
  const tick3$: Observable<Action> = createTickObservable(3, 0.6);

  const source$ = merge(
    tick$,
    tick2$,
    tick3$,
    left$,
    right$,
    down$,
    reset$,
    rotate$,
    hold$
  )
    .pipe(scan((acc: State, n: Action) => n.apply(acc), BEGINNING_STATE))
    .subscribe((s: State) => {
      render(s);

      if (s.gameEnd) {
        show(gameover);
      } else {
        hide(gameover);
      }
    });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
