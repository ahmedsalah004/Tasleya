      const xoIntroScreen = document.getElementById("xoIntroScreen");
      const xoRuntimeHost = document.getElementById("xoRuntimeHost");
      const xoRuntimeNav = document.getElementById("xoRuntimeNav");
      const returnToIntroBtn = document.getElementById("returnToIntroBtn");
      const XO_RUNTIME_FRAGMENT_URL = "/games/xo-intersection/runtime-fragment.html";
      let xoRuntimeMounted = false;
      let xoRuntimeMounting = false;
      let xoAppInitialized = false;

      async function mountXoRuntime() {
        if (xoRuntimeMounted || xoRuntimeMounting) return;
        xoRuntimeMounting = true;
        try {
          const response = await fetch(XO_RUNTIME_FRAGMENT_URL, { cache: "no-store" });
          if (!response.ok) throw new Error(`XO_RUNTIME_LOAD_FAILED_${response.status}`);
          xoRuntimeHost.innerHTML = await response.text();
          xoRuntimeMounted = true;
        } finally {
          xoRuntimeMounting = false;
        }
      }

      document.getElementById("enterXoSetupBtn").addEventListener("click", async () => {
        const cta = document.getElementById("enterXoSetupBtn");
        cta.disabled = true;
        try {
          await mountXoRuntime();
          if (!xoRuntimeMounted) throw new Error("XO_RUNTIME_MOUNT_ABORTED");
          xoIntroScreen.classList.add("hidden");
          document.body.classList.add("runtime-active");
          xoRuntimeNav?.classList.remove("hidden");
          const setupScreen = document.querySelector('[data-screen="setup"]');
          if (!setupScreen) throw new Error("XO_SETUP_SCREEN_MISSING");
          setupScreen.classList.remove("hidden");
          setupScreen.classList.add("active");
          setupScreen.scrollIntoView({ behavior: "smooth", block: "start" });
          window.setTimeout(() => {
            const teamInput = document.getElementById("team1Input");
            teamInput?.focus();
          }, 220);
          initXoIntersectionApp();
        } catch (error) {
          console.error("[xo-intersection] Failed to mount runtime UI", error);
          cta.disabled = false;
        }
      });

      returnToIntroBtn?.addEventListener("click", () => {
        document.body.classList.remove("runtime-active");
        xoIntroScreen.classList.remove("hidden");
        xoRuntimeNav?.classList.add("hidden");
        xoIntroScreen.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      function initXoIntersectionApp() {
        if (xoAppInitialized) return;
        xoAppInitialized = true;

      const WORKER_URL_PLACEHOLDER = "https://REPLACE_WITH_YOUR_WORKER_URL";
      const DEFAULT_WORKER_API_BASE_URL = "https://tasleya-sheets-proxy.tasleya-worker.workers.dev";
      const XO_INTERSECTION_BOARDS_PATH = "/xo-intersection/boards";
      const XO_INTERSECTION_RESUME_STORAGE_KEY = "tasleya.xoIntersection.resume.v1";
      const XO_CYCLE_RESET_NOTICE_TEXT = "أعدنا خلط اللوحات بعد استخدام معظم اللوحات المتاحة، وقد تظهر بعض اللوحات مرة أخرى.";
      const XO_GAME_KEY = "xo-intersection";
      const XO_ONLINE_WAIT_TEAM_CONFIRM_TEXT = "بانتظار تثبيت إجابة الفريق الحالي";
      const XO_RUNTIME_BUILD = "xo-runtime-2026-04-29c";

      const state = {
        currentScreen: "setup",
        loadingStatus: "idle",
        errorStatus: "",
        team1Name: "",
        team2Name: "",
        selectedCategoryKey: "",
        selectedCategoryNameAr: "",
        selectedModeKey: "",
        selectedModeNameAr: "",
        selectedRuleTextAr: "",
        allValidLoadedBoards: [],
        filteredBoardsForSelectedMode: [],
        modeBoardOrder: [],
        modeBoardOrderPosition: 0,
        usedBoardIdsInCurrentCycle: [],
        usedBoardIdsHistory: [],
        selectedBoard: null,
        boardCells: [],
        currentTurnTeamIndex: 0,
        selectedSquare: null,
        gameStatus: "playing",
        winningLineCells: [],
        isAwaitingResumeChoice: false,
        isOnlineDevEnabled: false,
        playMode: "local",
        online: { enabled:false, session:null, roomData:null, unsubscribeRoom:null, unsubscribePresence:null, pendingActionIds:{}, selectedStarterTeamIndex:null }
      };
      console.info("[xo-intersection]", XO_RUNTIME_BUILD);

      const elements = {
        screens: document.querySelectorAll("[data-screen]"),
        team1Input: document.getElementById("team1Input"),
        team2Input: document.getElementById("team2Input"),
        localSetupFields: document.getElementById("localSetupFields"),
        startBtn: document.getElementById("startBtn"),
        howToBtn: document.getElementById("howToBtn"),
        loadStatus: document.getElementById("loadStatus"),
        retryBtn: document.getElementById("retryBtn"),
        categoriesWrap: document.getElementById("categoriesWrap"),
        categoriesEmptyState: document.getElementById("categoriesEmptyState"),
        categoriesEmptyBackBtn: document.getElementById("categoriesEmptyBackBtn"),
        categoriesFooter: document.getElementById("categoriesFooter"),
        modesWrap: document.getElementById("modesWrap"),
        modesEmptyState: document.getElementById("modesEmptyState"),
        modesEmptyBackBtn: document.getElementById("modesEmptyBackBtn"),
        modesFooter: document.getElementById("modesFooter"),
        backToSetupBtn: document.getElementById("backToSetupBtn"),
        backToCategoriesBtn: document.getElementById("backToCategoriesBtn"),
        backToModesBtn: document.getElementById("backToModesBtn"),
        nextBoardBtn: document.getElementById("nextBoardBtn"),
        selectedModeMetaText: document.getElementById("selectedModeMetaText"),
        boardProgressText: document.getElementById("boardProgressText"),
        cycleNotice: document.getElementById("cycleNotice"),
        turnBanner: document.getElementById("turnBanner"),
        turnTeamText: document.getElementById("turnTeamText"),
        turnSymbolText: document.getElementById("turnSymbolText"),
        gameStateWrap: document.getElementById("gameStateWrap"),
        gameLoadingState: document.getElementById("gameLoadingState"),
        gameErrorState: document.getElementById("gameErrorState"),
        gameErrorBackBtn: document.getElementById("gameErrorBackBtn"),
        emptyStateWrap: document.getElementById("emptyStateWrap"),
        emptyStateBackBtn: document.getElementById("emptyStateBackBtn"),
        boardWrap: document.getElementById("boardWrap"),
        colLabel1: document.getElementById("colLabel1"),
        colLabel2: document.getElementById("colLabel2"),
        colLabel3: document.getElementById("colLabel3"),
        rowLabel1: document.getElementById("rowLabel1"),
        rowLabel2: document.getElementById("rowLabel2"),
        rowLabel3: document.getElementById("rowLabel3"),
        selectionPanel: document.getElementById("selectionPanel"),
        selectionTitleText: document.getElementById("selectionTitleText"),
        selectionRuleText: document.getElementById("selectionRuleText"),
        confirmCellBtn: document.getElementById("confirmCellBtn"),
        cancelCellBtn: document.getElementById("cancelCellBtn"),
        cancelNotice: document.getElementById("cancelNotice"),
        resultPanel: document.getElementById("resultPanel"),
        resultTitleText: document.getElementById("resultTitleText"),
        resultSubtitleText: document.getElementById("resultSubtitleText"),
        resultBoardProgressText: document.getElementById("resultBoardProgressText"),
        replayBoardBtn: document.getElementById("replayBoardBtn"),
        resultNextBoardBtn: document.getElementById("resultNextBoardBtn"),
        backToModeSelectionBtn: document.getElementById("backToModeSelectionBtn"),
        backToHomeBtn: document.getElementById("backToHomeBtn"),
        howToDialog: document.getElementById("howToDialog"),
        closeHowToBtn: document.getElementById("closeHowToBtn"),
        resumeDialog: document.getElementById("resumeDialog"),
        resumeContinueBtn: document.getElementById("resumeContinueBtn"),
        resumeNewGameBtn: document.getElementById("resumeNewGameBtn"),
        resumeLoadingHint: document.getElementById("resumeLoadingHint"),
        chooseSameDeviceBtn: document.getElementById("chooseSameDeviceBtn"),
        chooseOnlineBtn: document.getElementById("chooseOnlineBtn"),
        onlineCreateFlowBtn: document.getElementById("onlineCreateFlowBtn"),
        onlineJoinFlowBtn: document.getElementById("onlineJoinFlowBtn"),
        onlineHostNameInput: document.getElementById("onlineHostNameInput"),
        onlineHostCreateSubmitBtn: document.getElementById("onlineHostCreateSubmitBtn"),
        backToOnlineChoiceFromHostCreateBtn: document.getElementById("backToOnlineChoiceFromHostCreateBtn"),
        backToOnlineChoiceFromJoinBtn: document.getElementById("backToOnlineChoiceFromJoinBtn"),
        backToSetupFromOnlineChoiceBtn: document.getElementById("backToSetupFromOnlineChoiceBtn"),
        onlineRoleBadge: document.getElementById("onlineRoleBadge"),
        onlineLobbyMessage: document.getElementById("onlineLobbyMessage"),
        onlineRoomCodeText: document.getElementById("onlineRoomCodeText"),
        onlineInviteLinkText: document.getElementById("onlineInviteLinkText"),
        onlineInviteWrap: document.getElementById("onlineInviteWrap"),
        copyInviteBtn: document.getElementById("copyInviteBtn"),
        onlineJoinForm: document.getElementById("onlineJoinForm"),
        onlineRoomCodeInput: document.getElementById("onlineRoomCodeInput"),
        onlinePlayerNameInput: document.getElementById("onlinePlayerNameInput"),
        onlineJoinSubmitBtn: document.getElementById("onlineJoinSubmitBtn"),
        team0Players: document.getElementById("team0Players"),
        team1Players: document.getElementById("team1Players"),
        hostStartOnlineBtn: document.getElementById("hostStartOnlineBtn"),
        onlineStarterSelectorWrap: document.getElementById("onlineStarterSelectorWrap"),
        onlineStarterTeam0Btn: document.getElementById("onlineStarterTeam0Btn"),
        onlineStarterTeam1Btn: document.getElementById("onlineStarterTeam1Btn"),
        onlineStarterSummaryText: document.getElementById("onlineStarterSummaryText")
      };
      elements.boardCellButtons = Array.from({ length: 3 }, (_, rowIndex) =>
        Array.from({ length: 3 }, (_, colIndex) => document.getElementById(`cell-${rowIndex}-${colIndex}`))
      );

      function setScreen(name) {
        state.currentScreen = name;
        elements.screens.forEach((screen) => {
          screen.classList.toggle("active", screen.getAttribute("data-screen") === name);
        });
        persistResumeState();
      }

      function normalizeCell(value) {
        return String(value || "").trim();
      }

      function getConfiguredApiBaseUrl() {
        const configuredBaseUrl = normalizeCell(window.TASLEYA_API_BASE_URL);
        if (!configuredBaseUrl || configuredBaseUrl === WORKER_URL_PLACEHOLDER) {
          return DEFAULT_WORKER_API_BASE_URL;
        }
        return configuredBaseUrl.replace(/\/+$/, "");
      }

      function buildApiUrl(path) {
        return new URL(`${getConfiguredApiBaseUrl()}${path}`, window.location.origin);
      }

      async function apiFetchJson(path) {
        const response = await fetch(buildApiUrl(path), {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store"
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const message = normalizeCell(payload && payload.error) || "تعذر تحميل بيانات اللعبة.";
          throw new Error(message);
        }
        return payload;
      }

      function normalizeBoardRow(raw) {
        return {
          board_id: normalizeCell(raw && raw.board_id),
          category_key: normalizeCell(raw && raw.category_key),
          category_name_ar: normalizeCell(raw && raw.category_name_ar),
          mode_key: normalizeCell(raw && raw.mode_key),
          mode_name_ar: normalizeCell(raw && raw.mode_name_ar),
          rule_text_ar: normalizeCell(raw && raw.rule_text_ar),
          column_1: normalizeCell(raw && raw.column_1),
          column_2: normalizeCell(raw && raw.column_2),
          column_3: normalizeCell(raw && raw.column_3),
          row_1: normalizeCell(raw && raw.row_1),
          row_2: normalizeCell(raw && raw.row_2),
          row_3: normalizeCell(raw && raw.row_3),
          is_active: normalizeCell(raw && raw.is_active),
          sort_order: Number.isFinite(raw && raw.sort_order) ? raw.sort_order : null
        };
      }

      function isBoardRowPlayable(row) {
        if (!row || typeof row !== "object") return false;
        const requiredFields = [
          "board_id",
          "category_key",
          "category_name_ar",
          "mode_key",
          "mode_name_ar",
          "rule_text_ar",
          "column_1",
          "column_2",
          "column_3",
          "row_1",
          "row_2",
          "row_3"
        ];
        return requiredFields.every((field) => normalizeCell(row[field]));
      }

      function getUniqueCategories() {
        const categoriesMap = new Map();

        state.allValidLoadedBoards.forEach((row) => {
          if (!categoriesMap.has(row.category_key)) {
            categoriesMap.set(row.category_key, {
              categoryKey: row.category_key,
              categoryNameAr: row.category_name_ar
            });
          }
        });

        return Array.from(categoriesMap.values());
      }

      function getUniqueModesForCategory(categoryKey) {
        const modesMap = new Map();

        state.allValidLoadedBoards
          .filter((row) => row.category_key === categoryKey)
          .forEach((row) => {
            if (!modesMap.has(row.mode_key)) {
              modesMap.set(row.mode_key, {
                modeKey: row.mode_key,
                modeNameAr: row.mode_name_ar,
                ruleTextAr: row.rule_text_ar
              });
            }
          });

        return Array.from(modesMap.values());
      }

      function getFilteredBoardsForMode(categoryKey, modeKey) {
        const uniqueBoardsById = new Map();
        state.allValidLoadedBoards.forEach((row) => {
          if (row.category_key === categoryKey && row.mode_key === modeKey && row.board_id && !uniqueBoardsById.has(row.board_id)) {
            uniqueBoardsById.set(row.board_id, row);
          }
        });
        return Array.from(uniqueBoardsById.values());
      }

      function renderCategories() {
        const categories = getUniqueCategories();
        elements.categoriesWrap.innerHTML = "";
        const hasCategories = categories.length > 0;
        elements.categoriesWrap.classList.toggle("hidden", !hasCategories);
        elements.categoriesEmptyState.classList.toggle("hidden", hasCategories);
        elements.categoriesFooter.classList.toggle("hidden", !hasCategories);

        categories.forEach((category) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "category-card";
          button.textContent = category.categoryNameAr;
          button.addEventListener("click", () => {
            state.selectedCategoryKey = category.categoryKey;
            state.selectedCategoryNameAr = category.categoryNameAr;
            renderModes();
            setScreen("modes");
          });
          elements.categoriesWrap.appendChild(button);
        });
      }

      function renderModes() {
        const modes = getUniqueModesForCategory(state.selectedCategoryKey);
        elements.modesWrap.innerHTML = "";
        const hasModes = modes.length > 0;
        elements.modesWrap.classList.toggle("hidden", !hasModes);
        elements.modesEmptyState.classList.toggle("hidden", hasModes);
        elements.modesFooter.classList.toggle("hidden", !hasModes);

        modes.forEach((mode) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "mode-card";
          const boardsCount = getFilteredBoardsForMode(state.selectedCategoryKey, mode.modeKey).length;
          button.innerHTML = `
            <p class="mode-card-title">${mode.modeNameAr}</p>
            <p class="mode-card-rule">${mode.ruleTextAr}</p>
            <p class="mode-card-count">${boardsCount} لوحة</p>
          `;
          button.addEventListener("click", () => {
            state.selectedModeKey = mode.modeKey;
            state.selectedModeNameAr = mode.modeNameAr;
            state.selectedRuleTextAr = mode.ruleTextAr;
            state.filteredBoardsForSelectedMode = getFilteredBoardsForMode(state.selectedCategoryKey, state.selectedModeKey);
            setScreen("gameplay");
            startSelectedModeGameplay();
          });
          elements.modesWrap.appendChild(button);
        });
      }

      function getTeamNameByIndex(index) {
        return index === 0 ? state.team1Name : state.team2Name;
      }

      function getSymbolByTeamIndex(index) {
        return index === 0 ? "X" : "O";
      }

      function resetBoardStateOnly() {
        state.boardCells = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ""));
        state.currentTurnTeamIndex = 0;
        state.selectedSquare = null;
        state.gameStatus = "playing";
        state.winningLineCells = [];
      }

      function clearGameplaySelectionState() {
        state.selectedSquare = null;
        state.winningLineCells = [];
        state.gameStatus = "playing";
      }

      function resetModeSessionState() {
        state.modeBoardOrder = [];
        state.modeBoardOrderPosition = 0;
        state.usedBoardIdsInCurrentCycle = [];
      }

      function sanitizeUsedBoardHistory(savedHistory) {
        const availableBoardIds = new Set(state.filteredBoardsForSelectedMode.map((row) => row.board_id).filter(Boolean));
        if (!availableBoardIds.size) return [];
        const seen = new Set();
        const normalizedHistory = Array.isArray(savedHistory) ? savedHistory : [];
        const sanitized = [];
        normalizedHistory.forEach((boardId) => {
          if (typeof boardId !== "string" || !availableBoardIds.has(boardId) || seen.has(boardId)) return;
          seen.add(boardId);
          sanitized.push(boardId);
        });
        return sanitized;
      }

      function getRecentHistoryHelper() {
        const helper = window.TasleyaRecentHistory;
        if (!helper || typeof helper !== "object") return null;
        if (
          typeof helper.buildScopeKey !== "function" ||
          typeof helper.getRecentIds !== "function" ||
          typeof helper.markRecentId !== "function" ||
          typeof helper.clearRecentIds !== "function"
        ) {
          return null;
        }
        return helper;
      }

      function getRecentHistoryScopeKey() {
        const helper = getRecentHistoryHelper();
        if (!helper) return "";
        try {
          return helper.buildScopeKey("xo-intersection", {
            category: state.selectedCategoryKey || "all",
            mode: state.selectedModeKey || "all"
          });
        } catch (error) {
          return "";
        }
      }

      function getRecentUsedBoardIdsForScope() {
        const helper = getRecentHistoryHelper();
        const scopeKey = getRecentHistoryScopeKey();
        if (!helper || !scopeKey) return [];
        try {
          return sanitizeUsedBoardHistory(helper.getRecentIds(scopeKey));
        } catch (error) {
          return [];
        }
      }

      function markBoardIdAsRecent(boardId) {
        const helper = getRecentHistoryHelper();
        const scopeKey = getRecentHistoryScopeKey();
        if (!helper || !scopeKey || !boardId) return;
        try {
          helper.markRecentId(scopeKey, boardId);
        } catch (error) {
          // Keep gameplay running if recent-history persistence fails.
        }
      }

      function clearRecentBoardScope() {
        const helper = getRecentHistoryHelper();
        const scopeKey = getRecentHistoryScopeKey();
        if (!helper || !scopeKey) return;
        try {
          helper.clearRecentIds(scopeKey);
        } catch (error) {
          // Keep gameplay running if recent-history persistence fails.
        }
      }

      function shuffleInPlace(list) {
        for (let i = list.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [list[i], list[j]] = [list[j], list[i]];
        }
      }

      function buildModeBoardOrder() {
        const boards = state.filteredBoardsForSelectedMode;
        if (!boards.length) {
          resetModeSessionState();
          state.usedBoardIdsHistory = [];
          state.selectedBoard = null;
          return;
        }
        const allBoardIds = boards.map((row) => row.board_id).filter(Boolean);
        const normalizedHistory = getRecentUsedBoardIdsForScope();
        const usedSet = new Set(normalizedHistory);
        let remainingBoardIds = allBoardIds.filter((boardId) => !usedSet.has(boardId));
        let shouldStartNewCycle = false;

        if (!remainingBoardIds.length) {
          shouldStartNewCycle = true;
          clearRecentBoardScope();
          state.usedBoardIdsHistory = [];
          remainingBoardIds = [...allBoardIds];
        } else {
          state.usedBoardIdsHistory = normalizedHistory;
        }

        const freshOrder = [...remainingBoardIds];
        if (freshOrder.length > 1) {
          shuffleInPlace(freshOrder);
        }
        state.modeBoardOrder = freshOrder;
        state.modeBoardOrderPosition = 0;
        state.usedBoardIdsInCurrentCycle = freshOrder.length ? [freshOrder[0]] : [];
        if (shouldStartNewCycle) {
          showCycleNotice();
        }
      }

      function updateUsedBoardsForCurrentPosition() {
        const cappedPosition = Math.min(state.modeBoardOrderPosition, Math.max(0, state.modeBoardOrder.length - 1));
        state.modeBoardOrderPosition = cappedPosition;
        state.usedBoardIdsInCurrentCycle = state.modeBoardOrder.slice(0, cappedPosition + 1);
      }

      function setSelectedBoardBySessionPosition(position) {
        if (!state.modeBoardOrder.length) {
          state.selectedBoard = null;
          resetBoardStateOnly();
          return;
        }
        state.modeBoardOrderPosition = Math.max(0, Math.min(position, state.modeBoardOrder.length - 1));
        const boardId = state.modeBoardOrder[state.modeBoardOrderPosition];
        state.selectedBoard = state.filteredBoardsForSelectedMode.find((row) => row.board_id === boardId) || null;
        updateUsedBoardsForCurrentPosition();
        if (boardId && !state.usedBoardIdsHistory.includes(boardId)) {
          state.usedBoardIdsHistory.push(boardId);
        }
        markBoardIdAsRecent(boardId);
        resetBoardStateOnly();
      }

      function setSelectedBoardById(boardId) {
        const nextPosition = state.modeBoardOrder.indexOf(boardId);
        if (nextPosition < 0) return false;
        setSelectedBoardBySessionPosition(nextPosition);
        return true;
      }

      function hideCycleNotice() {
        elements.cycleNotice.classList.add("hidden");
      }

      function showCycleNotice() {
        if (elements.cycleNotice) {
          elements.cycleNotice.textContent = XO_CYCLE_RESET_NOTICE_TEXT;
        }
        elements.cycleNotice.classList.remove("hidden");
        window.clearTimeout(showCycleNotice.hideTimeoutId);
        showCycleNotice.hideTimeoutId = window.setTimeout(() => {
          hideCycleNotice();
        }, 1800);
      }

      function gotoNextBoard() {
        const totalBoards = state.filteredBoardsForSelectedMode.length;
        if (!totalBoards) return;

        hideCycleNotice();
        if (totalBoards === 1) {
          setSelectedBoardBySessionPosition(0);
          hideCancelNotice();
          renderGameplay();
          return;
        }

        const isAtEndOfCycle = state.modeBoardOrderPosition >= state.modeBoardOrder.length - 1;
        if (isAtEndOfCycle) {
          buildModeBoardOrder();
          setSelectedBoardBySessionPosition(0);
        } else {
          setSelectedBoardBySessionPosition(state.modeBoardOrderPosition + 1);
        }

        hideCancelNotice();
        renderGameplay();
        persistResumeState();
      }

      function getWinningLine(cells) {
        const lines = [
          [
            [0, 0],
            [0, 1],
            [0, 2]
          ],
          [
            [1, 0],
            [1, 1],
            [1, 2]
          ],
          [
            [2, 0],
            [2, 1],
            [2, 2]
          ],
          [
            [0, 0],
            [1, 0],
            [2, 0]
          ],
          [
            [0, 1],
            [1, 1],
            [2, 1]
          ],
          [
            [0, 2],
            [1, 2],
            [2, 2]
          ],
          [
            [0, 0],
            [1, 1],
            [2, 2]
          ],
          [
            [0, 2],
            [1, 1],
            [2, 0]
          ]
        ];

        return (
          lines.find((line) => {
            const first = cells[line[0][0]][line[0][1]];
            return first && line.every(([r, c]) => cells[r][c] === first);
          }) || null
        );
      }

      function isBoardFull(cells) {
        return cells.every((row) => row.every((cell) => Boolean(cell)));
      }

      function hideCancelNotice() {
        elements.cancelNotice.classList.add("hidden");
      }

      function showCancelNotice() {
        elements.cancelNotice.classList.remove("hidden");
        window.clearTimeout(showCancelNotice.hideTimeoutId);
        showCancelNotice.hideTimeoutId = window.setTimeout(() => {
          hideCancelNotice();
        }, 1800);
      }
      function showOnlineStatus(message, isError = false) {
        elements.cancelNotice.classList.remove("hidden");
        elements.cancelNotice.textContent = message;
        elements.cancelNotice.classList.toggle("error", Boolean(isError));
      }

      function switchTurn() {
        state.currentTurnTeamIndex = state.currentTurnTeamIndex === 0 ? 1 : 0;
      }

      function getOnlineMyTeamId() {
        const teamId = Number(state.online.roomData?.players?.[state.online.session?.uid || ""]?.teamId);
        return teamId === 0 || teamId === 1 ? teamId : null;
      }
      function canOnlineTeamAct() {
        const myTeamId = getOnlineMyTeamId();
        return myTeamId !== null && myTeamId === state.currentTurnTeamIndex;
      }

      function renderTurnBanner() {
        const teamName = getTeamNameByIndex(state.currentTurnTeamIndex);
        const symbol = getSymbolByTeamIndex(state.currentTurnTeamIndex);
        if (state.playMode === "online") {
          const isMyTurn = canOnlineTeamAct();
          elements.turnTeamText.textContent = state.selectedSquare ? (isMyTurn ? XO_ONLINE_WAIT_TEAM_CONFIRM_TEXT : "بانتظار تثبيت إجابة الفريق الآخر") : (isMyTurn ? "دور فريقك" : "بانتظار دور الفريق الآخر");
        } else {
          elements.turnTeamText.textContent = `الدور الآن: ${teamName}`;
        }
        elements.turnSymbolText.textContent = `الرمز الحالي: ${symbol} · ${teamName}`;
      }

      function renderBoardLabels() {
        const board = state.selectedBoard;
        elements.colLabel1.textContent = board.column_1;
        elements.colLabel2.textContent = board.column_2;
        elements.colLabel3.textContent = board.column_3;
        elements.rowLabel1.textContent = board.row_1;
        elements.rowLabel2.textContent = board.row_2;
        elements.rowLabel3.textContent = board.row_3;
      }

      function isCellInWinningLine(row, col) {
        return state.winningLineCells.some(([winRow, winCol]) => winRow === row && winCol === col);
      }

      async function submitOnlineAction(type, payload) {
        const gameRooms = await ensureGameRooms();
        const action = await gameRooms.submitGameRoomAction(state.online.session.roomCode, {
          type,
          payload,
          clientRequestId: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        });
        if (action?.actionId) {
          state.online.pendingActionIds[action.actionId] = type;
        }
        return action;
      }
      function renderOnlineActionDiagnostics() {
        const actions = state.online.roomData?.actions || {};
        Object.entries(state.online.pendingActionIds || {}).forEach(([actionId, type]) => {
          const action = actions[actionId];
          if (!action || action.status !== "processed") return;
          const ok = Boolean(action.result?.ok);
          if (ok) showOnlineStatus("تمت مزامنة الإجراء بنجاح.");
          else showOnlineStatus(`تعذر تنفيذ الإجراء: ${action.result?.reason || "سبب غير معروف"}`, true);
          delete state.online.pendingActionIds[actionId];
        });
      }

      function onCellSelect(row, col) {
        if (state.playMode === "online") {
          const myTeamId = getOnlineMyTeamId();
          const isMyTurn = canOnlineTeamAct();
          if (state.gameStatus !== "playing") return showOnlineStatus("اللعبة غير نشطة حالياً.", true);
          if (!isMyTurn) return showOnlineStatus("بانتظار دور الفريق الآخر.", true);
          if (state.selectedSquare) return showOnlineStatus("بانتظار تثبيت إجابة الفريق الحالي.", true);
          if (state.boardCells[row][col]) return showOnlineStatus("هذه الخانة محجوزة مسبقاً.", true);
          submitOnlineAction("select_cell", { row, col, teamId: myTeamId, expectedRevision: Number(state.online.revision || 0) })
            .then(() => showOnlineStatus("تم إرسال اختيار الخانة للمزامنة."))
            .catch(() => showOnlineStatus("تعذر إرسال اختيار الخانة. حاول مرة أخرى.", true));
          return;
        }
        if (state.gameStatus !== "playing") return;
        if (state.selectedSquare) return;
        if (state.boardCells[row][col]) return;
        state.selectedSquare = { row, col };
        hideCancelNotice();
        renderGameplay();
      }

      function renderBoardCells() {
        elements.boardCellButtons.forEach((rowButtons, rowIndex) => {
          rowButtons.forEach((button, colIndex) => {
            const value = state.boardCells[rowIndex][colIndex];
            const isSelected =
              state.selectedSquare &&
              state.selectedSquare.row === rowIndex &&
              state.selectedSquare.col === colIndex;
            const isClaimed = Boolean(value);
            const hasOpenSelection = Boolean(state.selectedSquare);
            const isDisabled = state.gameStatus !== "playing" || isClaimed || (hasOpenSelection && !isSelected);

            button.textContent = value;
            button.disabled = isDisabled;
            button.classList.toggle("selected", Boolean(isSelected));
            button.classList.toggle("claimed-x", value === "X");
            button.classList.toggle("claimed-o", value === "O");
            button.classList.toggle("winning-cell", isCellInWinningLine(rowIndex, colIndex));
          });
        });
      }

      function renderSelectionPanel() {
        if (!state.selectedSquare || state.gameStatus !== "playing") {
          elements.selectionPanel.classList.add("hidden");
          return;
        }
        if (state.playMode === "online" && !canOnlineTeamAct()) {
          elements.selectionPanel.classList.add("hidden");
          return;
        }

        const { row, col } = state.selectedSquare;
        const rowLabel = state.selectedBoard[`row_${row + 1}`];
        const colLabel = state.selectedBoard[`column_${col + 1}`];
        elements.selectionTitleText.textContent = `${rowLabel} × ${colLabel}`;
        elements.selectionRuleText.textContent = state.selectedRuleTextAr;
        elements.selectionPanel.classList.remove("hidden");
      }

      function renderResultPanel() {
        if (state.gameStatus === "won") {
          const winnerSymbol = state.boardCells[state.winningLineCells[0][0]][state.winningLineCells[0][1]];
          const winnerTeamName = winnerSymbol === "X" ? state.team1Name : state.team2Name;
          elements.resultTitleText.textContent = `فاز ${winnerTeamName}!`;
          elements.resultSubtitleText.textContent = "";
          elements.resultPanel.classList.remove("hidden");
          return;
        }

        if (state.gameStatus === "draw") {
          elements.resultTitleText.textContent = "تعادل";
          elements.resultSubtitleText.textContent = "لا يوجد فائز في هذه اللوحة";
          elements.resultPanel.classList.remove("hidden");
          return;
        }

        elements.resultPanel.classList.add("hidden");
      }

      function renderBoardProgress() {
        const totalBoards = state.filteredBoardsForSelectedMode.length;
        if (!totalBoards || !state.selectedBoard) {
          elements.boardProgressText.textContent = "";
          elements.resultBoardProgressText.textContent = "";
          return;
        }

        const currentBoard = state.modeBoardOrderPosition + 1;
        const progressText = `اللوحة ${currentBoard} من ${totalBoards}`;
        elements.boardProgressText.textContent = progressText;
        elements.resultBoardProgressText.textContent = progressText;
      }

      function renderGameplay() {
        const hasBoard = Boolean(state.selectedBoard);
        const hasBoardsForMode = state.filteredBoardsForSelectedMode.length > 0;
        const isPreparingBoard = state.loadingStatus === "preparing-board";
        const hasGameplayError = state.loadingStatus === "board-error";
        const boardActionsDisabled = !hasBoard || state.gameStatus !== "playing";
        const showNoBoards = !hasBoard && !isPreparingBoard && !hasGameplayError && !hasBoardsForMode;
        const showStateWrap = isPreparingBoard || hasGameplayError || showNoBoards;

        elements.selectedModeMetaText.textContent = `${state.selectedCategoryNameAr} — ${state.selectedModeNameAr}`;
        elements.gameStateWrap.classList.toggle("hidden", !showStateWrap);
        elements.gameLoadingState.classList.toggle("hidden", !isPreparingBoard);
        elements.gameErrorState.classList.toggle("hidden", !hasGameplayError);
        elements.emptyStateWrap.classList.toggle("hidden", !showNoBoards);
        elements.boardWrap.classList.toggle("hidden", !hasBoard || showStateWrap);
        elements.turnBanner.classList.toggle("hidden", !hasBoard || showStateWrap);
        elements.nextBoardBtn.disabled = boardActionsDisabled || state.playMode === "online";
        elements.nextBoardBtn.classList.toggle("hidden", state.playMode === "online");
        elements.resultNextBoardBtn.disabled = state.playMode === "online";
        if (state.playMode === "online") elements.resultNextBoardBtn.title = "بدء لوحة جديدة أونلاين غير متاح حالياً"; else elements.resultNextBoardBtn.removeAttribute("title");

        if (!hasBoard || showStateWrap) {
          elements.selectionPanel.classList.add("hidden");
          elements.resultPanel.classList.add("hidden");
          elements.nextBoardBtn.disabled = true;
          renderBoardProgress();
          return;
        }

        renderBoardLabels();
        renderTurnBanner();
        renderBoardCells();
        renderSelectionPanel();
        renderResultPanel();
        renderBoardProgress();
      }

      function sanitizeAndApplyModeSessionFromSaved(savedSession) {
        const availableBoardIds = new Set(state.filteredBoardsForSelectedMode.map((row) => row.board_id));
        state.usedBoardIdsHistory = sanitizeUsedBoardHistory(savedSession && savedSession.usedBoardIdsHistory);
        const normalizedOrder = Array.isArray(savedSession && savedSession.modeBoardOrder)
          ? savedSession.modeBoardOrder.filter((boardId) => typeof boardId === "string" && availableBoardIds.has(boardId))
          : [];
        const dedupedOrder = [];
        const seen = new Set();
        normalizedOrder.forEach((boardId) => {
          if (!seen.has(boardId)) {
            seen.add(boardId);
            dedupedOrder.push(boardId);
          }
        });
        const missingIds = state.filteredBoardsForSelectedMode
          .map((row) => row.board_id)
          .filter((boardId) => !seen.has(boardId) && !state.usedBoardIdsHistory.includes(boardId));
        const finalOrder = dedupedOrder.concat(missingIds);
        if (!finalOrder.length) {
          buildModeBoardOrder();
          return;
        }

        state.modeBoardOrder = finalOrder;
        const normalizedPosition = Number.isInteger(savedSession && savedSession.modeBoardOrderPosition)
          ? savedSession.modeBoardOrderPosition
          : 0;
        state.modeBoardOrderPosition = Math.max(0, Math.min(normalizedPosition, finalOrder.length - 1));

        const savedCurrentBoardId = normalizeCell(savedSession && savedSession.selectedBoardId);
        if (savedCurrentBoardId && finalOrder.includes(savedCurrentBoardId)) {
          state.modeBoardOrderPosition = finalOrder.indexOf(savedCurrentBoardId);
        }
        updateUsedBoardsForCurrentPosition();
      }

      function startSelectedModeGameplay(options = {}) {
        hideCycleNotice();
        clearGameplaySelectionState();
        hideCancelNotice();
        state.loadingStatus = "preparing-board";
        renderGameplay();
        window.setTimeout(() => {
          try {
            if (options.restoreFromSavedSession) {
              sanitizeAndApplyModeSessionFromSaved(options.savedSession || null);
            } else {
              buildModeBoardOrder();
            }
            setSelectedBoardBySessionPosition(state.modeBoardOrderPosition || 0);
            state.loadingStatus = "success";
          } catch (error) {
            state.selectedBoard = null;
            state.loadingStatus = "board-error";
          }
          renderGameplay();
          persistResumeState();
        }, 0);
      }

      function toSerializableBoardCells() {
        if (!Array.isArray(state.boardCells) || state.boardCells.length !== 3) {
          return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ""));
        }
        return state.boardCells.map((row) =>
          Array.isArray(row) ? row.map((cell) => (cell === "X" || cell === "O" ? cell : "")) : ["", "", ""]
        );
      }

      function saveResumeSnapshot() {
        const snapshot = {
          version: 1,
          savedAt: Date.now(),
          loadingStatus: state.loadingStatus,
          currentScreen: state.currentScreen,
          team1Name: state.team1Name,
          team2Name: state.team2Name,
          selectedCategoryKey: state.selectedCategoryKey,
          selectedCategoryNameAr: state.selectedCategoryNameAr,
          selectedModeKey: state.selectedModeKey,
          selectedModeNameAr: state.selectedModeNameAr,
          selectedRuleTextAr: state.selectedRuleTextAr,
          filteredModeBoardIds: state.filteredBoardsForSelectedMode.map((row) => row.board_id),
          modeBoardOrder: [...state.modeBoardOrder],
          modeBoardOrderPosition: state.modeBoardOrderPosition,
          usedBoardIdsInCurrentCycle: [...state.usedBoardIdsInCurrentCycle],
          usedBoardIdsHistory: [...state.usedBoardIdsHistory],
          selectedBoardId: normalizeCell(state.selectedBoard && state.selectedBoard.board_id),
          boardCells: toSerializableBoardCells(),
          currentTurnTeamIndex: state.currentTurnTeamIndex === 1 ? 1 : 0,
          gameStatus: ["playing", "won", "draw"].includes(state.gameStatus) ? state.gameStatus : "playing",
          winningLineCells: Array.isArray(state.winningLineCells) ? state.winningLineCells : []
        };
        localStorage.setItem(XO_INTERSECTION_RESUME_STORAGE_KEY, JSON.stringify(snapshot));
      }

      function clearResumeSnapshot() {
        localStorage.removeItem(XO_INTERSECTION_RESUME_STORAGE_KEY);
      }

      function persistResumeState() {
        if (state.isAwaitingResumeChoice) return;
        try {
          saveResumeSnapshot();
        } catch (error) {
          // Ignore storage quota/security errors.
        }
      }

      function readResumeSnapshot() {
        const raw = localStorage.getItem(XO_INTERSECTION_RESUME_STORAGE_KEY);
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
            clearResumeSnapshot();
            return null;
          }
          if (typeof parsed.currentScreen !== "string") {
            clearResumeSnapshot();
            return null;
          }
          return parsed;
        } catch (error) {
          clearResumeSnapshot();
          return null;
        }
      }

      function shouldOfferResumePrompt(snapshot) {
        if (!snapshot || typeof snapshot !== "object") return false;
        const hasCategoryOrMode = Boolean(normalizeCell(snapshot.selectedCategoryKey) || normalizeCell(snapshot.selectedModeKey));
        const gameplayScreens = new Set(["categories", "modes", "gameplay"]);
        const savedScreen = normalizeCell(snapshot.currentScreen);
        return hasCategoryOrMode || gameplayScreens.has(savedScreen);
      }

      function applySnapshotWithFallback(snapshot) {
        if (!snapshot) return false;
        const categoryKey = normalizeCell(snapshot.selectedCategoryKey);
        const modeKey = normalizeCell(snapshot.selectedModeKey);

        state.team1Name = normalizeCell(snapshot.team1Name) || "الفريق الأول";
        state.team2Name = normalizeCell(snapshot.team2Name) || "الفريق الثاني";
        elements.team1Input.value = state.team1Name;
        elements.team2Input.value = state.team2Name;

        state.selectedCategoryKey = categoryKey;
        state.selectedCategoryNameAr = normalizeCell(snapshot.selectedCategoryNameAr);
        state.selectedModeKey = modeKey;
        state.selectedModeNameAr = normalizeCell(snapshot.selectedModeNameAr);
        state.selectedRuleTextAr = normalizeCell(snapshot.selectedRuleTextAr);
        state.currentScreen = normalizeCell(snapshot.currentScreen) || "setup";

        if (!categoryKey || !modeKey) {
          setScreen(["setup", "categories"].includes(state.currentScreen) ? state.currentScreen : "setup");
          return true;
        }

        state.filteredBoardsForSelectedMode = getFilteredBoardsForMode(categoryKey, modeKey);
        if (!state.filteredBoardsForSelectedMode.length) {
          return false;
        }

        sanitizeAndApplyModeSessionFromSaved(snapshot);
        const selectedBoardId = normalizeCell(snapshot.selectedBoardId);
        if (selectedBoardId && !setSelectedBoardById(selectedBoardId)) {
          setSelectedBoardBySessionPosition(state.modeBoardOrderPosition || 0);
        }

        state.boardCells = Array.isArray(snapshot.boardCells) && snapshot.boardCells.length === 3
          ? snapshot.boardCells.map((row) =>
              Array.isArray(row) ? row.map((cell) => (cell === "X" || cell === "O" ? cell : "")) : ["", "", ""]
            )
          : Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ""));
        state.currentTurnTeamIndex = snapshot.currentTurnTeamIndex === 1 ? 1 : 0;
        state.gameStatus = ["playing", "won", "draw"].includes(snapshot.gameStatus) ? snapshot.gameStatus : "playing";
        state.winningLineCells = Array.isArray(snapshot.winningLineCells)
          ? snapshot.winningLineCells.filter(
              (pair) => Array.isArray(pair) && pair.length === 2 && Number.isInteger(pair[0]) && Number.isInteger(pair[1])
            )
          : [];
        const recomputedWinningLine = getWinningLine(state.boardCells);
        const hasBoardWinner = Boolean(recomputedWinningLine);
        const hasBoardDraw = isBoardFull(state.boardCells) && !hasBoardWinner;
        if (state.gameStatus === "won") {
          if (!hasBoardWinner) {
            state.gameStatus = "playing";
            state.winningLineCells = [];
          } else {
            state.winningLineCells = recomputedWinningLine;
          }
        } else if (state.gameStatus === "draw") {
          if (!hasBoardDraw) {
            state.gameStatus = "playing";
          }
          state.winningLineCells = [];
        } else if (hasBoardWinner) {
          state.gameStatus = "won";
          state.winningLineCells = recomputedWinningLine;
        } else {
          state.winningLineCells = [];
        }
        state.selectedSquare = null;
        hideCancelNotice();
        hideCycleNotice();

        if (["gameplay", "modes", "categories"].includes(state.currentScreen)) {
          if (state.currentScreen === "gameplay") {
            setScreen("gameplay");
            renderGameplay();
          } else if (state.currentScreen === "modes") {
            setScreen("modes");
            renderModes();
          } else {
            setScreen("categories");
            renderCategories();
          }
        } else {
          setScreen("setup");
        }
        return true;
      }

      function openResumeDialog() {
        if (!elements.resumeDialog.open) {
          elements.resumeDialog.showModal();
        }
      }

      function closeResumeDialog() {
        if (elements.resumeDialog.open) {
          elements.resumeDialog.close();
        }
      }

      function updateResumeLoadingHint() {
        if (state.loadingStatus === "loading") {
          elements.resumeLoadingHint.classList.remove("hidden");
          elements.resumeLoadingHint.textContent = "جارِ تحميل بيانات اللوحات...";
          elements.resumeContinueBtn.disabled = true;
          return;
        }
        if (state.loadingStatus === "error") {
          elements.resumeLoadingHint.classList.remove("hidden");
          elements.resumeLoadingHint.textContent = "تعذّر تحميل اللوحات، ابدأ لعبة جديدة أو أعد المحاولة.";
          elements.resumeContinueBtn.disabled = true;
          return;
        }
        elements.resumeLoadingHint.classList.add("hidden");
        elements.resumeLoadingHint.textContent = "";
        elements.resumeContinueBtn.disabled = false;
      }

      function refreshLoadingUi() {
        elements.startBtn.disabled = state.loadingStatus !== "success";
        elements.retryBtn.classList.toggle("hidden", state.loadingStatus !== "error");

        if (state.loadingStatus === "loading") {
          elements.loadStatus.classList.remove("error");
          elements.loadStatus.textContent = "جارِ تحميل اللوحات...";
        } else if (state.loadingStatus === "success") {
          elements.loadStatus.classList.remove("error");
          elements.loadStatus.textContent = "تم تحميل البيانات بنجاح.";
        } else if (state.loadingStatus === "error") {
          elements.loadStatus.classList.add("error");
          elements.loadStatus.textContent = "تعذّر تحميل اللوحات";
        }
        updateResumeLoadingHint();
      }

      async function fetchBoardsData() {
        state.loadingStatus = "loading";
        state.errorStatus = "";
        refreshLoadingUi();

        try {
          const payload = await apiFetchJson(XO_INTERSECTION_BOARDS_PATH);
          const boards = Array.isArray(payload && payload.boards) ? payload.boards : [];
          const validRows = boards.map((row) => normalizeBoardRow(row)).filter((row) => isBoardRowPlayable(row));

          if (!validRows.length) {
            throw new Error("لم يتم العثور على بيانات صالحة نشطة.");
          }

          state.allValidLoadedBoards = validRows;
          state.loadingStatus = "success";
          refreshLoadingUi();
          persistResumeState();
        } catch (error) {
          state.loadingStatus = "error";
          state.errorStatus = error.message;
          state.allValidLoadedBoards = [];
          refreshLoadingUi();
        }
      }

      function applyTeamNames() {
        state.team1Name = (elements.team1Input.value || "").trim() || "الفريق الأول";
        state.team2Name = (elements.team2Input.value || "").trim() || "الفريق الثاني";
        persistResumeState();
      }


      function isOnlineDevEnabled() {
        const params = new URLSearchParams(window.location.search || "");
        const hash = String(window.location.hash || "").toLowerCase();
        return params.get("xoOnlineDev") === "1" || hash.includes("xo-online-dev");
      }

      const xoScriptLoadPromises = new Map();
      function loadScriptOnce(src) {
        if (xoScriptLoadPromises.has(src)) return xoScriptLoadPromises.get(src);
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing && existing.dataset.loaded === "true") return Promise.resolve();
        const script = existing || document.createElement("script");
        const promise = new Promise((resolve, reject) => {
          const done = () => {
            script.dataset.loaded = "true";
            xoScriptLoadPromises.delete(src);
            resolve();
          };
          const fail = () => {
            xoScriptLoadPromises.delete(src);
            reject(new Error(`تعذر تحميل الاعتماد: ${src}`));
          };
          script.addEventListener("load", done, { once: true });
          script.addEventListener("error", fail, { once: true });
          if (!existing) {
            script.src = src;
            script.async = false;
            document.head.appendChild(script);
          }
        });
        xoScriptLoadPromises.set(src, promise);
        return promise;
      }

      async function ensureGameRooms() {
        if (window.TasleyaGameRooms) return window.TasleyaGameRooms;
        await loadScriptOnce("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
        await loadScriptOnce("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js");
        await loadScriptOnce("https://www.gstatic.com/firebasejs/10.12.5/firebase-database-compat.js");
        await loadScriptOnce("/firebase-config.js");
        await loadScriptOnce("/games/shared/game-rooms.js");
        return window.TasleyaGameRooms;
      }

      function buildInvite(roomCode) {
        return `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
      }

      function getOnlineStartBoard() {
        if (state.selectedBoard) return state.selectedBoard;
        if (Array.isArray(state.allValidLoadedBoards) && state.allValidLoadedBoards.length > 0) {
          return state.allValidLoadedBoards[0];
        }
        return null;
      }

      function setupEvents() {
        state.isOnlineDevEnabled = isOnlineDevEnabled();
        elements.startBtn.classList.add("hidden");
        elements.chooseSameDeviceBtn.classList.remove("hidden");
        elements.chooseOnlineBtn.classList.remove("hidden");

        elements.chooseSameDeviceBtn?.addEventListener("click", () => {
          state.playMode = "local";
          elements.localSetupFields.classList.remove("hidden");
          elements.startBtn.classList.remove("hidden");
          applyTeamNames();
          renderCategories();
          setScreen("categories");
        });

        elements.chooseOnlineBtn?.addEventListener("click", () => {
          state.playMode = "online";
          setScreen("onlineChoice");
        });

        async function assignMyTeam(teamId) {
          const gameRooms = await ensureGameRooms();
          await gameRooms.setGameRoomPresence(state.online.session.roomCode, { teamId });
        }
        elements.onlineCreateFlowBtn?.addEventListener("click", () => {
          setScreen("onlineHostCreate");
        });
        elements.onlineHostCreateSubmitBtn?.addEventListener("click", async () => {
          elements.onlineHostCreateSubmitBtn.disabled = true;
          elements.onlineLobbyMessage.textContent = "جارِ إنشاء الغرفة...";
          try {
            const gameRooms = await ensureGameRooms();
            const hostName = (elements.onlineHostNameInput.value || "المضيف").trim();
            const session = await gameRooms.createGameRoom({ gameType: XO_GAME_KEY, hostName, maxTeams: 2 });
            state.online.enabled = true; state.online.session = session;
            await assignMyTeam(0);
            const gs = { phase:"lobby", teams:{ teamAssignments:{} } };
            await gameRooms.updateGameRoomPublicState(session.roomCode, { gameState: gs });
            elements.onlineRoleBadge.textContent = "أنت المضيف";
            elements.onlineLobbyMessage.textContent = "شارك الرابط أو الكود مع اللاعب الآخر. سيتم وضعه في الفريق الثاني تلقائياً.";
            elements.onlineRoomCodeText.textContent = session.roomCode;
            elements.onlineInviteLinkText.textContent = buildInvite(session.roomCode);
            elements.onlineInviteWrap.classList.remove("hidden");
            elements.onlineJoinForm.classList.add("hidden");
            setScreen("onlineLobby");
            state.online.unsubscribeRoom = gameRooms.listenToGameRoom(session.roomCode, (roomData)=>{ state.online.roomData=roomData; renderOnlineLobby(); processPendingRoomActions(roomData).catch(()=>{}); if(roomData?.public?.gameState?.phase==="playing"||roomData?.public?.gameState?.phase==="finished"){applyOnlineGameState(roomData.public.gameState);} });
          } catch (error) {
            elements.onlineLobbyMessage.textContent = `تعذر إنشاء الغرفة: ${error?.message || "حاول مرة أخرى."}`;
          } finally {
            elements.onlineHostCreateSubmitBtn.disabled = false;
          }
        });

        elements.onlineJoinFlowBtn?.addEventListener("click", () => { setScreen("onlineLobby"); elements.onlineRoleBadge.textContent = "أنت لاعب منضم"; elements.onlineJoinForm.classList.remove("hidden"); elements.onlineLobbyMessage.textContent = "في انتظار الانضمام للغرفة..."; elements.onlineInviteWrap.classList.add("hidden"); });
        elements.backToSetupFromOnlineChoiceBtn?.addEventListener("click", ()=>setScreen("setup"));
        elements.backToOnlineChoiceFromHostCreateBtn?.addEventListener("click", ()=>setScreen("onlineChoice"));
        elements.backToOnlineChoiceFromJoinBtn?.addEventListener("click", ()=>setScreen("onlineChoice"));
        elements.onlineJoinSubmitBtn?.addEventListener("click", async ()=>{ try { const gameRooms=await ensureGameRooms(); const code=(elements.onlineRoomCodeInput.value||new URLSearchParams(location.search).get("room")||"").trim().toUpperCase(); const session=await gameRooms.joinGameRoom({roomCode:code, playerName:(elements.onlinePlayerNameInput.value||"لاعب")}); const resumedRole = String(session?.role || ""); const resumedTeamId = Number(session?.existingPlayer?.teamId); const isValidGuestResume = !!session?.resumedExistingPlayer && resumedRole !== "host" && resumedTeamId === 1; state.online.enabled=true; state.online.session=session; if (session?.createdNewPlayer) { await assignMyTeam(1); } else if (isValidGuestResume) { await gameRooms.setGameRoomPresence(code, {}); } else if (session?.resumedExistingPlayer) { throw new Error("لا يمكن الانضمام كلاعب ثانٍ من نفس المتصفح. افتح رابط الدعوة في نافذة خفية أو متصفح آخر أو جهاز آخر."); } elements.onlineRoleBadge.textContent="أنت لاعب منضم"; elements.onlineRoomCodeText.textContent=code; elements.onlineInviteWrap.classList.add("hidden"); elements.onlineJoinForm.classList.add("hidden"); state.online.unsubscribeRoom = gameRooms.listenToGameRoom(code, (roomData)=>{ state.online.roomData=roomData; renderOnlineLobby(); processPendingRoomActions(roomData).catch(()=>{}); if(roomData?.public?.gameState?.phase==="playing"||roomData?.public?.gameState?.phase==="finished"){applyOnlineGameState(roomData.public.gameState);} }); } catch (error) { if (error?.code === "SELF_JOIN_BLOCKED" || String(error?.message || "").includes("نفس المتصفح")) { elements.onlineLobbyMessage.textContent = "لا يمكن الانضمام كلاعب ثانٍ من نفس المتصفح. افتح رابط الدعوة في نافذة خفية أو متصفح آخر أو جهاز آخر."; return; } elements.onlineLobbyMessage.textContent = `تعذر الانضمام: ${error?.message || "حاول مرة أخرى."}`; } });
        elements.copyInviteBtn?.addEventListener("click", ()=>navigator.clipboard?.writeText(elements.onlineInviteLinkText.textContent||""));
        elements.onlineStarterTeam0Btn?.addEventListener("click", () => selectOnlineStarterTeam(0));
        elements.onlineStarterTeam1Btn?.addEventListener("click", () => selectOnlineStarterTeam(1));
        elements.hostStartOnlineBtn?.addEventListener("click", async ()=>{
          try {
            const gameRooms=await ensureGameRooms();
            const roomData=state.online.roomData;
            if(!roomData || roomData.meta?.hostUid!==state.online.session.uid) {
              elements.onlineLobbyMessage.textContent = "لا يمكن بدء اللعبة الآن.";
              return;
            }
            const startBoard = getOnlineStartBoard();
            if (!startBoard) {
              elements.onlineLobbyMessage.textContent = "تعذر تحميل اللوحات، لا يمكن بدء اللعبة الآن.";
              return;
            }
            const players = Object.entries(roomData.players || {}).map(([uid, p]) => ({ uid, teamId: Number(p?.teamId) }));
            const hasTeam0 = players.some((p) => p.teamId === 0);
            const hasTeam1 = players.some((p) => p.teamId === 1);
            const distinctTeamUids = new Set(players.filter((p) => p.teamId === 0 || p.teamId === 1).map((p) => p.uid));
            if(!(hasTeam0 && hasTeam1 && distinctTeamUids.size >= 2)){
              elements.onlineLobbyMessage.textContent="لا يمكن البدء قبل انضمام اللاعب الثاني.";
              return;
            }
            const selectedStarterTeamIndex = getSelectedStarterTeamIndex(roomData);
            if (selectedStarterTeamIndex !== 0 && selectedStarterTeamIndex !== 1) {
              elements.onlineLobbyMessage.textContent = "اختر من يبدأ الجولة أولاً.";
              return;
            }
            elements.onlineLobbyMessage.textContent = "جارٍ بدء اللعبة...";
            const assign = {};
            players.forEach((p) => { if (p.teamId === 0 || p.teamId === 1) assign[p.uid] = p.teamId; });
            const gameState={ gameKey:XO_GAME_KEY, phase:"playing", revision:0, board:{boardId:startBoard.board_id,rowLabels:[startBoard.row_1,startBoard.row_2,startBoard.row_3],colLabels:[startBoard.column_1,startBoard.column_2,startBoard.column_3]}, boardCells:[["","",""] ,["","",""] ,["","",""]], selectedSquare:null,currentTurnTeamIndex:selectedStarterTeamIndex,teams:{teamAssignments:assign},gameStatus:"playing",winningLineCells:[] };
            await gameRooms.updateGameRoomPublicState(state.online.session.roomCode,{gameState});
            elements.onlineLobbyMessage.textContent = "تم بدء اللعبة.";
          } catch (error) {
            elements.onlineLobbyMessage.textContent = `تعذر بدء اللعبة: ${error?.message || "حاول مرة أخرى."}`;
          }
        });

        function getSelectedStarterTeamIndex(roomData) {
          const publicStarter = Number(roomData?.public?.gameState?.starterTeamIndex);
          if (publicStarter === 0 || publicStarter === 1) return publicStarter;
          return state.online.selectedStarterTeamIndex === 0 || state.online.selectedStarterTeamIndex === 1
            ? state.online.selectedStarterTeamIndex
            : null;
        }
        async function selectOnlineStarterTeam(teamIndex) {
          const roomData = state.online.roomData;
          const isHost = roomData?.meta?.hostUid === state.online.session?.uid;
          if (!isHost || (teamIndex !== 0 && teamIndex !== 1)) return;
          state.online.selectedStarterTeamIndex = teamIndex;
          renderOnlineLobby();
          try {
            const gameRooms = await ensureGameRooms();
            const gameState = roomData?.public?.gameState || { phase: "lobby", teams: { teamAssignments: {} } };
            await gameRooms.updateGameRoomPublicState(state.online.session.roomCode, {
              gameState: { ...gameState, starterTeamIndex: teamIndex }
            });
          } catch (error) {
            elements.onlineLobbyMessage.textContent = `تعذر حفظ اختيار البداية: ${error?.message || "حاول مرة أخرى."}`;
          }
        }
        function renderOnlineLobby(){
          const roomData=state.online.roomData; if(!roomData) return;
          const players=Object.entries(roomData.players||{}).map(([uid,p])=>({uid,name:p.name||"لاعب",teamId:Number(p?.teamId)}));
          const render=(el,idx)=>{el.innerHTML=players.filter(p=>p.teamId===idx).map(p=>`<li>${p.name}${p.uid===roomData.meta?.hostUid?" (المضيف)":""}</li>`).join("")||"<li>—</li>"};
          render(elements.team0Players,0);
          render(elements.team1Players,1);
          const hasTeam0 = players.some((p) => p.teamId === 0);
          const hasTeam1 = players.some((p) => p.teamId === 1);
          const distinctTeamUids = new Set(players.filter((p) => p.teamId === 0 || p.teamId === 1).map((p) => p.uid));
          const canChooseStarter = hasTeam0 && hasTeam1 && distinctTeamUids.size >= 2;
          const selectedStarterTeamIndex = getSelectedStarterTeamIndex(roomData);
          const canStart = canChooseStarter && (selectedStarterTeamIndex === 0 || selectedStarterTeamIndex === 1);
          const isHost = roomData.meta?.hostUid===state.online.session.uid;
          const team0Name = players.find((p) => p.teamId === 0)?.name || "الفريق الأول";
          const team1Name = players.find((p) => p.teamId === 1)?.name || "الفريق الثاني";
          elements.onlineStarterTeam0Btn.textContent = `يبدأ: ${team0Name} — الفريق الأول`;
          elements.onlineStarterTeam1Btn.textContent = `يبدأ: ${team1Name} — الفريق الثاني`;
          elements.onlineStarterTeam0Btn.classList.toggle("btn-primary", selectedStarterTeamIndex === 0);
          elements.onlineStarterTeam0Btn.classList.toggle("btn-secondary", selectedStarterTeamIndex !== 0);
          elements.onlineStarterTeam1Btn.classList.toggle("btn-primary", selectedStarterTeamIndex === 1);
          elements.onlineStarterTeam1Btn.classList.toggle("btn-secondary", selectedStarterTeamIndex !== 1);
          elements.onlineStarterTeam0Btn.disabled = !isHost || !canChooseStarter;
          elements.onlineStarterTeam1Btn.disabled = !isHost || !canChooseStarter;
          elements.onlineStarterSelectorWrap.classList.toggle("hidden", !canChooseStarter);
          const starterName = selectedStarterTeamIndex === 0 ? team0Name : selectedStarterTeamIndex === 1 ? team1Name : "";
          elements.onlineStarterSummaryText.textContent = starterName ? `البداية: ${starterName}` : "اختر من يبدأ الجولة أولاً.";
          elements.hostStartOnlineBtn.classList.toggle("hidden", !isHost);
          elements.hostStartOnlineBtn.disabled = !canStart;
          const myTeamId = Number(roomData.players?.[state.online.session?.uid || ""]?.teamId);
          if (isHost) {
            elements.onlineRoleBadge.textContent = "أنت المضيف";
            elements.onlineLobbyMessage.textContent = canStart ? "أنت في الفريق الأول" : "أنت في الفريق الأول — في انتظار اللاعب الثاني";
            if (!canStart) elements.onlineLobbyMessage.textContent = "لا يمكن البدء قبل انضمام اللاعب الثاني.";
          } else {
            elements.onlineRoleBadge.textContent = "أنت لاعب منضم";
            elements.onlineLobbyMessage.textContent = myTeamId === 1 ? "أنت في الفريق الثاني — في انتظار المضيف لبدء اللعبة" : "في انتظار المضيف لبدء اللعبة";
          }
          if (isHost && canStart) {
            elements.onlineLobbyMessage.textContent = "جاهز للبدء.";
          } else if (isHost && canChooseStarter && !canStart) {
            elements.onlineLobbyMessage.textContent = "اختر من يبدأ الجولة أولاً.";
          } else if (!isHost && canChooseStarter && starterName) {
            elements.onlineLobbyMessage.textContent = `البداية: ${starterName}`;
          }
        }
        async function processPendingRoomActions(roomData) {
          const gameRooms = await ensureGameRooms();
          if (roomData?.meta?.hostUid !== state.online.session?.uid) return;
          const pending = Object.values(roomData?.actions || {})
            .filter((action) => action?.status === "pending")
            .sort((a, b) => Number(a?.createdAt || 0) - Number(b?.createdAt || 0));
          let workingGameState = roomData?.public?.gameState;
          for (const action of pending) {
            const gs = workingGameState;
            const expectedRevision = Number(action?.payload?.expectedRevision);
            if (!gs || !Number.isInteger(expectedRevision) || expectedRevision !== Number(gs.revision || 0) || gs.phase !== "playing" || gs.gameStatus !== "playing") {
              await gameRooms.markGameRoomActionProcessed(state.online.session.roomCode, action.actionId, { ok: false, reason: "stale_or_invalid" });
              continue;
            }
            const teams = gs.teams?.teamAssignments || {};
            const senderTeamId = Number(teams[action.fromUid]);
            if (action.type === "select_cell") {
              const row = Number(action.payload?.row); const col = Number(action.payload?.col);
              if (gs.selectedSquare || senderTeamId !== Number(gs.currentTurnTeamIndex || 0) || !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 2 || col < 0 || col > 2 || gs.boardCells?.[row]?.[col]) {
                await gameRooms.markGameRoomActionProcessed(state.online.session.roomCode, action.actionId, { ok: false, reason: "invalid_select" }); continue;
              }
              const next = { ...gs, selectedSquare: { row, col, byTeamId: senderTeamId, byUid: action.fromUid }, revision: Number(gs.revision || 0) + 1 };
              await gameRooms.updateGameRoomPublicState(state.online.session.roomCode, { gameState: next });
              workingGameState = next;
              await gameRooms.markGameRoomActionProcessed(state.online.session.roomCode, action.actionId, { ok: true });
            } else if (action.type === "mark_correct" || action.type === "mark_incorrect") {
              if (!gs.selectedSquare || senderTeamId !== Number(gs.currentTurnTeamIndex || 0) || senderTeamId !== Number(gs.selectedSquare.byTeamId) || action.fromUid !== gs.selectedSquare.byUid) { await gameRooms.markGameRoomActionProcessed(state.online.session.roomCode, action.actionId, { ok: false, reason: "active_team_only" }); continue; }
              const next = { ...gs, boardCells: gs.boardCells.map((r)=>r.slice()), selectedSquare: null, winningLineCells: Array.isArray(gs.winningLineCells) ? gs.winningLineCells : [] };
              if (action.type === "mark_correct") {
                const sq = gs.selectedSquare; next.boardCells[sq.row][sq.col] = getSymbolByTeamIndex(Number(gs.currentTurnTeamIndex || 0));
                const win = getWinningLine(next.boardCells);
                if (win) { next.winningLineCells = win; next.gameStatus = "won"; next.phase = "finished"; }
                else if (isBoardFull(next.boardCells)) { next.winningLineCells = []; next.gameStatus = "draw"; next.phase = "finished"; }
                else { next.currentTurnTeamIndex = Number(gs.currentTurnTeamIndex || 0) === 0 ? 1 : 0; next.gameStatus = "playing"; next.phase = "playing"; next.winningLineCells = []; }
              } else {
                next.currentTurnTeamIndex = Number(gs.currentTurnTeamIndex || 0) === 0 ? 1 : 0;
              }
              next.revision = Number(gs.revision || 0) + 1;
              await gameRooms.updateGameRoomPublicState(state.online.session.roomCode, { gameState: next });
              workingGameState = next;
              await gameRooms.markGameRoomActionProcessed(state.online.session.roomCode, action.actionId, { ok: true });
            } else {
              await gameRooms.markGameRoomActionProcessed(state.online.session.roomCode, action.actionId, { ok: false, reason: "unsupported" });
            }
          }
        }
        function applyOnlineGameState(gs){ state.playMode="online"; state.online.revision=Number(gs.revision||0); state.selectedBoard={board_id:gs.board.boardId,row_1:gs.board.rowLabels[0],row_2:gs.board.rowLabels[1],row_3:gs.board.rowLabels[2],column_1:gs.board.colLabels[0],column_2:gs.board.colLabels[1],column_3:gs.board.colLabels[2]}; state.boardCells=gs.boardCells; state.currentTurnTeamIndex=Number(gs.currentTurnTeamIndex)||0; state.gameStatus=gs.gameStatus||"playing"; state.selectedSquare=gs.selectedSquare||null; state.winningLineCells=Array.isArray(gs.winningLineCells)?gs.winningLineCells:[]; setScreen("gameplay"); renderGameplay(); elements.cancelNotice.classList.add("hidden");  }

        elements.startBtn.addEventListener("click", () => {
          state.playMode = "local";
          applyTeamNames();
          renderCategories();
          setScreen("categories");
        });

        elements.team1Input.addEventListener("input", () => {
          applyTeamNames();
        });
        elements.team2Input.addEventListener("input", () => {
          applyTeamNames();
        });

        elements.retryBtn.addEventListener("click", () => {
          state.selectedCategoryKey = "";
          state.selectedModeKey = "";
          state.filteredBoardsForSelectedMode = [];
          state.selectedBoard = null;
          fetchBoardsData();
      if (new URLSearchParams(window.location.search).get("room")) {
        setScreen("onlineLobby");
        elements.onlineRoleBadge.textContent = "أنت لاعب منضم";
        elements.onlineRoomCodeInput.value = new URLSearchParams(window.location.search).get("room") || "";
        elements.onlineJoinForm.classList.remove("hidden");
        elements.onlineInviteWrap.classList.add("hidden");
        elements.onlineLobbyMessage.textContent = "أدخل اسمك ثم انضمام.";
      }
          persistResumeState();
        });

        elements.backToSetupBtn.addEventListener("click", () => {
          hideCancelNotice();
          hideCycleNotice();
          setScreen("setup");
          persistResumeState();
        });

        elements.backToCategoriesBtn.addEventListener("click", () => {
          resetModeSessionState();
          state.selectedBoard = null;
          hideCycleNotice();
          setScreen("categories");
          persistResumeState();
        });

        elements.backToModesBtn.addEventListener("click", () => {
          resetModeSessionState();
          state.selectedBoard = null;
          clearGameplaySelectionState();
          hideCancelNotice();
          hideCycleNotice();
          setScreen("modes");
          persistResumeState();
        });

        elements.emptyStateBackBtn.addEventListener("click", () => {
          resetModeSessionState();
          state.selectedBoard = null;
          clearGameplaySelectionState();
          hideCancelNotice();
          hideCycleNotice();
          setScreen("modes");
          persistResumeState();
        });
        elements.gameErrorBackBtn.addEventListener("click", () => {
          state.loadingStatus = "success";
          resetModeSessionState();
          state.selectedBoard = null;
          clearGameplaySelectionState();
          hideCancelNotice();
          hideCycleNotice();
          setScreen("modes");
          persistResumeState();
        });
        elements.categoriesEmptyBackBtn.addEventListener("click", () => {
          setScreen("setup");
          persistResumeState();
        });
        elements.modesEmptyBackBtn.addEventListener("click", () => {
          setScreen("categories");
          persistResumeState();
        });

        elements.nextBoardBtn.addEventListener("click", () => {
          if (state.gameStatus !== "playing") return;
          gotoNextBoard();
        });

        elements.boardCellButtons.forEach((rowButtons, rowIndex) => {
          rowButtons.forEach((button, colIndex) => {
            button.addEventListener("click", () => {
              onCellSelect(rowIndex, colIndex);
            });
          });
        });

        elements.confirmCellBtn.addEventListener("click", () => {
          if (!state.selectedSquare || state.gameStatus !== "playing") return;
          if (state.playMode === "online") { if (!canOnlineTeamAct()) return showOnlineStatus("تعذر تثبيت الخانة: بانتظار دور فريقك.", true); showOnlineStatus("جارٍ إرسال تثبيت الخانة..."); submitOnlineAction("mark_correct", { expectedRevision: Number(state.online.revision || 0) }).then(()=>showOnlineStatus("تم إرسال تثبيت الخانة، بانتظار المزامنة...")).catch((error)=>showOnlineStatus(`تعذر إرسال الإجراء: ${error?.message || "فشل غير معروف"}`, true)); return; }
          const { row, col } = state.selectedSquare;
          state.boardCells[row][col] = getSymbolByTeamIndex(state.currentTurnTeamIndex);
          state.selectedSquare = null;
          const winningLine = getWinningLine(state.boardCells);
          if (winningLine) {
            state.winningLineCells = winningLine;
            state.gameStatus = "won";
          } else if (isBoardFull(state.boardCells)) {
            state.gameStatus = "draw";
          } else {
            switchTurn();
          }
          hideCancelNotice();
          renderGameplay();
          persistResumeState();
        });

        elements.cancelCellBtn.addEventListener("click", () => {
          if (!state.selectedSquare || state.gameStatus !== "playing") return;
          if (state.playMode === "online") { if (!canOnlineTeamAct()) return showOnlineStatus("تعذر إلغاء الخانة: بانتظار دور فريقك.", true); showOnlineStatus("جارٍ إرسال إلغاء الخانة..."); submitOnlineAction("mark_incorrect", { expectedRevision: Number(state.online.revision || 0) }).then(()=>showOnlineStatus("تم إرسال إلغاء الخانة، بانتظار المزامنة...")).catch((error)=>showOnlineStatus(`تعذر إرسال الإجراء: ${error?.message || "فشل غير معروف"}`, true)); return; }
          state.selectedSquare = null;
          switchTurn();
          showCancelNotice();
          renderGameplay();
          persistResumeState();
        });

        elements.replayBoardBtn.addEventListener("click", () => {
          resetBoardStateOnly();
          hideCancelNotice();
          hideCycleNotice();
          renderGameplay();
          persistResumeState();
        });

        elements.resultNextBoardBtn.addEventListener("click", () => {
          gotoNextBoard();
        });

        elements.backToModeSelectionBtn.addEventListener("click", () => {
          state.selectedBoard = null;
          resetModeSessionState();
          clearGameplaySelectionState();
          hideCancelNotice();
          hideCycleNotice();
          setScreen("modes");
          persistResumeState();
        });

        elements.backToHomeBtn.addEventListener("click", () => {
          state.selectedCategoryKey = "";
          state.selectedCategoryNameAr = "";
          state.selectedModeKey = "";
          state.selectedModeNameAr = "";
          state.selectedRuleTextAr = "";
          state.filteredBoardsForSelectedMode = [];
          state.selectedBoard = null;
          resetModeSessionState();
          resetBoardStateOnly();
          hideCancelNotice();
          hideCycleNotice();
          setScreen("setup");
          clearResumeSnapshot();
        });

        elements.howToBtn.addEventListener("click", () => {
          elements.howToDialog.showModal();
        });

        elements.closeHowToBtn.addEventListener("click", () => {
          elements.howToDialog.close();
        });

        elements.resumeContinueBtn.addEventListener("click", () => {
          if (state.loadingStatus !== "success") return;
          state.isAwaitingResumeChoice = false;
          const savedSnapshot = readResumeSnapshot();
          if (!savedSnapshot || !applySnapshotWithFallback(savedSnapshot)) {
            clearResumeSnapshot();
            setScreen("setup");
          }
          closeResumeDialog();
          persistResumeState();
        });

        elements.resumeNewGameBtn.addEventListener("click", () => {
          state.isAwaitingResumeChoice = false;
          clearResumeSnapshot();
          closeResumeDialog();
          setScreen("setup");
        });
      }

      setupEvents();
      const existingSnapshot = readResumeSnapshot();
      if (existingSnapshot && shouldOfferResumePrompt(existingSnapshot)) {
        state.isAwaitingResumeChoice = true;
        openResumeDialog();
      }
      fetchBoardsData();
      if (new URLSearchParams(window.location.search).get("room")) {
        setScreen("onlineLobby");
        elements.onlineRoleBadge.textContent = "أنت لاعب منضم";
        elements.onlineRoomCodeInput.value = new URLSearchParams(window.location.search).get("room") || "";
      }
      }
