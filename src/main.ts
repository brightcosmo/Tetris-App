/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import { fromEvent, interval, merge,Observable } from "rxjs";
import { map, filter, scan } from "rxjs/operators";

/** Constants */

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
  SCORE: 10,
  BONUS_SCORE: 100
} as const;

const BlockConstants = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.BOARD_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.BOARD_HEIGHT,
};

/** User input */

type Key = "KeyS" | "KeyA" | "KeyD"| "KeyR" | "KeyW" | "KeyH";

type Event = "keydown" | "keyup" | "keypress";

/** Utility functions */


const getNextBlock = (): BlockGroup => {
  return randomPiece(sequence.next().value)
}


/** State processing */

type State = Readonly<{
  gameEnd: boolean,
  boardState: number[][],
  currentBlock: BlockGroup,
  nextBlock: BlockGroup,
  heldBlock: BlockGroup | null,
  holdStatus: boolean,
  RNG: LazySequence<number>,
  score: number,
  highScore: number,
  level: number
}>;

type Block = Readonly<{
  x: number,
  y: number,
}>

type BlockGroup = Readonly<{
  group: Block[],
  currentRotation: number,
  name: string,
  style: string
}>

interface LazySequence<T> {
  value: T;
  next():LazySequence<T>;
}

// Usage


// CSS Styles for blocks
const aquaStyle: string = "fill: #00ffff; stroke: black; stroke-width: 2px; z-index: 2"
const yellowStyle: string = "fill: #ffff00; stroke: black; stroke-width: 2px; z-index: 2"
const purpleStyle: string = "fill: #ff00ff; stroke: black; stroke-width: 2px; z-index: 2"
const blueStyle: string = "fill: #0000ff; stroke: black; stroke-width: 2px; z-index: 2"
const orangeStyle: string = "fill: #ff8100; stroke: black; stroke-width: 2px; z-index: 2"
const greenStyle: string = "fill: #00ff00; stroke: black; stroke-width: 2px; z-index: 2"
const redStyle: string = "fill: #ff0000; stroke: black; stroke-width: 2px; z-index: 2"
const greyStyle: string = "fill: #808080; stroke: black; stroke-width: 2px; z-index: 2"

const IBLOCK: BlockGroup = {
  style: aquaStyle,
  group: [{x: 3, y: 0}, {x: 4, y: 0}, {x: 5, y: 0}, {x: 6, y: 0}],
  name: "IBLOCK",
  currentRotation: 1
};

const OBLOCK: BlockGroup = {
  style: yellowStyle,
  group: [{x: 4, y: 0}, {x: 5, y: 0}, {x: 4, y: 1}, {x: 5, y: 1}],
  name: "OBLOCK",
  currentRotation: 1
};

const TBLOCK: BlockGroup = {
  style: purpleStyle,
  group: [{x: 4, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}],
  name: "TBLOCK",
  currentRotation: 1
};

const JBLOCK: BlockGroup = {
  style: blueStyle,
  group: [{x: 3, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}],
  name: "JBLOCK",
  currentRotation: 1
};

const LBLOCK: BlockGroup = {
  style: orangeStyle,
  group: [{x: 5, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}],
  name: "LBLOCK",
  currentRotation: 1
};

const SBLOCK: BlockGroup = {
  style: greenStyle,
  group: [{x: 4, y: 0}, {x: 5, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}],
  name: "SBLOCK",
  currentRotation: 1
};

const ZBLOCK: BlockGroup = {
  style: redStyle,
  group: [{x: 3, y: 0}, {x: 4, y: 0}, {x: 4, y: 1}, {x: 5, y: 1}],
  name: "ZBLOCK",
  currentRotation: 1
};

type RotationLookupTable = {
  [tetromino: string]: {
    [rotation: number]: Block[];
  };
};

