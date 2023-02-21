// import { JSDOM } from 'jsdom';
// const DOM = new JSDOM(`<!DOCTYPE html><body></body>`);
// global.window = <any>DOM.window;
// global.document = DOM.window.document;

//@ts-ignore
import { createSVGWindow } from "svgdom";
import { SVG, registerWindow, Svg } from "@svgdotjs/svg.js";
import * as vscode from 'vscode';

const G = {
  fontsize: vscode.workspace.getConfiguration('editor').get<number>('fontSize') ?? 14,
  charwidth: '14px',
  lineheight: 0,
};
G.lineheight = Math.max(8, Math.round(1.35 * G.fontsize));

let output: vscode.OutputChannel;
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "errorviz" is now active!');
  output = vscode.window.createOutputChannel("RError");
  output.appendLine('debug');

  decorateImage();
  output.appendLine('decorated');
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
  const svgurl = `data:image/svg+xml;base64,${Buffer.from(image.svg()).toString('base64')}`;
  return {
    range: new vscode.Range(line, 0, line, 0),
    renderOptions: {
      after: <any>{ contentIconPath: vscode.Uri.parse(svgurl), verticalAlign: 'text-top' }
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
    console.log('no editor');
    return;
  }
  const afterLineText = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
  });
  const i502 = image502(
    '`a` borrowed immutably in this region',
    '`a` borrowed mutably, conflicting with the immutable borrow region',
    'tip: move the mutable borrow out of the immutable borrow area');
  const i503 = image503(
    '`value` borrowed mutably in this region',
    '`value` used here, conflicting with the borrow region',
    'tip: move the use of `value` out of the borrow region');
  const i505 = image505(
    800, 4 * G.lineheight,
    '`x` borrowed in this region',
    '`x` moved into function `eat()`',
    'tip: the move of a value should happen when it is not borrowed\nafter the move, the value can no longer be borrowed',
  );
  const i597 = image597();

  editor.setDecorations(afterLineText, [
    image2decoration(i502, 4),
    image2decoration(i503, 12),
    image2decoration(i505, 24),
    image2decoration(i597, 61),
  ]);
}

function image502(imm: string, mut: string, tip: string): Svg {
  const svgimg = newSvg(800, 3 * G.lineheight);
  const canvas = svgimg.group().attr({
    fill: 'transparent',
    transform: 'translate(60, 0)',
    style: `font-family: monospace; font-size: ${G.fontsize}px; overflow: visible;`,
  });
  canvas.path(`M0,0 L10,0 l0,${G.lineheight * 3} l-10,0`).stroke('cyan');
  canvas.plain(imm).fill('cyan').attr({ x: 20, y: G.fontsize});
  canvas.path(`M0,${1.5 * G.lineheight} l20,0`).stroke('red');
  canvas.plain(mut).fill('red').attr({ x: 30, y: G.fontsize + G.lineheight});
  canvas.plain(tip).fill('white').attr({ x: 20, y: G.fontsize + 2 * G.lineheight});
  return svgimg;
}

function image503(mut: string, use: string, tip: string): Svg {
  const svgimg = newSvg(800, 3 * G.lineheight);
  const canvas = svgimg.group().attr({
    fill: 'transparent',
    transform: 'translate(0, 0)',
    style: `font-family: monospace; font-size: ${G.fontsize}px; overflow: visible;`,
  });
  canvas.path(`M0,0 L10,0 l0,${G.lineheight * 3} l-10,0`).stroke('cyan');
  canvas.plain(mut).fill('cyan').attr({ x: 20, y: G.fontsize});
  canvas.path(`M0,${1.5 * G.lineheight} l20,0`).stroke('red');
  canvas.plain(use).fill('red').attr({ x: 30, y: G.fontsize + G.lineheight});
  canvas.plain(tip).fill('white').attr({ x: 20, y: G.fontsize + 2 * G.lineheight});
  return svgimg;
}

function image505(width: number, height: number, borrow: string, move: string, tip: string): Svg {
  const svgimg = newSvg(width, height);
  const canvas = svgimg.group().attr({
    fill: 'transparent',
    transform: 'translate(0, 0)',
    style: `font-family: monospace; font-size: ${G.fontsize}px; overflow: visible;`,
  });
  canvas.path(`M0,0 L10,0 l0,${G.lineheight * 3} l-10,0`).stroke('cyan');
  canvas.plain(borrow).fill('cyan').attr({ x: 20, y: G.fontsize});
  canvas.path(`M0,${1.5 * G.lineheight} l20,0`).stroke('red');
  canvas.plain(move).fill('red').attr({ x: 30, y: G.fontsize + G.lineheight});
  canvas.text(tip).fill('white').attr({ x: 20, y: G.fontsize + 2 * G.lineheight});
  return svgimg;
}

