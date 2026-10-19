# Folio Windows installer

`upstream.nsi` is the Tauri CLI v2.12.3 NSIS template, retained under Tauri's MIT/Apache-2.0 licensing:
https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.3/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi

`npm run desktop:build` runs `scripts/prepare-installer.mjs` to generate `installer.nsi`, the logo bitmap and the small statically linked x86 drawing DLL. The existing Visual Studio C++ tools build the DLL; no extra runtime is installed.

`folio-ui.nsh` owns the welcome, directory selection and completion presentation. `controls.cpp` paints fixed-size buttons with double buffering and preserves owner drawing when keyboard focus changes. Installation, WebView2 setup and uninstall operations remain in the Tauri template. Generated binaries and the generated template are ignored by Git.
