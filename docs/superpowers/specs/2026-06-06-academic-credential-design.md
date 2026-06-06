---
title: Decentralized Academic Credential System Design
date: 2026-06-06
---

# Decentralized Academic Credential System Design

## Goal

Build a runnable local prototype for issuing and verifying digital diplomas with selective transcript disclosure. A student proves graduation facts and selected course grades without revealing the full transcript.

## Recommended approach

Use Hardhat, Solidity, TypeScript, ethers, and tests. This keeps blockchain logic real, cryptographic operations inspectable, and verification repeatable through one command.

## Architecture

### Smart contract

`CredentialRegistry.sol` stores two on-chain facts:

- which university addresses are authorized issuers;
- which credential IDs are revoked.

The contract owner manages authorized issuers. Authorized issuers can revoke credential IDs they issued. Verifiers read authorization and revocation status from the contract.

### Credential model

A diploma credential contains:

- credential ID;
- issuer address;
- holder identifier;
- degree field;
- graduation year;
- transcript Merkle root.

The university signs the credential digest using secp256k1 ECDSA through ethers-compatible signing. Verification recovers signer address from the signature and checks it matches an authorized issuer.

### Selective disclosure

Each course and grade is normalized into a leaf payload and hashed. Leaves form a Merkle tree. Holder reveals only one requested course payload plus Merkle proof. Verifier checks proof against the signed transcript root.

### Verification flow

1. University address is added to issuer registry.
2. University builds transcript Merkle root.
3. University signs credential digest.
4. Holder presents credential metadata, signature, one course payload, and Merkle proof.
5. Verifier checks issuer authorization, revocation status, signature recovery, and Merkle proof.
6. If credential is revoked or proof/signature is invalid, verification fails.

## Files

- `contracts/CredentialRegistry.sol` — issuer registry and revocation list.
- `src/merkle.ts` — Merkle tree creation, proof generation, proof verification.
- `src/crypto.ts` — credential digest, signing, signer recovery, verification helpers.
- `test/credential.test.ts` — end-to-end tests for issue, disclose, verify, and revoke.
- Hardhat/TypeScript config and package files — local project scaffolding.

## Error handling

- Smart contract rejects unauthorized issuer changes and unauthorized revocation.
- Verification returns false for invalid proof, invalid signature, unauthorized issuer, or revoked credential.
- Tests cover both successful and failing paths.

## Testing

`npm test` runs Hardhat tests. Passing tests prove:

- owner can authorize issuer;
- transcript Merkle proof verifies for selected course;
- credential signature recovers issuer;
- issuer authorization is checked on-chain;
- revoked credential fails verification;
- tampered course disclosure fails verification.

## Scope

Included: local blockchain prototype, cryptographic signing, Merkle selective disclosure, registry contract, tests.

Not included: frontend, wallet integration, production deployment, persistent database, zero-knowledge proofs.