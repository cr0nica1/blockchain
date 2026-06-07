const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const defaultTranscript = [
  { courseCode: "CS101", courseName: "Introduction to Computer Science", grade: "A" },
  { courseCode: "MATH201", courseName: "Discrete Mathematics", grade: "B+" },
  { courseCode: "SEC301", courseName: "Applied Cryptography", grade: "A-" }
];

let transcriptRows = [...defaultTranscript];

function renderTranscriptRows(rows) {
  const container = $("#transcript-rows");
  container.innerHTML = rows
    .map((r, i) => `<div class="transcript-row">
      <input placeholder="Code" value="${r.courseCode}" data-field="courseCode" data-index="${i}">
      <input placeholder="Name" value="${r.courseName}" data-field="courseName" data-index="${i}">
      <input placeholder="Grade" value="${r.grade}" data-field="grade" data-index="${i}" style="max-width:80px">
      <button class="remove-row secondary" data-index="${i}">x</button>
    </div>`)
    .join("");
}

function syncTranscriptRows() {
  const inputs = $$("#transcript-rows input");
  inputs.forEach((input) => {
    const idx = Number(input.dataset.index);
    const field = input.dataset.field;
    if (transcriptRows[idx]) transcriptRows[idx][field] = input.value;
  });
}

$("#transcript-rows").addEventListener("input", syncTranscriptRows);
$("#transcript-rows").addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-row")) {
    syncTranscriptRows();
    transcriptRows.splice(Number(e.target.dataset.index), 1);
    renderTranscriptRows(transcriptRows);
  }
});

$("#add-row-button").addEventListener("click", () => {
  syncTranscriptRows();
  transcriptRows.push({ courseCode: "", courseName: "", grade: "" });
  renderTranscriptRows(transcriptRows);
});

renderTranscriptRows(transcriptRows);

// Load status
async function loadStatus() {
  try {
    const res = await fetch("/api/status");
    const status = await res.json();
    $("#uni-status").textContent = `Contract: ${status.contractAddress} | Issuer: ${status.universityAddress}`;
    if (status.issued) {
      const stateRes = await fetch("/api/issued");
      if (stateRes.ok) {
        const state = await stateRes.json();
        $("#issue-output").textContent = JSON.stringify(state, null, 2);
        $("#revoke-button").disabled = false;
      }
    }
  } catch {
    $("#uni-status").textContent = "Error: cannot connect to server.";
  }
}

// Issue
$("#issue-button").addEventListener("click", async () => {
  syncTranscriptRows();
  const valid = transcriptRows.filter((r) => r.courseCode && r.grade);
  if (valid.length === 0) { alert("Add at least one course."); return; }

  const res = await fetch("/api/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      degreeField: $("#degree-field").value,
      graduationYear: Number($("#grad-year").value),
      transcript: valid
    })
  });

  if (!res.ok) { alert((await res.json()).error); return; }

  const state = await res.json();
  $("#issue-output").textContent = JSON.stringify(state, null, 2);
  $("#revoke-button").disabled = false;
});

// Revoke
$("#revoke-button").addEventListener("click", async () => {
  const res = await fetch("/api/revoke", { method: "POST" });
  if (!res.ok) { alert((await res.json()).error); return; }
  const data = await res.json();
  $("#issue-output").textContent += `\n\nREVOKED on-chain!\nTx: ${data.txHash}`;
  $("#revoke-button").disabled = true;
});

loadStatus();
