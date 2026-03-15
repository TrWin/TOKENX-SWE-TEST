# 🏦 Assessment: Mutual Fund Vault (Full-Stack Web3)

> 💡 **Important**: Please understand that this assessment will be related with your future work at Token X.

## 📋 The Mission
You are building a **Tokenized Mutual Fund Vault** with two contracts:

| Contract | Role |
|----------|------|
| **`VaultShares`** | User-facing ERC20 share token (deposits, redemptions) |
| **`FundVault`** | Treasury that holds the stablecoin assets |

Share price is determined by **NAV (Net Asset Value)**, updated periodically by the Admin.

The core challenge: implementing a **T+1 Settlement Workflow**. The Admin may withdraw stablecoins for off-chain investments, leaving the Treasury with insufficient liquidity for immediate redemptions. Users must first *request* a redemption, and the Admin *settles* it after 24 hours. If the Treasury lacks funds, liquidity must be returned before settlement can complete.


## 🤖 AI Assistance

Feel free to use **AI Tools or Agentic Coding** (ChatGPT, Gemini, Claude Code, Cursor, etc.) to help write, refactor, or optimize your code.

**Important:** You must take full ownership of the logic you submit. During the technical interview, you will be asked to explain your implementation decisions and walk through specific code paths in detail.


## 🛠 Tooling & Frameworks

Use the stack that makes you most productive. We evaluate your **architecture**, **logic**, and **production readiness**, not your specific choice of tools.

**Examples (not requirements):**
- **Contracts**: Hardhat, Foundry
- **Backend**: Node.js, Go, Python, Rust
- **Frontend**: React, Next.js, Vue, Tailwind

**Included in this Repo:**
- `package.json` with Hardhat for running tests: `npm install && npx hardhat test`


## 🏗 Requirements Specification

### 1. Smart Contracts (`/smart-contracts`)

> 💡 **Note:** You are fully allowed and encouraged to import and use OpenZeppelin contracts (e.g., `ERC20`, `Ownable`, `Pausable`, `ReentrancyGuard`) to build secure implementations.

*   **`THBMock.sol`**: (Provided) A standard ERC-20 stablecoin implementation.

*   **`VaultShares.sol`**: (To Implement) ERC-20 token representing vault shares.
    
    **Setup:**
    *   `setFundVault(address)`: Set the FundVault address (Admin only, one-time).
    
    **User Functions:**
    *   `deposit(uint256)`: Pulls stablecoins from user, sends them to `FundVault`, and mints shares.
    *   `requestRedeem(uint256)`: Burns shares and records a pending redemption at nav price.
    
    **Admin Functions:**
    *   `setNav(uint256)`: Update the current share price (default: 1.0).
    *   `settleRedemption(uint256)`: Execute a **T+1 Settlement**. Mark a specific request as settled (only after 24 hours have passed) and trigger the fund transfer from `FundVault` directly to the user.
    *   `pause()` / `unpause()`: Emergency circuit breaker to halt all operations.
    
    **View Functions:**
    *   `nav()`: Returns current NAV price (18 decimals).
    *   `totalSupply()`: Total vault shares in circulation.
    *   `balanceOf(address)`: Shares owned by an address.
    

    > 💡 **Note:** Standard ERC20 functions (`transfer`, `approve`, `transferFrom`, etc.) are expected.

*   **`FundVault.sol`**: (To Implement) Treasury that holds all `THBMock` tokens.
    
    **Setup:**
    *   `setVaultShares(address)`: Set the VaultShares address (Admin only).
    
    **Admin Functions:**
    *   `withdraw(uint256)`: Withdraw stablecoins for off-chain deployment.
    *   `pause()` / `unpause()`: Emergency circuit breaker.
    
    **Internal Functions:**
    *   `payoutRedemption(address, uint256)`: Transfer stablecoins to user. **Only callable by VaultShares**.
    
    **View Functions:**
    *   `balance()`: Current stablecoin balance in treasury.
    *   `aum()`: Assets Under Management (shares × NAV).
    
    
    > 💡 **Authorization:** Must restrict `payoutRedemption` to the authorized `VaultShares` contract only.

#### Smart Contract Workflow

**DEPOSIT FLOW**
```text
User                 VaultShares              FundVault              THBMock (ERC20)
 │                        │                        │                     │
 │──approve(amount)───────┼────────────────────────┼────────────────────►│
 │                        │                        │                     │
 │──deposit(amount)──────►│                        │                     │
 │                        │──transferFrom()────────┼────────────────────►│
 │                        │                        │◄───(THB Received)───│
 │                        │──mint shares to user   │                     │
 │◄──shares received──────│                        │                     │
```

**REDEMPTION REQUEST (T)**
```
User                        VaultShares
 │                              │
 │──requestRedeem(share)-──────►│
 │                              │──burn shares from user
 │                              │──create redemption request
 │◄──requestId event emitted────│
```

**MANAGER WITHDRAW**
```
Admin                FundVault
 │                        │
 │──withdraw(amount)─────►│
 │                        │
 │◄──THBMock received─────│
```

**SETTLE REDEMPTION 24h (T+1)**
```text
Admin                VaultShares              FundVault              THBMock (ERC20)            User
 │                        │                        │                     │                        │
 │──settleRedemption(id)-►│                        │                     │                        │
 │                        │──verify 24h passed     │                     │                        │
 │                        │──payoutRedemption()───►│                     │                        │
 │                        │                        │──transfer(user)────►│                        │
 │                        │                        │                     │──(THB Received)───────►│
```

