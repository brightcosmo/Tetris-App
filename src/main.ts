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
  board_WIDTH: 10,
  board_HEIGHT: 20,
} as const;

const BlockConstants = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.board_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.board_HEIGHT,
};

/** User input */

type Key = "KeyS" | "KeyA" | "KeyD"| "KeyR";

type Event = "keydown" | "keyup" | "keypress";

/** Utility functions */

/** State processing */

type State = Readonly<{
  gameEnd: boolean,
  boardState: number[][],
  currentBlock: BlockGroup
  nextBlock: BlockGroup,
  RNG: LazySequence<number>
}>;

type Block = Readonly<{
  x: number,
  y: number,
  style: string
}>

type BlockGroup = Readonly<{
  group: Block[]
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
const background: string = "fill: #DAB483; stroke-width: 0px;"

const IBLOCK: BlockGroup = {
  group: [{x: 4, y: 0, style: aquaStyle}, {x: 5, y: 0, style: aquaStyle}, {x: 6, y: 0, style: aquaStyle}, {x: 7, y: 0, style: aquaStyle}]
}

const OBLOCK: BlockGroup = {
  group: [{x: 4, y: 0, style: yellowStyle}, {x: 5, y: 0, style: yellowStyle}, {x: 4, y: 1, style: yellowStyle}, {x: 5, y: 1, style: yellowStyle}]
}

const TBLOCK: BlockGroup = {
  group: [{x: 4, y: 0, style: purpleStyle}, {x: 3, y: 1, style: purpleStyle}, {x: 4, y: 1, style: purpleStyle}, {x: 5, y: 1, style: purpleStyle}]
}

const JBLOCK: BlockGroup = {
  group: [{x: 3, y: 0, style: blueStyle}, {x: 3, y: 1, style: blueStyle}, {x: 4, y: 1, style: blueStyle}, {x: 5, y: 1, style: blueStyle}]
}

const LBLOCK: BlockGroup = {
  group: [{x: 5, y: 0, style: orangeStyle}, {x: 3, y: 1, style: orangeStyle}, {x: 4, y: 1, style: orangeStyle}, {x: 5, y: 1, style: orangeStyle}]
}

const SBLOCK: BlockGroup = {
  group: [{x: 4, y: 0, style: greenStyle}, {x: 5, y: 0, style: greenStyle}, {x: 3, y: 1, style: greenStyle}, {x: 4, y: 1, style: greenStyle}]
}

const ZBLOCK: BlockGroup = {
  group: [{x: 3, y: 0, style: redStyle}, {x: 4, y: 0, style: redStyle}, {x: 4, y: 1, style: redStyle}, {x: 5, y: 1, style: redStyle}]
}

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
const updateBlock = (block: BlockGroup, movement: (block: Block) => Block) => ({group: block.group.map(movement)})

const down = ({x, y, style}: Block): Block => ({x: x, y: y+1, style: style});
const up = ({x, y, style}: Block): Block => ({x: x, y: y-1, style: style});
const left = ({x, y, style}: Block): Block => ({x: x-1, y: y, style: style});
const right = ({x, y, style}: Block): Block => ({x: x+1, y: y, style: style});

const updateBoard = (board: number[][], block: BlockGroup): number[][] => {
  return board.map((row: number[],rowIndex: number) => row.map((cell: number, columnIndex: number) => {
    const conflict: boolean = block.group.some((block: Block) => block.x === columnIndex && block.y === rowIndex);
  if (conflict) {return 1;}
  else {return cell}}))
};

// function to detect collision
const convertNegatives = (num: number): number => (num < 0 ? 0 : num);
const checkBlockCollision = (board: number[][], block: BlockGroup): boolean => block.group.some((block: Block) => board[convertNegatives(block.y)][block.x] === 1);
const checkSideCollision = (block: BlockGroup): boolean => block.group.some((block: Block) => 0 > block.x || block.x >= Constants.board_WIDTH)
const checkBottomCollision = (block: BlockGroup): boolean => block.group.some((block: Block) => block.y >= Constants.board_HEIGHT)
const checkTopCollision = (block: BlockGroup): boolean => block.group.some((block: Block) => 0 > block.y)

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

const seed = 2000;
const sequence: LazySequence<number> = new RandomNumberSequence(seed);


const BEGINNING: State = {
  gameEnd: false,
  boardState: board,
  currentBlock: updateBlock(randomPiece(sequence.next().value), up),
  nextBlock: randomPiece(sequence.next().value),
  RNG: sequence.next()
} as const;

interface Action {
  apply(s: State): State;
}

class Reset implements Action {
  constructor(public readonly change: (block: Block) => Block) {};

  apply(s: State): State {
    return {...BEGINNING, 
      currentBlock: updateBlock(randomPiece(sequence.next().value), up),
      nextBlock: randomPiece(sequence.next().value)};
  }
}

class MoveSideways implements Action{
  constructor(public readonly change: (block: Block) => Block) {};

  apply(s: State): State {
    const newBlock: BlockGroup = updateBlock(s.currentBlock, this.change)

    if (checkSideCollision(newBlock) || checkBlockCollision(s.boardState, newBlock)) {
      return s;
    }

    return {...s, currentBlock: newBlock}
  }
}

class MoveDownwards implements Action{
  constructor(public readonly change: (block: Block) => Block) {};

  apply(s: State): State {
    const newBlock: BlockGroup = updateBlock(s.currentBlock, this.change);

    if (checkTopCollision(s.currentBlock) && checkBlockCollision(s.boardState, s.currentBlock)) {
      return {...s, gameEnd: true}
    }

    if (checkBottomCollision(newBlock) || checkBlockCollision(s.boardState, newBlock)) {
      const newBoard: number[][] = updateBoard(s.boardState, s.currentBlock)
      return {...s, boardState: newBoard, currentBlock: updateBlock(s.nextBlock, up), nextBlock: randomPiece(s.RNG.next().value)}
    }

    return {...s, currentBlock: newBlock}
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

const renderBlock = (block: BlockGroup, namespace: string | null, svg: SVGGraphicsElement & HTMLElement) => {
  block.group.forEach((block: Block) => svg.appendChild(createBlock(block.x, block.y, block.style, namespace)))
}

const renderForPreview = (block: BlockGroup, namespace: string | null, svg: SVGGraphicsElement & HTMLElement) => {
  block.group.forEach((block: Block) => svg.appendChild(createBlock(block.x-1, block.y+1, block.style, namespace)))
}

const renderboard = (board: number[][], namespace: string | null, svg: SVGGraphicsElement & HTMLElement) => {
  board.forEach((row: number[], rowIndex: number) => row.forEach((cell: number, columnIndex: number) => {
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
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

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

  const left$: Observable<Action> = fromKey("KeyA", () => new MoveSideways(left));
  const right$: Observable<Action> = fromKey("KeyD", () => new MoveSideways(right));
  const down$: Observable<Action> = fromKey("KeyS", () => new MoveDownwards(down));
  const reset$: Observable<Action> = fromKey("KeyR", () => new Reset(down));

  /** Observables */

  /** Determines the rate of time steps */
  const tick$: Observable<Action> = interval(Constants.TICK_RATE_MS).pipe(map((_: number) => new MoveDownwards(down)));
  // const tick$ = interval(Constants.TICK_RATE_MS);

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

    renderBlock(s.currentBlock, svg.namespaceURI, svg);
    renderForPreview(s.nextBlock, preview.namespaceURI, preview);
    renderboard(s.boardState, svg.namespaceURI, svg);
  };


  const source$ = merge(tick$, left$, right$, down$, reset$)
    .pipe(scan((acc: State, n: Action) => n.apply(acc), BEGINNING))
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
