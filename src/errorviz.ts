//@ts-ignore
import { createSVGWindow } from "svgdom";
import { SVG, registerWindow, Svg } from "@svgdotjs/svg.js";
import * as vscode from "vscode";
import { log } from "./util";

function svg2uri(svg: Svg): vscode.Uri {
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg.svg()).toString("base64")}`;
  return vscode.Uri.parse(uri);
}

/** Generates an array of numbers in the interval [from, to) */
function range(from: number, to: number): ReadonlyArray<number> {
  return [...Array(to - from).keys()].map((i) => i + from);
}

/**
 *  Gets the difference of line width of the longest line from lines `de` to
 * `au` and the width of `de` in character count
 */
function getXshift(editor: vscode.TextEditor, de: number, au: number): number {
  const longest = Math.max(
    ...range(de, au + 1).map((li) => {
      try {
        return editor.document.lineAt(li).text.length;
      } catch (_) {
        return 0;
      }
    })
  );
  const first = editor.document.lineAt(de).text.length;
  return longest - first;
}

function newDecorationType(): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
  });
}

function image2decoration(image: Svg, line: number): vscode.DecorationOptions {
  return {
    range: new vscode.Range(line, 0, line, 0),
    renderOptions: {
      after: <any>{
        contentIconPath: svg2uri(image),
        verticalAlign: "text-top",
      },
    },
    hoverMessage: new vscode.MarkdownString("click for visualization"),
  };
}

function newSvg(width: number, height: number): Svg {
  const window = createSVGWindow();
  const document = window.document;
  registerWindow(window, document);
  return (<Svg>SVG(document.documentElement)).size(width, height);
}

export type DiagnosticInfo = {
  diagnostics: vscode.Diagnostic;
  displayed: boolean;
  dectype: vscode.TextEditorDecorationType | null;
  svg: vscode.DecorationOptions | null;
};
export const G = {
  fontsize: vscode.workspace.getConfiguration("editor").get<number>("fontSize") ?? 14,
  charwidth: 10,
  lineheight: 0,
  dectype: vscode.window.createTextEditorDecorationType({ isWholeLine: true }),
  diags: new Map<string, DiagnosticInfo>(),
  showTriangles(diags: Map<string, DiagnosticInfo> | null = null) {
    if (diags === null) {
      diags = this.diags;
    }
    const sidelength = 9;
    const sign = newSvg(sidelength, sidelength * 0.866);
    sign.path(`M${sidelength / 2},0 L0,${sidelength * 0.866} l${sidelength},0`).fill("#ff3300");
    const dtype = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      gutterIconPath: svg2uri(sign),
    });
    const ranges = Array.from(diags.keys()).map((k) => {
      const line = parseInt(k);
      return new vscode.Range(line, 0, line, 0);
    });
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
      log.error("no editor");
      return;
    }
    editor.setDecorations(dtype, ranges);
  },
  hideDiag(idx: string, diags: Map<string, DiagnosticInfo> | null = null) {
    if (diags === null) {
      diags = this.diags;
    }
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
      log.error("no editor");
      return;
    }
    const diaginfo = diags.get(idx);
    if (diaginfo === undefined) {
      return;
    }
    const diag = diaginfo.diagnostics;
    if (typeof diag.code === "number" || typeof diag.code === "string") {
      log.error("unexpected diag.code type");
      return;
    }
    if (diaginfo.dectype !== null) {
      editor.setDecorations(diaginfo.dectype, []);
    }
    diaginfo.displayed = false;
  },
  showDiag(erridx: string, diags: Map<string, DiagnosticInfo> | null = null) {
    if (diags === null) {
      diags = this.diags;
    }
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
      log.error("no editor");
      return;
    }
    const diaginfo = diags.get(erridx);
    if (diaginfo === undefined) {
      log.error(`diags pour ${erridx} n'existe pas`);
      return;
    }
    const diag = diaginfo.diagnostics;
    if (typeof diag.code === "number" || typeof diag.code === "string") {
      log.error("unexpected diag.code type");
      return;
    }
    // get the diaginfo.svg in this switch block
    const img = imageByCode(editor, diag);
    if (typeof img === "string") {
      log.error("svg generation failed");
      return;
    }
    diaginfo.svg = img;
    if (diaginfo.dectype === null) {
      diaginfo.dectype = newDecorationType();
    }
    diaginfo.displayed = true;
    editor.setDecorations(diaginfo.dectype, [diaginfo.svg]);
  },
};
G.lineheight = Math.max(8, Math.round(1.35 * G.fontsize));

function imageByCode(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic
): vscode.DecorationOptions | string {
  if (typeof diag.code === "number" || typeof diag.code === "string") {
    log.error("unexpected diag.code type");
    return "unexpected diag.code type";
  }
  switch (diag.code!.value) {
    case "E0502":
      return image502(editor, diag);
    case "E0503":
      return image503(editor, diag);
    case "E0505":
      return image505(editor, diag);
    case "E0506":
      return image506(editor, diag);
    case "E0597":
      return image597(editor, diag);
    default:
      log.info(`unsupported error code ${diag.code!.value}`);
      return `unsupported error code ${diag.code!.value}`;
  }
}

/// line numbers are 0-indexed
function regionPointConflict(
  xshift: number,
  fromline: number,
  toline: number,
  errorline: number,
  tipline: number,
  regiontext: string,
  pointtext: string,
  tip: string
) {
  const svgimg = newSvg(800 + xshift, G.lineheight * (Math.max(toline, tipline) - fromline + 2));
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
    .attr({ x: 20, y: G.fontsize + G.lineheight * (tipline - fromline) });
  return image2decoration(svgimg, fromline);
}

