---
title: Academic Credential Demo UI and Server Design
date: 2026-06-06
---

# Academic Credential Demo UI and Server Design

## Goal

Add a simple browser demo for the academic credential prototype. The demo should show issuance, selective disclosure, verification, and revocation without requiring a frontend build system or a live blockchain node.

## Recommended approach

Use an Express server with static HTML, CSS, and browser JavaScript. This keeps the demo easy to run with `npm run demo`, reuses the existing TypeScript crypto and Merkle helpers, and avoids extra frontend framework setup.

## Architecture

### Demo server

`src/demo-server.ts` starts an Express app on port 3000. At startup it creates deterministic demo state:

- university wallet;
- holder ID;
- degree metadata;
- sample transcript;
- transcript Merkle tree;
- signed diploma credential;
- in-memory issuer authorization and revocation status.

The server exposes API routes:

- `GET /api/demo-state` returns public demo metadata and transcript course list.
- `POST /api/disclose` accepts a `courseCode` and returns the selected course, Merkle proof, signed credential, and signature.
- `POST /api/verify` accepts a presentation and returns verification result plus checks for signature, Merkle proof, issuer authorization, and revocation.
- `POST /api/revoke` marks the demo credential as revoked in memory.

The server uses the existing `buildTranscriptTree`, `buildCredentialDigest`, `recoverCredentialSigner`, and `verifyCourseProof` helpers.

### Frontend

Static files live under `public/`:

- `public/index.html` — page structure.
- `public/styles.css` — simple readable layout.
- `public/app.js` — calls API routes and updates the UI.

The page has three panels:

1. University Issue: displays issuer, degree field, credential ID, Merkle root, and signature.
2. Student Selective Disclosure: lets user pick one course and request proof.
3. Verifier: verifies the presentation, shows pass/fail checks, then lets user revoke and verify again.

## Data flow

1. Browser loads demo state from `GET /api/demo-state`.
2. User chooses one course.
3. Browser calls `POST /api/disclose`.
4. Server returns selected course and Merkle proof only.
5. Browser calls `POST /api/verify` with returned presentation.
6. Server verifies signature, issuer authorization, revocation status, and Merkle proof.
7. User clicks revoke.
8. Browser calls `POST /api/revoke`, then verifies again to show revocation failure.

## Error handling

- Unknown course code returns HTTP 404 with an error message.
- Invalid presentation returns HTTP 400 with an error message.
- Verification failures return HTTP 200 with `valid: false` and per-check details.

## Testing

- Existing `npm test` remains the core correctness suite.
- Add API tests for demo state, disclosure, verification success, unknown course, and revocation failure.
- Add a smoke check that `npm run demo` can start the server.

## Scope

Included: demo server, static frontend, API tests, npm script.

Not included: wallet browser extension, live contract deployment from UI, persistent storage, user authentication, production hosting.