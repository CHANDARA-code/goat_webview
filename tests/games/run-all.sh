#!/usr/bin/env bash
# ==============================================================================
# tests/games/run-all.sh
# Master automation runner for Goat WebView Game Engine Demos
# Supported projects: littlejs-demo, phaser-demo, threejs-demo, r3f-demo
# Compatible with macOS Bash 3.2+ and Linux Bash 4/5+
# ==============================================================================
set -euo pipefail

# ANSI Colors
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECTS=("littlejs-demo" "phaser-demo" "threejs-demo" "r3f-demo")

# Port Allocations (preventing dev server collisions)
get_project_port() {
  case "$1" in
    littlejs-demo) echo "5173" ;;
    phaser-demo) echo "5174" ;;
    threejs-demo) echo "5175" ;;
    r3f-demo) echo "5176" ;;
    *) echo "5173" ;;
  esac
}

# Uncompressed Bundle Size Budgets in KB (excluding sourcemaps)
get_project_budget_kb() {
  case "$1" in
    littlejs-demo) echo "70" ;;
    threejs-demo) echo "850" ;;
    phaser-demo) echo "1500" ;;
    r3f-demo) echo "1600" ;;
    *) echo "1000" ;;
  esac
}

log_header() {
  echo -e "\n${BOLD}${BLUE}================================================================================${RESET}"
  echo -e "${BOLD}${CYAN}🎮 [Goat WebView Games] $1${RESET}"
  echo -e "${BOLD}${BLUE}================================================================================${RESET}\n"
}

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: node is not installed or not in PATH.${RESET}" >&2
    exit 1
  fi
  if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: npm is not installed or not in PATH.${RESET}" >&2
    exit 1
  fi
}

cmd_install() {
  log_header "Installing Dependencies Across All 4 Game Projects"
  local start_time
  start_time=$(date +%s)
  local failed=0

  if [[ $PARALLEL -eq 1 ]]; then
    echo -e "${BLUE}⚡ Running parallel npm install across all 4 projects...${RESET}"
    local pids=()
    local log_files=()
    for p in "${PROJECTS[@]}"; do
      local log_file
      log_file=$(mktemp)
      log_files+=("$log_file")
      (
        cd "$SCRIPT_DIR/$p" && npm install
      ) > "$log_file" 2>&1 &
      local pid=$!
      pids+=("$pid")
      echo -e "${YELLOW}📦 [${p}] Started npm install in background (PID ${pid})...${RESET}"
    done

    for i in "${!pids[@]}"; do
      local p="${PROJECTS[$i]}"
      local pid="${pids[$i]}"
      local log_file="${log_files[$i]}"
      if wait "$pid"; then
        echo -e "${GREEN}✅ [${p}] Dependencies installed successfully.${RESET}"
      else
        echo -e "${RED}❌ [${p}] npm install failed! Log output:${RESET}"
        cat "$log_file"
        failed=1
      fi
      rm -f "$log_file"
    done
  else
    for p in "${PROJECTS[@]}"; do
      echo -e "${YELLOW}📦 [${p}] Running npm install...${RESET}"
      if (cd "$SCRIPT_DIR/$p" && npm install); then
        echo -e "${GREEN}✅ [${p}] Dependencies installed.${RESET}\n"
      else
        echo -e "${RED}❌ [${p}] npm install failed!${RESET}\n"
        failed=1
      fi
    done
  fi

  if [[ $failed -ne 0 ]]; then
    echo -e "${RED}❌ One or more dependency installations failed.${RESET}" >&2
    exit 1
  fi

  local duration=$(( $(date +%s) - start_time ))
  echo -e "\n${BOLD}${GREEN}🎉 All dependencies installed in ${duration}s.${RESET}"
}

