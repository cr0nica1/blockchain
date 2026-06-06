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
