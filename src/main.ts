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

import { fromEvent, interval, merge } from "rxjs";
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
  GRID_WIDTH: 10,
  GRID_HEIGHT: 20,
} as const;

const BlockConstants = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.GRID_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.GRID_HEIGHT,
};

/** User input */

type Key = "KeyS" | "KeyA" | "KeyD";

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
  style: String
}>

type BlockGroup = Readonly<{
  group: Block[]
}>

interface LazySequence<T> {
  value: T;
  next():LazySequence<T>;
}

// CSS Styles for blocks
const aquaStyle: String = "fill: #00ffff; stroke: black; stroke-width: 2px; z-index: 2"
const yellowStyle: String = "fill: #ffff00; stroke: black; stroke-width: 2px; z-index: 2"
const purpleStyle: String = "fill: #ff00ff; stroke: black; stroke-width: 2px; z-index: 2"
const blueStyle: String = "fill: #0000ff; stroke: black; stroke-width: 2px; z-index: 2"
const orangeStyle: String = "fill: #ff8100; stroke: black; stroke-width: 2px; z-index: 2"
const greenStyle: String = "fill: #00ff00; stroke: black; stroke-width: 2px; z-index: 2"
const redStyle: String = "fill: #ff0000; stroke: black; stroke-width: 2px; z-index: 2"

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
  public static scale = (hash: number) => (2 * hash) / (RNG.m - 1) - 1;
}

// functions to move blocks
const updateBlock = (block: BlockGroup, movement: (block: Block) => Block) => ({group: block.group.map(movement)})

const down = ({x, y, style}: Block): Block => ({x: x, y: y+1, style: style});
const left = ({x, y, style}: Block): Block => ({x: x-1, y: y, style: style});
const right = ({x, y, style}: Block): Block => ({x: x+1, y: y, style: style});

// function to detect collision
const checkCollision = (grid: number[][], block: BlockGroup) => block.group.some((block: Block) => grid[block.y][block.x] === 1);

const grid: number[][] = [[0,0,0,0,0,0,0,0,0,0],
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

const initialState: State = {
  gameEnd: false,
  boardState: grid,
  currentBlock: randomPiece
} as const;

interface Action {
  apply(s: State): State;
}

/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
// const tick = (s: State) => s;
class Tick implements Action{
  constructor(public readonly tick: number){}

  apply(s: State): State{
    const updatedBlock: BlockGroup = {group: s.currentBlock.group.map(({x, y}: Block): Block => ({x: x, y: y+1, style: greenStyle}))}
    const updatedBoard: number[][] = moveBlock(s.boardState, s.currentBlock, updatedBlock)
    return { ...s, currentBlock: updatedBlock, boardState: updatedBoard}
  };
}

const moveBlock = (grid: number[][], oldBlock: BlockGroup, newBlock: BlockGroup): number[][] => {
  return grid.map((row: number[], rowIndex: number) => row.map((cell: number, columnIndex: number) => {
    const isOldPieceCell: boolean = oldBlock.group.some((block: Block) => block.x === columnIndex && block.y === rowIndex);
    const isNewPieceCell: boolean = newBlock.group.some((block: Block) => block.x === columnIndex && block.y === rowIndex);
    if (isOldPieceCell && isNewPieceCell){
      return 1;
    }
    else if (isOldPieceCell){
      return 0;
    }
    else if (isNewPieceCell){
      return 1;
    }
    else{
      return cell;
    }
  }))
}

/** Rendering (side effects) */
const reduceState = (s:State, change: Action) => change.apply(s);

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

  const fromKey = (keyCode: Key) =>
    key$.pipe(filter(({ code }) => code === keyCode));

  const left$ = fromKey("KeyA");
  const right$ = fromKey("KeyD");
  const down$ = fromKey("KeyS");


  /** Observables */

  /** Determines the rate of time steps */
  const tick$ = interval(Constants.TICK_RATE_MS);

  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */
  const render = (s: State) => {
    const blockObjects = s.boardState.flatMap((row, i) =>
        row.map((cell, j) => ({
          x: BlockConstants.WIDTH * j,
          y: BlockConstants.HEIGHT * i,
          style: cell === 0 ? "fill: #DAB483; stroke-width: 0px; z-index: 1" : "fill: green; stroke: black; stroke-width: 2px; z-index: 2"
        })));
    
    blockObjects.forEach((block: Block): void => {
      const SVGelem = createSvgElement(svg.namespaceURI, "rect", {
        height: `${BlockConstants.HEIGHT}`,
        width: `${BlockConstants.WIDTH}`,
        x: `${block.x}`,
        y: `${block.y}`,
        style: `${block.style}`,
      });
      svg.appendChild(SVGelem);
    });
  };


  const source$ = merge(tick$)
    .pipe(
      map((tick_val: number) => new Tick(tick_val)),
      scan(reduceState, initialState)
      )


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
