# Firebase Realtime Database plan for new-game online mode (`gameRooms`)

> Scope: **new games only** (starting with **خمنها من التلميح**).  
> Non-goals: no gameplay implementation yet, and no changes to the current `rooms/{roomCode}` runtime.

## 1) Proposed `gameRooms/{roomCode}` data model

```json
{
  "gameRooms": {
    "ABCD12": {
      "meta": {
        "gameKey": "guess-from-hint",
        "createdAt": 1710000000000,
        "hostUid": "uid_host",
        "hostSessionId": "sess_host_1",
        "version": 1,
        "state": "lobby"
      },
      "players": {
        "uid_host": {
          "name": "Host",
          "role": "host",
          "joinedAt": 1710000000000,
          "lastSeenAt": 1710000000000,
          "isConnected": true,
          "sessionId": "sess_host_1",
          "reconnectToken": "optional-short-lived-token"
        },
        "uid_guest": {
          "name": "Guest",
          "role": "player",
          "joinedAt": 1710000005000,
          "lastSeenAt": 1710000005000,
          "isConnected": true,
          "sessionId": "sess_guest_1",
          "reconnectToken": "optional-short-lived-token"
        }
      },
      "public": {
        "gameState": {
          "phase": "lobby",
          "round": 1,
          "turnUid": "uid_host",
          "status": "waiting_for_start",
          "updatedAt": 1710000010000
        },
        "scoreboard": {
          "uid_host": 0,
          "uid_guest": 0
        },
        "lastActionSeq": 0
      },
      "actions": {
        "-Nxyz1": {
          "actionId": "-Nxyz1",
          "type": "submitGuess",
          "fromUid": "uid_guest",
          "payload": {
            "guess": "example"
          },
          "clientRequestId": "guest-uuid-1",
          "createdAt": 1710000020000,
          "status": "pending",
          "processedAt": null,
          "processedBy": null,
          "result": null
        }
      }
    }
  }
}
```

### Field intent
- `meta`: immutable identity + room ownership + lifecycle flags.
- `players`: private-per-player operational profile (presence/reconnect/session metadata).
- `public`: host-authoritative game state visible to all room members.
- `public.gameState`: canonical state machine snapshot for the game.
- `actions`: append-only requests from players, processed by host.

## 2) Action pattern decision

### Chosen: **Option B** (`actions/{actionId}`)

Use a dedicated queue at `gameRooms/{roomCode}/actions/{actionId}` where:
- each player can **create** actions where `fromUid == auth.uid`.
- host can mark `status`, set `processedAt`, `processedBy`, `result`, or remove processed actions.

### Why Option B is safer than `players/{uid}/pendingAction`
- Avoids permission collision: player writes their own action node; host processes in a separate namespace.
- Supports retries/idempotency (`clientRequestId`) and ordering.
- Avoids overloading `players/{uid}` with mixed ownership fields.
- Prevents host from needing elevated write access in each player subtree just to clear pending requests.

## 3) Proposed Realtime Database rules (`gameRooms` only)

> Add this as a **new sibling block** under `rules`, without weakening existing `rooms` rules.

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "rooms": {
      "...": "(keep existing rules exactly as-is)"
    },

    "gameRooms": {
      "$roomId": {
        ".read": "auth != null && root.child('gameRooms/' + $roomId + '/players/' + auth.uid).exists()",

        "meta": {
          ".read": "auth != null && root.child('gameRooms/' + $roomId + '/players/' + auth.uid).exists()",
          "hostUid": {
            ".write": "!data.exists() && newData.val() === auth.uid"
          },
          "$other": {
            ".write": "auth != null && root.child('gameRooms/' + $roomId + '/meta/hostUid').val() === auth.uid"
          }
        },

        "players": {
          "$uid": {
            ".read": "auth != null && root.child('gameRooms/' + $roomId + '/players/' + auth.uid).exists()",
            ".write": "auth != null && auth.uid === $uid"
          }
        },

        "public": {
          ".read": "auth != null && root.child('gameRooms/' + $roomId + '/players/' + auth.uid).exists()",
          ".write": "auth != null && root.child('gameRooms/' + $roomId + '/meta/hostUid').val() === auth.uid"
        },

        "actions": {
          "$actionId": {
            ".read": "auth != null && root.child('gameRooms/' + $roomId + '/players/' + auth.uid).exists()",

            ".write": "auth != null && (\
              ( !data.exists() && newData.child('fromUid').val() === auth.uid && root.child('gameRooms/' + $roomId + '/players/' + auth.uid).exists() ) || \
              ( root.child('gameRooms/' + $roomId + '/meta/hostUid').val() === auth.uid )\
            )"
          }
        }
      }
    }
  }
}
```

### Practical write ownership under these rules
- **Host**:
  - full write to `public`.
  - can process/clear `actions/*`.
- **Any player**:
  - can only write their own `players/{uid}` (presence/reconnect updates).
  - can only create actions where `fromUid == auth.uid`.

## 4) Coexistence check with existing `rooms`

This proposal coexists safely because:
- `rooms` remains untouched in path and semantics.
- `gameRooms` is a separate namespace (`gameRooms/{roomCode}`), so no runtime conflict with old online mode.
- no broad top-level permission changes beyond adding a sibling path.

### Do we need any `rooms` changes?
No. For this migration stage, **no `rooms` rule changes are required**.

## 5) Manual Firebase Console update plan

1. Open **Realtime Database → Rules** in the current Tasleya Firebase project.
2. Keep the entire existing `rooms` block unchanged.
3. Under top-level `"rules"`, add a new sibling block named `"gameRooms"` (the one in section 3).
4. Do **not** change:
   - top-level `".read": false`, `".write": false`
   - existing `"rooms"` behavior
   - Firebase project/config/auth setup
5. Publish rules.
6. Verify with emulator/manual tests that old `rooms` flow still works.

## 6) Minimal implementation plan for next PRs

### PR2 (infra only, no gameplay integration)
- Add a shared Firebase helper for `gameRooms` only (create/join/leave/presence/action submit/process utilities).
- Keep current `rooms` helper and calls untouched.
- Add constants for `gameKey = 'guess-from-hint'` and room path `gameRooms`.
- Add light validation helpers for action envelope (`type`, `fromUid`, `clientRequestId`, `createdAt`).

### PR3 (feature integration)
- Implement **خمنها من التلميح** online flow on top of `gameRooms`.
- Host-authoritative reducer updates `public.gameState`.
- Players emit actions; host processes and updates `result/status`.
- Reconnect flow uses `players/{uid}.sessionId`, `isConnected`, `lastSeenAt`.
- Keep original Tasleya mode on `rooms` unchanged.
