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
echo -e "${BOLD}${BLUE}🔵 [1/11] @goat/appservice...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/appservice" && npm test); then
  echo -e "  ${GREEN}✅ @goat/appservice tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/appservice tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 2. @goat/server ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [2/11] @goat/server...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/server" && npm test); then
  echo -e "  ${GREEN}✅ @goat/server tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/server tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 3. @goat/bridge-mock ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [3/11] @goat/bridge-mock...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/bridge-mock" && npm test); then
  echo -e "  ${GREEN}✅ @goat/bridge-mock tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/bridge-mock tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 4. @goat/cli ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [4/11] @goat/cli...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/cli" && node --experimental-strip-types --test test/cli.test.ts); then
  echo -e "  ${GREEN}✅ @goat/cli tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/cli tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 5. @goat/playground ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [5/11] @goat/playground...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/playground" && npm test); then
  echo -e "  ${GREEN}✅ @goat/playground tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/playground tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 6. vscode-goat ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [6/11] vscode-goat (@goat/vscode-extension)...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/vscode-extension" && npm test); then
  echo -e "  ${GREEN}✅ vscode-goat tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ vscode-goat tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 7. @goat/devtools ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [7/11] @goat/devtools...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/devtools" && npm test && npm run test:e2e); then
  echo -e "  ${GREEN}✅ @goat/devtools tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/devtools tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 8. @goat/core ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [8/11] @goat/core...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/core" && bun test); then
  echo -e "  ${GREEN}✅ @goat/core tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/core tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 9. @goat/compiler-taro ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [9/11] @goat/compiler-taro...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/compiler-taro" && npm test); then
  echo -e "  ${GREEN}✅ @goat/compiler-taro tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/compiler-taro tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 10. @goat/compiler-uniapp ---
echo ""
echo -e "${BOLD}${BLUE}🔵 [10/11] @goat/compiler-uniapp...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/compiler-uniapp" && npm test); then
  echo -e "  ${GREEN}✅ @goat/compiler-uniapp tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/compiler-uniapp tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 11. @goat/adapter-dsl ---
# The WeChat/Alipay/uni-app/Taro DSL compatibility layer. No gate ran this suite before
# 2026-09-07 even though it is the core of TASK_PORTABLE_MINIAPP_DSL_ADAPTERS, and it is the
# suite that parses the real Kotlin/Swift sources to prove every DSL method maps to an action
# both platforms dispatch -- i.e. the one most likely to catch a regression in that mapping.
echo ""
echo -e "${BOLD}${BLUE}🔵 [11/11] @goat/adapter-dsl...${RESET}"
if (cd "${WORKSPACE_DIR}/packages/adapter-dsl" && npm test); then
  echo -e "  ${GREEN}✅ @goat/adapter-dsl tests passed.${RESET}"
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo -e "  ${RED}❌ @goat/adapter-dsl tests FAILED.${RESET}"
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

echo ""
echo "================================================================================"
if [ "$PACKAGES_FAIL" -gt 0 ]; then
  echo -e "${BOLD}${RED}❌ [Packages] ${PACKAGES_FAIL} package(s) failed. ${PACKAGES_OK} passed.${RESET}"
  exit 1
else
  echo -e "${BOLD}${GREEN}✅ [Packages] All 11 monorepo tooling packages passed (11/11).${RESET}"
  echo "================================================================================"
fi
