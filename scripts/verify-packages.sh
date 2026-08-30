#!/usr/bin/env bash
set -euo pipefail

# ANSI color codes for rich terminal logging
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

echo "================================================================================"
echo -e "${BOLD}${CYAN}📦 [Goat WebView] Monorepo Tooling Packages Verification Suite (10 Packages)${RESET}"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PACKAGES_OK=0
PACKAGES_FAIL=0

# --- 1. @goat/appservice ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [1/10] @goat/appservice...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/appservice" && npm test); then
  echo -e "  ${GREEN}✅ @goat/appservice tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/appservice tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 2. @goat/server ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [2/10] @goat/server...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/server" && npm test); then
  echo -e "  ${GREEN}✅ @goat/server tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/server tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 3. @goat/bridge-mock ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [3/10] @goat/bridge-mock...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/bridge-mock" && npm test); then
  echo -e "  ${GREEN}✅ @goat/bridge-mock tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/bridge-mock tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 4. @goat/cli ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [4/10] @goat/cli...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/cli" && node --experimental-strip-types --test test/cli.test.ts); then
  echo -e "  ${GREEN}✅ @goat/cli tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/cli tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 5. @goat/playground ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [5/10] @goat/playground...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/playground" && npm test); then
  echo -e "  ${GREEN}✅ @goat/playground tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/playground tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 6. vscode-goat ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [6/10] vscode-goat (@goat/vscode-extension)...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/vscode-extension" && npm test); then
  echo -e "  ${GREEN}✅ vscode-goat tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ vscode-goat tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 7. @goat/devtools ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [7/10] @goat/devtools...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/devtools" && npm test && npm run test:e2e); then
  echo -e "  ${GREEN}✅ @goat/devtools tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/devtools tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 8. @goat/core ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [8/10] @goat/core...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/core" && bun test); then
  echo -e "  ${GREEN}✅ @goat/core tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/core tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 9. @goat/compiler-taro ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [9/10] @goat/compiler-taro...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/compiler-taro" && npm test); then
  echo -e "  ${GREEN}✅ @goat/compiler-taro tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/compiler-taro tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 10. @goat/compiler-uniapp ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [10/10] @goat/compiler-uniapp...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/compiler-uniapp" && npm test); then
  echo -e "  ${GREEN}✅ @goat/compiler-uniapp tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/compiler-uniapp tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

echo ""
echo "================================================================================"
if [ "$PACKAGES_FAIL" -gt 0 ]; then
  echo -e "${BOLD}${RED}❌ [Packages] ${PACKAGES_FAIL} package(s) failed. ${PACKAGES_OK} passed.${RESET}"
  exit 1
else
  echo -e "${BOLD}${GREEN}✅ [Packages] All 10 monorepo tooling packages passed (10/10).${RESET}"
  echo "================================================================================"
fi
