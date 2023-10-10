import * as vscode from "vscode";
import { languages } from "vscode";
import * as errorviz from "./errorviz";
import { log } from "./util";
import { codeFuncMap } from "./visualizations";
import * as fs from "fs";
import TelemetryReporter from '@vscode/extension-telemetry';
import * as crypto from 'crypto';


const VERSION = "0.1.1";
let intervalHandle: number | null = null;

const key = "cdf9fbe6-bfd3-438a-a2f6-9eed10994c4e";
const initialStamp = Math.floor(Date.now() / 1000);
let buildNum = 0;
let logPath = "";
let time = initialStamp;
let stream: fs.WriteStream;
let reporter: TelemetryReporter;

export function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders) {
    log.error("no workspace folders");
    return;
  }
  const dir = vscode.workspace.workspaceFolders[0].uri.fsPath;
  fs.writeFileSync(dir + "/.errorviz-version", VERSION);

  //schedule prompt to notify user of research participation
  // vscode.window.showInformationMessage(
  //   "Would you like to participate in research and learn about your error resolution skills?",
  //   "Yes",
  //   "No"
  //   )
  //   .then((sel) => {
  //     if (sel === "Yes"){
  //       FormPanel.render();
  //     }
  //   });
  
  //set up telemetry and log storage based on settings
  //default is record=true, send=false
  if (vscode.workspace.getConfiguration("errorviz").get("recordLogs")){
    if (vscode.workspace.getConfiguration("errorviz").get("sendLogs")){
      reporter = new TelemetryReporter(key);
      context.subscriptions.push(reporter);
    }

    logPath = context.globalStorageUri.fsPath + "/log.json";

    if (!fs.existsSync(logPath)){
      fs.writeFileSync(logPath, "do not modify\n");
    }
    stream = fs.createWriteStream(logPath, {flags:'a'});
    stream.write("{\"new session\"}\n");

    vscode.workspace.openTextDocument(logPath).then((textDocument => {
      buildNum = textDocument.lineCount;
    }));
  }

  //settings.json config to get rustc err code
  const raconfig = vscode.workspace.getConfiguration("rust-analyzer");
  const useRustcErrorCode = raconfig.get<boolean>("diagnostics.useRustcErrorCode");
  if (!useRustcErrorCode) {
    vscode.window
      .showWarningMessage(
        "revis wants to set `rust-analyzer.diagnostics.useRustcErrorCode` to true in settings.json.",
        "Allow",
        "I'll do it myself"
      )
      .then((sel) => {
        if (sel === "Allow") {
          raconfig.update("diagnostics.useRustcErrorCode", true);
        }
      });
  }

  let timeoutHandle: NodeJS.Timeout | null = null;
  let throttleLog = false;
  context.subscriptions.push(
    languages.onDidChangeDiagnostics((_: vscode.DiagnosticChangeEvent) => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined) {
        return;
      }
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }

      //if logging is enabled, wait 3 seconds for diagnostics to load in
      if (vscode.workspace.getConfiguration("errorviz").get("recordLogs")){
        //throttle diagnostic report to get final diagnostic
        if (!throttleLog){
          if (time !== 0){
            time = Math.floor(Date.now() / 1000);
            throttleLog = true;
            setTimeout(() => {
              logError(editor, stream, time);
              throttleLog = false;
            }, 3000);
          }
        }
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
    vscode.commands.registerTextEditorCommand("revis.toggleVisualization", toggleVisualization)
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "revis.clearAllVisualizations",
      clearAllVisualizations
    )
  );
}

//create a json object representing current diagnostics and writes to stream, may call sendDiagnostics
function logError(editor: vscode.TextEditor, stream: fs.WriteStream, time: number) {
  const doc = editor.document;

  //filter for only rust errors
  if (doc.languageId !== "rust") {
    return;
  }
  const diagnostics = languages
    .getDiagnostics(doc.uri)
    .filter((d) => {
      return (
        //d.source === "rustc" &&
        d.severity === vscode.DiagnosticSeverity.Error &&
        typeof d.code === "object" &&
        typeof d.code.value === "string"
      );
    });

  //if errors are present, for every error create a JSON object in the errors list
  let errors = [];
  if (diagnostics.length !== 0) {
    for (const diag of diagnostics) {
      if (diag.code === undefined || typeof diag.code === "number" || typeof diag.code === "string") {
        log.error("unexpected diag.code type", typeof diag.code);
        return;
      }
      let code = diag.code.value;

      //syntax errors dont follow Rust error code conventions
      if (typeof code === "string" && code[0] !== 'E'){
        code = "Syntax";
      }

      //add error data to list
      errors.push({
        code: code,
        msg: hashString(diag.message),
        range:{
          start: diag.range.start.line,
          end: diag.range.end.line
        }
      });
    }
  }

  //write to file
  const entry = JSON.stringify({
    errors: errors, 
    seconds: (time - initialStamp),
    file: hashString(doc.fileName)
  }) + '\n';
  stream.write(entry);
  console.log(entry);

  //increase the buildcount and check if divisible by some number
  buildNum++;
  if (buildNum % 10 === 0
      && vscode.workspace.getConfiguration("errorviz").get("sendLogs")){
    sendDiagnostics(reporter);
  }
}

function sendDiagnostics(reporter: TelemetryReporter){
  //read file and send
  const data = fs.readFileSync(logPath, 'utf-8');
  reporter.sendTelemetryEvent('errorLog', {'data': data });
}


//hashes and truncates strings
function hashString(input: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(input);
  return hash.digest('hex').slice(0,8);
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
