# Decentralized Academic Credential System

A system for issuing and verifying digital diplomas with selective transcript disclosure using blockchain, elliptic-curve cryptography, and Merkle trees.

## Requirements

- Node.js >= 18
- npm >= 9

Verify:

```bash
node -v
npm -v
```

## Setup

```bash
npm install
```

## Project Structure

```
contracts/CredentialRegistry.sol    Smart contract — issuer registry and revocation list
scripts/deploy.ts                   Deploy contract to local Hardhat node
src/crypto.ts                       ECC signing, signature recovery, verification
src/merkle.ts                       Merkle tree construction and proof verification
src/demo-state.ts                   AppService — server-side contract interaction
src/demo-server.ts                  Express API server
public/index.html                   Home — role selection
public/university.html              University — issue and revoke credentials
public/student.html                 Student — select course, generate proof
public/verifier.html                Verifier — verify presentation
public/styles.css                   Shared styles
public/university.js                University frontend logic
public/student.js                   Student frontend logic
public/verifier.js                  Verifier frontend logic
test/credential.test.ts             Contract, Merkle, crypto, e2e tests
test/demo-server.test.ts            Unit tests for Merkle and crypto helpers
```


## Run Web Demo

Open **3 terminals** and run in order:

**Terminal 1** — Start local blockchain:

```bash
npm run node
```

Keep this terminal running.

**Terminal 2** — Deploy contract and start server:

```bash
npm run deploy
npm run demo
```

**Browser** — Open:

```
http://localhost:3000
```

## Demo Flow

### Step 1: University issues credential

1. Open `http://localhost:3000/university.html`
2. Enter degree field, graduation year, and transcript
3. Click **Issue Credential**
4. Signed credential appears with Merkle root and ECC signature

### Step 2: Student selectively discloses one course

1. Open `http://localhost:3000/student.html`
2. Select one course to reveal
3. Click **Generate Merkle Proof**
4. Click **Copy Presentation JSON**

### Step 3: Verifier checks the presentation

1. Open `http://localhost:3000/verifier.html`
2. Paste the JSON from Step 2
3. Click **Verify**
4. See 4 check results — all PASS

### Step 4: Revoke and re-verify

1. Go back to University page
2. Click **Revoke Credential**
3. Go back to Verifier page
4. Paste the same JSON → Click **Verify**
5. See "Not revoked (on-chain): FAIL" — credential rejected

## How It Works

### Elliptic-Curve Cryptography (ECC)

The university signs the credential using ECDSA (secp256k1). The signature proves the credential was issued by the correct university and cannot be forged.

### Merkle Tree — Selective Disclosure

Each course is one leaf in a Merkle tree. The student sends only one course plus a Merkle proof. The verifier checks that the proof matches the Merkle root in the credential, without seeing other courses.

```
Full transcript: [CS101-A, MATH201-B+, SEC301-A-]
              → Merkle Root: 0xabc123...

Student reveals: SEC301-A- + Merkle proof
Verifier sees: only SEC301, other courses remain hidden
```

### Smart Contract — On-chain Registry

The `CredentialRegistry` contract stores on the blockchain:

- `authorizedIssuers(address)` — which universities can issue credentials
- `revokedCredentials(bytes32)` — which credentials have been revoked

### 4 Verification Checks

| # | Check | Source |
|---|-------|--------|
| 1 | ECC signature is valid | Offline — recoverSigner |
| 2 | Issuer is authorized | On-chain — smart contract |
| 3 | Credential is not revoked | On-chain — smart contract |
| 4 | Merkle proof matches root | Offline — verifyCourseProof |

All 4 must PASS for the credential to be accepted.

## npm Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run compile` | Compile smart contract |
| `npm test` | Run all 14 tests |
| `npm run node` | Start Hardhat node (local blockchain) |
| `npm run deploy` | Deploy contract to local node |
| `npm run demo` | Start web server |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Contract address, node status, issuer info |
| GET | `/api/issued` | Current issued credential state |
| POST | `/api/issue` | Issue a new credential |
| POST | `/api/disclose` | Disclose one course with Merkle proof |
| POST | `/api/verify` | Verify a credential presentation |
| POST | `/api/revoke` | Revoke credential on-chain |
| POST | `/api/reset` | Clear demo state |
