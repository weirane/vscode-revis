import * as vscode from "vscode";
import { Svg, G as Group } from "@svgdotjs/svg.js";
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

function image2decoration(darkImage: Svg, lightImage: Svg, line: number): vscode.DecorationOptions {
  return {
    range: new vscode.Range(line, 0, line, 0),
    renderOptions: {
      light: {
        after: <any>{
          contentIconPath: svg2uri(lightImage),
          verticalAlign: "text-top",
        },
      },
      dark: {
        after: <any>{
          contentIconPath: svg2uri(darkImage),
          verticalAlign: "text-top",
        },
      },
    },
    hoverMessage: new vscode.MarkdownString("click for visualization"),
  };
}

/**
 * Draw a pointer to a line and add text at the right
 * @param lineoffset which line do you want to annotate?
 * @param pointeroffset where should the pointer be? (0: at the top of the line, 0.5: at the middle, 1: at the bottom)
 */
function pointerText(
  canvas: Group,
  lineoffset: number,
  pointeroffset: number,
  text: string,
  color: string
) {
  const { fontsize, lineheight, arrowsize } = CONFIG;
  canvas
    .path(
      `M0,${(lineoffset + pointeroffset) * lineheight} l20,0
      l${-arrowsize},${-arrowsize / 2}
      m${arrowsize},${arrowsize / 2}
      l${-arrowsize},${arrowsize / 2}`
    )
    .stroke(color);
  canvas
    .plain(text)
    .fill(color)
    .attr({ x: 30, y: fontsize + lineheight * lineoffset });
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
    (
      editor: vscode.TextEditor,
      diag: vscode.Diagnostic,
      theme: keyof typeof CONFIG.color
    ) => string | [Svg, number]
  > = new Map([
    ["E0373", image373],
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
    const darkresult = func(editor, diag, "dark");
    if (typeof darkresult === "string") {
      return darkresult;
    }
    const lightresult = func(editor, diag, "light");
    if (typeof lightresult === "string") {
      return lightresult;
    }
    const [dark, line] = darkresult;
    const [light, _] = lightresult;
    return image2decoration(dark, light, line);
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
  tip: string,
  theme: keyof typeof CONFIG.color
): [Svg, number, Group] {
  const { fontsize, lineheight, arrowsize } = CONFIG;
  const colortheme = CONFIG.color[theme];
  const svgimg = newSvg(800 + xshift, lineheight * (Math.max(toline, tipline) - fromline + 2));
  const canvas = svgimg.group().attr({
    fill: "transparent",
    transform: `translate(${xshift}, 0)`,
    style: `font-family: monospace; font-size: ${fontsize}px; overflow: visible;`,
  });
  canvas
    .path(
      `M0,0 L10,0 l0,${lineheight * (toline - fromline + 1)} l-10,0
       M10,${lineheight / 2}l10,0
       l${-arrowsize},${-arrowsize / 2}
       m${arrowsize},${arrowsize / 2}
       l${-arrowsize},${arrowsize / 2}`
    )
    .stroke(colortheme.info);
  canvas.text(regiontext).fill(colortheme.info).attr({ x: 30, y: fontsize });
  pointerText(canvas, errorline - fromline, 0.5, pointtext, colortheme.error);
  canvas
    .text(tip)
    .fill(colortheme.tip)
    .attr({ x: 20, y: fontsize + lineheight * (tipline - fromline) });
  return [svgimg, fromline, canvas];
}

function image373(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic,
  theme: keyof typeof CONFIG.color
): [Svg, number] | string {
  const colortheme = CONFIG.color[theme];
  const { fontsize, lineheight, charwidth, arrowsize } = CONFIG;
  const borrowed = /^closure may outlive the current function, but it borrows `(.+)`,/.exec(
    diag.message
  )![1];
  const line = diag.range.start.line;
  const xshift = getXshift(editor, line, line + 2) * charwidth;
  const svgimg = newSvg(800 + xshift, 2 * lineheight);
  const canvas = svgimg.group().attr({
    fill: "transparent",
    transform: `translate(${xshift}, 0)`,
    style: `font-family: monospace; font-size: ${fontsize}px; overflow: visible;`,
  });
  canvas
    .path(
      `M0,${lineheight / 2} l10,0 l0,${lineheight * 1.5}
       l${-arrowsize / 2},${-arrowsize}
       m${arrowsize / 2},${arrowsize}
       l${arrowsize / 2},${-arrowsize}`
    )
    .stroke(colortheme.error);
  canvas
    .text(`the closure borrows \`${borrowed}\`, which only lives in the current function`)
    .fill(colortheme.info)
    .attr({ x: 20, y: fontsize });
  canvas
    .text(`but the closure needs to live after the function returns`)
    .fill(colortheme.error)
    .attr({ x: 20, y: fontsize + lineheight });
  return [svgimg, line];
}

function image382(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic,
  theme: keyof typeof CONFIG.color
): [Svg, number] | string {
  const colortheme = CONFIG.color[theme];
  const moved = /: `(.+)`\n/.exec(diag.message)![1];
  const errorline = diag.range.start.line;
  const defineline = diag.relatedInformation?.filter((d) =>
    d.message.startsWith("move occurs because `")
  )[0]?.location.range.start.line;
  const moveline = diag.relatedInformation?.filter((d) => d.message.endsWith("value moved here"))[0]
    ?.location.range.start.line;
  if (defineline === undefined || moveline === undefined) {
    return "cannot parse diagnostics";
  }
  const xshift = getXshift(editor, defineline, errorline) * CONFIG.charwidth;
  const [svgimg, line, canvas] = regionPointConflict(
    xshift,
    defineline,
    moveline,
    errorline,
    errorline + 1,
    `lifetime of \`${moved}\``,
    `use of \`${moved}\` after being moved`,
    "tip: value cannot be used after moved",
    theme
  );
  pointerText(
    canvas,
    moveline - defineline,
    0.5,
    `\`${moved}\` moved to another variable`,
    colortheme.info2
  );
  return [svgimg, line];
}

function image499(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic,
  theme: keyof typeof CONFIG.color
): [Svg, number] | string {
  const colortheme = CONFIG.color[theme];
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
  if (fromline === toline) {
    // loop situation
    const tipline = errorline + 1;
    const svgimg = newSvg(800 + xshift, CONFIG.lineheight * (errorline - fromline + 2));
    const canvas = svgimg.group().attr({
      fill: "transparent",
      transform: `translate(${xshift}, 0)`,
      style: `font-family: monospace; font-size: ${CONFIG.fontsize}px; overflow: visible;`,
    });
    pointerText(
      canvas,
      0,
      0.5,
      `\`${borrowed}\` mutably borrowed for the duration of the loop`,
      colortheme.info
    );
    pointerText(
      canvas,
      errorline - fromline,
      0.5,
      `\`${borrowed}\` mutably borrowed again`,
      colortheme.error
    );
    canvas
      .text("tip: a value can only be mutably borrowed once at a time")
      .fill(colortheme.tip)
      .attr({ x: 20, y: CONFIG.fontsize + CONFIG.lineheight * (tipline - fromline) });
    return [svgimg, fromline];
  } else {
    const imm = `\`${borrowed}\` borrowed mutably in this region`;
    const mut = `\`${borrowed}\` borrowed mutably again, conflicting with the first borrow`;
    const tip = "tip: a variable can only be mutably borrowed once at a time";
    const [s, li, _] = regionPointConflict(
      xshift,
      fromline,
      toline,
      errorline,
      toline,
      imm,
      mut,
      tip,
      theme
    );
    return [s, li];
  }
}

function image502(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic,
  theme: keyof typeof CONFIG.color
): [Svg, number] | string {
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
  const [s, li, _] = regionPointConflict(
    xshift,
    fromline,
    toline,
    errorline,
    toline,
    imm,
    mut,
    tip,
    theme
  );
  return [s, li];
}

function image503(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic,
  theme: keyof typeof CONFIG.color
): [Svg, number] | string {
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
  const [s, li, _] = regionPointConflict(
    xshift,
    fromline,
    toline,
    errorline,
    toline,
    imm,
    mut,
    tip,
    theme
  );
  return [s, li];
}

function image505(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic,
  theme: keyof typeof CONFIG.color
): [Svg, number] | string {
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
  const [s, li, _] = regionPointConflict(
    xshift,
    fromline,
    toline,
    errorline,
    toline,
    imm,
    mut,
    tip,
    theme
  );
  return [s, li];
}

function image506(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic,
  theme: keyof typeof CONFIG.color
): [Svg, number] | string {
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
  const [s, li, _] = regionPointConflict(
    xshift,
    fromline,
    toline,
    errorline,
    toline,
    `\`${borrowed}\` borrowed in this region`,
    `\`${borrowed}\` assigned to another value`,
    tip,
    theme
  );
  return [s, li];
}

function image597(
  editor: vscode.TextEditor,
  diag: vscode.Diagnostic,
  theme: keyof typeof CONFIG.color
): [Svg, number] | string {
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
  const [s, li, _] = regionPointConflict(
    xshift,
    validfrom,
    validto,
    lateruse,
    lateruse + 1,
    `\`${user}\` borrows from \`${borrowed}\` and can be used in this region`,
    `\`${borrowed}\` is no longer valid, while \`${user}\` is still borrowing it`,
    `tip: make sure \`${user}\` borrows from a valid value`,
    theme
  );
  return [s, li];
}
