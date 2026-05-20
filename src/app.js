const { analyzeCollection } = globalThis.PaintasterAnalyzer;

const progressSteps = [
  { percent: 18, label: "Reading Postman collection" },
  { percent: 42, label: "Recon Agent is parsing folders and requests" },
  { percent: 68, label: "Mapping endpoints and HTTP methods" },
  { percent: 88, label: "Identifying authorization mechanisms" },
  { percent: 100, label: "Recon complete" },
];

const elements = {
  collectionInput: document.querySelector("#collectionInput"),
  fileLabel: document.querySelector("#fileLabel"),
  progressPanel: document.querySelector("#progressPanel"),
  progressLabel: document.querySelector("#progressLabel"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  resultsPanel: document.querySelector("#resultsPanel"),
  collectionName: document.querySelector("#collectionName"),
  collectionMeta: document.querySelector("#collectionMeta"),
  endpointCount: document.querySelector("#endpointCount"),
  endpointTable: document.querySelector("#endpointTable"),
  errorPanel: document.querySelector("#errorPanel"),
  errorMessage: document.querySelector("#errorMessage"),
};

elements.collectionInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  resetView(file.name);

  try {
    const text = await file.text();
    const collection = JSON.parse(text);
    const report = analyzeCollection(collection);
    await runReconProgress();
    renderEndpoints(report);
  } catch (error) {
    showError(error);
  }
});

function resetView(fileName) {
  elements.fileLabel.textContent = fileName;
  elements.resultsPanel.classList.add("hidden");
  elements.errorPanel.classList.add("hidden");
  elements.progressPanel.classList.remove("hidden");
  setProgress(0, "Starting Recon Agent");
}

async function runReconProgress() {
  for (const step of progressSteps) {
    await wait(260);
    setProgress(step.percent, step.label);
  }
}

function setProgress(percent, label) {
  elements.progressBar.style.width = `${percent}%`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressLabel.textContent = label;
}

function renderEndpoints(report) {
  const endpoints = report.endpoints;
  elements.collectionName.textContent = report.collection.name || "API Surface";
  elements.collectionMeta.textContent = `${report.collection.type} collection analyzed by Recon Agent`;
  elements.endpointCount.textContent = `${endpoints.length} ${endpoints.length === 1 ? "endpoint" : "endpoints"}`;
  elements.endpointTable.innerHTML = endpoints.length
    ? endpoints.map(renderEndpointRow).join("")
    : `<tr><td colspan="3">No endpoints found in this collection.</td></tr>`;
  elements.resultsPanel.classList.remove("hidden");
}

function renderEndpointRow(endpoint) {
  return `
    <tr>
      <td><span class="method-pill method-${escapeHtml(endpoint.method.toLowerCase())}">${escapeHtml(endpoint.method)}</span></td>
      <td class="path-cell">${escapeHtml(endpoint.path)}</td>
      <td class="auth-cell">${escapeHtml(formatAuth(endpoint))}</td>
    </tr>
  `;
}

function formatAuth(endpoint) {
  const auth = String(endpoint.auth || "").toLowerCase();
  const headers = endpoint.headers.map((header) => header.toLowerCase());

  if (["none", "noauth", "no auth"].includes(auth)) {
    return "No auth";
  }

  if (auth === "bearer" || headers.includes("authorization")) {
    return "Bearer token";
  }

  if (auth === "basic") {
    return "Basic auth";
  }

  if (auth === "apikey" || auth === "api key" || headers.includes("x-api-key")) {
    return "API key";
  }

  if (auth === "oauth1" || auth === "oauth2") {
    return auth.toUpperCase();
  }

  if (auth === "declared") {
    return "Declared in spec";
  }

  if (auth === "unspecified" || !auth) {
    return "Unspecified";
  }

  return titleCase(auth);
}

function showError(error) {
  elements.progressPanel.classList.add("hidden");
  elements.resultsPanel.classList.add("hidden");
  elements.errorMessage.textContent = error.message;
  elements.errorPanel.classList.remove("hidden");
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
