@echo off
typedoc --out ./reference src/api/mim.ts src/api/HtmlTypes.ts src/api/SvgTypes.ts src/api/LocalStyles.ts --readme none --excludeExternals --excludeNotExported --excludePrivate