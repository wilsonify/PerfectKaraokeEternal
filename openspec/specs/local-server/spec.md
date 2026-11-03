# Local Server Specification

## Purpose

Describe how the application is served and opened locally: the static file server's exposure rules and the ways a user can load the player in a browser. This defines local operation only; the app has no application backend.

## Requirements

### Requirement: Loopback-only by default

The static server (`serve.js`) SHALL listen on `127.0.0.1` by default. Listening on other interfaces SHALL require an explicit opt-in via the `--host` flag or `HOST` environment variable, and the server SHALL print a warning that other devices on the network can reach the player.

#### Scenario: Default binding

- **GIVEN** the server is started with `npm start` or `node serve.js`
- **WHEN** it binds its listening socket
- **THEN** it listens on `127.0.0.1` only
- **AND** no LAN-access warning is printed

#### Scenario: Explicit LAN opt-in

- **GIVEN** the server is started with `--host 0.0.0.0` (or `HOST=0.0.0.0`)
- **WHEN** it binds its listening socket
- **THEN** it listens on all interfaces
- **AND** it prints a warning that other devices on the network can reach the player

### Requirement: Application-files-only allowlist

The server SHALL serve only the application shell and its own assets: `index.html`, files under `css/`, `js/` and `assets/`. Any other path inside the repository (tests, documentation, `serve.js` itself, `.git`, `node_modules`) SHALL NOT be reachable.

#### Scenario: App files are served

- **GIVEN** the server is running
- **WHEN** a client requests `/`, `/js/app.js`, `/css/app.css` or an image under `/assets/`
- **THEN** the file is returned with `200` and a correct `Content-Type`

#### Scenario: Repository internals are not served

- **GIVEN** the server is running
- **WHEN** a client requests `/.git/config`, `/package.json`, `/test/serve.test.js`, `/docs/...` or `/node_modules/...`
- **THEN** the response is `404`

### Requirement: Path traversal and malformed requests are rejected

URL paths SHALL be resolved against the repository root before serving, with raw and percent-encoded backslashes normalized. Requests that resolve outside the served application files SHALL be rejected (`403` for paths outside the root, `404` for other unserved paths), and malformed URLs SHALL be rejected rather than crash the server.

#### Scenario: Encoded traversal attempt

- **GIVEN** the server is running
- **WHEN** a client requests a percent-encoded traversal such as `/..%2f..%2fpackage.json` or a backslash variant
- **THEN** the request is rejected (`400` or `403`) and no file content is returned

#### Scenario: Plain traversal attempt

- **GIVEN** the server is running
- **WHEN** a client requests `/../package.json`
- **THEN** the response is `403` or `404` and no file outside the allowlist is served

### Requirement: Served over HTTP, not file://

The application SHALL be loaded from an HTTP(S) origin; it does not support being opened directly from the filesystem (`file://`), because browsers refuse to load ES modules there.

#### Scenario: Opened from disk

- **GIVEN** the user double-clicks `index.html`
- **WHEN** the browser tries to load the ES modules
- **THEN** module loading fails, and the documented way to run the app is `npm start`

### Requirement: Read-only HTTP methods

The server SHALL answer only `GET` and `HEAD` requests. Other methods SHALL receive `405`.

#### Scenario: Unsupported method

- **GIVEN** the server is running
- **WHEN** a client sends `POST`, `PUT` or `DELETE` to any path
- **THEN** the response is `405`
