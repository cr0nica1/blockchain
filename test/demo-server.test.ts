import { expect } from "chai";
import { ethers } from "hardhat";
import { buildCredentialDigest, recoverCredentialSigner } from "../src/crypto";
import { buildTranscriptTree, verifyCourseProof } from "../src/merkle";

describe("Demo state and API (unit)", function () {
  const transcript = [
    { courseCode: "CS101", courseName: "Introduction to Computer Science", grade: "A" },
    { courseCode: "MATH201", courseName: "Discrete Mathematics", grade: "B+" },
    { courseCode: "SEC301", courseName: "Applied Cryptography", grade: "A-" }
  ];

  it("builds Merkle tree and verifies proof for a course", function () {
    const tree = buildTranscriptTree(transcript);
    const proof = tree.getProof(2);

    expect(verifyCourseProof(transcript[2], proof, tree.root)).to.equal(true);
    expect(verifyCourseProof({ ...transcript[2], grade: "F" }, proof, tree.root)).to.equal(false);
  });

  it("signs and recovers credential issuer", async function () {
    const [issuer] = await ethers.getSigners();
    const tree = buildTranscriptTree(transcript);
    const credential = {
      credentialId: ethers.id("credential-test-1"),
      issuer: issuer.address,
      holderId: ethers.id("student-test"),
      degreeField: "Computer Science",
      graduationYear: 2026,
      transcriptRoot: tree.root
    };

    const digest = buildCredentialDigest(credential);
    const signature = await issuer.signMessage(ethers.getBytes(digest));
    const recovered = recoverCredentialSigner(credential, signature);

    expect(recovered).to.equal(issuer.address);
  });
});
