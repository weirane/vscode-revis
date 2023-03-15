import * as vscode from "vscode";
import { Svg } from "@svgdotjs/svg.js";
import { range, log, svg2uri, newSvg } from "./util";
import { CONFIG } from "./errorviz";

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

export function imageByCode(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic
): vscode.DecorationOptions | string {
  if (
    typeof diag.code === "number" ||
    typeof diag.code === "string" ||
    typeof diag.code?.value !== "string"
  ) {
    log.error("unexpected diag.code type", diag.code);
    return "unexpected diag.code type";
  }

  const codeFuncMap: Map<
    string,
    (editor: vscode.TextEditor, diag: vscode.Diagnostic) => string | vscode.DecorationOptions
  > = new Map([
    ["E0382", image382],
    ["E0499", image499],
    ["E0502", image502],
    ["E0503", image503],
    ["E0505", image505],
    ["E0506", image506],
    ["E0597", image597],
  ]);
  const func = codeFuncMap.get(diag.code!.value);
  if (func === undefined) {
    log.info(`unsupported error code ${diag.code!.value}`);
    return `unsupported error code ${diag.code!.value}`;
  } else {
    return func(editor, diag);
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
  const svgimg = newSvg(
    800 + xshift,
    CONFIG.lineheight * (Math.max(toline, tipline) - fromline + 2)
  );
  const canvas = svgimg.group().attr({
    fill: "transparent",
    transform: `translate(${xshift}, 0)`,
    style: `font-family: monospace; font-size: ${CONFIG.fontsize}px; overflow: visible;`,
  });
  canvas.path(`M0,0 L10,0 l0,${CONFIG.lineheight * (toline - fromline + 1)} l-10,0`).stroke("cyan");
  canvas.plain(regiontext).fill("cyan").attr({ x: 20, y: CONFIG.fontsize });
  canvas.path(`M0,${(errorline - fromline + 0.5) * CONFIG.lineheight} l20,0`).stroke("red");
  canvas
    .plain(pointtext)
    .fill("red")
    .attr({ x: 30, y: CONFIG.fontsize + CONFIG.lineheight * (errorline - fromline) });
  canvas
    .text(tip)
    .fill("white")
    .attr({ x: 20, y: CONFIG.fontsize + CONFIG.lineheight * (tipline - fromline) });
  return image2decoration(svgimg, fromline);
}

function image382(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic
): vscode.DecorationOptions | string {
  log.info("382", diag);
  return "";
}

function image499(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic
): vscode.DecorationOptions | string {
  log.info("499", diag);
  const borrowed = /^cannot borrow `(.+)` as mutable more than once at a time/.exec(
    diag.message
  )![1];
  const errorline = diag.range.start.line;
  const fromline = diag.relatedInformation?.filter((d) =>
    d.message.endsWith("first mutable borrow occurs here")
  )[0]?.location.range.start.line;
  const toline = diag.relatedInformation?.filter((d) =>
    d.message.endsWith("first borrow later used here")
  )[0]?.location.range.end.line;
  if (borrowed === undefined || fromline === undefined || toline === undefined) {
    return "cannot parse diagnostics";
  }
  const xshift = getXshift(editor, fromline, toline) * CONFIG.charwidth;
  const imm = `\`${borrowed}\` borrowed mutably in this region`;
  const mut = `\`${borrowed}\` borrowed mutably again, conflicting with the first borrow`;
  const tip = "tip: a variable can only be mutably borrowed once at a time";
  return regionPointConflict(xshift, fromline, toline, errorline, toline, imm, mut, tip);
}

function image502(
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
  const xshift = getXshift(editor, fromline, toline) * CONFIG.charwidth;
  const imm = `\`${borrowed}\` borrowed immutably in this region`;
  const mut = `\`${borrowed}\` borrowed mutably here, conflicting with the immutable borrow`;
  const tip = "tip: move the mutable borrow out of the immutable borrow area";
  return regionPointConflict(xshift, fromline, toline, errorline, toline, imm, mut, tip);
}

function image503(
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
  const xshift = getXshift(editor, fromline, toline) * CONFIG.charwidth;
  const imm = `\`${borrowed}\` borrowed mutably in this region`;
  const mut = `\`${borrowed}\` used here, conflicting with the borrow`;
  const tip = `tip: move the use of \`${borrowed}\` out of the borrow region`;
  return regionPointConflict(xshift, fromline, toline, errorline, toline, imm, mut, tip);
}

function image505(
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
  const xshift = getXshift(editor, fromline, toline) * CONFIG.charwidth;
  const imm = `\`${borrowed}\` borrowed in this region`;
  const mut = `\`${borrowed}\` moved into ${movein}`;
  const tip =
    "tip: the move of a value should happen when it is not borrowed.\nafter the move, the value can no longer be borrowed";
  return regionPointConflict(xshift, fromline, toline, errorline, toline, imm, mut, tip);
}

function image506(
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
  const xshift = getXshift(editor, fromline, toline) * CONFIG.charwidth;
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
  const xshift = getXshift(editor, validfrom, lateruse) * CONFIG.charwidth;
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
