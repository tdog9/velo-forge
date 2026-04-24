Canonical Firestore schemas used by the web app (app.js) and the native app
(ios/Shared/*.swift). Hand-maintained — when you change a shape here, change
the Swift mirror too. These files are not compiled; they serve as shared
source-of-truth documentation with editor-friendly types.

Keep the Swift structs in `ios/Shared/` one-to-one with these files.
