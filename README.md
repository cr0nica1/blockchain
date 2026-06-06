# Decentralized Academic Credential System

A demo system for issuing and verifying digital diplomas with selective transcript disclosure.

A university signs a diploma credential with elliptic-curve cryptography. A student can reveal one requested course and grade with a Merkle proof, without exposing the full transcript. Verifiers check the signature, issuer authorization, Merkle proof, and revocation status.

## Features

- **ECC credential signature**: university signs diploma metadata and transcript Merkle root.
- **Selective disclosure**: each course and grade is a Merkle leaf; holder reveals only selected course plus proof.
- **Issuer registry**: Solidity contract tracks authorized universities.
- **Revocation list**: Solidity contract tracks revoked credential IDs.
- **Browser demo**: simple frontend and Express server for presentation flow.
- **Automated tests**: Hardhat tests cover contract, crypto, Merkle proofs, API, and revocation.

## Tech Stack

- Solidity `0.8.28`
- Hardhat
- TypeScript
- ethers v6
- Express
- Static HTML/CSS/JavaScript

## Project Structure

```text
contracts/CredentialRegistry.sol   # issuer registry and revocation list
src/crypto.ts                      # credential digest, signature recovery, verification helper
src/merkle.ts                      # transcript Merkle tree and proof verification
src/demo-state.ts                  # in-memory demo credential state
src/demo-server.ts                 # Express API and static frontend server
public/index.html                  # browser demo page
public/styles.css                  # demo styling
public/app.js                      # browser demo logic
test/credential.test.ts            # contract, Merkle, crypto, revocation tests
test/demo-server.test.ts           # demo state and API tests
```

## Install

```bash
npm install
```

## Run Demo

```bash
npm run demo
```

Open:

```text
http://localhost:3000
```

Demo flow:

1. Select one course.
2. Click **Generate Merkle proof**.
3. Click **Verify presentation**.
4. Click **Revoke credential**.
5. Click **Verify presentation** again to see revocation failure.

## Test

```bash
npm run compile
npm test
```

Expected result:

```text
19 passing
```

Hardhat may warn that Node `v18.19.1` is unsupported. The tests still pass in this environment.

## How Verification Works

1. University creates transcript leaves from course code, course name, and grade.
2. Server builds a Merkle tree and stores root in diploma credential.
3. University signs credential digest with secp256k1 ECDSA.
4. Holder selects one course to disclose.
5. Holder sends selected course, Merkle proof, credential, and signature.
6. Verifier checks:
   - recovered signer equals credential issuer;
   - issuer is authorized;
   - credential is not revoked;
   - disclosed course proof matches transcript Merkle root.

## API Endpoints

### `GET /api/demo-state`

Returns public demo metadata, credential, signature, and course list.

### `POST /api/disclose`

Request:

```json
{
  "courseCode": "SEC301"
}
```

Returns credential presentation with only selected course and Merkle proof.

### `POST /api/verify`

Accepts credential presentation from `/api/disclose` and returns verification checks.

### `POST /api/revoke`

Marks demo credential revoked in memory.

## Smart Contract

`CredentialRegistry.sol` stores:

- `authorizedIssuers(address => bool)`
- `revokedCredentials(bytes32 => bool)`

Only contract owner can authorize or remove issuers. Only authorized issuers can revoke credentials.

## Scope

This is a local demo/prototype. It does not include wallet browser integration, production deployment, persistent storage, authentication, or zero-knowledge proofs.
