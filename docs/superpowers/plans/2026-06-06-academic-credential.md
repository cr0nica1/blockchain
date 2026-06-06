# Academic Credential System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Hardhat prototype for digital diploma issuance and verification with ECC signatures, Merkle selective disclosure, issuer registry, and revocation.

**Architecture:** Solidity contract stores authorized issuers and revoked credential IDs. TypeScript helpers build transcript Merkle trees and sign credential digests. Hardhat tests prove full issue/disclose/verify/revoke flow.

**Tech Stack:** Solidity 0.8.28, Hardhat 3, TypeScript, ethers v6, Node test runner through Hardhat.

---

## File Structure

- Create `package.json` — npm scripts and dev dependencies.
- Create `tsconfig.json` — TypeScript config for Hardhat and helpers.
- Create `hardhat.config.ts` — Hardhat Solidity and test config.
- Create `contracts/CredentialRegistry.sol` — issuer authorization and revocation list.
- Create `src/merkle.ts` — transcript leaf hashing, tree building, proof generation, proof verification.
- Create `src/crypto.ts` — credential digest, signing, recovered signer, full verification helper.
- Create `test/credential.test.ts` — end-to-end behavior tests.

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `hardhat.config.ts`

- [ ] **Step 1: Create package.json**

Write `package.json`:

```json
{
  "name": "academic-credential-system",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "hardhat test",
    "compile": "hardhat compile"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-ethers": "^3.0.8",
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "@types/node": "^22.10.2",
    "hardhat": "^2.22.17",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "mocha"]
  },
  "include": ["hardhat.config.ts", "src", "test"]
}
```

- [ ] **Step 3: Create hardhat.config.ts**

Write `hardhat.config.ts`:

```ts
import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {}
  }
};

export default config;
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` created.

- [ ] **Step 5: Compile empty project**

Run: `npm run compile`

Expected: Hardhat completes with no Solidity files or no compile errors.

### Task 2: Registry contract

**Files:**
- Create: `contracts/CredentialRegistry.sol`
- Test: `test/credential.test.ts`

- [ ] **Step 1: Write failing registry tests**

Create `test/credential.test.ts`:

```ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("CredentialRegistry", function () {
  async function deployRegistry() {
    const [owner, university, attacker] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CredentialRegistry");
    const registry = await Registry.deploy();
    return { registry, owner, university, attacker };
  }

  it("lets owner authorize and remove issuers", async function () {
    const { registry, university } = await deployRegistry();

    await expect(registry.setIssuer(university.address, true))
      .to.emit(registry, "IssuerUpdated")
      .withArgs(university.address, true);

    expect(await registry.authorizedIssuers(university.address)).to.equal(true);

    await registry.setIssuer(university.address, false);

    expect(await registry.authorizedIssuers(university.address)).to.equal(false);
  });

  it("rejects issuer updates from non-owner", async function () {
    const { registry, university, attacker } = await deployRegistry();

    await expect(
      registry.connect(attacker).setIssuer(university.address, true)
    ).to.be.revertedWith("only owner");
  });

  it("lets authorized issuers revoke credentials", async function () {
    const { registry, university } = await deployRegistry();
    const credentialId = ethers.id("credential-1");

    await registry.setIssuer(university.address, true);

    await expect(registry.connect(university).revokeCredential(credentialId))
      .to.emit(registry, "CredentialRevoked")
      .withArgs(credentialId, university.address);

    expect(await registry.revokedCredentials(credentialId)).to.equal(true);
  });

  it("rejects revocation from unauthorized issuers", async function () {
    const { registry, attacker } = await deployRegistry();
    const credentialId = ethers.id("credential-1");

    await expect(
      registry.connect(attacker).revokeCredential(credentialId)
    ).to.be.revertedWith("unauthorized issuer");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --grep CredentialRegistry`

Expected: FAIL with missing artifact or missing contract factory for `CredentialRegistry`.

- [ ] **Step 3: Implement registry contract**

Create `contracts/CredentialRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CredentialRegistry {
    address public owner;
    mapping(address => bool) public authorizedIssuers;
    mapping(bytes32 => bool) public revokedCredentials;

    event IssuerUpdated(address indexed issuer, bool authorized);
    event CredentialRevoked(bytes32 indexed credentialId, address indexed issuer);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "unauthorized issuer");
        _;
    }

    function setIssuer(address issuer, bool authorized) external onlyOwner {
        authorizedIssuers[issuer] = authorized;
        emit IssuerUpdated(issuer, authorized);
    }

    function revokeCredential(bytes32 credentialId) external onlyAuthorizedIssuer {
        revokedCredentials[credentialId] = true;
        emit CredentialRevoked(credentialId, msg.sender);
    }
}
```