const BlockCoordinates: RotationLookupTable = {
  IBLOCK: {
    1: [{x: 3, y: 0}, {x: 4, y: 0}, {x: 5, y: 0}, {x: 6, y: 0}],
    2: [{x: 4, y: 0}, {x: 4, y: 1}, {x: 4, y: 2}, {x: 4, y: 3}],
    3: [{x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}, {x: 6, y: 1}],
    4: [{x: 5, y: 0}, {x: 5, y: 1}, {x: 5, y: 2}, {x: 5, y: 3}],
  },
  OBLOCK: {
    1: [{x: 4, y: 0}, {x: 5, y: 0}, {x: 4, y: 1}, {x: 5, y: 1}],
    2: [{x: 4, y: 0}, {x: 5, y: 0}, {x: 4, y: 1}, {x: 5, y: 1}],
    3: [{x: 4, y: 0}, {x: 5, y: 0}, {x: 4, y: 1}, {x: 5, y: 1}],
    4: [{x: 4, y: 0}, {x: 5, y: 0}, {x: 4, y: 1}, {x: 5, y: 1}],
  },
  TBLOCK: {
    1: [{x: 4, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}],
    2: [{x: 4, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 4, y: 2}],
    3: [{x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}, {x: 4, y: 2}],
    4: [{x: 4, y: 0}, {x: 4, y: 1}, {x: 4, y: 2}, {x: 5, y: 1}],
  },
  JBLOCK: {
    1: [{x: 3, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}],
    2: [{x: 4, y: 0}, {x: 3, y: 0}, {x: 4, y: 1}, {x: 4, y: 2}],
    3: [{x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}, {x: 5, y: 2}],
    4: [{x: 4, y: 0}, {x: 4, y: 1}, {x: 4, y: 2}, {x: 5, y: 2}],
  },
  LBLOCK: {
    1: [{x: 5, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}],
    2: [{x: 4, y: 0}, {x: 4, y: 1}, {x: 4, y: 2}, {x: 5, y: 2}],
    3: [{x: 3, y: 1}, {x: 4, y: 1}, {x: 5, y: 1}, {x: 3, y: 2}],
    4: [{x: 3, y: 0}, {x: 4, y: 0}, {x: 4, y: 1}, {x: 4, y: 2}],
  },
  SBLOCK: {
    1: [{x: 4, y: 0}, {x: 5, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}],
    2: [{x: 3, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 4, y: 2}],
    3: [{x: 4, y: 0}, {x: 5, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}],
    4: [{x: 3, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 4, y: 2}],
  },
  ZBLOCK: {
    1: [{x: 3, y: 0}, {x: 4, y: 0}, {x: 4, y: 1}, {x: 5, y: 1}],
    2: [{x: 4, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 3, y: 2}],
    3: [{x: 3, y: 0}, {x: 4, y: 0}, {x: 4, y: 1}, {x: 5, y: 1}],
    4: [{x: 4, y: 0}, {x: 3, y: 1}, {x: 4, y: 1}, {x: 3, y: 2}],
  },
};


const randomPiece = (num: number): BlockGroup => {
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
}

// functions to move blocks
const updateBlock = (block: BlockGroup, movement: (block: Block) => Block) => ({...block, group: block.group.map(movement)})

const moveDown = ({x, y}: Block): Block => ({x: x, y: y+1});
const moveUp = ({x, y}: Block): Block => ({x: x, y: y-1});
const moveLeft = ({x, y}: Block): Block => ({x: x-1, y: y});
const moveRight = ({x, y}: Block): Block => ({x: x+1, y: y});

const moveToBoard = (block: BlockGroup): BlockGroup => {
  return updateBlock(block, moveUp)
}

const updateBoard = (board: number[][], block: BlockGroup): number[][] => {
  return board.map((row: number[],rowIndex: number) => row.map((cell: number, columnIndex: number) => {
    const conflict: boolean = block.group.some((block: Block) => block.x === columnIndex && block.y === rowIndex);
  if (conflict) {return 1;}
  else {return cell}}))
};

// function to detect collision
const convertNegatives = (num: number): number => (num < 0 ? 0 : num);
const checkBlockCollision = (board: number[][], block: BlockGroup): boolean => block.group.some((block: Block) => board[convertNegatives(block.y)][block.x] === 1);
const checkSideCollision = (block: BlockGroup): boolean => block.group.some((block: Block) => 0 > block.x || block.x >= Constants.BOARD_WIDTH)
const checkBottomCollision = (block: BlockGroup): boolean => block.group.some((block: Block) => block.y >= Constants.BOARD_HEIGHT)
const checkTopCollision = (block: BlockGroup): boolean => block.group.some((block: Block) => 0 > block.y)

const removeClearedRows = (board: number[][]): number[][] => {
  return board.filter(row => !row.every(block => block === 1));
};


const board: number[][] = [[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0],
[0,0,0,0,0,0,0,0,0,0]]

abstract class RNG {
  // LCG using GCC's constants
  private static m = 0x80000000; // 2**31
  private static a = 1103515245;
  private static c = 12345;