export function image502(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic
): vscode.DecorationOptions | string {
  const borrowed = /^cannot borrow `\*?(.+)` as mutable/.exec(diag.message)![1];
  const errorline = diag.range.start.line;
  const fromline = diag.relatedInformation?.filter((d) =>
    d.message.endsWith("borrow occurs here")
  )[0]?.location.range.start.line;
  const toline = diag.relatedInformation?.filter((d) =>
    d.message.endsWith("borrow later used here")
  )[0]?.location.range.end.line;
  if (borrowed === undefined || fromline === undefined || toline === undefined) {
    return "cannot parse diagnostics";
  }
  const xshift = getXshift(editor, fromline, toline) * G.charwidth;
  const imm = `\`${borrowed}\` borrowed immutably in this region`;
  const mut = `\`${borrowed}\` borrowed mutably here, conflicting with the immutable borrow`;
  const tip = "tip: move the mutable borrow out of the immutable borrow area";
  return regionPointConflict(xshift, fromline, toline, errorline, toline, imm, mut, tip);
}

export function image503(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic
): vscode.DecorationOptions | string {
  const borrowed = /^cannot use `(.+)` because it was mutably borrowed/.exec(diag.message)![1];
  const errorline = diag.range.start.line;
  const fromline = diag.relatedInformation?.filter((d) => d.message.endsWith("occurs here"))[0]
    ?.location.range.start.line;
  const toline = diag.relatedInformation?.filter((d) =>
    d.message.endsWith("borrow later used here")
  )[0]?.location.range.end.line;
  if (borrowed === undefined || fromline === undefined || toline === undefined) {
    return "cannot parse diagnostics";
  }
  const xshift = getXshift(editor, fromline, toline) * G.charwidth;
  const imm = `\`${borrowed}\` borrowed mutably in this region`;
  const mut = `\`${borrowed}\` used here, conflicting with the borrow`;
  const tip = `tip: move the use of \`${borrowed}\` out of the borrow region`;
  return regionPointConflict(xshift, fromline, toline, errorline, toline, imm, mut, tip);
}

export function image505(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic
): vscode.DecorationOptions | string {
  const borrowed = /^cannot move out of `(.+)` because it is borrowed/.exec(diag.message)![1];
  const errorline = diag.range.start.line;
  const fromline = diag.relatedInformation?.filter((d) => d.message.endsWith("occurs here"))[0]
    ?.location.range.start.line;
  const toline = diag.relatedInformation?.filter((d) =>
    d.message.endsWith("borrow later used here")
  )[0]?.location.range.end.line;
  if (borrowed === undefined || fromline === undefined || toline === undefined) {
    return "cannot parse diagnostics";
  }
  // TODO: parse movein
  const movein = "something";
  const xshift = getXshift(editor, fromline, toline) * G.charwidth;
  const imm = `\`${borrowed}\` borrowed in this region`;
  const mut = `\`${borrowed}\` moved into ${movein}`;
  const tip =
    "tip: the move of a value should happen when it is not borrowed.\nafter the move, the value can no longer be borrowed";
  return regionPointConflict(xshift, fromline, toline, errorline, toline, imm, mut, tip);
}

export function image506(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic
): vscode.DecorationOptions | string {
  const borrowed = /^cannot assign to `(.+)` because it is borrowed/.exec(diag.message)![1];
  const errorline = diag.range.start.line;
  const fromline = diag.relatedInformation?.filter((d) => d.message.endsWith("occurs here"))[0]
    ?.location.range.start.line;
  const toline = diag.relatedInformation?.filter((d) =>
    d.message.endsWith("borrow later used here")
  )[0]?.location.range.end.line;
  if (borrowed === undefined || fromline === undefined || toline === undefined) {
    return "cannot parse diagnostics";
  }
  // TODO: parse movein
  const movein = "something";
  const xshift = getXshift(editor, fromline, toline) * G.charwidth;
  const mut = `\`${borrowed}\` moved into ${movein}`;
  const tip = "tip: when a variable is borrowed by another variable, it cannot be reassigned";
  return regionPointConflict(
    xshift,
    fromline,
    toline,
    errorline,
    toline,
    `\`${borrowed}\` borrowed in this region`,
    `\`${borrowed}\` assigned to another value`,
    tip
  );
}

function image597(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic
): vscode.DecorationOptions | string {
  const borrowed = /`(.+)` does not live long enough/.exec(diag.message)![1];
  const validfrom = diag.range.start.line;
  const validto = diag.relatedInformation?.filter((d) =>
    d.message.endsWith("dropped here while still borrowed")
  )[0]?.location.range.end.line;
  const lateruseObj = diag.relatedInformation?.filter((d) =>
    d.message.endsWith("borrow later used here")
  )[0];
  if (lateruseObj === undefined) {
    return "cannot parse diagnostics";
  }
  // get the name of the borrower
  if (lateruseObj.location.range.end.line !== lateruseObj.location.range.start.line) {
    log.warn("user crossed multiple lines");
  }
  const lateruse = lateruseObj.location.range.end.line;
  const line = editor.document.lineAt(lateruse).text;
  const userfrom = lateruseObj.location.range.start.character;
  const userto = lateruseObj.location.range.end.character;
  const user = line.slice(userfrom, userto);
  if (borrowed === undefined || validfrom === undefined || validto === undefined) {
    return "cannot parse diagnostics";
  }
  const xshift = getXshift(editor, validfrom, lateruse) * G.charwidth;
  return regionPointConflict(
    xshift,
    validfrom,
    validto,
    lateruse,
    lateruse + 1,
    `\`${user}\` borrows from \`${borrowed}\` and can be used in this region`,
    `\`${borrowed}\` is no longer valid, while \`${user}\` is still borrowing it`,
    `tip: make sure \`${user}\` borrows from a valid value`
  );
}
