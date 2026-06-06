import { expect } from "chai";
import { ethers } from "hardhat";
import { buildCredentialDigest, recoverCredentialSigner, verifyCredentialPresentation } from "../src/crypto";
import { buildTranscriptTree, hashCourseRecord, verifyCourseProof } from "../src/merkle";

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
