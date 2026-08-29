from pathlib import Path
import sys
Path("/workspace/editorial-pass/PRODUCT.md.in").open("a", encoding="utf-8").write(sys.stdin.read())
