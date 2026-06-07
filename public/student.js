const $ = (sel) => document.querySelector(sel);

async function loadState() {
  try {
    const res = await fetch("/api/status");
    const status = await res.json();

    if (!status.issued) {
      $("#student-status").textContent = "No credential issued yet. Waiting for University to issue.";
      return;
    }

    const stateRes = await fetch("/api/issued");
    if (!stateRes.ok) return;
    const state = await stateRes.json();

    $("#student-status").textContent = `Credential received. Issuer: ${state.credential.issuer}. Select a course to disclose.`;

    const select = $("#course-select");
    select.disabled = false;
    select.innerHTML = state.transcript
      .map((c) => `<option value="${c.courseCode}">${c.courseCode} - ${c.courseName} (${c.grade})</option>`)
      .join("");
    $("#disclose-button").disabled = false;
  } catch {
    $("#student-status").textContent = "Error: cannot connect to server.";
  }
}

// Disclose
$("#disclose-button").addEventListener("click", async () => {
  const res = await fetch("/api/disclose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courseCode: $("#course-select").value })
  });

  if (!res.ok) { alert((await res.json()).error); return; }

  const presentation = await res.json();

  const stateRes = await fetch("/api/issued");
  const issued = await stateRes.json();

  $("#presentation-output").textContent = JSON.stringify({
    disclosedCourse: presentation.disclosedCourse,
    merkleProof: presentation.merkleProof,
    hiddenCourses: issued.transcript
      .filter((c) => c.courseCode !== presentation.disclosedCourse.courseCode)
      .map((c) => c.courseCode + ": HIDDEN"),
    credential: presentation.credential,
    signature: presentation.signature
  }, null, 2);

  $("#copy-button").disabled = false;
});

// Copy
$("#copy-button").addEventListener("click", () => {
  const text = $("#presentation-output").textContent;
  navigator.clipboard.writeText(text).then(() => {
    $("#copy-button").textContent = "Copied!";
    setTimeout(() => { $("#copy-button").textContent = "Copy Presentation JSON"; }, 2000);
  });
});

// Poll for state changes
setInterval(loadState, 3000);
loadState();
