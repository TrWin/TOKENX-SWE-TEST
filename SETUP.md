# Tokenized Mutual Fund Vault — Setup Guide

## Prerequisites

- Node.js v18 – v22 (แนะนำ v20 LTS)
- npm v9+
- MetaMask browser extension

---

## 1. Clone & Install Dependencies

```bash
git clone https://github.com/TrWin/TOKENX-SWE-TEST.git
cd TOKENX-SWE-TEST

# Root (Hardhat)
npm install

# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

---

## 2. Start Local Blockchain

```bash
# Terminal 1 — เปิดทิ้งไว้ตลอด
npx hardhat node
```

---

## 3. Compile Contracts

```bash
# Terminal 2
# จำเป็นต้องทำก่อน deploy เพื่อสร้าง artifacts/ และ ABI
npx hardhat compile
```

---

## 4. Deploy Smart Contracts

```bash
npx hardhat run smart-contracts/scripts/deploy.js --network localhost
```

Output จะได้ address ของ contracts ทั้งหมด เช่น:

```
THBMock deployed to:      0x5FbDB...
FundVault deployed to:    0xe7f17...
VaultShares deployed to:  0x9fE46...
✅ Saved to deployment.json
```

เก็บ address ทั้ง 3 ไว้ใช้ในขั้นตอนถัดไป

---

## 5. Configure Backend

สร้างไฟล์ `backend/.env`:

```bash
# Mac/Linux
touch backend/.env

# Windows
type nul > backend\.env
```

แก้ไข `backend/.env` ใส่ค่าดังนี้:

```bash
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
VAULT_SHARES_ADDRESS=<VaultShares address จากข้อ 4>
FUND_VAULT_ADDRESS=<FundVault address จากข้อ 4>
PORT=3000
```

> **หมายเหตุ:** PRIVATE_KEY นี้เป็น Hardhat default account ที่เป็นสาธารณะอยู่แล้ว ใช้ได้เฉพาะ local เท่านั้น

---

## 6. Configure Frontend

แก้ไข `frontend/src/contracts/addresses.js` ใส่ address จากข้อ 4:

```javascript
export const ADDRESSES = {
  THBMock:     "0x...",   // THBMock address
  FundVault:   "0x...",   // FundVault address
  VaultShares: "0x...",   // VaultShares address
};
```

---

## 7. Start Backend

```bash
# Terminal 3
cd backend
npm start
# Server running on http://localhost:3000
```

---

## 8. Start Frontend

```bash
# Terminal 4
cd frontend
npm run dev
# App running on http://localhost:5174
```

---

## 9. MetaMask Setup

1. ติดตั้ง MetaMask extension ใน Chrome: https://metamask.io
2. Import wallet ด้วย Secret Recovery Phrase:
   ```
   test test test test test test test test test test test junk
   ```
3. เพิ่ม Hardhat Local Network:
   ```
   Network Name : Hardhat Local
   RPC URL      : http://127.0.0.1:8545
   Chain ID     : 31337
   Symbol       : ETH
   ```
4. Switch ไปที่ **Hardhat Local** Network
5. เปิด http://localhost:5174 แล้วกด **Connect Wallet**

---

## 10. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/nav` | Update NAV price |
| POST | `/api/withdraw` | Withdraw stablecoins |
| GET | `/api/redemptions` | List redemption requests |
| POST | `/api/settle` | Settle a redemption |

### ตัวอย่างการใช้งาน

```bash
# Update NAV
curl -X POST http://localhost:3000/api/nav \
  -H "Content-Type: application/json" \
  -d '{"nav": "1.05"}'

# Withdraw
curl -X POST http://localhost:3000/api/withdraw \
  -H "Content-Type: application/json" \
  -d '{"amount": "1000.0"}'

# List redemptions
curl http://localhost:3000/api/redemptions

# Settle
curl -X POST http://localhost:3000/api/settle \
  -H "Content-Type: application/json" \
  -d '{"requestId": 1}'
```

---

## 11. Run Tests

```bash
# รันจาก root
npx hardhat test
```

---

## Terminals Summary

| Terminal | Directory | Command | หน้าที่ |
|----------|-----------|---------|---------|
| #1 | root | `npx hardhat node` | Local blockchain |
| #2 | root | `npx hardhat run smart-contracts/scripts/deploy.js --network localhost` | Deploy contracts (ครั้งแรกครั้งเดียว) |
| #3 | backend/ | `npm start` | Backend API :3000 |
| #4 | frontend/ | `npm run dev` | Frontend :5174 |

---

## Project Structure

```
tokenx-swe-test/
├── hardhat.config.js
├── deployment.json          # Auto-generated after deploy
├── SETUP.md
├── package.json
├── smart-contracts/
│   ├── scripts/
│   │   └── deploy.js
│   ├── FundVault.sol
│   ├── VaultShares.sol
│   └── THBMock.sol
├── backend/
│   ├── .env                 # สร้างเองตามข้อ 5 (ไม่ติดไปกับ repo)
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── config.js
│       ├── indexer.js
│       ├── db/
│       │   └── store.js
│       └── routes/
│           ├── nav.js
│           ├── withdraw.js
│           ├── redemptions.js
│           └── settle.js
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── contracts/
│       │   ├── addresses.js  # แก้ไขตามข้อ 6
│       │   └── abis.js
│       ├── hooks/
│       │   └── useVault.js
│       └── components/
│           ├── StatsPanel.jsx
│           ├── DepositForm.jsx
│           └── RedeemForm.jsx
└── tests/
```