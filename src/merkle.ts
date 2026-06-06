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
