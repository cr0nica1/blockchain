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
