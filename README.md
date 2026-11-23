# Air near Tesla Fremont

Live PurpleAir PM2.5 AQI map for the sensors around Lila Bringhurst Elementary, the Innovation community and the Tesla Fremont facility.

- `data.json` refreshes on each watcher scan; `history.json` covers the last 7 days (key sensor at 10-minute resolution) and updates at most hourly.
- Map numbers are **raw** PurpleAir readings (same as the PurpleAir map's raw view). Each sensor card also shows an **EPA-corrected** AQI (US EPA 2021 nationwide correction, display only). Alerts use raw values.
- The page is facility-centric: distance and bearing from the Tesla Fremont facility, live wind (including whether it is blowing from the facility toward the school), and whether a rise looks localized or area-wide. Wind comes from Open-Meteo and is stored in a 7-day log. None of this, by itself, means the facility caused a reading.
- News & media coverage is refreshed about once a day from Google News RSS. Only published stories whose publisher links return HTTP 200 are listed. We do not write these articles.
- WHO 2021 guideline (15 µg/m³ 24-hr, 5 µg/m³ annual) is shown as a reference only.
- Open a sensor's card directly: `?open=322702`. Pick the map average: `?w=10minute|60minute|24hour`.
