import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
  const [owner, university] = await ethers.getSigners();

  const Registry = await ethers.getContractFactory("CredentialRegistry", owner);
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  const contractAddress = await registry.getAddress();

  await registry.setIssuer(university.address, true);

  const addressFile = path.join(__dirname, "..", ".contract-address.json");
  fs.writeFileSync(addressFile, JSON.stringify({
    contractAddress,
    universityAddress: university.address,
    ownerAddress: owner.address
  }, null, 2));

  console.log(`CredentialRegistry deployed to: ${contractAddress}`);
  console.log(`University issuer authorized: ${university.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
