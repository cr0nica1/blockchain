# Demo UI Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple browser demo and server for issuing, selectively disclosing, verifying, and revoking academic credentials.

**Architecture:** Express serves static files and JSON API routes. Server uses existing TypeScript Merkle and crypto helpers with in-memory issuer authorization and revocation. Browser JavaScript drives demo flow through API calls.

**Tech Stack:** Express, TypeScript, ts-node, static HTML/CSS/JavaScript, ethers, existing Hardhat tests.

---

## File Structure

- Modify `package.json` — add Express dependencies and demo script.
- Create `src/demo-state.ts` — deterministic demo data, in-memory registry, disclose and verify functions.
- Create `src/demo-server.ts` — Express app, API routes, static file serving, startup entrypoint.
- Create `test/demo-server.test.ts` — API tests using supertest.
- Create `public/index.html` — demo page structure.
- Create `public/styles.css` — readable presentation styles.
- Create `public/app.js` — browser workflow and API calls.

### Task 1: Add demo dependencies and scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json**

Set `package.json` to:

```json
{
  "name": "academic-credential-system",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "hardhat test",
    "compile": "hardhat compile",
    "demo": "ts-node src/demo-server.ts"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-ethers": "^3.0.8",
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@types/express": "^4.17.21",
    "@types/node": "^22.10.2",
    "@types/supertest": "^6.0.2",
    "hardhat": "^2.22.17",
    "supertest": "^7.0.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: install succeeds and `package-lock.json` updates.

### Task 2: Demo state service

**Files:**
- Create: `src/demo-state.ts`
- Test: `test/demo-server.test.ts`

- [ ] **Step 1: Write failing demo state tests**

Create `test/demo-server.test.ts`:

```ts
import { expect } from "chai";
import { createDemoState } from "../src/demo-state";

