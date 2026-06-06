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
