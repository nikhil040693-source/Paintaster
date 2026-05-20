(() => {
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_TERMS = ["admin", "password", "token", "secret", "key", "payment", "billing", "invoice", "role", "permission", "user", "account", "session", "reset"];
const ID_TERMS = ["id", "uuid", "userId", "accountId", "orderId", "tenantId", "orgId", "teamId"];
const URL_TERMS = ["url", "uri", "callback", "webhook", "redirect", "avatar", "imageUrl", "target"];
const FILE_TERMS = ["file", "upload", "attachment", "document", "image", "photo", "csv"];
const ROLE_TERMS = ["role", "isAdmin", "admin", "permission", "scope", "status", "plan"];

function analyzeCollection(rawCollection) {
  const normalized = normalizeCollection(rawCollection);
  const agents = [
    runReconAgent(normalized.endpoints),
    runAuthAgent(normalized.endpoints),
    runInputAgent(normalized.endpoints),
    runStateAgent(normalized.endpoints),
    runChainAgent(normalized.endpoints),
  ];
  const findings = dedupeFindings(agents.flatMap((agent) => agent.findings));
  const chains = buildChains(normalized.endpoints, findings);
  const riskScore = calculateRiskScore(findings, chains);
  return {
    generatedAt: new Date().toISOString(),
    collection: normalized.meta,
    endpoints: normalized.endpoints,
    agents,
    findings,
    chains,
    riskScore,
  };
}

function normalizeCollection(rawCollection) {
  if (!rawCollection || typeof rawCollection !== "object") {
    throw new Error("Collection JSON must be an object.");
  }
  if (rawCollection.info && Array.isArray(rawCollection.item)) {
    return normalizePostman(rawCollection);
  }
  if (typeof rawCollection.openapi === "string" && rawCollection.paths) {
    return normalizeOpenApi(rawCollection);
  }
  throw new Error("Unsupported file. Import Postman Collection v2.x or OpenAPI 3.x JSON.");
}

function normalizePostman(collection) {
  const endpoints = [];
  const stack = collection.item.map((item) => ({ item, folders: [] }));
  while (stack.length) {
    const { item, folders } = stack.shift();
    if (Array.isArray(item.item)) {
      item.item.forEach((child) => stack.push({ item: child, folders: folders.concat(item.name || "Folder") }));
      continue;
    }
    if (!item.request) continue;
    const request = item.request;
    const urlInfo = parsePostmanUrl(request.url);
    const method = String(request.method || "GET").toUpperCase();
    endpoints.push(createEndpoint({
      id: stableId([method, urlInfo.path, item.name]),
      name: item.name || `${method} ${urlInfo.path}`,
      method,
      path: urlInfo.path,
      rawUrl: urlInfo.raw,
      folders,
      auth: readAuthType(request.auth) || readAuthType(collection.auth),
      headers: normalizeHeaders(request.header),
      queryParams: urlInfo.queryKeys,
      bodyFields: extractPostmanBodyKeys(request.body),
      source: "postman",
      description: readDescription(item.description || request.description),
    }));
  }
  return {
    meta: {
      type: "Postman",
      name: collection.info?.name || "Untitled Postman Collection",
      version: collection.info?.version || "",
      endpointCount: endpoints.length,
    },
    endpoints,
  };
}

function normalizeOpenApi(spec) {
  const endpoints = [];
  const serverUrl = Array.isArray(spec.servers) && spec.servers[0]?.url ? spec.servers[0].url : "";
  Object.entries(spec.paths || {}).forEach(([path, pathItem]) => {
    if (!pathItem || typeof pathItem !== "object") return;
    Object.entries(pathItem).forEach(([methodKey, operation]) => {
      const method = methodKey.toUpperCase();
      if (!HTTP_METHODS.has(method)) return;
      const parameters = [].concat(pathItem.parameters || [], operation.parameters || []);
      const security = operation.security ?? pathItem.security ?? spec.security;
      const auth = Array.isArray(security) && security.length === 0 ? "none" : security ? "declared" : "unspecified";
      endpoints.push(createEndpoint({
        id: stableId([method, path, operation.operationId]),
        name: operation.summary || operation.operationId || `${method} ${path}`,
        method,
        path,
        rawUrl: `${serverUrl}${path}`,
        folders: Array.isArray(operation.tags) ? operation.tags : [],
        auth,
        headers: parameters.filter((param) => param.in === "header").map((param) => param.name).filter(Boolean),
        queryParams: parameters.filter((param) => param.in === "query").map((param) => param.name).filter(Boolean),
        bodyFields: extractOpenApiBodyFields(operation.requestBody),
        source: "openapi",
        description: readDescription(operation.description || operation.summary),
      }));
    });
  });
  return {
    meta: {
      type: "OpenAPI",
      name: spec.info?.title || "Untitled OpenAPI Spec",
      version: spec.info?.version || "",
      endpointCount: endpoints.length,
    },
    endpoints,
  };
}

function createEndpoint(endpoint) {
  const auth = endpoint.auth || inferAuth(endpoint.headers);
  const endpointWithPath = {
    ...endpoint,
    method: endpoint.method.toUpperCase(),
    auth,
    pathParts: tokenizePath(endpoint.path),
  };
  return {
    ...endpointWithPath,
    signals: inferSignals(endpointWithPath),
  };
}

function runReconAgent(endpoints) {
  const sensitive = endpoints.filter((endpoint) => endpoint.signals.includes("sensitive"));
  const unauthenticated = endpoints.filter((endpoint) => isNoAuth(endpoint.auth));
  const findings = [];
  if (sensitive.length) {
    findings.push(finding("recon-sensitive-surface", sensitive.some(isWrite) ? "high" : "medium", "Recon Agent", "Sensitive API surface discovered", `${sensitive.length} endpoint(s) reference sensitive resources such as users, admin, billing, tokens, or permissions.`, sensitive, "Confirm these endpoints are in scope, require authentication, and have audit logging before active testing.", "Review route ownership and use only test tenant data when validating access controls."));
  }
  if (unauthenticated.length) {
    findings.push(finding("recon-unauthenticated-routes", unauthenticated.some(isWrite) ? "high" : "medium", "Recon Agent", "Unauthenticated route candidates", `${unauthenticated.length} endpoint(s) appear to have no collection-level or operation-level authentication metadata.`, unauthenticated, "Verify whether these routes are intentionally public and document the expected access model.", "Send a single read-only request in a lab without credentials and confirm the expected status code."));
  }
  return { name: "Recon Agent", role: "Maps API surface and highlights sensitive resources.", status: findings.length ? "Signals Found" : "Clean Pass", findings };
}

function runAuthAgent(endpoints) {
  const idRoutes = endpoints.filter(hasIdSignal);
  const weakIdRoutes = idRoutes.filter((endpoint) => isNoAuth(endpoint.auth) || endpoint.auth === "unspecified");
  const privilegeRoutes = endpoints.filter((endpoint) => hasAnyTerm(endpoint.bodyFields, ROLE_TERMS) || hasPathTerm(endpoint, ROLE_TERMS));
  const findings = [];
  if (weakIdRoutes.length) {
    findings.push(finding("auth-bola-candidates", weakIdRoutes.some(isWrite) ? "critical" : "high", "Auth Agent", "BOLA or IDOR validation candidates", `${weakIdRoutes.length} route(s) use object identifiers with missing or unclear authorization metadata.`, weakIdRoutes, "Require object-level authorization checks using the caller identity and tenant boundary.", "In a controlled tenant, compare access using two owned test accounts and only swap object IDs created for the test."));
  }
  if (privilegeRoutes.length) {
    findings.push(finding("auth-privilege-fields", "high", "Auth Agent", "Privilege-bearing fields exposed", `${privilegeRoutes.length} endpoint(s) expose fields or paths related to roles, permissions, admin state, or account status.`, privilegeRoutes, "Deny client-controlled privilege changes unless a specific privileged workflow requires them.", "Use a benign test account and confirm unauthorized privilege-field changes are rejected and logged."));
  }
  return { name: "Auth Agent", role: "Looks for authorization gaps, identity boundaries, and privilege controls.", status: findings.length ? "Needs Review" : "No Major Signals", findings };
}

function runInputAgent(endpoints) {
  const urlInputs = endpoints.filter((endpoint) => hasAnyTerm(endpoint.queryParams.concat(endpoint.bodyFields), URL_TERMS));
  const fileInputs = endpoints.filter((endpoint) => hasAnyTerm(endpoint.pathParts.concat(endpoint.bodyFields), FILE_TERMS));
  const broadBodies = endpoints.filter((endpoint) => BODY_METHODS.has(endpoint.method) && endpoint.bodyFields.length >= 8);
  const findings = [];
  if (urlInputs.length) {
    findings.push(finding("input-ssrf-redirect-candidates", "high", "Input Agent", "URL-bearing input fields", `${urlInputs.length} endpoint(s) accept URL-like fields that often need SSRF, redirect, and callback validation.`, urlInputs, "Allowlist expected schemes and destinations, block internal networks, and resolve redirects safely.", "Use a controlled callback URL in a lab and confirm the service does not reach disallowed destinations.", formatEndpointWithInputs));
  }
  if (fileInputs.length) {
    findings.push(finding("input-file-upload-candidates", "medium", "Input Agent", "File or media handling routes", `${fileInputs.length} endpoint(s) appear to process file-like inputs.`, fileInputs, "Validate content type, file size, storage location, malware scanning, and post-upload access controls.", "Upload a harmless text fixture in a lab and confirm storage permissions, metadata handling, and retrieval rules.", formatEndpointWithInputs));
  }
  if (broadBodies.length) {
    findings.push(finding("input-mass-assignment-candidates", "medium", "Input Agent", "Large mutable request bodies", `${broadBodies.length} write endpoint(s) accept broad request bodies that may hide mass-assignment risk.`, broadBodies, "Use server-side DTO allowlists and ignore client-provided fields outside the intended contract.", "Add a harmless unexpected field to a lab request and confirm it is rejected or ignored.", formatEndpointWithInputs));
  }
  return { name: "Input Agent", role: "Flags risky input classes and validation boundaries.", status: findings.length ? "Input Risks" : "No Major Signals", findings };
}

function runStateAgent(endpoints) {
  const destructive = endpoints.filter((endpoint) => endpoint.method === "DELETE");
  const unsafeNoAuth = endpoints.filter((endpoint) => isWrite(endpoint) && isNoAuth(endpoint.auth));
  const findings = [];
  if (unsafeNoAuth.length) {
    findings.push(finding("state-unsafe-noauth", "critical", "State Agent", "State-changing routes without declared auth", `${unsafeNoAuth.length} write route(s) appear to change state without declared authentication.`, unsafeNoAuth, "Require authentication, CSRF protections where browser credentials are used, and audit records.", "Use dry-run or fixture data only; confirm unauthenticated writes are rejected before testing deeper flows."));
  }
  if (destructive.length) {
    findings.push(finding("state-delete-review", destructive.some((endpoint) => isNoAuth(endpoint.auth)) ? "critical" : "medium", "State Agent", "Destructive operation review", `${destructive.length} DELETE endpoint(s) should be tested only with disposable data and rollback coverage.`, destructive, "Confirm soft-delete behavior, ownership checks, idempotency, and recovery workflows.", "Create disposable lab records, delete only those records, and verify cross-account deletion fails."));
  }
  return { name: "State Agent", role: "Reviews write paths, destructive operations, and workflow guardrails.", status: findings.length ? "Guardrails Needed" : "Stable", findings };
}

function runChainAgent(endpoints) {
  const publicAuth = endpoints.filter((endpoint) => isNoAuth(endpoint.auth) && /login|signup|register|reset|session|token/i.test(endpoint.path));
  const listRoutes = endpoints.filter((endpoint) => endpoint.method === "GET" && !hasPathParam(endpoint.path));
  const objectRoutes = endpoints.filter(hasIdSignal);
  const writeRoutes = endpoints.filter(isWrite);
  const findings = [];
  if (publicAuth.length && objectRoutes.length && writeRoutes.length) {
    findings.push({
      id: "chain-account-to-object-write",
      severity: "high",
      agent: "Chain Planner",
      title: "Account flow can chain into object-level write checks",
      summary: "Collection shape suggests a test sequence from account/session flow to object enumeration and write authorization.",
      evidence: [`Entry: ${formatEndpoint(publicAuth[0])}`, `Object route: ${formatEndpoint(objectRoutes[0])}`, `Write route: ${formatEndpoint(writeRoutes[0])}`],
      recommendation: "Run this chain only with two owned lab accounts and disposable records.",
      validation: "Confirm every step enforces the intended user and tenant boundary before moving to the next step.",
      endpointIds: [publicAuth[0].id, objectRoutes[0].id, writeRoutes[0].id],
    });
  }
  if (listRoutes.length && objectRoutes.length) {
    findings.push({
      id: "chain-list-to-object-access",
      severity: "medium",
      agent: "Chain Planner",
      title: "List-to-object authorization path",
      summary: "A list endpoint and object endpoint can form a safe BOLA validation workflow.",
      evidence: [`List: ${formatEndpoint(listRoutes[0])}`, `Object: ${formatEndpoint(objectRoutes[0])}`],
      recommendation: "Confirm object identifiers disclosed by list routes are scoped to the caller.",
      validation: "Use owned fixtures from two test accounts; never test with real customer records.",
      endpointIds: [listRoutes[0].id, objectRoutes[0].id],
    });
  }
  return { name: "Chain Planner", role: "Connects findings into authorized multi-step validation plans.", status: findings.length ? "Chains Drafted" : "No Chain Yet", findings };
}

function buildChains(endpoints, findings) {
  const byId = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));
  return findings
    .filter((finding) => finding.agent === "Chain Planner")
    .map((finding, index) => {
      const chainEndpoints = finding.endpointIds.map((id) => byId.get(id)).filter(Boolean);
      const steps = chainEndpoints.map((endpoint, stepIndex) => {
        const prefix = stepIndex === 0 ? "Prepare" : stepIndex === chainEndpoints.length - 1 ? "Validate" : "Compare";
        return `${prefix}: ${formatEndpoint(endpoint)} using authorized lab data only.`;
      });
      return {
        id: `chain-${index + 1}`,
        title: finding.title,
        severity: finding.severity,
        summary: finding.summary,
        steps: steps.concat("Stop if any request leaves the approved target scope or touches non-test data."),
        approvals: ["Written scope", "Target allowlist", "Disposable fixtures", "Human approval"],
        endpointIds: finding.endpointIds,
      };
    });
}