- [ ] **Step 4: Run registry tests**

Run: `npm test -- --grep CredentialRegistry`

Expected: 4 passing tests.

### Task 3: Merkle selective disclosure helpers

**Files:**
- Create: `src/merkle.ts`
- Modify: `test/credential.test.ts`

- [ ] **Step 1: Add failing Merkle tests**

Append to `test/credential.test.ts`:

```ts
import { buildTranscriptTree, hashCourseRecord, verifyCourseProof } from "../src/merkle";

describe("Merkle transcript disclosure", function () {
  const transcript = [
    { courseCode: "CS101", courseName: "Introduction to Computer Science", grade: "A" },
    { courseCode: "MATH201", courseName: "Discrete Mathematics", grade: "B+" },
    { courseCode: "SEC301", courseName: "Applied Cryptography", grade: "A-" }
  ];

  it("verifies a disclosed course without revealing full transcript", function () {
    const tree = buildTranscriptTree(transcript);
    const disclosedCourse = transcript[2];
    const proof = tree.getProof(2);

    expect(verifyCourseProof(disclosedCourse, proof, tree.root)).to.equal(true);
  });

  it("rejects tampered course disclosures", function () {
    const tree = buildTranscriptTree(transcript);
    const proof = tree.getProof(2);
    const tamperedCourse = { ...transcript[2], grade: "A+" };

    expect(verifyCourseProof(tamperedCourse, proof, tree.root)).to.equal(false);
  });

  it("hashes identical course records deterministically", function () {
    expect(hashCourseRecord(transcript[0])).to.equal(hashCourseRecord({ ...transcript[0] }));
  });
});
```

- [ ] **Step 2: Run Merkle tests to verify failure**

Run: `npm test -- --grep "Merkle transcript disclosure"`

Expected: FAIL because `../src/merkle` does not exist.

- [ ] **Step 3: Implement Merkle helpers**

Create `src/merkle.ts`:

```ts
import { ethers } from "ethers";

export type CourseRecord = {
  courseCode: string;
  courseName: string;
  grade: string;
};

export type MerkleProofNode = {
  sibling: string;
  position: "left" | "right";
};

export type TranscriptTree = {
  root: string;
  leaves: string[];
  getProof(index: number): MerkleProofNode[];
};

export function hashCourseRecord(course: CourseRecord): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["string", "string", "string"],
      [course.courseCode, course.courseName, course.grade]
    )
  );
}

function hashPair(left: string, right: string): string {
  return ethers.keccak256(
    ethers.concat([ethers.getBytes(left), ethers.getBytes(right)])
  );
}

function buildLevels(leaves: string[]): string[][] {
  if (leaves.length === 0) {
    throw new Error("transcript must contain at least one course");
  }

  const levels: string[][] = [leaves];
  let current = leaves;

  while (current.length > 1) {
    const next: string[] = [];

    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] ?? left;
      next.push(hashPair(left, right));
    }

    levels.push(next);
    current = next;
  }

  return levels;
}

export function buildTranscriptTree(transcript: CourseRecord[]): TranscriptTree {
  const leaves = transcript.map(hashCourseRecord);
  const levels = buildLevels(leaves);
  const root = levels[levels.length - 1][0];

  return {
    root,
    leaves,
    getProof(index: number): MerkleProofNode[] {
      if (index < 0 || index >= leaves.length) {
        throw new Error("course index out of range");
      }

      const proof: MerkleProofNode[] = [];
      let nodeIndex = index;

      for (let level = 0; level < levels.length - 1; level++) {
        const levelNodes = levels[level];
        const isRightNode = nodeIndex % 2 === 1;
        const siblingIndex = isRightNode ? nodeIndex - 1 : nodeIndex + 1;
        const sibling = levelNodes[siblingIndex] ?? levelNodes[nodeIndex];

        proof.push({
          sibling,
          position: isRightNode ? "left" : "right"
        });

        nodeIndex = Math.floor(nodeIndex / 2);
      }

      return proof;
    }
  };
}

export function verifyCourseProof(course: CourseRecord, proof: MerkleProofNode[], root: string): boolean {
  let computed = hashCourseRecord(course);

  for (const node of proof) {
    computed = node.position === "left"
      ? hashPair(node.sibling, computed)
      : hashPair(computed, node.sibling);
  }

  return computed.toLowerCase() === root.toLowerCase();
}
```

