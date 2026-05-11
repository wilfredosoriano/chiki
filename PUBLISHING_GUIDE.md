# Chiki — Publishing Guide

A step-by-step reference for what to update before publishing to the App Store or Play Store.
No prior experience needed — each section tells you exactly which file to open and what to change.

---

## 1. App Identity (Do this first)

**File:** `app.config.ts`

| Field | What it is | What to change |
|-------|-----------|----------------|
| `name` | App name shown on device home screen | Change `'Chiki'` to your final app name |
| `slug` | URL-safe identifier on Expo's servers | Match it to your app name, lowercase, no spaces |
| `version` | App version shown in stores | Start at `'1.0.0'`, bump each release |
| `ios.bundleIdentifier` | Unique iOS app ID (like a domain name) | Must match what you register in App Store Connect |
| `android.package` | Unique Android app ID | Must match what you register in Google Play Console |
| `ios.buildNumber` | Internal build counter for iOS | Managed automatically by EAS (`appVersionSource: 'remote'`) |

> **Tip:** Bundle identifiers follow reverse-domain format: `com.yourname.chiki`

---

## 2. Environment Variables / Secrets

**File:** `.env` (you'll create this from `.env.example`)

```
REVENUECAT_API_KEY_IOS=your_key_here
REVENUECAT_API_KEY_ANDROID=your_key_here
EAS_PROJECT_ID=your_expo_project_id
```

### Where to get these:
- **RevenueCat keys:** [app.revenuecat.com](https://app.revenuecat.com) → Your Project → API Keys
- **EAS Project ID:** Run `eas init` in your terminal — it creates the project and fills this in automatically

> **Never commit your `.env` file to git.** It's already in `.gitignore`.

---

## 3. App Icons & Splash Screen

**Folder:** `assets/`

| File | Size | Used for |
|------|------|---------|
| `icon.png` | 1024×1024 px | iOS App Store icon |
| `adaptive-icon.png` | 1024×1024 px | Android home screen icon (foreground layer) |
| `splash-icon.png` | Any | Loading screen while app starts |

**File:** `app.config.ts`
```ts
android: {
  adaptiveIcon: {
    backgroundColor: '#4338CA', // Change this to match your icon's background color
  }
}
```

> **Tip:** Use a tool like [EAS Asset Generator](https://github.com/byCedric/eas-cli-local-build-plugin) or Figma to export icons at the right sizes.

---

## 4. In-App Purchases (RevenueCat)

**File:** `src/stores/subscriptionStore.ts`

Lines to check:
```ts
// The entitlement name must match what you create in RevenueCat dashboard
const ENTITLEMENT_ID = 'premium'; // Change if you name it differently
```

### Setup steps:
1. Create a RevenueCat account at [revenuecat.com](https://revenuecat.com)
2. Create a new Project and add iOS + Android apps
3. In App Store Connect, create a Subscription product (e.g. `chiki_premium_monthly`)
4. In Google Play Console, do the same
5. In RevenueCat, create an **Entitlement** named `premium` and link those products to it
6. Copy your API keys to `.env`

---

## 5. Push Notifications

**File:** `src/utils/notifications.ts`

No code changes needed for basic notifications. But you need:
- **iOS:** Apple Developer account ($99/year) — notifications require a real device build
- **Android:** No extra cost — works in EAS builds

For bill reminders and budget alerts to work, the app must be installed natively (not Expo Go).

---

## 6. Privacy Policy & App Store Listings

Both App Store Connect and Google Play require a Privacy Policy URL before publishing.

**File:** `app/(tabs)/settings.tsx`

Search for `privacyPolicyUrl` or `mailto:` — update any hardcoded contact emails or links:
```ts
// Example — find and update these
Linking.openURL('mailto:support@yourdomain.com');
Linking.openURL('https://yourdomain.com/privacy');
```

---

## 7. Build & Submit

### First time setup:
```bash
# Login to your Expo account
npx eas login

# Link this project to your Expo account (creates EAS_PROJECT_ID)
eas init

# Register your Apple Developer account
eas credentials
```

### Building:

```bash
# Test build (install via TestFlight or direct download)
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production build (for App Store / Play Store submission)
eas build --platform ios --profile production
eas build --platform android --profile production
```

### Submitting:
```bash
# Submit to App Store Connect (requires Apple Developer account)
eas submit --platform ios

# Submit to Google Play Console
eas submit --platform android
```

---

## 8. Pre-Launch Checklist

- [ ] Updated `name`, `bundleIdentifier`, and `android.package` in `app.config.ts`
- [ ] Added RevenueCat API keys to `.env`
- [ ] Replaced placeholder icons in `assets/`
- [ ] Created Privacy Policy page and updated its URL in settings
- [ ] Tested on a real device (not simulator) — especially Face ID and notifications
- [ ] Created app listings in App Store Connect and Google Play Console
- [ ] Set up RevenueCat products and linked them to store products
- [ ] Run a production build and tested it via TestFlight / internal testing track

---

## Quick Reference: Key Files

| What you want to change | File to open |
|------------------------|-------------|
| App name, version, bundle ID | `app.config.ts` |
| API keys and secrets | `.env` |
| App icons and splash | `assets/` folder |
| Premium/subscription logic | `src/stores/subscriptionStore.ts` |
| Notification scheduling | `src/utils/notifications.ts` |
| Biometric/lock screen | `src/utils/biometric.ts`, `app/(auth)/lock.tsx` |
| Settings screen (links, email) | `app/(tabs)/settings.tsx` |
| Database structure & migrations | `src/db/migrations.ts` |
| Categories, default data | `src/db/seed.ts` |
| Build profiles (dev/preview/prod) | `eas.json` |