describe("Demo state", function () {
  it("creates issued credential metadata", async function () {
    const demo = await createDemoState();
    const state = demo.getPublicState();

    expect(state.credential.issuer).to.equal(state.universityAddress);
    expect(state.credential.degreeField).to.equal("Computer Science");
    expect(state.transcript).to.have.length(3);
    expect(state.signature).to.match(/^0x[0-9a-f]+$/i);
  });

  it("discloses one course with a Merkle proof", async function () {
    const demo = await createDemoState();
    const presentation = demo.discloseCourse("SEC301");

    expect(presentation.disclosedCourse.courseCode).to.equal("SEC301");
    expect(presentation.merkleProof.length).to.be.greaterThan(0);
    expect(presentation.credential.transcriptRoot).to.equal(demo.getPublicState().credential.transcriptRoot);
  });

  it("rejects unknown course disclosure", async function () {
    const demo = await createDemoState();

    expect(() => demo.discloseCourse("UNKNOWN")).to.throw("course not found");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --grep "Demo state"`

Expected: FAIL because `src/demo-state.ts` does not exist.

- [ ] **Step 3: Implement demo state**

Create `src/demo-state.ts`:

```ts
import { ethers } from "ethers";
import { buildCredentialDigest, CredentialPresentation, DiplomaCredential, recoverCredentialSigner } from "./crypto";
import { buildTranscriptTree, CourseRecord, verifyCourseProof } from "./merkle";

export type VerificationChecks = {
  signatureValid: boolean;
  issuerAuthorized: boolean;
  notRevoked: boolean;
  merkleProofValid: boolean;
};

export type VerificationResult = {
  valid: boolean;
  checks: VerificationChecks;
};

export type PublicDemoState = {
  universityAddress: string;
  holderId: string;
  credential: DiplomaCredential;
  signature: string;
  transcript: CourseRecord[];
};

export type DemoState = {
  getPublicState(): PublicDemoState;
  discloseCourse(courseCode: string): CredentialPresentation;
  verifyPresentation(presentation: CredentialPresentation): Promise<VerificationResult>;
  revokeCredential(): void;
};

const transcript: CourseRecord[] = [
  { courseCode: "CS101", courseName: "Introduction to Computer Science", grade: "A" },
  { courseCode: "MATH201", courseName: "Discrete Mathematics", grade: "B+" },
  { courseCode: "SEC301", courseName: "Applied Cryptography", grade: "A-" }
];

export async function createDemoState(): Promise<DemoState> {
  const university = new ethers.Wallet("0x59c6995e998f97a5a0044966f094538f0f5e5acb03911e6a56d130b1ce8c6e3b");
  const holderId = ethers.id("student-123");
  const tree = buildTranscriptTree(transcript);
  const credential: DiplomaCredential = {
    credentialId: ethers.id("credential-demo-1"),
    issuer: university.address,
    holderId,
    degreeField: "Computer Science",
    graduationYear: 2026,
    transcriptRoot: tree.root
  };
  const signature = await university.signMessage(ethers.getBytes(buildCredentialDigest(credential)));
  let revoked = false;

  const registry = {
    async authorizedIssuers(address: string): Promise<boolean> {
      return address.toLowerCase() === university.address.toLowerCase();
    },
    async revokedCredentials(credentialId: string): Promise<boolean> {
      return credentialId.toLowerCase() === credential.credentialId.toLowerCase() && revoked;
    }
  };

  return {
    getPublicState(): PublicDemoState {
      return {
        universityAddress: university.address,
        holderId,
        credential,
        signature,
        transcript
      };
    },
    discloseCourse(courseCode: string): CredentialPresentation {
      const index = transcript.findIndex((course) => course.courseCode === courseCode);
      if (index === -1) {
        throw new Error("course not found");
      }

      return {
        credential,
        signature,
        disclosedCourse: transcript[index],
        merkleProof: tree.getProof(index)
      };
    },
    async verifyPresentation(presentation: CredentialPresentation): Promise<VerificationResult> {
      const recoveredSigner = recoverCredentialSigner(presentation.credential, presentation.signature);
      const signatureValid = recoveredSigner.toLowerCase() === presentation.credential.issuer.toLowerCase();
      const issuerAuthorized = await registry.authorizedIssuers(presentation.credential.issuer);
      const notRevoked = !(await registry.revokedCredentials(presentation.credential.credentialId));
      const merkleProofValid = verifyCourseProof(
        presentation.disclosedCourse,
        presentation.merkleProof,
        presentation.credential.transcriptRoot
      );

      const checks = { signatureValid, issuerAuthorized, notRevoked, merkleProofValid };
      return {
        valid: Object.values(checks).every(Boolean),
        checks
      };
    },
    revokeCredential(): void {
      revoked = true;
    }
  };
}
```

- [ ] **Step 4: Run demo state tests**

Run: `npm test -- --grep "Demo state"`

Expected: 3 passing tests.

### Task 3: Express API

**Files:**
- Create: `src/demo-server.ts`
- Modify: `test/demo-server.test.ts`

- [ ] **Step 1: Add failing API tests**

Append to `test/demo-server.test.ts`:

```ts
import request from "supertest";
import { createDemoApp } from "../src/demo-server";

describe("Demo API", function () {
  async function app() {
    return createDemoApp(await createDemoState());
  }

  it("returns public demo state", async function () {
    const response = await request(await app()).get("/api/demo-state").expect(200);

    expect(response.body.credential.degreeField).to.equal("Computer Science");
    expect(response.body.transcript.map((course: { courseCode: string }) => course.courseCode)).to.deep.equal([
      "CS101",
      "MATH201",
      "SEC301"
    ]);
  });

  it("discloses and verifies a selected course", async function () {
    const server = await app();
    const disclosure = await request(server)
      .post("/api/disclose")
      .send({ courseCode: "SEC301" })
      .expect(200);

    expect(disclosure.body.disclosedCourse.courseCode).to.equal("SEC301");

    const verification = await request(server)
      .post("/api/verify")
      .send(disclosure.body)
      .expect(200);

    expect(verification.body.valid).to.equal(true);
    expect(verification.body.checks).to.deep.equal({
      signatureValid: true,
      issuerAuthorized: true,
      notRevoked: true,
      merkleProofValid: true
    });
  });

  it("returns 404 for unknown course", async function () {
    const response = await request(await app())
      .post("/api/disclose")
      .send({ courseCode: "UNKNOWN" })
      .expect(404);

    expect(response.body.error).to.equal("course not found");
  });

  it("fails verification after revocation", async function () {
    const server = await app();
    const disclosure = await request(server)
      .post("/api/disclose")
      .send({ courseCode: "CS101" })
      .expect(200);

    await request(server).post("/api/revoke").expect(200);

    const verification = await request(server)
      .post("/api/verify")
      .send(disclosure.body)
      .expect(200);

    expect(verification.body.valid).to.equal(false);
    expect(verification.body.checks.notRevoked).to.equal(false);
  });
});
```

- [ ] **Step 2: Run API tests to verify failure**

Run: `npm test -- --grep "Demo API"`

Expected: FAIL because `src/demo-server.ts` does not exist or imports are not at top.

- [ ] **Step 3: Implement Express server**

Create `src/demo-server.ts`:

```ts
import express, { Express } from "express";
import path from "path";
import { createDemoState, DemoState } from "./demo-state";

export function createDemoApp(demo: DemoState): Express {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/api/demo-state", (_req, res) => {
    res.json(demo.getPublicState());
  });

  app.post("/api/disclose", (req, res) => {
    try {
      const courseCode = String(req.body?.courseCode ?? "");
      const presentation = demo.discloseCourse(courseCode);
      res.json(presentation);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : "course not found" });
    }
  });

  app.post("/api/verify", async (req, res) => {
    try {
      const result = await demo.verifyPresentation(req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "invalid presentation" });
    }
  });

  app.post("/api/revoke", (_req, res) => {
    demo.revokeCredential();
    res.json({ revoked: true });
  });

  return app;
}

