const { analyzeCollection, summarizeMethods } = globalThis.PaintasterAnalyzer;

const state = {
  report: null,
  filter: "all",
};

const elements = {
  collectionInput: document.querySelector("#collectionInput"),
  loadSampleButton: document.querySelector("#loadSampleButton"),
  copyReportButton: document.querySelector("#copyReportButton"),
  endpointCount: document.querySelector("#endpointCount"),
  findingCount: document.querySelector("#findingCount"),
  chainCount: document.querySelector("#chainCount"),
  riskScore: document.querySelector("#riskScore"),
  collectionType: document.querySelector("#collectionType"),
  runState: document.querySelector("#runState"),
  emptyState: document.querySelector("#emptyState"),
  collectionSummary: document.querySelector("#collectionSummary"),
  agentBoard: document.querySelector("#agentBoard"),
  findingsList: document.querySelector("#findingsList"),
  chainList: document.querySelector("#chainList"),
  endpointTable: document.querySelector("#endpointTable"),
  surfaceLabel: document.querySelector("#surfaceLabel"),
  filterButtons: [...document.querySelectorAll("[data-filter]")],
};

const defaultAgents = [
  ["Recon Agent", "Waiting for collection surface."],
  ["Auth Agent", "Waiting for identity boundaries."],
  ["Input Agent", "Waiting for parameters and bodies."],
  ["State Agent", "Waiting for write operations."],
  ["Chain Planner", "Waiting for validation paths."],
];

renderEmpty();

elements.collectionInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const text = await file.text();
  analyzeJsonText(text);
});

elements.loadSampleButton.addEventListener("click", async () => {
  try {
    setRunning(true);
    analyzeCollectionObject(globalThis.PaintasterSampleCollection);
  } catch (error) {
    renderError(error);
  } finally {
    setRunning(false);
  }
});

elements.copyReportButton.addEventListener("click", async () => {
  if (!state.report) {
    return;
  }
  await navigator.clipboard.writeText(JSON.stringify(state.report, null, 2));
  elements.copyReportButton.textContent = "Copied";
  window.setTimeout(() => {
    elements.copyReportButton.textContent = "Copy";
  }, 1200);
});

elements.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    elements.filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderFindings();
  });
});

function analyzeJsonText(text) {
  try {
    setRunning(true);
    const parsed = JSON.parse(text);
    analyzeCollectionObject(parsed);
  } catch (error) {
    renderError(error);
  } finally {
    setRunning(false);
  }
}

function analyzeCollectionObject(collection) {
  state.report = analyzeCollection(JSON.parse(JSON.stringify(collection)));
  renderReport();
}

function setRunning(isRunning) {
  elements.runState.textContent = isRunning ? "Running" : state.report ? "Complete" : "Idle";
  elements.runState.className = isRunning ? "pill warning" : "pill neutral";
}

function renderEmpty() {
  elements.agentBoard.innerHTML = defaultAgents
    .map(([name, body]) => {
      return `
        <article class="agent-card">
          <span class="agent-name">${escapeHtml(name)}</span>
          <span class="pill neutral agent-status">Queued</span>
          <p>${escapeHtml(body)}</p>
        </article>
      `;
    })
    .join("");
  elements.findingsList.innerHTML = emptyMessage("No findings yet.");
  elements.chainList.innerHTML = emptyMessage("No chains yet.");
  elements.endpointTable.innerHTML = tableEmptyRow("Import a collection to map the API surface.");
}

function renderReport() {
  const report = state.report;
  const methods = summarizeMethods(report.endpoints);
  elements.endpointCount.textContent = report.endpoints.length;
  elements.findingCount.textContent = report.findings.length;
  elements.chainCount.textContent = report.chains.length;
  elements.riskScore.textContent = report.riskScore;
  elements.collectionType.textContent = report.collection.type;
  elements.collectionType.className = "pill neutral";
  elements.surfaceLabel.textContent = `${Object.keys(methods).length} methods`;
  elements.copyReportButton.disabled = false;
  elements.emptyState.classList.add("hidden");
  elements.collectionSummary.classList.remove("hidden");
  elements.collectionSummary.innerHTML = renderSummary(report, methods);
  renderAgents();
  renderFindings();
  renderChains();
  renderEndpoints();
}

