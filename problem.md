# Block chain & application 
## Problem: Decentralized Academic Credential System with selective disclosure
### Objective
Develop a system for issuing and verifying digital diplomas. A student (Holder) can prove they graduated in a specific field without revealing rheir entire transcript or unnecessary personal data.
### Techincal Requirements:
- Cryptography: use Eliptic Curve Cryptography to sign credentials  issued by the university.
- Selective Disclosure: Implement a Merkle Tree structure. Each course/grade is a leaf node. The student provides Merkle Proofs only for specific requested course without revealing the rest of the transcript.
- On-chain Registry: Deploy a smart contract to maintain a registry of authorized issuers (universities) and a Revocation List for invalid credentials