### 2. Backend API (`/backend`)

| Endpoint | Description |
| :--- | :--- |
| `POST /api/nav` | Update the nav price on-chain via `VaultShares`. |
| `POST /api/withdraw` | Withdraw stablecoins from `FundVault` for fund deployment. |
| `GET /api/redemptions` | List all pending redemption requests from `VaultShares`. |
| `POST /api/settle` | Mark a specific user's redemption as settled on-chain via `VaultShares` (triggers direct payment). |

> 💡 **Note:** No authentication required for this assessment. Focus on the core logic.

#### API Specification

**`POST /api/nav`** — Update NAV price
```json
// Request
{ "nav": "1.05" }

// Response (200 OK)
{
  "data": {
    "txHash": "0x..."
  }
}
```

**`POST /api/withdraw`** — Withdraw stablecoins for fund deployment
```json
// Request
{ "amount": "1000.0" }

// Response (200 OK)
{
  "data": {
    "txHash": "0x..."
  }
}

// Error (400 Bad Request)
{
  "error": {
    "code": "INSUFFICIENT_TREASURY_BALANCE",
    "message": "Vault has less THB than requested"
  }
}
```

**`GET /api/redemptions`** — List pending redemption requests

> 💡 **Architectural Constraint:** Smart Contracts are not databases. To prevent EVM gas/timeout issues with `O(N)` constraints on large arrays, the `VaultShares` contract does not have a `getAll()` function. 
>
> Your backend must use **Event Indexing** (parsing `RedemptionRequested` and `RedemptionSettled` events via libraries like `ethers.js` or `viem`) to build this list and return it. 
>
> For the purpose of this assessment, we recommend using a simple local database like **SQLite** or even a local JSON file to persist and serve the indexed data, as it keeps the setup lightweight and friction-free.

> 💡 **Status Lifecycle**: `pending` → `ready` (24h passed) → `fulfilled` (settled on-chain)

```json
// Response (200 OK)
{
  "data": [
    {
      "requestId": 1,
      "wallet": "0xUser...",
      "shares": "100.0",
      "nav": "1.0",
      "amount": "100.0",
      "unlockDate": "2024-03-15T12:00:00Z",
      "status": "pending"
    },
    {
      "requestId": 2,
      "wallet": "0xUser...",
      "shares": "50.0",
      "nav": "1.05",
      "amount": "52.5",
      "unlockDate": "2024-03-10T09:00:00Z",
      "status": "ready"
    },
    {
      "requestId": 3,
      "wallet": "0xUser...",
      "shares": "200.0",
      "nav": "1.05",
      "amount": "210.0",
      "unlockDate": "2024-02-01T10:00:00Z",
      "status": "fulfilled"
    }
  ]
}
```

**`POST /api/settle`** — Settle a redemption request
```json
// Request
{ "requestId": 1 }

// Response (200 OK)
{
  "data": {
    "txHash": "0x..."
  }
}

// Error (400 Bad Request)
{ "error": { "code": "INSUFFICIENT_LIQUIDITY", "message": "Vault lacks THBMock to payout" } }
{ "error": { "code": "ALREADY_SETTLED", "message": "Status is already 'fulfilled'" } }
{ "error": { "code": "INVALID_REQUEST_ID", "message": "ID does not exist" } }
{ "error": { "code": "UNLOCK_PERIOD_NOT_PASSED", "message": "Status is still 'pending'" } }
```

### 3. Frontend UI (`/frontend`)

> 💡 **Note:** Can be a simple skeleton UI but appreciate for good design.

Build an interface that connects to a Web3 wallet (e.g., MetaMask) to interact with the **VaultShares** contract:

**User Features:**
*   **Vault Interaction**: UI buttons and inputs for **Deposit** and **Request Redemption**.
*   **Data Display**: Show the **Current NAV**, **User's vTHB Shares**, **Total Vault Shares**, **Treasury THB Balance**, and the calculated **Total AUM**.

**Admin Features (Optional, not required on this assessment):**
*   Admin panel for `setNav`, `settleRedemption`, `withdraw`, and `pause/unpause`.
*   Admin operations can be performed via backend API or direct contract calls.

> 💡 **Note:** General information (NAV, balances, AUM) can be fetched directly from smart contracts via `eth_call` (using `ethers.js` or `viem`). No backend endpoints required for read operations.

## 🚀 Submission & Review

To submit your work, please provide a link to a **Public GitHub Repository** containing:

*   **Source Code**: Your complete implementation of the Smart Contracts, Backend API, and Frontend UI.
*   **`SETUP.md`**: Clear instructions for installing dependencies and running the full-stack environment locally.

### 🔍 How We Review

We value clean architecture, security, and financial precision. Our evaluation process includes:

*   **Automated Verification**: We will run an extensive suite of **100+ E2E and unit tests** (via `npx hardhat test`) to verify protocol correctness, edge cases, and security boundaries.
*   **Manual API Audit**: We will manually inspect your Backend API endpoints for adherence to the specification and robust error handling.
*   **End-to-End Simulation**: We will simulate the full user and admin lifecycle—from initial deposit and fund deployment to the final T+1 settlement.