LLM output.md

Short answer: I can’t “hand it off to Codex” as a separate background service, but I **can** give you a concrete, self-contained client-side app you can drop on S3 and iterate from.

Here’s a minimal-but-real starter that does what you described:

- Static HTML file
- Pure client-side JS
- User selects one or more lap files
- Parses them into a common structure
- Plots speed vs distance for multiple laps for comparison

You can tweak the parser once you inspect your actual `lapdata` files.

---

## 1. Minimal file layout

You can literally start with a single file:

- `index.html`

Host that in an S3 bucket with static hosting enabled, and you’re done.

---

## 2. `index.html` – full example

This assumes Telemetry Tool exports a CSV/semicolon-separated text file with a header row, including at least:

- `Time` (seconds since lap start)
- `LapDist` (or similar – distance around lap; you may need to check your header name)
- `Speed` (km/h)

You can adjust the header names inside `guessColumnIndices()` once you’ve looked at real samples.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>TT Lap Viewer</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family:
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          'Segoe UI',
          sans-serif;
        margin: 0;
        padding: 0;
        background: #111;
        color: #eee;
      }
      header {
        padding: 0.75rem 1rem;
        background: #222;
        border-bottom: 1px solid #333;
      }
      h1 {
        margin: 0;
        font-size: 1.1rem;
      }
      main {
        padding: 1rem;
        display: grid;
        grid-template-columns: minmax(220px, 260px) 1fr;
        gap: 1rem;
      }
      @media (max-width: 800px) {
        main {
          grid-template-columns: 1fr;
        }
      }
      .panel {
        background: #181818;
        border-radius: 6px;
        padding: 0.75rem;
        border: 1px solid #333;
      }
      .panel h2 {
        margin-top: 0;
        font-size: 0.95rem;
        margin-bottom: 0.5rem;
      }
      #dropzone {
        border: 1px dashed #555;
        border-radius: 4px;
        padding: 1rem;
        text-align: center;
        font-size: 0.9rem;
        cursor: pointer;
        background: #151515;
      }
      #dropzone.dragover {
        border-color: #999;
        background: #202020;
      }
      #fileInput {
        display: none;
      }
      #lapList {
        list-style: none;
        padding: 0;
        margin: 0.5rem 0 0 0;
        max-height: 250px;
        overflow-y: auto;
        font-size: 0.85rem;
      }
      #lapList li {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.15rem 0;
        border-bottom: 1px solid #252525;
      }
      #lapList label {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex: 1;
        cursor: pointer;
      }
      #lapList span.meta {
        opacity: 0.7;
        font-size: 0.8em;
      }
      #status {
        font-size: 0.8rem;
        margin-top: 0.5rem;
        opacity: 0.8;
        white-space: pre-line;
      }
      #channelControls {
        margin-top: 0.75rem;
        font-size: 0.85rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1rem;
      }
      #channelControls label {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        cursor: pointer;
      }
      #chartContainer {
        min-height: 400px;
      }
      canvas {
        max-width: 100%;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Telemetry Tool Lap Viewer (Client-side)</h1>
    </header>

    <main>
      <!-- LEFT: file + lap selection -->
      <section class="panel">
        <h2>Load laps</h2>

        <div id="dropzone">
          Click to choose lap files<br />
          or drop them here
        </div>
        <input type="file" id="fileInput" multiple />

        <ul id="lapList"></ul>

        <div id="status">No laps loaded yet.</div>

        <div id="channelControls">
          <label>
            <input type="radio" name="channel" value="speed" checked />
            Speed
          </label>
          <label>
            <input type="radio" name="channel" value="throttle" />
            Throttle
          </label>
          <label>
            <input type="radio" name="channel" value="brake" />
            Brake
          </label>
          <label>
            <input type="radio" name="channel" value="steer" />
            Steering
          </label>
          <!-- Add more channels as you map them -->
        </div>
      </section>

      <!-- RIGHT: chart -->
      <section class="panel" id="chartContainer">
        <h2>Lap comparison (vs distance)</h2>
        <canvas id="chart"></canvas>
      </section>
    </main>

    <!-- Chart.js via CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <script>
      // --- State ----------------------------------------------------------------
      const laps = []; // { id, name, metadata, samples: [ { t, s, speed, throttle, brake, steer } ] }
      let chart = null;
      let nextLapId = 1;

      // --- DOM elements ---------------------------------------------------------
      const dropzone = document.getElementById('dropzone');
      const fileInput = document.getElementById('fileInput');
      const lapList = document.getElementById('lapList');
      const statusEl = document.getElementById('status');
      const chartCanvas = document.getElementById('chart');
      const channelControls = document.getElementById('channelControls');

      // --- Helpers --------------------------------------------------------------

      function setStatus(msg) {
        statusEl.textContent = msg;
      }

      function guessDelimiter(line) {
        // Telemetry Tool often uses ';' – fall back to CSV
        if (line.includes(';')) return ';';
        if (line.includes(',')) return ',';
        return ';';
      }

      function guessColumnIndices(headerColumns) {
        // Adjust these to match your real TT headers after inspecting a file.
        function findIndex(possibleNames) {
          const lower = headerColumns.map((h) => h.trim().toLowerCase());
          for (const name of possibleNames) {
            const idx = lower.indexOf(name.toLowerCase());
            if (idx !== -1) return idx;
          }
          return -1;
        }

        return {
          time: findIndex(['time', 'laptime', 't']),
          dist: findIndex(['lapdist', 'dist', 's', 'distance']),
          speed: findIndex(['speed', 'vel', 'velocity']),
          throttle: findIndex(['throttle', 'throttlepos', 'throttle_pct']),
          brake: findIndex(['brake', 'brakepos', 'brake_pct']),
          steer: findIndex(['steer', 'steering', 'steerangle'])
        };
      }

      function parseLapFile(text, filename) {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('File has no data rows');
        }

        const delimiter = guessDelimiter(lines[0]);
        const headerCols = lines[0].split(delimiter).map((h) => h.trim());
        const idx = guessColumnIndices(headerCols);

        if (idx.time === -1 || idx.dist === -1) {
          console.warn('Header columns:', headerCols);
          throw new Error(
            'Could not find Time or Distance columns. Adjust guessColumnIndices() to match your header names.'
          );
        }

        const samples = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(delimiter);
          if (parts.length !== headerCols.length) continue;

          const readFloat = (colIdx) => {
            if (colIdx === -1) return NaN;
            const v = parseFloat(parts[colIdx]);
            return isFinite(v) ? v : NaN;
          };

          const t = readFloat(idx.time);
          const s = readFloat(idx.dist);
          if (!isFinite(t) || !isFinite(s)) continue;

          samples.push({
            t,
            s,
            speed: readFloat(idx.speed),
            throttle: readFloat(idx.throttle),
            brake: readFloat(idx.brake),
            steer: readFloat(idx.steer)
          });
        }

        // Sort by distance just in case
        samples.sort((a, b) => a.s - b.s);

        const lap = {
          id: nextLapId++,
          name: filename,
          metadata: {
            length: samples.length,
            sMin: samples[0]?.s ?? 0,
            sMax: samples[samples.length - 1]?.s ?? 0
          },
          samples
        };

        return lap;
      }

      function addLapToList(lap) {
        const li = document.createElement('li');
        const label = document.createElement('label');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        checkbox.dataset.lapId = lap.id;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = lap.name;

        const metaSpan = document.createElement('span');
        metaSpan.className = 'meta';
        const lengthMeters = (lap.metadata.sMax - lap.metadata.sMin).toFixed(0);
        metaSpan.textContent = `(${lap.metadata.length} samples, ~${lengthMeters} m)`;

        label.appendChild(checkbox);
        label.appendChild(nameSpan);
        label.appendChild(metaSpan);
        li.appendChild(label);
        lapList.appendChild(li);

        checkbox.addEventListener('change', () => {
          updateChart();
        });
      }

      function getSelectedChannel() {
        const input = channelControls.querySelector('input[name="channel"]:checked');
        return input ? input.value : 'speed';
      }

      function getSelectedLaps() {
        const checkedInputs = Array.from(
          lapList.querySelectorAll('input[type="checkbox"]:checked')
        );
        const selectedIds = new Set(checkedInputs.map((cb) => Number(cb.dataset.lapId)));
        return laps.filter((l) => selectedIds.has(l.id));
      }

      function buildDatasets(channel) {
        const selected = getSelectedLaps();
        if (selected.length === 0) return [];

        return selected.map((lap, i) => {
          const data = lap.samples
            .filter((s) => isFinite(s[channel]))
            .map((s) => ({ x: s.s, y: s[channel] }));

          return {
            label: lap.name,
            data,
            showLine: true,
            pointRadius: 0,
            borderWidth: 1.5
            // Chart.js will auto-assign colours; you can customise later if needed.
          };
        });
      }

      function updateChart() {
        const channel = getSelectedChannel();
        const datasets = buildDatasets(channel);

        if (!chart) {
          chart = new Chart(chartCanvas.getContext('2d'), {
            type: 'scatter',
            data: { datasets },
            options: {
              parsing: false,
              animation: false,
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  type: 'linear',
                  title: { display: true, text: 'Lap distance' }
                },
                y: {
                  title: { display: true, text: channel }
                }
              },
              plugins: {
                legend: {
                  display: true,
                  labels: {
                    color: '#eee'
                  }
                },
                tooltip: {
                  mode: 'nearest',
                  intersect: false
                }
              }
            }
          });
        } else {
          chart.data.datasets = datasets;
          chart.options.scales.y.title.text = channel;
          chart.update();
        }
      }

      async function handleFiles(files) {
        setStatus('Loading files…');
        let loaded = 0;
        let failed = 0;

        for (const file of files) {
          try {
            const text = await file.text();
            const lap = parseLapFile(text, file.name);
            laps.push(lap);
            addLapToList(lap);
            loaded++;
          } catch (err) {
            console.warn('Failed to parse', file.name, err);
            failed++;
          }
        }

        if (loaded > 0) {
          updateChart();
        }

        if (loaded === 0 && failed > 0) {
          setStatus(
            'Failed to parse all files. Check console for details and adjust header mappings.'
          );
        } else {
          const msg = [];
          if (loaded) msg.push(`Loaded ${loaded} lap(s).`);
          if (failed) msg.push(`Failed: ${failed}.`);
          setStatus(msg.join(' '));
        }
      }

      // --- Event wiring ---------------------------------------------------------

      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', (event) => {
        event.preventDefault();
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropzone.classList.remove('dragover');
        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) return;
        handleFiles(files);
      });

      fileInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        handleFiles(files);
      });

      channelControls.addEventListener('change', () => {
        updateChart();
      });

      setStatus('No laps loaded yet. Drop Telemetry Tool lap files here.');
    </script>
  </body>
</html>
```

---

## 3. How to iterate from here

Once you’ve tried this with real `lapdata` files, your next steps are:

1. **Inspect the actual header row** from a couple of Telemetry Tool lap files.
   - Update `guessColumnIndices()` with the exact header names it uses.
   - Add extra channels (RPM, gear, etc.) if you care.

2. **Improve UX/analysis:**
   - Add a delta-time trace (requires resampling both laps onto a uniform distance axis and computing cumulative time).
   - Add a small track map if TT logs X/Y or lat/long.
   - Add some basic “session metadata” reading if that’s encoded in the file.

3. **Host on S3:**
   - Create S3 bucket, enable static hosting, upload `index.html`.
   - Turn on public read or put it behind CloudFront if you want TLS on a custom domain.

This gives you a genuinely usable foundation: no server, no logins, no uploads – just a tiny web app that runs entirely on the client and understands TT lap files once you nail the column names.