function image597(): Svg {
  const svgimg = newSvg(800, 7 * G.lineheight);
  const canvas = svgimg.group().attr({
    fill: 'transparent',
    transform: 'translate(80, 0)',
    style: `font-family: monospace; font-size: ${G.fontsize}px; overflow: visible;`,
  });
  canvas.path(`M0,0 L10,0 l0,${G.lineheight * 3} l-10,0`).stroke('cyan');
  canvas.plain("`y`'s lifetime").fill('cyan').attr({ x: 20, y: 1.5 * G.lineheight});
  canvas.plain('`x.x` still refers to `y`, but `y` doesn\'t exist anymore').fill('red').attr({ x: 0, y: G.fontsize + 3 * G.lineheight});
  return svgimg;
}

function decorate502() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    console.log('no editor');
    return;
  }
  const afterLineText = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    after: { margin: `0 0 0 2em` },
  });
  const [info1l, info1f, info1t, info1m] = [3, 12, 14, 'immutable borrow occurs here'];
  const [info2l, info2f, info2t, info2m] = [5, 19, 20, 'immutable borrow later used here'];
  const [errorl, errorf, errort, errorm] = [4, 8, 9, 'mutable borrow occurs here'];
  const message = 'cannot borrow `*a` as mutable because it is also borrowed as immutable';
  editor.setDecorations(afterLineText, [
    {
      range: new vscode.Range(info1l, 0, info1l, 0),
      renderOptions: {
        after: {
          color: 'cyan',
          contentText: info1m,
        }
      },
    },
    {
      range: new vscode.Range(info2l, 0, info2l, 0),
      renderOptions: {
        after: {
          color: 'cyan',
          contentText: info2m,
        }
      },
    },
    {
      range: new vscode.Range(errorl, 0, errorl, 0),
      renderOptions: {
        after: {
          color: 'red',
          contentText: errorm,
        }
      },
    },
  ]);
  const relatedInfo = vscode.window.createTextEditorDecorationType({
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'cyan',
  });
  editor.setDecorations(relatedInfo, [
    {
      range: new vscode.Range(info1l, info1f, info1l, info1t),
    },
    {
      range: new vscode.Range(info2l, info2f, info2l, info2t),
    },
  ]);

  const errorInfo = vscode.window.createTextEditorDecorationType({
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'red',
  });
  editor.setDecorations(errorInfo, [
      {
          range: new vscode.Range(errorl, errorf, errorl, errort),
          hoverMessage: message,
      },
  ]);
}

function decorate505() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    console.log('no editor');
    return;
  }
  const afterLineText = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    // cursor: 'crosshair',
    after: {
      margin: `0 0 0 2em`,
    },
  });
  const [info1l, info1f, info1t, info1m] = [16, 30, 32, 'borrow of `x` occurs here'];
  const [info2l, info2f, info2t, info2m] = [18, 11, 22, 'borrow later used here'];
  const [errorl, errorf, errort, errorm] = [17, 8, 9, 'move out of `x` occurs here'];
  const message = 'cannot move out of `x` because it is borrowed';
  editor.setDecorations(afterLineText, [
    {
      range: new vscode.Range(info1l, 0, info1l, 0),
      renderOptions: {
        after: {
          color: 'cyan',
          contentText: info1m,
        }
      },
    },
    {
      range: new vscode.Range(info2l, 0, info2l, 0),
      renderOptions: {
        after: {
          color: 'cyan',
          contentText: info2m,
        }
      },
    },
    {
      range: new vscode.Range(errorl, 0, errorl, 0),
      renderOptions: {
        after: {
          color: 'red',
          contentText: errorm,
        }
      },
    },
  ]);
  const relatedInfo = vscode.window.createTextEditorDecorationType({
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'cyan',
  });
  editor.setDecorations(relatedInfo, [
    {
      range: new vscode.Range(info1l, info1f, info1l, info1t),
    },
    {
      range: new vscode.Range(info2l, info2f, info2l, info2t),
    },
  ]);

  const errorInfo = vscode.window.createTextEditorDecorationType({
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'red',
  });
  editor.setDecorations(errorInfo, [
    {
      range: new vscode.Range(errorl, errorf, errorl, errort),
      hoverMessage: message,
    },
  ]);
}

// This method is called when your extension is deactivated
export function deactivate() { }
