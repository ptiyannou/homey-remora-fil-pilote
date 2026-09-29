# Remora Fil Pilote — Homey / SHS

A native Homey SDK 3 app for the Remora ESP8266 pilot-wire heating controller. Control up to seven outputs as separate Homey devices over the local HTTP API. No Remora cloud service or account is required.

**[Install the test version](https://homey.app/a/fr.remora.filpilote/test/)** · [Documentation française](README.md) · [Report an issue](https://github.com/ptiyannou/homey-remora-fil-pilote/issues)

Version 0.1.6 is available on the Homey test channel and is awaiting Athom certification as of 29 September 2026.

## Features

- Exactly four commands: Off, Eco, Comfort and Frost protection.
- One Homey device per output, up to seven per Remora board.
- Pair by IP address or hostname; the app validates the board and lists its outputs.
- Local polling every 30 seconds, serialized requests and command readback.
- Flow and Advanced Flow cards: set one output, set all seven outputs on its board, check a mode, and react to mode changes.
- Read-only load-shedding status and address repair without changing device identities.

The bulk action affects all seven physical outputs, including outputs not paired with Homey. The radiator's own thermostat controls temperature: the app does not set an absolute temperature and does not measure per-radiator energy use. This firmware integration does not offer Comfort −1°C or −2°C.

## Compatibility and setup

Tested with Remora V1.2 (MCP23017), firmware 1.4.0 and Homey Self-Hosted Server 13.4.1. The manifest targets Homey's local platform, SDK 3, Homey 12 or later. Homey Pro is targeted by the manifest but has not been tested on physical Homey Pro hardware. Homey Cloud is not supported.

Install the test app, then add **Remora Fil Pilote → Radiateur Remora**. Enter the board's IP address or a hostname resolvable from Homey, select the required outputs, and rename them for your rooms. No automatic network scan is performed. Homey must be able to reach the board's HTTP port on your LAN.

## Install from source

Use Node.js 24 or later for the Homey CLI (4.5.2 was used for validation):

```sh
git clone https://github.com/ptiyannou/homey-remora-fil-pilote.git
cd homey-remora-fil-pilote
npm install --global homey@4.5.2
homey login
homey select
npm test
homey app validate --level publish
homey app install
```

There are no application npm dependencies to install. The `homey` runtime module is supplied by Homey. Choose your target server in `homey select`; avoid `--clean` if you want to preserve paired devices and Flows.

Read-only connection test (replace the hostname with your board's address):

```sh
npm run probe -- remora.local
```

## Validation and limitations

The automated suite contains 14 tests using simulated firmware and Homey interfaces. Seven devices were paired on a real SHS installation. Device commands and individual/bulk Flow actions were checked by resending the already-active Frost protection mode. Restart and state recovery were verified. Physical transitions to Off, Eco and Comfort and their electrical effects still need testing. Firmware readback is not an independent measurement of a radiator's electrical state.

See [validation details](docs/VALIDATION.md) and the [verified API contract](docs/API-SOURCES.md). When reporting a problem, include the app, Homey and firmware versions, the affected output and the error message; remove credentials and private network details from logs.

## Credits

Remora is a free, open-source project. This is an independent community integration, not the Remora firmware itself.

- [Remora project and hardware overview — tducret/programmateur-fil-pilote-wifi](https://github.com/tducret/programmateur-fil-pilote-wifi)
- [Remora firmware — hallard/remora_soft](https://github.com/hallard/remora_soft)
- [PyRemora — FreeTHX/pyremora](https://github.com/FreeTHX/pyremora), consulted to verify the HTTP API; not bundled as a dependency.

Thanks to the original authors and contributors. See [image provenance](docs/IMAGE-PROVENANCE.md) for the product visuals.

[Homey community discussion](https://community.homey.app/t/app-pro-shs-test-remora-fil-pilote/160170)
