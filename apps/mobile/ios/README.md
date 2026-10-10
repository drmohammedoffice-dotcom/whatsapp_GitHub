# ChatLoora iOS (Xcode)

SwiftUI + WKWebView app for App Store publishing.

## Open on Mac

1. Install Xcode 15+
2. Open `ChatLoora.xcodeproj`
3. Select Team under Signing & Capabilities
4. Bundle ID: `com.chatloora.app`
5. Run on Simulator or device

## App Store

1. Archive in Xcode → Organizer → Distribute App
2. Or use EAS from parent folder (`../`) after `eas build -p ios`

## Note

This native iOS project mirrors the Expo WebView shell. The Expo Android project lives in `../android`. Developers on Mac can also regenerate a full Expo iOS tree with:

```bash
cd ..
npx expo prebuild --platform ios
```
