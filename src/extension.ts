import * as vscode from "vscode";
import { languages } from "vscode";
import * as errorviz from "./errorviz";
import { log } from "./util";
import { codeFuncMap } from "./visualizations";
import * as fs from "fs";
import * as path from "path";
import TelemetryReporter from '@vscode/extension-telemetry';
import { FormPanel } from "./research/form";
import * as crypto from 'crypto';


const VERSION = "0.1.1";
let intervalHandle: number | null = null;

const key = "cdf9fbe6-bfd3-438a-a2f6-9eed10994c4e";
const initialStamp = Math.floor(Date.now() / 1000);
let visToggled = false;
//these probably dont need to be global- should be passed
let buildCount = 0;
let fileCount = 0;
let logPath = "";
let logDir = "";
//
let time = initialStamp;
let stream: fs.WriteStream;
let reporter: TelemetryReporter;

export function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders) {
    log.error("no workspace folders");
    return;
  }
  const dir = vscode.workspace.workspaceFolders[0].uri.fsPath;
  logDir = context.globalStorageUri.fsPath;

  fs.writeFileSync(logDir + "/.revis-version", VERSION);

  //Check if logfile exists and render in consent form otherwise and create logfile
  if (!fs.existsSync(logDir + "/log1.json")){
    FormPanel.render();
    fs.writeFileSync(logDir + "/log1.json", "");
  }
  
  //set up telemetry and log storage based on settings
  //default is false
  if (vscode.workspace.getConfiguration("revis").get("errorLogging")){
    reporter = new TelemetryReporter(key);
    context.subscriptions.push(reporter);

    //find how many json files are in folder to determine current log
    fileCount = fs.readdirSync(logDir)
      .filter(f => path.extname(f) === ".json").length;
    logPath = logDir + "/log" + fileCount + ".json";

    stream = fs.createWriteStream(logPath, {flags:'a'});
    stream.write("{\"new session\"}\n");

    vscode.workspace.openTextDocument(logPath).then((textDocument => {
      buildCount = textDocument.lineCount;
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
  let lastSuccess = false;
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
      timeoutHandle = setTimeout(() => {
        saveDiagnostics(editor);
      }, 200);

      //if logging is enabled, wait 3 seconds for diagnostics to load in
      if (vscode.workspace.getConfiguration("revis").get("errorLogging")){
        //on update, wait x seconds for full diagnostics to load in
        if (!throttleLog && time !== 0){
          throttleLog = true;
          time = Math.floor(Date.now() / 1000);
          let doc = editor.document;

          //filter for only rust errors
          if (doc.languageId !== "rust") {
            return false;
          }
          timeoutHandle = setTimeout(() => {
            let diagnostics = languages
            .getDiagnostics(doc.uri)
            .filter((d) => {
              return (
                //d.source === "rustc" &&
                d.severity === vscode.DiagnosticSeverity.Error &&
                typeof d.code === "object" &&
                typeof d.code.value === "string"
              );
            });
            //if empty and previously didn't compile successfully log empty array
            if (diagnostics.length === 0 && !lastSuccess){
              logError(diagnostics, doc, stream, time);
              lastSuccess = true;
            }
            //if not empty, wait until rustc codes generate to log
            else if (diagnostics.filter(e => e.source === 'rustc').length > 0){
              logError(diagnostics, doc, stream, time);
              lastSuccess = false;
            }
            throttleLog = false;
          }, 2000);
        }
      }
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
    vscode.commands.registerCommand("revis.researchParticipation", FormPanel.render)
  );
  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "revis.clearAllVisualizations",
      clearAllVisualizations
    )
  );
}

//create a json object representing current diagnostics and writes to stream, may call sendDiagnostics
function logError(diagnostics: vscode.Diagnostic[], doc:  vscode.TextDocument, stream: fs.WriteStream, time: number) {
  
  //for every error create a JSON object in the errors list
  let errors = [];
  for (const diag of diagnostics) {
    if (diag.code === undefined || typeof diag.code === "number" || typeof diag.code === "string") {
      log.error("unexpected diag.code type", typeof diag.code);
      return false;
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
      source: diag.source,
      range:{
        start: diag.range.start.line,
        end: diag.range.end.line
      }
    });
  }

  //write to file
  const entry = JSON.stringify({
    file: hashString(doc.fileName),
    seconds: (time - initialStamp),
    revis: visToggled, 
    errors: errors
  }) + '\n';
  stream.write(entry);
  console.log(entry);
  visToggled = false;

  //increase the buildcount and check if divisible by some number
  buildCount++;
  console.log(buildCount);
  if (buildCount % 10 === 0
      && vscode.workspace.getConfiguration("revis").get("errorLogging")){
    sendDiagnostics(reporter);

    //create new log file WIP --- need to pass writestream
    // if (buildCount >= 10){
    //   fileCount++;
    //   console.log(fileCount + "sent");
    //   logPath = logDir + "/log" + fileCount + ".json";
    //   stream = fs.createWriteStream(logPath, {flags:'a'});
    //   buildCount = 0;
    //   stream.write("test");
    // }
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
  visToggled = true;
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