cmd_build() {
  log_header "Compiling Production Bundles Across All 4 Game Projects"
  local start_time
  start_time=$(date +%s)
  local failed=0

  if [[ $PARALLEL -eq 1 ]]; then
    echo -e "${BLUE}⚡ Running parallel compilation...${RESET}"
    local pids=()
    local log_files=()
    for p in "${PROJECTS[@]}"; do
      local log_file
      log_file=$(mktemp)
      log_files+=("$log_file")
      (
        cd "$SCRIPT_DIR/$p" && npm run build
      ) > "$log_file" 2>&1 &
      local pid=$!
      pids+=("$pid")
      echo -e "${YELLOW}🔨 [${p}] Started build in background (PID ${pid})...${RESET}"
    done

    for i in "${!pids[@]}"; do
      local p="${PROJECTS[$i]}"
      local pid="${pids[$i]}"
      local log_file="${log_files[$i]}"
      if wait "$pid"; then
        local index_path="$SCRIPT_DIR/$p/dist/index.html"
        if [[ -f "$index_path" ]]; then
          echo -e "${GREEN}✅ [${p}] Build successful. dist/index.html verified.${RESET}"
        else
          echo -e "${RED}❌ [${p}] Build finished with code 0, but $index_path does not exist!${RESET}"
          cat "$log_file"
          failed=1
        fi
      else
        echo -e "${RED}❌ [${p}] Build failed! Output:${RESET}"
        cat "$log_file"
        failed=1
      fi
      rm -f "$log_file"
    done
  else
    for p in "${PROJECTS[@]}"; do
      echo -e "${YELLOW}🔨 [${p}] Building with 'npm run build'...${RESET}"
      if (cd "$SCRIPT_DIR/$p" && npm run build); then
        local index_path="$SCRIPT_DIR/$p/dist/index.html"
        if [[ -f "$index_path" ]]; then
          echo -e "${GREEN}✅ [${p}] Build successful. dist/index.html verified.${RESET}\n"
        else
          echo -e "${RED}❌ [${p}] Build command succeeded, but $index_path not found!${RESET}\n"
          failed=1
        fi
      else
        echo -e "${RED}❌ [${p}] Build failed!${RESET}\n"
        failed=1
      fi
    done
  fi

  if [[ $failed -ne 0 ]]; then
    echo -e "${RED}❌ One or more builds failed.${RESET}" >&2
    exit 1
  fi

  local duration=$(( $(date +%s) - start_time ))
  echo -e "${BOLD}${GREEN}🎉 All 4 game projects compiled successfully in ${duration}s!${RESET}"
}

cmd_clean() {
  log_header "Cleaning Build Artifacts & Node Modules"
  local clean_modules=1
  if [[ "${1:-}" == "--dist-only" ]]; then
    clean_modules=0
  fi

  for p in "${PROJECTS[@]}"; do
    if [[ $clean_modules -eq 1 ]]; then
      echo -e "${YELLOW}🧹 [${p}] Cleaning dist/ and node_modules/...${RESET}"
      rm -rf "$SCRIPT_DIR/$p/dist" "$SCRIPT_DIR/$p/node_modules"
    else
      echo -e "${YELLOW}🧹 [${p}] Cleaning dist/...${RESET}"
      rm -rf "$SCRIPT_DIR/$p/dist"
    fi
    echo -e "${GREEN}✅ [${p}] Cleaned.${RESET}"
  done
  echo -e "\n${BOLD}${GREEN}🎉 Cleanup complete.${RESET}"
}

cmd_check_size() {
  log_header "Verifying Production Bundle Sizes Against Budgets"
  local failed=0

  printf "%-18s | %-12s | %-12s | %-8s\n" "Project" "Size (KB)" "Budget (KB)" "Status"
  printf -- "-------------------+--------------+--------------+----------\n"

  for p in "${PROJECTS[@]}"; do
    local dist_dir="$SCRIPT_DIR/$p/dist"
    local budget_kb
    budget_kb=$(get_project_budget_kb "$p")

    if [[ ! -d "$dist_dir" || ! -f "$dist_dir/index.html" ]]; then
      printf "%-18s | %-12s | %-12s | ${RED}%-8s${RESET}\n" "$p" "N/A" "${budget_kb} KB" "MISSING ❌"
      failed=1
      continue
    fi

    # Calculate total uncompressed production bundle size in KB (excluding sourcemaps)
    local size_bytes
    size_bytes=$(find "$dist_dir" -type f ! -name "*.map" -exec wc -c {} + 2>/dev/null | awk '/^[[:space:]]*[0-9]+[[:space:]]+total$/ {next} {total += $1} END {print total}')
    size_bytes=${size_bytes:-0}
    local size_kb=$(( (size_bytes + 1023) / 1024 ))

    if [[ $size_kb -le $budget_kb ]]; then
      printf "%-18s | %-12s | %-12s | ${GREEN}%-8s${RESET}\n" "$p" "${size_kb} KB" "${budget_kb} KB" "PASS ✅"
    else
      printf "%-18s | %-12s | %-12s | ${RED}%-8s${RESET}\n" "$p" "${size_kb} KB" "${budget_kb} KB" "EXCEED ❌"
      failed=1
    fi
  done

  if [[ $failed -ne 0 ]]; then
    echo -e "\n${RED}❌ Size budget checks failed!${RESET}" >&2
    return 1
  fi
  echo -e "\n${BOLD}${GREEN}✅ All bundle sizes within budget!${RESET}"
}

