# Firebase manual setup for Tasleya online rooms

This repository uses client-side Firebase config and does **not** include a Firebase CLI deployment pipeline for rules.

## 1) Enable Firebase Anonymous Auth (required)
1. Open **Firebase Console** for your project.
2. Go to **Authentication** → **Sign-in method**.
3. Enable **Anonymous** provider.
4. Save.

## 2) Realtime Database rules to paste
Open **Realtime Database** → **Rules** and replace rules with:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$roomId": {
        ".read": "auth != null",
        "meta": {
          ".read": "auth != null",
          "hostUid": {
            ".write": "!data.exists() && newData.val() === auth.uid"
          },
          "$other": {
            ".write": "auth != null && root.child('rooms/' + $roomId + '/meta/hostUid').val() === auth.uid"
          }
        },
        "players": {
          "$uid": {
            ".read": "auth != null",
            ".write": "auth != null && auth.uid === $uid"
          }
        },
        "public": {
          ".read": "auth != null",
          "selectedCategories": {
            ".write": "auth != null && root.child('rooms/' + $roomId + '/meta/hostUid').val() === auth.uid"
          },
          "gameState": {
            ".write": "auth != null && root.child('rooms/' + $roomId + '/meta/hostUid').val() === auth.uid"
          },
          "scores": {
            ".write": "auth != null && root.child('rooms/' + $roomId + '/meta/hostUid').val() === auth.uid"
          }
        }
      }
    }
  }
}
```

## 3) Publish
1. Click **Publish** in the Rules editor.
2. Confirm the publish prompt.
3. Test by creating a room and joining from another device/session.