async function main(): Promise<void> {
  const app = createDemoApp(await createDemoState());
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Demo running at http://localhost:${port}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Fix test imports if needed**

If TypeScript rejects appended imports, rewrite `test/demo-server.test.ts` imports to top:

```ts
import { expect } from "chai";
import request from "supertest";
import { createDemoState } from "../src/demo-state";
import { createDemoApp } from "../src/demo-server";
```

Then keep both describe blocks below imports.

- [ ] **Step 5: Run API tests**

Run: `npm test -- --grep "Demo API"`

Expected: 4 passing tests.

### Task 4: Static frontend

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

- [ ] **Step 1: Create frontend HTML**

Create `public/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Academic Credential Demo</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="page">
    <header class="hero">
      <p class="eyebrow">Decentralized Academic Credential Demo</p>
      <h1>Selective transcript disclosure</h1>
      <p>University signs a diploma credential. Student reveals one course. Verifier checks signature, Merkle proof, issuer authorization, and revocation.</p>
    </header>

    <section class="grid">
      <article class="card">
        <h2>1. University Issue</h2>
        <dl id="credential-details"></dl>
      </article>

      <article class="card">
        <h2>2. Student Disclosure</h2>
        <label for="course-select">Course to reveal</label>
        <select id="course-select"></select>
        <button id="disclose-button">Generate Merkle proof</button>
        <pre id="presentation-output">No presentation yet.</pre>
      </article>

      <article class="card">
        <h2>3. Verifier</h2>
        <div class="actions">
          <button id="verify-button" disabled>Verify presentation</button>
          <button id="revoke-button">Revoke credential</button>
        </div>
        <div id="verification-result" class="result">Waiting for presentation.</div>
      </article>
    </section>
  </main>
  <script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create frontend CSS**

Create `public/styles.css`:

```css
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #eef2ff;
  color: #172033;
}

body {
  margin: 0;
}

.page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 40px 20px;
}

.hero {
  margin-bottom: 28px;
}

.eyebrow {
  color: #4f46e5;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  font-size: clamp(34px, 6vw, 64px);
  margin: 0 0 12px;
}

h2 {
  margin-top: 0;
}

.grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.card {
  background: white;
  border: 1px solid #dbe3ff;
  border-radius: 18px;
  box-shadow: 0 20px 45px rgba(79, 70, 229, 0.12);
  padding: 22px;
}

dl {
  display: grid;
  gap: 12px;
}

dt {
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}

label {
  display: block;
  font-weight: 700;
  margin-bottom: 8px;
}

select,
button {
  border-radius: 10px;
  border: 1px solid #c7d2fe;
  font: inherit;
  padding: 10px 12px;
}

select {
  width: 100%;
  margin-bottom: 12px;
}

