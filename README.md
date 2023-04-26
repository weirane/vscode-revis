# errorviz

## Features

Visualize lifetime-related Rust compiler errors.
This extension focuses on errors with a "timeline" that can be visualized.

## Requirements

The extension needs the diagnostics information from rust-analyzer.
Install the VSCode extension [rust-analyzer][] and add the following to `settings.json`:
```
"rust-analyzer.diagnostics.useRustcErrorCode": true
```
The configuration can be automatically set when you use the extension for the first time.
Just click "Allow" when the warning prompt appears.
The configuration will be added to `.vscode/settings.json` under the project root.

[rust-analyzer]: https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer

## How to use

Right-pointing red triangles will be displayed for supported errors after the source file is saved.
To display/hide the visualization, move the text cursor to the line with the red triangle and execute command `errorviz.toggleVisualization` or use the keyboard shortcut <kbd>Ctrl+E Ctrl+V</kbd>.
To clear all visualizations, execute command `errorviz.clearAllVisualizations` or use the keyboard shortcut <kbd>Ctrl+E Ctrl+C</kbd>.
To refresh the visualizations, save the current file.

## Note

This extension is still in an early stage. Please file an issue or contact Ruochen (wangrc@ucsd.edu) if you find any bugs/confusing points.
