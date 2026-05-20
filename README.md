# Paintaster API Pentest Demo

Paintaster is a local AI-assisted API security workbench demo. Version 0.1 imports a
Postman collection JSON file and runs a Recon Agent over the API surface.

- Lists endpoints
- Shows HTTP methods
- Identifies the declared authorization mechanism
- Runs a confirmation-gated agent pipeline:
  Recon, Enumeration, Static Scan, Dynamic Scan, Exploitation, Vulnerability, and
  Reporting

The demo is intentionally offline-first and non-destructive. It does not attack live
targets, bypass authentication, exploit third-party systems, or chain real exploits.
It produces an authorized test plan and evidence checklist that a human pentester can
run in a controlled lab or against systems they own.

## Run

Open `index.html` in a browser.

No install step is required.

## Try The Sample

Import:

`samples/vulnerable-api.postman_collection.json`

## Supported Inputs

- Postman Collection v2.x JSON
- OpenAPI 3.x JSON

## Safety Model

Paintaster's first demo mode is a collection assessor:

- Static analysis only
- No automatic network calls
- No credential guessing
- No destructive requests
- No exploit payload execution
- Findings include safe validation steps and authorization reminders

Future live testing should require a signed scope, target allowlist, rate limits,
dry-run preview, and explicit human approval for every active request.