button {
  background: #4f46e5;
  color: white;
  cursor: pointer;
  font-weight: 700;
}

button:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

pre {
  background: #0f172a;
  border-radius: 12px;
  color: #dbeafe;
  min-height: 160px;
  overflow: auto;
  padding: 14px;
  white-space: pre-wrap;
}

.result {
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 14px;
}

.result.pass {
  background: #dcfce7;
  border-color: #86efac;
}

.result.fail {
  background: #fee2e2;
  border-color: #fca5a5;
}
```

- [ ] **Step 3: Create frontend JavaScript**

Create `public/app.js`:

```js
let currentPresentation = null;

const details = document.querySelector("#credential-details");
const courseSelect = document.querySelector("#course-select");
const discloseButton = document.querySelector("#disclose-button");
const verifyButton = document.querySelector("#verify-button");
const revokeButton = document.querySelector("#revoke-button");
const presentationOutput = document.querySelector("#presentation-output");
const verificationResult = document.querySelector("#verification-result");

function short(value) {
  return `${value.slice(0, 12)}…${value.slice(-10)}`;
}

function renderDetails(state) {
  const rows = [
    ["Issuer", state.universityAddress],
    ["Credential ID", state.credential.credentialId],
    ["Degree", `${state.credential.degreeField} (${state.credential.graduationYear})`],
    ["Transcript Merkle Root", state.credential.transcriptRoot],
    ["Signature", short(state.signature)]
  ];

  details.innerHTML = rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
  courseSelect.innerHTML = state.transcript
    .map((course) => `<option value="${course.courseCode}">${course.courseCode} — ${course.courseName}</option>`)
    .join("");
}

async function loadState() {
  const response = await fetch("/api/demo-state");
  renderDetails(await response.json());
}

async function discloseCourse() {
  const response = await fetch("/api/disclose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseCode: courseSelect.value })
  });
  currentPresentation = await response.json();
  presentationOutput.textContent = JSON.stringify({
    disclosedCourse: currentPresentation.disclosedCourse,
    merkleProof: currentPresentation.merkleProof,
    hiddenTranscript: "Other courses are not sent to verifier"
  }, null, 2);
  verifyButton.disabled = false;
  verificationResult.className = "result";
  verificationResult.textContent = "Presentation ready. Click verify.";
}

async function verifyPresentation() {
  const response = await fetch("/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(currentPresentation)
  });
  const result = await response.json();
  verificationResult.className = `result ${result.valid ? "pass" : "fail"}`;
  verificationResult.innerHTML = `
    <strong>${result.valid ? "Credential valid" : "Credential rejected"}</strong>
    <ul>
      <li>Signature valid: ${result.checks.signatureValid}</li>
      <li>Issuer authorized: ${result.checks.issuerAuthorized}</li>
      <li>Not revoked: ${result.checks.notRevoked}</li>
      <li>Merkle proof valid: ${result.checks.merkleProofValid}</li>
    </ul>
  `;
}

async function revokeCredential() {
  await fetch("/api/revoke", { method: "POST" });
  verificationResult.className = "result fail";
  verificationResult.textContent = "Credential revoked. Verify again to see revocation check fail.";
}

discloseButton.addEventListener("click", discloseCourse);
verifyButton.addEventListener("click", verifyPresentation);
revokeButton.addEventListener("click", revokeCredential);
loadState().catch((error) => {
  verificationResult.className = "result fail";
  verificationResult.textContent = error.message;
});
```

### Task 5: Final verification

**Files:**
- Check all created and modified files.

- [ ] **Step 1: Run compile and tests**

Run: `npm run compile && npm test`

Expected: compile succeeds and all tests pass.

- [ ] **Step 2: Smoke start demo server**

Run: `timeout 5s npm run demo`

Expected: output includes `Demo running at http://localhost:3000`; command exits with status 124 because timeout stops long-running server.

- [ ] **Step 3: Report result**

Report changed files, test result, and start command `npm run demo`.

## Self-Review

- Spec coverage: Express API, static frontend, demo state, disclosure, verification, revocation, and API tests are covered.
- Placeholder scan: no placeholders remain.
- Type consistency: `DemoState`, `CredentialPresentation`, `VerificationResult`, API route names, and frontend DOM IDs match across tasks.