cmd_verify() {
  log_header "Full Automated Verification (Dist Check + Size Gate + E2E Runner)"
  local failed=0

  echo -e "${BLUE}🔍 Verifying production artifacts (dist/index.html)...${RESET}"
  for p in "${PROJECTS[@]}"; do
    local index_path="$SCRIPT_DIR/$p/dist/index.html"
    if [[ -f "$index_path" ]]; then
      echo -e "${GREEN}✅ [${p}] dist/index.html exists and is verified.${RESET}"
    else
      echo -e "${RED}❌ [${p}] Missing $index_path! Run './run-all.sh build' first.${RESET}"
      failed=1
    fi
  done

  if [[ $failed -ne 0 ]]; then
    echo -e "\n${RED}❌ Verification failed: missing dist/index.html artifacts.${RESET}" >&2
    exit 1
  fi

  cmd_check_size

  if [[ -f "$SCRIPT_DIR/e2e-verify.ts" ]]; then
    echo -e "\n${BLUE}🧪 Running E2E verification test runner (e2e-verify.ts)...${RESET}"
    if node --experimental-strip-types "$SCRIPT_DIR/e2e-verify.ts"; then
      echo -e "\n${BOLD}${GREEN}✅ E2E verification test runner passed!${RESET}"
    else
      echo -e "\n${RED}❌ E2E verification test runner reported failures.${RESET}" >&2
      exit 1
    fi
  else
    echo -e "\n${YELLOW}ℹ️ No e2e-verify.ts found, skipping test runner.${RESET}"
  fi

  echo -e "\n${BOLD}${GREEN}🏆 All game verification checks passed!${RESET}\n"
}

# ==============================================================================
# Argument Parsing & Dispatch
# ==============================================================================
check_node

PARALLEL=0
COMMAND=""
CLEAN_OPT=""

for arg in "$@"; do
  case "$arg" in
    --parallel|-p)
      PARALLEL=1
      ;;
    --dist-only)
      CLEAN_OPT="--dist-only"
      ;;
    install|build|clean|check-size|verify|help|--help|-h)
      COMMAND="$arg"
      ;;
    *)
      if [[ -z "$COMMAND" ]]; then
        COMMAND="$arg"
      fi
      ;;
  esac
done

# Default (no args): runs install and build
if [[ -z "$COMMAND" ]]; then
  COMMAND="default"
fi

case "$COMMAND" in
  default)
    cmd_install
    cmd_build
    ;;
  install)
    cmd_install
    ;;
  build)
    cmd_build
    ;;
  clean)
    cmd_clean "$CLEAN_OPT"
    ;;
  check-size)
    cmd_check_size
    ;;
  verify)
    cmd_verify
    ;;
  help|--help|-h)
    echo "Usage: ./run-all.sh [command] [--parallel|-p]"
    echo ""
    echo "Commands:"
    echo "  (no args)   Run install and build across all 4 game projects (default)"
    echo "  install     Run 'npm install' in each of the 4 project directories"
    echo "  build       Run 'npm run build' in each of the 4 project directories"
    echo "  clean       Clean dist/ and node_modules/ (pass --dist-only to keep node_modules)"
    echo "  check-size  Output bundle size table against uncompressed budgets"
    echo "  verify      Assert dist/index.html exists for all 4 games and run e2e verifier"
    echo "  help        Display this help message"
    echo ""
    echo "Options:"
    echo "  --parallel, -p   Run installs or builds concurrently"
    echo "  --dist-only      For clean command: only removes dist/, keeps node_modules"
    ;;
  *)
    echo -e "${RED}Unknown command: $COMMAND${RESET}"
    echo "Run ./run-all.sh help for usage."
    exit 1
    ;;
esac