function finding(id, severity, agent, title, summary, endpoints, recommendation, validation, formatter = formatEndpoint) {
  return {
    id,
    severity,
    agent,
    title,
    summary,
    evidence: endpoints.slice(0, 6).map(formatter),
    recommendation,
    validation,
    endpointIds: endpoints.map((endpoint) => endpoint.id),
  };
}

function inferSignals(endpoint) {
  const signals = [];
  if (hasPathTerm(endpoint, SENSITIVE_TERMS) || hasAnyTerm(endpoint.bodyFields, SENSITIVE_TERMS)) signals.push("sensitive");
  if (isNoAuth(endpoint.auth)) signals.push("no-auth");
  if (hasIdSignal(endpoint)) signals.push("object-id");
  if (isWrite(endpoint)) signals.push("writes");
  if (hasAnyTerm(endpoint.queryParams.concat(endpoint.bodyFields), URL_TERMS)) signals.push("url-input");
  if (hasAnyTerm(endpoint.bodyFields.concat(endpoint.pathParts || []), FILE_TERMS)) signals.push("file");
  return signals;
}

function parsePostmanUrl(url) {
  if (typeof url === "string") {
    return { raw: url, path: cleanupPath(url), queryKeys: extractQueryKeys(url) };
  }
  const raw = url?.raw || "";
  const path = Array.isArray(url?.path) ? `/${url.path.join("/")}` : cleanupPath(raw);
  const queryKeys = Array.isArray(url?.query) ? url.query.map((query) => query.key).filter(Boolean) : extractQueryKeys(raw);
  return { raw, path: cleanupPath(path), queryKeys };
}

