(function (globalScope) {
  "use strict";

  const GAME_ROOMS_PATH = "gameRooms";
  const GAME_ROOM_SESSION_STORAGE_KEY = "tasleya_game_room_session_v1";
  const ROOM_CODE_LENGTH = 6;
  const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const runtime = {
    initialized: false,
    db: null,
    auth: null,
    authPromise: null,
    listeners: new Map(),
    presenceByRoom: new Map(),
  };

  function assertFirebaseReady() {
    if (!globalScope.firebase || !globalScope.FIREBASE_CONFIG) {
      throw new Error("Firebase SDK/config is not available.");
    }

    const requiredKeys = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
    const hasAllKeys = requiredKeys.every((key) => {
      const value = normalizeText(globalScope.FIREBASE_CONFIG[key]);
      return !!value && !value.startsWith("PASTE_FIREBASE_") && !value.endsWith("_HERE");
    });

    if (!hasAllKeys) {
      throw new Error("Firebase config is incomplete.");
    }

    if (!globalScope.firebase.apps.length) {
      globalScope.firebase.initializeApp(globalScope.FIREBASE_CONFIG);
    }

    runtime.db = globalScope.firebase.database();
    runtime.auth = typeof globalScope.firebase.auth === "function" ? globalScope.firebase.auth() : null;
    runtime.initialized = true;
  }

  function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getServerTimestamp() {
    return globalScope.firebase.database.ServerValue.TIMESTAMP;
  }

  function roomRef(roomCode) {
    return runtime.db.ref(`${GAME_ROOMS_PATH}/${roomCode}`);
  }

  function playerRef(roomCode, uid) {
    return roomRef(roomCode).child(`players/${uid}`);
  }

  function requireRoomCode(roomCode) {
    const normalized = normalizeText(roomCode).toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(normalized)) {
      throw new Error("Invalid room code.");
    }
    return normalized;
  }

  function randomRoomCode() {
    let code = "";
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
  }

  function createSessionId() {
    if (globalScope.crypto?.randomUUID) {
      return globalScope.crypto.randomUUID();
    }
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function toDisplayName(name, fallback) {
    const normalized = normalizeText(name);
    return normalized || fallback;
  }

  function sanitizeAction(action) {
    if (!action || typeof action !== "object") {
      throw new Error("Action payload is required.");
    }

    const type = normalizeText(action.type);
    if (!type) {
      throw new Error("Action type is required.");
    }

    const payload = action.payload && typeof action.payload === "object" ? action.payload : {};

    const clientRequestId = normalizeText(action.clientRequestId) || createSessionId();

    return {
      type,
      payload,
      clientRequestId,
      createdAt: getServerTimestamp(),
      status: "pending",
      processedAt: null,
      processedBy: null,
      result: null,
    };
  }

  async function ensureGameRoomAuth() {
    if (!runtime.initialized) {
      assertFirebaseReady();
    }
    if (!runtime.auth) {
      throw new Error("Firebase auth SDK is unavailable.");
    }

    if (runtime.auth.currentUser?.uid) {
      return runtime.auth.currentUser.uid;
    }

    if (!runtime.authPromise) {
      runtime.authPromise = runtime.auth
        .signInAnonymously()
        .then((result) => result?.user?.uid || runtime.auth.currentUser?.uid)
        .finally(() => {
          runtime.authPromise = null;
        });
    }

    const uid = await runtime.authPromise;
    if (!uid) {
      throw new Error("Unable to establish anonymous auth.");
    }
    return uid;
  }

  async function createGameRoom({ gameType, hostName, maxTeams } = {}) {
    const uid = await ensureGameRoomAuth();
    const normalizedGameType = normalizeText(gameType) || "guess-from-hint";
    const normalizedHostName = toDisplayName(hostName, "Host");
    const validatedMaxTeams = Math.max(2, Math.min(6, Number(maxTeams) || 2));
    const roomCode = randomRoomCode();
    const sessionId = createSessionId();

    const payload = {
      meta: {
        gameKey: normalizedGameType,
        createdAt: getServerTimestamp(),
        hostUid: uid,
        hostSessionId: sessionId,
        version: 1,
        state: "lobby",
        maxTeams: validatedMaxTeams,
      },
      players: {
        [uid]: {
          name: normalizedHostName,
          role: "host",
          joinedAt: getServerTimestamp(),
          lastSeenAt: getServerTimestamp(),
          isConnected: true,
          sessionId,
        },
      },
      public: {
        gameState: {
          phase: "lobby",
          status: "waiting_for_players",
          updatedAt: getServerTimestamp(),
        },
        scoreboard: {},
        lastActionSeq: 0,
      },
      actions: {},
    };

    await roomRef(roomCode).set(payload);

    const session = {
      roomCode,
      uid,
      role: "host",
      sessionId,
      gameType: normalizedGameType,
      playerName: normalizedHostName,
      savedAt: Date.now(),
    };

    saveGameRoomSession(session);
    return session;
  }

  async function joinGameRoom({ roomCode, playerName } = {}) {
    const uid = await ensureGameRoomAuth();
    const normalizedRoomCode = requireRoomCode(roomCode);
    const normalizedPlayerName = toDisplayName(playerName, "Player");
    const sessionId = createSessionId();
    const rootRef = roomRef(normalizedRoomCode);

    const metaSnapshot = await rootRef.child("meta").once("value");
    if (!metaSnapshot.exists()) {
      throw new Error("Room not found.");
    }

    const updates = {
      [`players/${uid}/name`]: normalizedPlayerName,
      [`players/${uid}/role`]: "player",
      [`players/${uid}/joinedAt`]: getServerTimestamp(),
      [`players/${uid}/lastSeenAt`]: getServerTimestamp(),
      [`players/${uid}/isConnected`]: true,
      [`players/${uid}/sessionId`]: sessionId,
    };

    await rootRef.update(updates);

    const session = {
      roomCode: normalizedRoomCode,
      uid,
      role: "player",
      sessionId,
      playerName: normalizedPlayerName,
      savedAt: Date.now(),
    };

    saveGameRoomSession(session);
    return session;
  }

  function listenToGameRoom(roomCode, callback) {
    const normalizedRoomCode = requireRoomCode(roomCode);
    if (typeof callback !== "function") {
      throw new Error("A callback function is required.");
    }

    if (!runtime.initialized) {
      assertFirebaseReady();
    }

    const key = normalizedRoomCode;
    detachGameRoomListener(normalizedRoomCode);

    const ref = roomRef(normalizedRoomCode);
    const handler = (snapshot) => {
      callback(snapshot.val(), snapshot);
    };

    ref.on("value", handler);
    runtime.listeners.set(key, { ref, handler });

    return function unsubscribe() {
      detachGameRoomListener(normalizedRoomCode);
    };
  }

  function detachGameRoomListener(roomCode) {
    const normalizedRoomCode = requireRoomCode(roomCode);
    const existing = runtime.listeners.get(normalizedRoomCode);
    if (!existing) return;
    existing.ref.off("value", existing.handler);
    runtime.listeners.delete(normalizedRoomCode);
  }

  async function updateGameRoomPublicState(roomCode, partialState) {
    const uid = await ensureGameRoomAuth();
    const normalizedRoomCode = requireRoomCode(roomCode);

    if (!partialState || typeof partialState !== "object") {
      throw new Error("partialState must be an object.");
    }

    await roomRef(normalizedRoomCode).child("public").update({
      ...partialState,
      updatedBy: uid,
      updatedAt: getServerTimestamp(),
    });
  }

  async function submitGameRoomAction(roomCode, action) {
    const uid = await ensureGameRoomAuth();
    const normalizedRoomCode = requireRoomCode(roomCode);
    const actionEnvelope = sanitizeAction(action);
    const actionsRef = roomRef(normalizedRoomCode).child("actions");
    const pushedRef = actionsRef.push();

    const payload = {
      ...actionEnvelope,
      actionId: pushedRef.key,
      fromUid: uid,
    };

    await pushedRef.set(payload);
    return payload;
  }

  async function markGameRoomActionProcessed(roomCode, actionId, result) {
    const uid = await ensureGameRoomAuth();
    const normalizedRoomCode = requireRoomCode(roomCode);
    const normalizedActionId = normalizeText(actionId);
    if (!normalizedActionId) {
      throw new Error("actionId is required.");
    }

    await roomRef(normalizedRoomCode).child(`actions/${normalizedActionId}`).update({
      status: "processed",
      processedAt: getServerTimestamp(),
      processedBy: uid,
      result: result ?? null,
    });
  }

  function saveGameRoomSession(session) {
    if (!session || typeof session !== "object") {
      return null;
    }

    const normalizedRoomCode = normalizeText(session.roomCode).toUpperCase();
    const normalizedUid = normalizeText(session.uid);
    if (!normalizedRoomCode || !normalizedUid) {
      return null;
    }

    const safeSession = {
      roomCode: normalizedRoomCode,
      uid: normalizedUid,
      role: normalizeText(session.role) || "player",
      sessionId: normalizeText(session.sessionId) || createSessionId(),
      gameType: normalizeText(session.gameType),
      playerName: normalizeText(session.playerName),
      savedAt: Date.now(),
    };

    try {
      globalScope.localStorage.setItem(GAME_ROOM_SESSION_STORAGE_KEY, JSON.stringify(safeSession));
      return safeSession;
    } catch (_error) {
      return null;
    }
  }

  function restoreGameRoomSession() {
    try {
      const raw = globalScope.localStorage.getItem(GAME_ROOM_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const normalizedRoomCode = normalizeText(parsed.roomCode).toUpperCase();
      const normalizedUid = normalizeText(parsed.uid);
      if (!normalizedRoomCode || !normalizedUid) return null;
      return {
        roomCode: normalizedRoomCode,
        uid: normalizedUid,
        role: normalizeText(parsed.role) || "player",
        sessionId: normalizeText(parsed.sessionId),
        gameType: normalizeText(parsed.gameType),
        playerName: normalizeText(parsed.playerName),
        savedAt: Number(parsed.savedAt) || null,
      };
    } catch (_error) {
      return null;
    }
  }

  function clearGameRoomSession() {
    try {
      globalScope.localStorage.removeItem(GAME_ROOM_SESSION_STORAGE_KEY);
    } catch (_error) {
      // no-op
    }
  }

  async function attachGameRoomPresence(roomCode, options = {}) {
    const uid = await ensureGameRoomAuth();
    const normalizedRoomCode = requireRoomCode(roomCode);
    const { sessionId, onConnected } = options;
    const normalizedSessionId = normalizeText(sessionId) || createSessionId();

    if (!runtime.initialized) {
      assertFirebaseReady();
    }

    detachGameRoomPresence(normalizedRoomCode);

    const connectedRef = runtime.db.ref(".info/connected");
    const handler = (snapshot) => {
      if (snapshot.val() !== true) return;

      const updates = {
        isConnected: true,
        lastSeenAt: getServerTimestamp(),
        sessionId: normalizedSessionId,
      };

      playerRef(normalizedRoomCode, uid).update(updates).catch(() => {});
      playerRef(normalizedRoomCode, uid).child("isConnected").onDisconnect().set(false);
      playerRef(normalizedRoomCode, uid).child("lastSeenAt").onDisconnect().set(getServerTimestamp());

      if (typeof onConnected === "function") {
        onConnected();
      }
    };

    connectedRef.on("value", handler);
    runtime.presenceByRoom.set(normalizedRoomCode, { connectedRef, handler });

    return function unsubscribePresence() {
      detachGameRoomPresence(normalizedRoomCode);
    };
  }

  async function setGameRoomPresence(roomCode, patch = {}) {
    const uid = await ensureGameRoomAuth();
    const normalizedRoomCode = requireRoomCode(roomCode);
    if (!patch || typeof patch !== "object") {
      throw new Error("Presence patch must be an object.");
    }
    await playerRef(normalizedRoomCode, uid).update({
      ...patch,
      lastSeenAt: getServerTimestamp(),
    });
  }

  function detachGameRoomPresence(roomCode) {
    const normalizedRoomCode = requireRoomCode(roomCode);
    const entry = runtime.presenceByRoom.get(normalizedRoomCode);
    if (!entry) return;
    entry.connectedRef.off("value", entry.handler);
    runtime.presenceByRoom.delete(normalizedRoomCode);
  }

  const api = {
    GAME_ROOMS_PATH,
    ensureGameRoomAuth,
    createGameRoom,
    joinGameRoom,
    listenToGameRoom,
    detachGameRoomListener,
    updateGameRoomPublicState,
    submitGameRoomAction,
    markGameRoomActionProcessed,
    saveGameRoomSession,
    restoreGameRoomSession,
    clearGameRoomSession,
    attachGameRoomPresence,
    detachGameRoomPresence,
    setGameRoomPresence,
  };

  globalScope.TasleyaGameRooms = api;
})(window);
