import * as vscode from "vscode";
import { languages } from "vscode";
import * as errorviz from "./errorviz";
import { log } from "./util";
import { codeFuncMap } from "./visualizations";
import * as fs from "fs";
import { FormPanel } from "./telemetry/form";
import TelemetryReporter from '@vscode/extension-telemetry';


const VERSION = "0.1.1";
let intervalHandle: number | null = null;

const key = "cdf9fbe6-bfd3-438a-a2f6-9eed10994c4e";
const initialStamp = Math.floor(Date.now() / 1000);
let msgCnt = 1;
let msgMap = new Map<string, number>();
let stream: fs.WriteStream;
let reporter: TelemetryReporter;

export function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders) {
    log.error("no workspace folders");
    return;
  }
  const dir = vscode.workspace.workspaceFolders[0].uri.fsPath;
  fs.writeFileSync(dir + "/.errorviz-version", VERSION);

  vscode.window.showInformationMessage(
    "Would you like to participate in research and learn about your error resolution skills?",
    "Yes",
    "No"
    )
    .then((sel) => {
      if (sel === "Yes"){
        FormPanel.render();
      }
    });
  
  if (vscode.workspace.getConfiguration("errorviz").get("recordLogs")){
    if (vscode.workspace.getConfiguration("errorviz").get("sendLogs")){
      reporter = new TelemetryReporter(key);
      context.subscriptions.push(reporter);
    }

    if (!fs.existsSync(context.globalStorageUri.fsPath + "/log.json")){
      fs.writeFileSync(context.globalStorageUri.fsPath + "/log.json", "do not modify\n");
    }
    stream = fs.createWriteStream(context.globalStorageUri.fsPath + "/log.json", {flags:'a'});
    stream.write("{\"new session\"}\n");
  }

  const raconfig = vscode.workspace.getConfiguration("rust-analyzer");
  const useRustcErrorCode = raconfig.get<boolean>("diagnostics.useRustcErrorCode");
  if (!useRustcErrorCode) {
    vscode.window
      .showWarningMessage(
        "errorviz wants to set `rust-analyzer.diagnostics.useRustcErrorCode` to true in settings.json.",
        "Allow",
        "I'll do it myself"
      )
      .then((sel) => {
        if (sel === "Allow") {
          raconfig.update("diagnostics.useRustcErrorCode", true);
        }
      });
  }

  if (vscode.workspace.getConfiguration("errorviz").get("recordLogs")){
    context.subscriptions.push(
      languages.onDidChangeDiagnostics((_: vscode.DiagnosticChangeEvent) => {
      
          const editor = vscode.window.activeTextEditor;
          if (editor === undefined) {
            return;
          }
          if (stream === undefined){
            return;
          }
          const time = Math.floor(Date.now() / 1000);
          setTimeout(() => {
            logDiagnostics(editor, stream, time);
          }, 300);
        })
    );
  }

  let timeoutHandle: NodeJS.Timeout | null = null;
  context.subscriptions.push(
    languages.onDidChangeDiagnostics((_: vscode.DiagnosticChangeEvent) => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined) {
        return;
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      timeoutHandle = setTimeout(() => {
        saveDiagnostics(editor);
      }, 200);
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (e === undefined) {
        return;
      }
      saveDiagnostics(e);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand("errorviz.toggleVisualization", toggleVisualization)
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "errorviz.clearAllVisualizations",
      clearAllVisualizations
    )
  );
}

function logDiagnostics(editor: vscode.TextEditor, stream: fs.WriteStream, time: number) {
  const doc = editor.document;
  if (doc.languageId !== "rust") {
    return;
  }
  const diagnostics = languages
    .getDiagnostics(doc.uri)
    .filter((d) => {
      return (
        d.source === "rustc" &&
        d.severity === vscode.DiagnosticSeverity.Error &&
        typeof d.code === "object" &&
        typeof d.code.value === "string"
      );
    });
  
  let errors = [];
  if (diagnostics.length !== 0) {
    for (const diag of diagnostics) {
      if (diag.code === undefined || typeof diag.code === "number" || typeof diag.code === "string") {
        log.error("unexpected diag.code type", typeof diag.code);
        return;
      }
  
      //check for existence in map
      if (!msgMap.has(diag.message)){
        msgMap.set(diag.message, msgCnt);
        msgCnt++;
      }
  
      let code = diag.code.value;
      //syntax errors dont follow Rust error code conventions
      if (typeof code === "string" && code[0] !== 'E'){
        code = "Syntax";
      }

      errors.push({code: code, id: msgMap.get(diag.message)});
    }
  }

  const entry = JSON.stringify({build: {errors: errors, seconds: (time - initialStamp)}}) + '\n';
  stream.write(entry);
}

function sendDiagnostics(log: String, reporter: TelemetryReporter){
  //reporter.sendTelemetryErrorEvent(entry);
  //reporter.sendTelemetryEvent("build", {entry}, {"seconds" : time - initialStamp});
  //reporter.sendTelemetryEvent('sampleEvent', { 'stringProp': 'some string' }, { 'numericMeasure': 123 });
}

function saveDiagnostics(editor: vscode.TextEditor) {
  const doc = editor.document;
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
  errorviz.G.hideAllDiags(editor);
  errorviz.G.diags = newdiags;
  for (const d of torefresh) {
    log.info("reshow", d);
    errorviz.G.showDiag(editor, d);
  }
  errorviz.G.showTriangles(editor);
}

function toggleVisualization(editor: vscode.TextEditor, _: vscode.TextEditorEdit) {
  const currline = editor.selection.active.line;
  const lines = [...errorviz.G.diags.keys()];
  const ontheline = lines.filter((i) => parseInt(i) === currline);
  if (!ontheline) {
    log.info("no diagnostics on line", currline + 1);
    return;
  }
  if (ontheline.length > 1) {
    vscode.window
      .showQuickPick(
        ontheline.map((id) => {
          const diag = errorviz.G.diags.get(id);
          const [line, ecode] = id.split("_", 2);
          const label = `${ecode} on line ${parseInt(line) + 1}`;
          const detail = diag?.diagnostics.message;
          return { label, detail, id };
        })
      )
      .then((selected) => {
        if (selected !== undefined) {
          errorviz.G.toggleDiag(editor, selected.id);
        }
      });
  } else {
    errorviz.G.toggleDiag(editor, ontheline[0]);
  }
}

function clearAllVisualizations(e: vscode.TextEditor, _: vscode.TextEditorEdit) {
  errorviz.G.hideAllDiags(e);
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }
}