function extractPostmanBodyKeys(body) {
  if (!body || typeof body !== "object") return [];
  if (Array.isArray(body.urlencoded)) return body.urlencoded.map((entry) => entry.key).filter(Boolean);
  if (Array.isArray(body.formdata)) return body.formdata.map((entry) => entry.key).filter(Boolean);
  if (body.raw && typeof body.raw === "string") {
    try {
      return flattenObjectKeys(JSON.parse(body.raw));
    } catch {
      return inferKeysFromText(body.raw);
    }
  }
  return [];
}

function extractOpenApiBodyFields(requestBody) {
  if (!requestBody?.content || typeof requestBody.content !== "object") return [];
  const keys = new Set();
  Object.values(requestBody.content).forEach((media) => collectSchemaKeys(media?.schema, keys));
  return [...keys];
}

function collectSchemaKeys(schema, keys, prefix = "") {
  if (!schema || typeof schema !== "object") return;
  if (schema.properties && typeof schema.properties === "object") {
    Object.entries(schema.properties).forEach(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      keys.add(path);
      collectSchemaKeys(child, keys, path);
    });
  }
  if (schema.items) collectSchemaKeys(schema.items, keys, prefix);
}

function normalizeHeaders(headers) {
  return Array.isArray(headers) ? headers.map((header) => header.key || header.name).filter(Boolean) : [];
}

