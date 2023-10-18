//extention is test-run by pressing f5 (or function+f5)
//while within the extension, access the consent form while on a rust file and pressing ctrl+shift+r or cmd+shift+r
//or thru extension command pallet

import * as vscode from "vscode";

export class FormPanel {
    public static currentPanel: FormPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
  
    private constructor(panel: vscode.WebviewPanel) {
      this._panel = panel;
      this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
      this._panel.webview.html = this._getConsentForm();
    }

    public static render(){
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
            // if (vscode.workspace.workspaceFolders) {
            //     //panel.webview.html = _getConsentForm();
            // }
            FormPanel.currentPanel = new FormPanel(panel);
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

    private _getConsentForm() {
        return `
            <!DOCTYPE html>
            <html>
            <script src="webview"></script>
            <h1>Participate in Academic Research!</h1>
            <h2>Rust Error Study Consent form</h2>
            <p>
            You are being invited to participate in a research study titled A Real-World Study of Rust Learning. This study is being done by Michael Coblenz and Molly MacLaren from UC San Diego. You were selected to participate in this study because you downloaded our Visual Studio Code extension.
            </p><p>
            The purpose of this research study is to gather data about error messages encountered by Rust programmers so that we can design and evaluate approaches to helping users fix errors. We also would like to find out whether the tools we are developing helps participants learn Rust more effectively. Your participation in this research could last up to 24 months or as long as you choose to send us your error data. If you agree to take part in this study, you will be asked to enable telemetry for this extension so that we can receive the logs of frequency and duration of errors in your Rust programs. These logs collect error codes and time intervals between program builds to track how long it takes to resolve certain errors.
            </p><p>
            Your participation in this study is completely voluntary and you can withdraw at any time. Choosing not to participate or withdrawing will result in no penalty or loss of benefits to which you are entitled. You are free to skip any question that you choose.
            </p><p>
            If you have questions about this project or if you have a research-related problem, you may contact the researcher(s), Michael Coblenz (mcoblenz@ucsd.edu) or Molly MacLaren (mmaclaren@ucsd.edu). If you have any questions concerning your rights as a research subject, you may contact the UC San Diego Office of IRB Administration at irb@ucsd.edu or 858-246-4777.
            </p><p>
            By participating in this research you are indicating that you are at least 18 years old, have read this consent form, and agree to participate in this research study. Please keep this consent form for your records.
            </p>
            <h2>Participation Agreement</h2>
            <form>
            <input type="radio" id="agree" name="agreement" value="yes">
            <label for="agree">Yes, I agree to participate in this study.</label>
            <br>
            <input type="radio" id="disagree" name="agreement" value="no">
            <label for="disagree">No, I would not like to participate.</label>
            <br><br>
            <button id="submit">Submit</button>
            </form>
            </html>
            `;
    }
}