  /**
   * Call `hash` repeatedly to generate the sequence of hashes.
   * @param seed
   * @returns a hash of the seed
   */
  public static hash = (seed: number) => (RNG.a * seed + RNG.c) % RNG.m;

  /**
   * Takes hash value and scales it to the range [-1, 1]
   */
  public static scale = (hash: number) => hash / (RNG.m - 1);
}
class RandomNumberSequence implements LazySequence<number> {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.value = Math.floor(RNG.scale(RNG.hash(this.seed)) * 7) + 1;
    console.log(this.value)
  }
  value: number;

  next(): RandomNumberSequence {
    this.seed = RNG.hash(this.seed);
    return new RandomNumberSequence(this.seed);
  }
}

// impure
const seed = Math.random();
const sequence: LazySequence<number> = new RandomNumberSequence(seed);


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
  level: 3
} as const;


function rotateBlock(block: BlockGroup): BlockGroup{
  const originalCoordinates = BlockCoordinates[block.name][block.currentRotation]

  const distX: number = block.group[0].x - originalCoordinates[0].x
  const distY: number = block.group[0].y - originalCoordinates[0].y
  const newRotation: number = toggleRotation(block.currentRotation)
  

  const rotatedCoordinates = BlockCoordinates[block.name][newRotation].map(({ x, y }) => ({x: distX + x,y: distY +y}));
  return {...block, group: rotatedCoordinates, currentRotation: newRotation}
}

interface Action {
  apply(s: State): State;
}

const toggleRotation = (current: number): number => {
  switch (current){
    case 1: return 2;
    case 2: return 3;
    case 3: return 4;
    default: return 1;
  }
}


class Rotate implements Action {
  apply(s: State): State {
    const rotatedBlock = rotateBlock(s.currentBlock)
    if (checkBlockCollision(s.boardState, rotatedBlock) || checkBottomCollision(rotatedBlock) || checkSideCollision(rotatedBlock) || checkTopCollision(rotatedBlock)){
      return s;
    }
    return {...s, currentBlock: rotatedBlock}}
  }

class Reset implements Action {
  apply(s: State): State {
    if (s.gameEnd){
      return {...BEGINNING_STATE, 
        currentBlock: updateBlock(getNextBlock(), moveUp),
        nextBlock: getNextBlock(),
        highScore: s.highScore};
    }
    return s;
  }
}

class MoveSideways implements Action{
  constructor(public readonly change: (block: Block) => Block) {};

  apply(s: State): State {
    // attempt to move the block - if there is any collision, don't move it
    const newBlock: BlockGroup = updateBlock(s.currentBlock, this.change)
    if (checkSideCollision(newBlock) || checkBlockCollision(s.boardState, newBlock)) {
      return s;
    }
    return {...s, currentBlock: newBlock}
  }
}

class MoveDownwards implements Action{
  apply(s: State): State {
    // check if we should end the game and update the high score
    if (checkTopCollision(s.currentBlock) && checkBlockCollision(s.boardState, s.currentBlock)) {
      const newHighScore: number = s.score > s.highScore ? s.score : s.highScore
      return {...s, gameEnd: true, highScore: newHighScore}
    }

    // try to move the block
    const movedBlock: BlockGroup = updateBlock(s.currentBlock, moveDown);

    // if there collision below the block, stop and move on to the next block
    // also, check if any rows were cleared and adjust score accordingly
    if (checkBottomCollision(movedBlock) || checkBlockCollision(s.boardState, movedBlock)) {
      const newBoard: number[][] = updateBoard(s.boardState, s.currentBlock);
      // check if there are any cleared rows, then update the board
      const clearedRows: number[][] = removeClearedRows(s.boardState);
      const clearedCount: number = Constants.BOARD_HEIGHT - clearedRows.length
      const nextBlock = getNextBlock();

      // update the board, the score
      if (clearedCount){
        const updatedBoard: number[][] = replaceRows(s.boardState, clearedCount);
        const newScore: number = s.score + Constants.SCORE*clearedCount;
        return {...s, 
          boardState: updatedBoard, 
          currentBlock: moveToBoard(s.nextBlock), 
          nextBlock: nextBlock,
          holdStatus: false, 
          score: newScore}
      }
      else{
        return {...s, 
          boardState: newBoard, 
          currentBlock: moveToBoard(s.nextBlock), 
          nextBlock: nextBlock, 
          holdStatus: false}
      }
    }

    // otherwise, just move the block
    return {...s, currentBlock: movedBlock}
  }
}
const replaceRows = (board: number[][], rowsCleared: number): number[][] => {
  const emptyRow = [0,0,0,0,0,0,0,0,0,0].map(value => value * rowsCleared);
  return [emptyRow].concat(board);
};
class HoldBlock implements Action {
  apply(s: State): State {
    // check if we already held
    if (s.holdStatus){
      return s;
    }

    // reset the coordinates of the current block to be held
    const resettedBlock: BlockGroup= {...s.currentBlock, group: BlockCoordinates[s.currentBlock.name][1]};
    
    // reset coordinates/orientation and swap
    if (s.heldBlock){
      const resettedHeld: BlockGroup = {...s.heldBlock, group: BlockCoordinates[s.heldBlock.name][1]};
      return {...s, currentBlock: resettedHeld, heldBlock: resettedBlock, holdStatus: true}
    }

    // no block is held yet, so just add the current one
    return {...s, currentBlock: getNextBlock(), heldBlock: s.currentBlock, holdStatus: true};

  }
}