function inferAuth(headers) {
  const names = headers.map((header) => header.toLowerCase());
  return names.some((name) => ["authorization", "x-api-key", "cookie"].includes(name)) ? "declared" : "unspecified";
}

function readAuthType(auth) {
  if (!auth) return "";
  return typeof auth === "string" ? auth : auth.type || "";
}

function readDescription(description) {
  if (!description) return "";
  return typeof description === "string" ? description : description.content || "";
}

function cleanupPath(raw) {
  let value = String(raw || "/").trim();
  value = value.replace(/^https?:\/\/[^/]+/i, "").replace(/^{{[^}]+}}/i, "").split("?")[0];
  if (!value.startsWith("/")) value = `/${value}`;
  return value.replace(/\/+/g, "/");
}

function extractQueryKeys(raw) {
  const query = String(raw || "").split("?")[1] || "";
  return query.split("&").map((part) => decodeURIComponent((part.split("=")[0] || "").trim())).filter(Boolean);
}

function tokenizePath(path) {
  return String(path || "").split("/").map((part) => part.replace(/[{}:]/g, "")).filter(Boolean);
}

function flattenObjectKeys(value, prefix = "") {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((entry) => flattenObjectKeys(entry, prefix));
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path].concat(flattenObjectKeys(child, path));
  });
}

