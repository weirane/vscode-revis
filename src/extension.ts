// import { JSDOM } from 'jsdom';
// const DOM = new JSDOM(`<!DOCTYPE html><body></body>`);
// global.window = <any>DOM.window;
// global.document = DOM.window.document;

//@ts-ignore
import { createSVGWindow } from "svgdom";
import { SVG, registerWindow, Svg } from "@svgdotjs/svg.js";
import * as vscode from "vscode";

const G = {
  fontsize: vscode.workspace.getConfiguration("editor").get<number>("fontSize") ?? 14,
  charwidth: "14px",
  lineheight: 0,
};
G.lineheight = Math.max(8, Math.round(1.35 * G.fontsize));

let output: vscode.OutputChannel;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "errorviz" is now active!');
  output = vscode.window.createOutputChannel("RError");
  output.appendLine("debug");

  decorateImage();
  output.appendLine("decorated");
  // decorate502();
  // decorate505();
  // const hover = {
  //   provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Hover> {
  //     const positionWord = document.getText(document.getWordRangeAtPosition(position));
  //     // console.log(positionWord);
  //     const contents = new vscode.MarkdownString('hover content');
  //     return Promise.resolve(new vscode.Hover(contents));
  //   }
  // };
  // context.subscriptions.push(vscode.languages.registerHoverProvider(['rust'], hover));
}

function image2decoration(image: Svg, line: number): vscode.DecorationOptions {
  const svgurl = `data:image/svg+xml;base64,${Buffer.from(image.svg()).toString("base64")}`;
  return {
    range: new vscode.Range(line, 0, line, 0),
    renderOptions: {
      after: <any>{ contentIconPath: vscode.Uri.parse(svgurl), verticalAlign: "text-top" },
    },
  };
}

function newSvg(width: number, height: number): Svg {
  const window = createSVGWindow();
  const document = window.document;
  registerWindow(window, document);
  return (<Svg>SVG(document.documentElement)).size(width, height);
}

function decorateImage() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    console.log("no editor");
    return;
  }
  const afterLineText = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
  });
  const i597 = image597();

  editor.setDecorations(afterLineText, [
    image502(60, 5, 8, 6, "a"),
    image503(0, 14, 16, 15, "value"),
    image505(0, 26, 28, 27, "x", "the function"),
    image2decoration(i597, 62),
  ]);
}

function regionPointConflict(
  xshift: number,
  fromline: number,
  toline: number,
  errorline: number,
  regiontext: string,
  pointtext: string,
  tip: string
) {
  const svgimg = newSvg(800, G.lineheight * (toline - fromline + 2));
  const canvas = svgimg.group().attr({
    fill: "transparent",
    transform: `translate(${xshift}, 0)`,
    style: `font-family: monospace; font-size: ${G.fontsize}px; overflow: visible;`,
  });
  canvas.path(`M0,0 L10,0 l0,${G.lineheight * (toline - fromline + 1)} l-10,0`).stroke("cyan");
  canvas.plain(regiontext).fill("cyan").attr({ x: 20, y: G.fontsize });
  canvas.path(`M0,${(errorline - fromline + 0.5) * G.lineheight} l20,0`).stroke("red");
  canvas
    .plain(pointtext)
    .fill("red")
    .attr({ x: 30, y: G.fontsize + G.lineheight * (errorline - fromline) });
  canvas
    .text(tip)
    .fill("white")
    .attr({ x: 20, y: G.fontsize + G.lineheight * (toline - fromline) });
  return image2decoration(svgimg, fromline - 1);
}

function image502(
  xshift: number,
  fromline: number,
  toline: number,
  errorline: number,
  borrowed: string
): vscode.DecorationOptions {
  const imm = `\`${borrowed}\` borrowed immutably in this region`;
  const mut = `\`${borrowed}\` borrowed mutably here, conflicting with the immutable borrow`;
  const tip = "tip: move the mutable borrow out of the immutable borrow area";
  return regionPointConflict(xshift, fromline, toline, errorline, imm, mut, tip);
}

function image503(
  xshift: number,
  fromline: number,
  toline: number,
  errorline: number,
  borrowed: string
): vscode.DecorationOptions {
  const imm = `\`${borrowed}\` borrowed mutably in this region`;
  const mut = `\`${borrowed}\` used here, conflicting with the borrow`;
  const tip = `tip: move the use of \`${borrowed}\` out of the borrow region`;
  return regionPointConflict(xshift, fromline, toline, errorline, imm, mut, tip);
}

function image505(
  xshift: number,
  fromline: number,
  toline: number,
  errorline: number,
  borrowed: string,
  movein: string
): vscode.DecorationOptions {
  const imm = `\`${borrowed}\` borrowed in this region`;
  const mut = `\`${borrowed}\` moved into ${movein}`;
  const tip =
    "tip: the move of a value should happen when it is not borrowed\nafter the move, the value can no longer be borrowed";
  return regionPointConflict(xshift, fromline, toline, errorline, imm, mut, tip);
}

function image597(): Svg {
  const svgimg = newSvg(800, 7 * G.lineheight);
  const canvas = svgimg.group().attr({
    fill: "transparent",
    transform: "translate(80, 0)",
    style: `font-family: monospace; font-size: ${G.fontsize}px; overflow: visible;`,
  });
  canvas.path(`M0,0 L10,0 l0,${G.lineheight * 3} l-10,0`).stroke("cyan");
  canvas
    .plain("`y`'s lifetime")
    .fill("cyan")
    .attr({ x: 20, y: 1.5 * G.lineheight });
  canvas
    .plain("`x.x` still refers to `y`, but `y` doesn't exist anymore")
    .fill("red")
    .attr({ x: 0, y: G.fontsize + 3 * G.lineheight });
  return svgimg;
}

// This method is called when your extension is deactivated
export function deactivate() {}