function renderSummary(report, methods) {
  const methodSummary = Object.entries(methods)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([method, count]) => `${method}:${count}`)
    .join(" ");

  return [
    ["Name", report.collection.name],
    ["Type", report.collection.type],
    ["Version", report.collection.version || "n/a"],
    ["Methods", methodSummary || "n/a"],
    ["Generated", new Date(report.generatedAt).toLocaleString()],
  ]
    .map(([label, value]) => {
      return `
        <div class="summary-row">
          <span>${escapeHtml(label)}</span>
          <span>${escapeHtml(String(value))}</span>
        </div>
      `;
    })
    .join("");
}

function renderAgents() {
  elements.agentBoard.innerHTML = state.report.agents
    .map((agent) => {
      const statusClass = agent.findings.length ? "warning" : "neutral";
      return `
        <article class="agent-card">
          <span class="agent-name">${escapeHtml(agent.name)}</span>
          <span class="pill ${statusClass} agent-status">${escapeHtml(agent.status)}</span>
          <p>${escapeHtml(agent.role)}</p>
        </article>
      `;
    })
    .join("");
}

function renderFindings() {
  if (!state.report) {
    return;
  }

  const findings = state.filter === "all"
    ? state.report.findings
    : state.report.findings.filter((finding) => finding.severity === state.filter);

  if (!findings.length) {
    elements.findingsList.innerHTML = emptyMessage("No matching findings.");
    return;
  }

  elements.findingsList.innerHTML = findings.map(renderFinding).join("");
}

function renderFinding(finding) {
  return `
    <article class="finding">
      <div class="finding-head">
        <h3 class="finding-title">${escapeHtml(finding.title)}</h3>
        <span class="severity-pill severity-${escapeHtml(finding.severity)}">${escapeHtml(finding.severity)}</span>
      </div>
      <div class="finding-meta">
        <span class="pill neutral">${escapeHtml(finding.agent)}</span>
      </div>
      <p>${escapeHtml(finding.summary)}</p>
      <ol class="evidence-list">
        ${finding.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ol>
      <p><strong>Validation:</strong> ${escapeHtml(finding.validation)}</p>
      <p><strong>Fix:</strong> ${escapeHtml(finding.recommendation)}</p>
    </article>
  `;
}

function renderChains() {
  const chains = state.report.chains;
  if (!chains.length) {
    elements.chainList.innerHTML = emptyMessage("No chain plan generated.");
    return;
  }

  elements.chainList.innerHTML = chains
    .map((chain) => {
      return `
        <article class="chain">
          <div class="chain-head">
            <h3 class="chain-title">${escapeHtml(chain.title)}</h3>
            <span class="severity-pill severity-${escapeHtml(chain.severity)}">${escapeHtml(chain.severity)}</span>
          </div>
          <p>${escapeHtml(chain.summary)}</p>
          <ol class="chain-steps">
            ${chain.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
          </ol>
          <div class="finding-meta">
            ${chain.approvals.map((approval) => `<span class="pill warning">${escapeHtml(approval)}</span>`).join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderEndpoints() {
  if (!state.report.endpoints.length) {
    elements.endpointTable.innerHTML = tableEmptyRow("No endpoints found.");
    return;
  }

  elements.endpointTable.innerHTML = state.report.endpoints
    .map((endpoint) => {
      const signalHtml = endpoint.signals.length
        ? endpoint.signals.map((signal) => `<span class="pill neutral">${escapeHtml(signal)}</span>`).join("")
        : `<span class="pill neutral">none</span>`;
      return `
        <tr>
          <td><span class="method-pill method-${escapeHtml(endpoint.method.toLowerCase())}">${escapeHtml(endpoint.method)}</span></td>
          <td class="path-cell">${escapeHtml(endpoint.path)}</td>
          <td>${escapeHtml(endpoint.auth || "unspecified")}</td>
          <td><div class="signal-list">${signalHtml}</div></td>
        </tr>
      `;
    })
    .join("");
}

function renderError(error) {
  state.report = null;
  elements.endpointCount.textContent = "0";
  elements.findingCount.textContent = "0";
  elements.chainCount.textContent = "0";
  elements.riskScore.textContent = "0";
  elements.copyReportButton.disabled = true;
  elements.collectionType.textContent = "Error";
  elements.collectionType.className = "pill warning";
  elements.collectionSummary.classList.add("hidden");
  elements.emptyState.classList.remove("hidden");
  elements.emptyState.innerHTML = `
    <strong>Could not analyze this file.</strong>
    <span>${escapeHtml(error.message)}</span>
  `;
  renderEmpty();
}

function emptyMessage(message) {
  return `<div class="empty-state"><strong>${escapeHtml(message)}</strong></div>`;
}

function tableEmptyRow(message) {
  return `<tr><td colspan="4">${escapeHtml(message)}</td></tr>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
