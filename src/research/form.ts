//extention is test-run by pressing f5 (or function+f5)
//while within the extension, access the consent form while on a rust file and pressing ctrl+shift+r or cmd+shift+r
//or thru extension command pallet

import * as vscode from "vscode";
import * as fs from "fs";

export class FormPanel {
    public static currentPanel: FormPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
  
    private constructor(panel: vscode.WebviewPanel, path: string) {
      this._panel = panel;
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
      this._panel.webview.html = this.getConsentForm(path);
    }

    public static render(path: string){
        if (FormPanel.currentPanel){
            FormPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
        }
        else {
            //show webview
            const panel = vscode.window.createWebviewPanel(
                'webview',
                'Consent Form',
                vscode.ViewColumn.One,
                {
                    enableScripts: true
                });

            FormPanel.currentPanel = new FormPanel(panel, path);
        }
    }

    public dispose() {
        FormPanel.currentPanel = undefined;
    
        this._panel.dispose();
    
        while (this._disposables.length) {
          const disposable = this._disposables.pop();
            if (disposable) {
            disposable.dispose();
            }
        }
    }

    private getSurvey(path: string) {
        let html = fs.readFileSync(path + "/src/research/survey.html", 'utf8');
        return html;
    }

    private getConsentForm(path: string) {
        let html = fs.readFileSync(path + "/src/research/consentform.html", 'utf8');
        return html;
    }
}