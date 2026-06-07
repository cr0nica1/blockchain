const $ = (sel) => document.querySelector(sel);

$("#verify-button").addEventListener("click", async () => {
  const raw = $("#presentation-input").value.trim();
  if (!raw) { alert("Paste presentation JSON first."); return; }

  let presentation;
  try {
    presentation = JSON.parse(raw);
  } catch {
    alert("Invalid JSON. Paste the presentation from Student page.");
    return;
  }

  const res = await fetch("/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(presentation)
  });

  if (!res.ok) {
    const err = await res.json();
    $("#verification-result").className = "result fail";
    $("#verification-result").innerHTML = `<strong>Error</strong><p>${err.error}</p>`;
    return;
  }

  const result = await res.json();
  const checks = result.checks;

  $("#verification-result").className = `result ${result.valid ? "pass" : "fail"}`;
  $("#verification-result").innerHTML = `
    <strong>${result.valid ? "Credential VALID" : "Credential REJECTED"}</strong>
    <ul>
      <li>Signature valid (ECC): ${checks.signatureValid ? "PASS" : "FAIL"}</li>
      <li>Issuer authorized (on-chain): ${checks.issuerAuthorized ? "PASS" : "FAIL"}</li>
      <li>Not revoked (on-chain): ${checks.notRevoked ? "PASS" : "FAIL"}</li>
      <li>Merkle proof valid: ${checks.merkleProofValid ? "PASS" : "FAIL"}</li>
    </ul>
  `;
});