- [ ] **Step 4: Run Merkle tests**

Run: `npm test -- --grep "Merkle transcript disclosure"`

Expected: 3 passing tests.

### Task 4: Credential signature helpers

**Files:**
- Create: `src/crypto.ts`
- Modify: `test/credential.test.ts`

- [ ] **Step 1: Add failing crypto tests**

Append to `test/credential.test.ts`:

```ts
import { buildCredentialDigest, recoverCredentialSigner, verifyCredentialPresentation } from "../src/crypto";

describe("Credential cryptography", function () {
  it("recovers the issuer from a credential signature", async function () {
    const [issuer] = await ethers.getSigners();
    const credential = {
      credentialId: ethers.id("credential-crypto-1"),
      issuer: issuer.address,
      holderId: ethers.id("student-123"),
      degreeField: "Computer Science",
      graduationYear: 2026,
      transcriptRoot: ethers.id("root")
    };

    const digest = buildCredentialDigest(credential);
    const signature = await issuer.signMessage(ethers.getBytes(digest));

    expect(recoverCredentialSigner(credential, signature)).to.equal(issuer.address);
  });

  it("verifies a valid credential presentation", async function () {
    const [owner, issuer] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CredentialRegistry");
    const registry = await Registry.deploy();
    await registry.connect(owner).setIssuer(issuer.address, true);

    const transcript = [
      { courseCode: "CS101", courseName: "Introduction to Computer Science", grade: "A" },
      { courseCode: "SEC301", courseName: "Applied Cryptography", grade: "A-" }
    ];
    const tree = buildTranscriptTree(transcript);
    const credential = {
      credentialId: ethers.id("credential-valid-1"),
      issuer: issuer.address,
      holderId: ethers.id("student-123"),
      degreeField: "Computer Science",
      graduationYear: 2026,
      transcriptRoot: tree.root
    };
    const signature = await issuer.signMessage(ethers.getBytes(buildCredentialDigest(credential)));

    expect(await verifyCredentialPresentation(registry, {
      credential,
      signature,
      disclosedCourse: transcript[1],
      merkleProof: tree.getProof(1)
    })).to.equal(true);
  });
});
```

- [ ] **Step 2: Run crypto tests to verify failure**

Run: `npm test -- --grep "Credential cryptography"`

Expected: FAIL because `../src/crypto` does not exist.

- [ ] **Step 3: Implement crypto helpers**

Create `src/crypto.ts`:

```ts
import { ethers } from "ethers";
import { CourseRecord, MerkleProofNode, verifyCourseProof } from "./merkle";

export type DiplomaCredential = {
  credentialId: string;
  issuer: string;
  holderId: string;
  degreeField: string;
  graduationYear: number;
  transcriptRoot: string;
};

export type CredentialPresentation = {
  credential: DiplomaCredential;
  signature: string;
  disclosedCourse: CourseRecord;
  merkleProof: MerkleProofNode[];
};

export type CredentialRegistryLike = {
  authorizedIssuers(address: string): Promise<boolean>;
  revokedCredentials(credentialId: string): Promise<boolean>;
};

export function buildCredentialDigest(credential: DiplomaCredential): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "bytes32", "string", "uint16", "bytes32"],
      [
        credential.credentialId,
        credential.issuer,
        credential.holderId,
        credential.degreeField,
        credential.graduationYear,
        credential.transcriptRoot
      ]
    )
  );
}

export function recoverCredentialSigner(credential: DiplomaCredential, signature: string): string {
  const digest = buildCredentialDigest(credential);
  return ethers.verifyMessage(ethers.getBytes(digest), signature);
}

export async function verifyCredentialPresentation(
  registry: CredentialRegistryLike,
  presentation: CredentialPresentation
): Promise<boolean> {
  const { credential, signature, disclosedCourse, merkleProof } = presentation;
  const recoveredSigner = recoverCredentialSigner(credential, signature);

  if (recoveredSigner.toLowerCase() !== credential.issuer.toLowerCase()) {
    return false;
  }

  if (!(await registry.authorizedIssuers(credential.issuer))) {
    return false;
  }

  if (await registry.revokedCredentials(credential.credentialId)) {
    return false;
  }

  return verifyCourseProof(disclosedCourse, merkleProof, credential.transcriptRoot);
}
```

