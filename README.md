# Chiki 🐔

A personal finance app built for Filipinos — track your money, loans, savings goals, and let Chiki guide you with insights.

**100% offline.** No internet required, no cloud sync, no servers. All your financial data stays on your device — always private, always available.

Built with React Native + Expo.

---

## Features

### 💳 Accounts
- Add multiple accounts (GCash, BDO, Maya, Cash, etc.)
- Track balances across all accounts
- Net worth calculation

### 💸 Transactions
- Record expenses, income, and transfers
- Category-based tracking with emojis
- Transaction history with search and filters
- Monthly income vs expense summary

### 🏦 Loans
- Track active loans with remaining balance
- Amortization calculator — monthly payment, total interest, full breakdown
- Supports add-on (Coop / 5-6 / SSS) and reducing balance (Bank / Mortgage) methods
- Monthly or annual interest rate input
- Progress bar showing how much has been paid off
- Due date countdown with urgency indicators
- Record payments directly from the loans screen

### 🎯 Savings Goals
- Set savings targets with deadlines
- Add money from any account — deducts balance and records transaction
- Progress tracking toward each goal

### 📊 Budgets
- Set monthly budgets per category
- Real-time progress bars
- Alerts when approaching or exceeding limits

### 🤖 Chiki AI Chat
- Natural language commands — no typing forms
- **Accounts:** "Transfer 2000 from BDO to GCash", "Balance of Maya"
- **Loans:** "How much do I owe on SSS loan?", "Pay SSS loan from GCash"
- **Goals:** "How much have I saved for Emergency Fund?", "Show my goals"
- **Spending:** "How much did I spend this month?", "How much did I earn this month?"

### 🔔 Alerts & Insights
- Smart insights based on your actual spending patterns
- Budget overspend alerts
- Loan due date reminders
- Chiki mascot mood changes based on your financial health

### 🔒 Security
- Biometric lock (Face ID / Touch ID)
- Auto-lock on background
- Local SQLite database — data stays on your device

---

## Tech Stack

- **React Native** + **Expo**
- **expo-sqlite** — local encrypted database
- **expo-router** — file-based navigation
- **Zustand** — state management
- **TypeScript**

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the app
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `i` for iOS simulator / `a` for Android emulator.

---

## 100% Offline

Chiki works completely offline — no internet connection needed, ever.

- All data is stored locally using SQLite on your device
- No accounts, no sign-in, no cloud sync
- No data is sent to any server
- Works without Wi-Fi or mobile data
- Your financial data never leaves your phone

---

## License

Private — all rights reserved.
