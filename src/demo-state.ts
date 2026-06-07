import { ethers, Contract } from "ethers";
import { buildCredentialDigest, CredentialPresentation, DiplomaCredential, recoverCredentialSigner } from "./crypto";
import { buildTranscriptTree, CourseRecord, verifyCourseProof } from "./merkle";
import * as fs from "fs";
import * as path from "path";

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

export type IssuedState = {
  credential: DiplomaCredential;
  signature: string;
  transcript: CourseRecord[];
  treeRoot: string;
};

export type StatusInfo = {
  contractAddress: string;
  universityAddress: string;
  ownerAddress: string;
  nodeUrl: string;
  issued: boolean;
};

const ABI = [
  "function authorizedIssuers(address) view returns (bool)",
  "function revokedCredentials(bytes32) view returns (bool)",
  "function setIssuer(address, bool)",
  "function revokeCredential(bytes32)",
  "function owner() view returns (address)"
];

const HARDHAT_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
];

export class AppService {
  private provider: ethers.JsonRpcProvider;
  private ownerWallet: ethers.Wallet;
  private universityWallet: ethers.Wallet;
  private studentWallet: ethers.Wallet;
  private contract: Contract;
  private issuedState: IssuedState | null = null;
  private nodeUrl: string;

  constructor(nodeUrl: string, contractAddress: string) {
    this.nodeUrl = nodeUrl;
    this.provider = new ethers.JsonRpcProvider(nodeUrl);
    this.ownerWallet = new ethers.Wallet(HARDHAT_PRIVATE_KEYS[0], this.provider);
    this.universityWallet = new ethers.Wallet(HARDHAT_PRIVATE_KEYS[1], this.provider);
    this.studentWallet = new ethers.Wallet(HARDHAT_PRIVATE_KEYS[2], this.provider);
    this.contract = new ethers.Contract(contractAddress, ABI, this.ownerWallet);
  }

  static async create(nodeUrl?: string): Promise<AppService> {
    const url = nodeUrl ?? "http://127.0.0.1:8545";
    const addressFile = path.join(__dirname, "..", ".contract-address.json");

    if (!fs.existsSync(addressFile)) {
      throw new Error("Contract not deployed. Run: npm run deploy");
    }

    const { contractAddress } = JSON.parse(fs.readFileSync(addressFile, "utf8"));
    const service = new AppService(url, contractAddress);

    await service.provider.getBlockNumber();
    return service;
  }

  getStatus(): StatusInfo {
    const addressFile = path.join(__dirname, "..", ".contract-address.json");
    const { contractAddress, universityAddress, ownerAddress } = JSON.parse(fs.readFileSync(addressFile, "utf8"));

    return {
      contractAddress,
      universityAddress,
      ownerAddress,
      nodeUrl: this.nodeUrl,
      issued: this.issuedState !== null
    };
  }

  async issue(degreeField: string, graduationYear: number, transcript: CourseRecord[]): Promise<IssuedState> {
    const tree = buildTranscriptTree(transcript);
    const holderId = ethers.id("student-" + this.studentWallet.address);
    const credential: DiplomaCredential = {
      credentialId: ethers.id("credential-" + Date.now()),
      issuer: this.universityWallet.address,
      holderId,
      degreeField,
      graduationYear,
      transcriptRoot: tree.root
    };

    const digest = buildCredentialDigest(credential);
    const signature = await this.universityWallet.signMessage(ethers.getBytes(digest));

    this.issuedState = { credential, signature, transcript, treeRoot: tree.root };
    return this.issuedState;
  }

  discloseCourse(courseCode: string): CredentialPresentation {
    if (!this.issuedState) {
      throw new Error("no credential issued yet");
    }

    const { credential, signature, transcript } = this.issuedState;
    const tree = buildTranscriptTree(transcript);
    const index = transcript.findIndex((c) => c.courseCode === courseCode);

    if (index === -1) {
      throw new Error("course not found");
    }

    return {
      credential,
      signature,
      disclosedCourse: transcript[index],
      merkleProof: tree.getProof(index)
    };
  }

  async verifyPresentation(presentation: CredentialPresentation): Promise<VerificationResult> {
    const recoveredSigner = recoverCredentialSigner(presentation.credential, presentation.signature);
    const signatureValid = recoveredSigner.toLowerCase() === presentation.credential.issuer.toLowerCase();

    const issuerAuthorized = await (this.contract as any).authorizedIssuers(presentation.credential.issuer) as boolean;
    const revoked = await (this.contract as any).revokedCredentials(presentation.credential.credentialId) as boolean;
    const notRevoked = !revoked;

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
  }

  async revokeCredential(): Promise<string> {
    if (!this.issuedState) {
      throw new Error("no credential issued yet");
    }

    const universityContract = this.contract.connect(this.universityWallet) as Contract;
    const tx = await (universityContract as any).revokeCredential(this.issuedState.credential.credentialId);
    await tx.wait();
    return tx.hash;
  }

  reset(): void {
    this.issuedState = null;
  }

  getIssuedState(): IssuedState | null {
    return this.issuedState;
  }
}
