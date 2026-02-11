# AGENTS.md - hlsfy-worker

## Scope
This file is for coding agents working in this repository.
Main goal: implement and maintain transcode actions safely.

## Quick map
- Entrypoint: `src/index.ts`
- HTTP routes: `src/transcode.ts`
- Queue runner: `src/queue.ts`
- Action registry: `src/actions/index.ts`
- Action helpers: `src/actions/utils.ts`
- DB schema: `src/db/schema.ts`
- Storage adapters: `src/storage-clients/*`
- ffmpeg/ffprobe resolver: `src/ffmpeg.ts`

## What is an action
An action is one executable step linked to a transcode.
Each action is stored in `transcode_actions` with status and retry metadata.

Registry shape in `src/actions/index.ts`:
- `name`: action id used by API
- `isInputFile`: whether action consumes file input from session/previous outputs
- `isOutputFile`: whether action emits file outputs that other actions can consume
- `handler(actionId)`
- optional `payloadSchema` (zod)

## Action lifecycle (important)
1. Client calls `POST /transcode/:id/actions`.
2. `createAction` validates action + payload.
3. Row is inserted as `PENDING` in `transcode_actions`.
4. Queue picks the id (`src/queue.ts`), marks `RUNNING`, executes handler.
5. Handler writes outputs via `createActionOutput`.
6. Queue sets final status to `COMPLETED` or `FAILED`.
7. Retry happens while `currentAttempt < maxAttempts`, waiting `delay` ms.

## Where files come from
Input file source is set when creating transcode (`POST /transcode`):
- `inputFileSource: "URL"` -> download from `inputFileUrl`
- `inputFileSource: "STORAGE"` -> download from object storage using `inputFileKey` + `storage`

Download action:
- `DOWNLOAD_SOURCE_FILE` (`src/actions/download-source-file/index.ts`)
- Creates temp folder in OS temp dir (`hlsfy*`)
- Downloads to `source`
- Detects extension with `file-type`
- Renames to `source.<ext>`
- Emits output `{ path, homeFolder }`

Session behavior:
- `getSession(transcodeId)` in `src/actions/utils.ts`
- If no active session exists, it auto-creates `DOWNLOAD_SOURCE_FILE`
- Saves `sourceFilePath` + `homeFolder` in `transcode_sessions`

## How to create a new action
1. Create folder and handler
- Add `src/actions/<action-name>/index.ts`
- Export `async function <handler>(actionId: number)`
- Start by loading action data with `getAction(actionId)`

2. Register in action registry
- Edit `src/actions/index.ts`
- Add import
- Add entry in `ACTIONS` array
- If payload is expected, add `payloadSchema`

3. Decide input mode
- `payload`: direct input params from API
- `payloadFromActionId`: consume outputs from previous action via `onData(...)`
- no payload + file-based action: call `getSession(...)` to get local source file

4. Emit outputs
- Use `createActionOutput({ transcodeId, actionId, output })`
- Emit one output row per downstream unit you want to expose

5. Failure semantics
- Return `{ status: "FAILED", retry: true }` for retryable failure
- Return `{ status: "FAILED", retry: false }` for terminal failure
- Throwing also enters queue retry/fail flow

## Chaining rules to never break
- If new action sets `isInputFile: true` and API uses `payloadFromActionId`, the source action must be `isOutputFile: true`.
- This is enforced in `createAction` (`src/actions/utils.ts`).

## Storage object shape (`inputFileSource: "STORAGE"`)
`storage` JSON must include:
- `provider`: `AWS_S3` | `GCS` | `AZURE_BLOB`
- `config`: provider config object

Provider config requirements:
- AWS_S3: `accessKeyId`, `secretAccessKey`, `region`, `bucket` (+ optional `endpoint`, `forcePathStyle`)
- GCS: `projectId`, `bucket`, `clientEmail`, `privateKey`
- AZURE_BLOB: `container` + (`connectionString` OR `accountName` + `accountKey`) (+ optional `blobEndpoint`)

## API notes
- All routes require `Authorization: Bearer <TOKEN>`.
- `TOKEN` is mandatory at startup.
- Route `POST /transcode/:id/actions` currently requires `retry` object in request schema.

## Local runtime notes
- SQLite DB path: `~/.hlsfy/worker.db`
- ffmpeg/ffprobe auto-install location: `~/.hlsfy/ffmpeg/<platform-arch>/`
- Queue concurrency: `QUEUE_CONCURRENCY` (default 3)

## Change discipline for agents
- Prefer small, isolated changes.
- Keep action handlers pure around their own responsibility.
- Do not bypass `createActionOutput` when output must be observable by downstream actions.
- When adding an action, always update registry + payload validation together.
