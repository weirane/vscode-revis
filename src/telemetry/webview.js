import { provideVSCodeDesignSystem, vsCodeButton, vsCodeRadio } from "@vscode/webview-ui-toolkit";
provideVSCodeDesignSystem().register(vsCodeButton(), vsCodeRadio());

// window.addEventListener('DOMContentLoaded', init);

console.log("test");

document.getElementById('submit').addEventListener("click", () => {
    if (document.getElementById("agree").value === "yes"){

    }
    else{
        
    }
});