/** Rendering (side effects) */

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

const createBlock = (x: number, y: number, style: string, namespace: string | null): SVGElement =>
  createSvgElement(namespace, "rect", {
    height: `${BlockConstants.HEIGHT}`,
    width: `${BlockConstants.WIDTH}`,
    x: `${BlockConstants.WIDTH*(x)}`,
    y: `${BlockConstants.HEIGHT*(y)}`,
    style: `${style}`,
    id: `block`
  });

const renderBlock = (blockGroup: BlockGroup, namespace: string | null, svg: SVGGraphicsElement & HTMLElement) => {
  blockGroup.group.forEach((block: Block) => svg.appendChild(createBlock(block.x, block.y, blockGroup.style, namespace)))
}

const renderForPreview = (blockGroup: BlockGroup, namespace: string | null, svg: SVGGraphicsElement & HTMLElement) => {
  blockGroup.group.forEach((block: Block) => svg.appendChild(createBlock(block.x-1, block.y+1, blockGroup.style, namespace)))
}

const renderboard = (board: number[][], namespace: string | null, svg: SVGGraphicsElement & HTMLElement) => {
  board.forEach((row: number[], rowIndex: number) => row.forEach((square: number, columnIndex: number) => {
    if (board[rowIndex][columnIndex] === 1) {
      svg.appendChild(createBlock(columnIndex, rowIndex, greyStyle, namespace))
    }
  }))
}

const clearHTML = (svg: SVGGraphicsElement & HTMLElement) => {
    const blocks = svg.querySelectorAll('[id="block"]');
    blocks.forEach(block => {
      svg.removeChild(block);
    });
  }

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
  const holdPreview = document.querySelector("#holdPreview") as SVGGraphicsElement &
    HTMLElement;
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
    key$.pipe(filter(({ code }) => code === keyCode),
    filter(({repeat}) => !repeat),
    map(change));

  const left$: Observable<Action> = fromKey("KeyA", () => new MoveSideways(moveLeft));
  const right$: Observable<Action> = fromKey("KeyD", () => new MoveSideways(moveRight));
  const down$: Observable<Action> = fromKey("KeyS", () => new MoveDownwards());
  const reset$: Observable<Action> = fromKey("KeyR", () => new Reset());
  const rotate$: Observable<Action> = fromKey("KeyW", () => new Rotate());
  const hold$: Observable<Action> = fromKey("KeyH", () => new HoldBlock());
  
  /** Observables */

  /** Determines the rate of time steps */
  const tick$: Observable<Action> = interval(Constants.TICK_RATE_MS).pipe(map((_: number) => new MoveDownwards()));
  const tick2$: Observable<Action> = interval(Constants.TICK_RATE_MS*2).pipe(map((_: number) => new MoveDownwards()));
  const tick3$: Observable<Action> = interval(Constants.TICK_RATE_MS*3).pipe(map((_: number) => new MoveDownwards()));

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
    levelText.innerText = `${s.level}`
    scoreText.innerText = `${s.score}`
    highScoreText.innerText = `${s.highScore}`

    renderboard(s.boardState, svg.namespaceURI, svg);
    renderBlock(s.currentBlock, svg.namespaceURI, svg);
    renderForPreview(s.nextBlock, preview.namespaceURI, preview);
    if (s.heldBlock){
      renderForPreview(s.heldBlock, holdPreview.namespaceURI, holdPreview);
    }
  };


  const source$ = merge(tick$, left$, right$, down$, reset$, rotate$, hold$)
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
