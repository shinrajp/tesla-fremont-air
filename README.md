# Air near Tesla Fremont

Live PurpleAir PM2.5 AQI map for the sensors around Lila Bringhurst Elementary, the Innovation community and the Tesla Fremont facility.

- `data.json` refreshes on each watcher scan; `history.json` (last 72 h) at most hourly.
- Map numbers are **raw** PurpleAir readings (same as the PurpleAir map's raw view). Each sensor card also shows an **EPA-corrected** AQI (US EPA 2021 nationwide correction, display only). Alerts use raw values.
- WHO 2021 guideline (15 µg/m³ 24-hr, 5 µg/m³ annual) is shown as a reference only.
- Open a sensor's card directly: `?open=322702`. Pick the map average: `?w=10minute|60minute|24hour`.
