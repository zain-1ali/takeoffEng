# TakeOff Studio

Quantity surveying take-off, bills of quantities, rate analysis and reports.

This repo is a **MERN** rebuild of the client kit in `COMPLETE SET OF NEW PROJECT DATA`. Formulas, wording and layout come from that folder — they are not redesigned.

## Stack

- **frontend/** — Vite, React, TypeScript, Tailwind (prototype colour tokens)
- **backend/** — Express, TypeScript
- **engine/** — shared measurement package (imported by both apps)
- MongoDB, Socket.IO, p-queue and Railway storage are added in later phases
- No Docker, no Redis, no Yjs

## Local setup

Node 22+. Two terminals are enough; `npm run dev` from the root starts engine watch, API and web together.

```bash
npm install
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
npm run dev
```

- Web: http://localhost:5173
- API health: http://localhost:4000/health
- API ready: http://localhost:4000/ready

Or separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Build

```bash
npm run build
```

Engine unit tests:

```bash
npm test -w @takeoff/engine
```

## Source of truth

1. `COMPLETE SET OF NEW PROJECT DATA/TakeOff_Studio_Engine_Spec.md`
2. `COMPLETE SET OF NEW PROJECT DATA/takeoff_studio_team.html`
3. Frontend / backend Cursor prompts in that folder (stack remapped to MERN)

## Phases

Phase 0 is this scaffold. Do not start a later phase until it is explicitly requested.