- [ ] **Step 4: Run crypto tests**

Run: `npm test -- --grep "Credential cryptography"`

Expected: 2 passing tests.

### Task 5: End-to-end negative verification cases

**Files:**
- Modify: `test/credential.test.ts`

- [ ] **Step 1: Add failing negative verification tests**

Append to `test/credential.test.ts`:

```ts
describe("End-to-end credential verification", function () {
  async function issuePresentation() {
    const [owner, issuer, unauthorizedIssuer] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CredentialRegistry");
    const registry = await Registry.deploy();
    await registry.connect(owner).setIssuer(issuer.address, true);

    const transcript = [
      { courseCode: "CS101", courseName: "Introduction to Computer Science", grade: "A" },
      { courseCode: "MATH201", courseName: "Discrete Mathematics", grade: "B+" },
      { courseCode: "SEC301", courseName: "Applied Cryptography", grade: "A-" }
    ];
    const tree = buildTranscriptTree(transcript);
    const credential = {
      credentialId: ethers.id("credential-e2e-1"),
      issuer: issuer.address,
      holderId: ethers.id("student-123"),
      degreeField: "Computer Science",
      graduationYear: 2026,
      transcriptRoot: tree.root
    };
    const signature = await issuer.signMessage(ethers.getBytes(buildCredentialDigest(credential)));

    return { registry, issuer, unauthorizedIssuer, transcript, tree, credential, signature };
  }

  it("rejects revoked credentials", async function () {
    const { registry, issuer, transcript, tree, credential, signature } = await issuePresentation();

    await registry.connect(issuer).revokeCredential(credential.credentialId);

    expect(await verifyCredentialPresentation(registry, {
      credential,
      signature,
      disclosedCourse: transcript[0],
      merkleProof: tree.getProof(0)
    })).to.equal(false);
  });

  it("rejects credentials signed by an unauthorized issuer", async function () {
    const { registry, unauthorizedIssuer, transcript, tree, credential } = await issuePresentation();
    const unauthorizedCredential = { ...credential, issuer: unauthorizedIssuer.address };
    const signature = await unauthorizedIssuer.signMessage(
      ethers.getBytes(buildCredentialDigest(unauthorizedCredential))
    );

    expect(await verifyCredentialPresentation(registry, {
      credential: unauthorizedCredential,
      signature,
      disclosedCourse: transcript[0],
      merkleProof: tree.getProof(0)
    })).to.equal(false);
  });

  it("rejects tampered signatures", async function () {
    const { registry, unauthorizedIssuer, transcript, tree, credential } = await issuePresentation();
    const signature = await unauthorizedIssuer.signMessage(
      ethers.getBytes(buildCredentialDigest(credential))
    );

    expect(await verifyCredentialPresentation(registry, {
      credential,
      signature,
      disclosedCourse: transcript[0],
      merkleProof: tree.getProof(0)
    })).to.equal(false);
  });
});
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: all tests pass once imports and helpers are correct.

- [ ] **Step 3: Fix import order if TypeScript rejects appended imports**

If TypeScript reports imports not at top-level, rewrite `test/credential.test.ts` with all imports at top:

```ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { buildCredentialDigest, recoverCredentialSigner, verifyCredentialPresentation } from "../src/crypto";
import { buildTranscriptTree, hashCourseRecord, verifyCourseProof } from "../src/merkle";
```

Then keep all describe blocks from Tasks 2-5 below imports.

- [ ] **Step 4: Run final verification**

Run: `npm test`

Expected: 12 passing tests.

### Task 6: Final cleanup

**Files:**
- Check: all created files

- [ ] **Step 1: Compile contracts**

Run: `npm run compile`

Expected: Solidity compiles successfully.

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Report result**

Report files created and final test status. Do not claim success unless `npm test` passes.

## Self-Review

- Spec coverage: contract registry, revocation, ECC signing, Merkle selective disclosure, and tests are all mapped to tasks.
- Placeholder scan: no TBD/TODO/fill-later placeholders remain.
- Type consistency: `DiplomaCredential`, `CourseRecord`, `MerkleProofNode`, `buildTranscriptTree`, `verifyCourseProof`, `buildCredentialDigest`, `recoverCredentialSigner`, and `verifyCredentialPresentation` names stay consistent across tasks.
