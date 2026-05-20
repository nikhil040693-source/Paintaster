import { readFile } from "node:fs/promises";
import vm from "node:vm";

const samplePath = new URL("../samples/vulnerable-api.postman_collection.json", import.meta.url);
const analyzerPath = new URL("../src/analyzer.js", import.meta.url);
const raw = JSON.parse(await readFile(samplePath, "utf8"));
const analyzerSource = await readFile(analyzerPath, "utf8");
const context = { console };

vm.createContext(context);
vm.runInContext(analyzerSource, context);

const { analyzeCollection } = context.PaintasterAnalyzer;
const report = analyzeCollection(raw);

if (report.endpoints.length !== 10) {
  throw new Error(`Expected 10 endpoints, received ${report.endpoints.length}.`);
}

if (!report.findings.some((finding) => finding.id === "auth-bola-candidates")) {
  throw new Error("Expected BOLA finding.");
}

if (!report.chains.length) {
  throw new Error("Expected at least one chain.");
}

console.log(`Paintaster smoke test passed: ${report.endpoints.length} endpoints, ${report.findings.length} findings.`);
