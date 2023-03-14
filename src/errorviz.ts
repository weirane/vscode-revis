import * as vscode from "vscode";
import { log, svg2uri, littleTriangle } from "./util";
import { imageByCode } from "./visualizations";

function newDecorationType(): vscode.TextEditorDecorationType {
  return vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
  });
}

export const CONFIG = {
  fontsize: vscode.workspace.getConfiguration("editor").get<number>("fontSize") ?? 14,
  charwidth: 10,
  lineheight: 0,
};
CONFIG.lineheight = Math.max(8, Math.round(1.35 * CONFIG.fontsize));

export type DiagnosticInfo = {
  diagnostics: vscode.Diagnostic;
  displayed: boolean;
  dectype: vscode.TextEditorDecorationType | null;
  svg: vscode.DecorationOptions | null;
};
export const G = {
  triangleDtype: vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    gutterIconPath: svg2uri(littleTriangle()),
  }),
  diags: new Map<string, DiagnosticInfo>(),
  showTriangles(diags: Map<string, DiagnosticInfo> | null = null) {
    if (diags === null) {
      diags = this.diags;
    }
    const ranges = Array.from(diags.keys()).map((k) => {
      const line = parseInt(k);
      return new vscode.Range(line, 0, line, 0);
    });
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
      log.error("no editor");
      return;
    }
    editor.setDecorations(this.triangleDtype, ranges);
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