function inferKeysFromText(value) {
  const matches = String(value).match(/["']?([a-zA-Z][a-zA-Z0-9_]{2,})["']?\s*:/g) || [];
  return matches.map((match) => match.replace(/["':\s]/g, ""));
}

function isNoAuth(auth) {
  return ["none", "noauth", "no auth"].includes(String(auth || "").toLowerCase());
}

function isWrite(endpoint) {
  return WRITE_METHODS.has(endpoint.method);
}

function hasIdSignal(endpoint) {
  return hasPathParam(endpoint.path) || hasAnyTerm(endpoint.pathParts.concat(endpoint.queryParams, endpoint.bodyFields), ID_TERMS);
}

function hasPathParam(path) {
  return /(?:[:{]{1,2})[a-zA-Z0-9_]*(id|uuid)[a-zA-Z0-9_]*(?:\}{0,2})/i.test(path);
}

function hasPathTerm(endpoint, terms) {
  return hasAnyTerm(endpoint.pathParts, terms);
}

function hasAnyTerm(values, terms) {
  const loweredTerms = terms.map((term) => term.toLowerCase());
  return values.some((value) => {
    const normalized = String(value || "").toLowerCase();
    return loweredTerms.some((term) => normalized === term || normalized.includes(term));
  });
}

function formatEndpoint(endpoint) {
  return `${endpoint.method} ${endpoint.path}`;
}

function formatEndpointWithInputs(endpoint) {
  const inputs = endpoint.queryParams.concat(endpoint.bodyFields).slice(0, 8).join(", ");
  return inputs ? `${formatEndpoint(endpoint)} | inputs: ${inputs}` : formatEndpoint(endpoint);
}

function stableId(parts) {
  const source = parts.filter(Boolean).join("|");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }
  return `ep-${Math.abs(hash).toString(16)}`;
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) return false;
    seen.add(finding.id);
    return true;
  });
}

function calculateRiskScore(findings, chains) {
  const weights = { critical: 28, high: 18, medium: 10, low: 4 };
  return Math.min(100, findings.reduce((sum, finding) => sum + (weights[finding.severity] || 0), 0) + chains.length * 8);
}

function summarizeMethods(endpoints) {
  return endpoints.reduce((summary, endpoint) => {
    summary[endpoint.method] = (summary[endpoint.method] || 0) + 1;
    return summary;
  }, {});
}

globalThis.PaintasterAnalyzer = {
  analyzeCollection,
  normalizeCollection,
  summarizeMethods,
};
})();
