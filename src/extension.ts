import * as vscode from "vscode";
import { languages } from "vscode";
import * as errorviz from "./errorviz";
import { log } from "./util";
import { codeFuncMap } from "./visualizations";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    languages.onDidChangeDiagnostics((_: vscode.DiagnosticChangeEvent) => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined) {
        return;
      }
      saveDiagnostics(editor.document);
    })
  );
  // context.subscriptions.push(
  //   vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
  //     // wait for rust-analyzer diagnostics to be ready
  //     setTimeout(() => {
  //       saveDiagnostics(doc);
  //     }, 300);
  //   })
  // );
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (e === undefined) {
        return;
      }
      saveDiagnostics(e.document);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "errorviz.toggleVisualization",
      toggleVisualization,
      "Toggle Visualization"
    )
  );
}

function saveDiagnostics(doc: vscode.TextDocument) {
  if (doc.languageId !== "rust") {
    // only supports rust
    return;
  }
  const diagnostics = languages
    .getDiagnostics(doc.uri)
    // only include _supported_ _rust_ _errors_
    .filter((d) => {
      return (
        d.source === "rustc" &&
        d.severity === vscode.DiagnosticSeverity.Error &&
        typeof d.code === "object" &&
        typeof d.code.value === "string" &&
        codeFuncMap.has(d.code.value)
      );
    });
  const newdiags = new Map<string, errorviz.DiagnosticInfo>();
  const torefresh: string[] = [];
  for (const diag of diagnostics) {
    if (diag.code === undefined || typeof diag.code === "number" || typeof diag.code === "string") {
      log.error("unexpected diag.code type", typeof diag.code);
      return;
    }
    const erridx = diag.range.start.line.toString() + "_" + diag.code.value;
    newdiags.set(erridx, {
      diagnostics: diag,
      displayed: false,
      dectype: null,
      svg: null,
    });
    const odiag = errorviz.G.diags.get(erridx);
    if (odiag?.displayed) {
      // this is a displayed old diagnostics
      torefresh.push(erridx);
    }
  }
  // hide old diags and refresh displayed diagnostics
  for (const id of errorviz.G.diags.keys()) {
    errorviz.G.hideDiag(id);
  }
  for (const d of torefresh) {
    errorviz.G.showDiag(d, newdiags);
  }
  errorviz.G.diags = newdiags;
  errorviz.G.showTriangles();
}

function toggleVisualization() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    log.error("no editor");
    return;
  }
  const currline = editor.selection.active.line;
  const lines = [...errorviz.G.diags.keys()];
  const ontheline = lines.filter((i) => parseInt(i) === currline);
  if (!ontheline) {
    log.info("nothing to toggle");
    return;
  }
  if (ontheline.length > 1) {
    // TODO: use quick picks https://code.visualstudio.com/api/ux-guidelines/quick-picks
    log.error(`too many errors on line ${ontheline}`);
    return;
  }
  const totoggle = errorviz.G.diags.get(ontheline[0]);
  if (totoggle === undefined) {
    log.info("nothing to toggle");
    return;
  }
  if (totoggle.displayed) {
    errorviz.G.hideDiag(ontheline[0]);
  } else {
    errorviz.G.showDiag(ontheline[0]);
  }
  errorviz.G.showTriangles();
}

// This method is called when your extension is deactivated
export function deactivate() {}
