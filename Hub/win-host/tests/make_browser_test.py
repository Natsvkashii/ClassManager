#!/usr/bin/env python3
# Builds a folder that serves the native HubDesk page in a normal browser, with the native bridges simulated.
# usage: python3 Hub/win-host/tests/make_browser_test.py <outDir>   then: python3 -m http.server 8790 -d <outDir>
# and open http://localhost:8790/renderer/index.html
import importlib.util, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__)); WIN = os.path.dirname(HERE); ELECTRON = os.path.join(WIN, "..", "electron")
out = sys.argv[1]
shutil.rmtree(out, ignore_errors=True); shutil.copytree(os.path.join(ELECTRON, "renderer"), os.path.join(out, "renderer"))
spec = importlib.util.spec_from_file_location("b", os.path.join(WIN, "build.py")); b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
open(os.path.join(out, "page.js"), "w", encoding="utf-8").write(b.page_bundle())
shutil.copy(os.path.join(HERE, "mock-bridges.js"), os.path.join(out, "mock.js"))
p = os.path.join(out, "renderer", "index.html"); s = open(p, encoding="utf-8").read()
open(p, "w", encoding="utf-8").write(s.replace('<script src="app.js"></script>', '<script src="../mock.js"></script><script src="../page.js"></script><script src="app.js"></script>'))
print("ok", out)
