(() => {
  "use strict";

  const APP_VERSION = "1.1.1";
  const REFERENCE_DATE = "2026-10-16";
  const TASK_COUNT = 10;
  const config = window.STUDY_CONFIG || {};
  const isCloudMode = Boolean(
    config.supabaseUrl &&
    config.supabasePublishableKey &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  );
  const db = isCloudMode
    ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
    : null;

  const CATEGORY_LABELS = {
    akademis: "Akademis",
    lomba: "Lomba",
    kepanitiaan: "Kepanitiaan",
    organisasi: "Organisasi"
  };

  // Dua set tugas menggunakan sepuluh deadline unik yang sama untuk menjaga tingkat kesulitan relatif.
  // Urutan baris sengaja tidak mengikuti urutan deadline.
  const TASK_SETS = {
    A: [
      { id: "A01", name: "Mengumpulkan laporan praktikum", category: "akademis", startDay: 12, dueDay: 23 },
      { id: "A02", name: "Menyelesaikan validasi basis data", category: "akademis", startDay: 10, dueDay: 17 },
      { id: "A03", name: "Finalisasi desain antarmuka lomba", category: "lomba", startDay: 6, dueDay: 25 },
      { id: "A04", name: "Mengedit video teaser acara", category: "kepanitiaan", startDay: 14, dueDay: 20 },
      { id: "A05", name: "Membuat proposal kegiatan", category: "organisasi", startDay: 11, dueDay: 26 },
      { id: "A06", name: "Menyusun ringkasan evaluasi lomba", category: "lomba", startDay: 5, dueDay: 18 },
      { id: "A07", name: "Membuat desain poster publikasi", category: "kepanitiaan", startDay: 15, dueDay: 22 },
      { id: "A08", name: "Menyusun laporan program kerja", category: "organisasi", startDay: 8, dueDay: 24 },
      { id: "A09", name: "Menyiapkan presentasi proyek", category: "akademis", startDay: 9, dueDay: 19 },
      { id: "A10", name: "Melengkapi dokumen pendaftaran", category: "lomba", startDay: 3, dueDay: 21 }
    ],
    B: [
      { id: "B01", name: "Mengunggah berkas administrasi lomba", category: "lomba", startDay: 7, dueDay: 22 },
      { id: "B02", name: "Menyusun rundown final kegiatan", category: "kepanitiaan", startDay: 13, dueDay: 18 },
      { id: "B03", name: "Finalisasi desain poster lomba", category: "lomba", startDay: 9, dueDay: 25 },
      { id: "B04", name: "Mengirim notulen rapat organisasi", category: "organisasi", startDay: 10, dueDay: 20 },
      { id: "B05", name: "Menyerahkan revisi laporan penelitian", category: "akademis", startDay: 8, dueDay: 17 },
      { id: "B06", name: "Menyusun evaluasi program organisasi", category: "organisasi", startDay: 3, dueDay: 24 },
      { id: "B07", name: "Menguji prototipe fitur utama", category: "akademis", startDay: 14, dueDay: 21 },
      { id: "B08", name: "Menyiapkan lampiran presentasi", category: "akademis", startDay: 15, dueDay: 26 },
      { id: "B09", name: "Menyelesaikan draft anggaran lomba", category: "lomba", startDay: 5, dueDay: 19 },
      { id: "B10", name: "Menyelesaikan materi publikasi acara", category: "kepanitiaan", startDay: 11, dueDay: 23 }
    ]
  };

  const PLANS = [
    { id: "list-A__gantt-B", order: ["list", "gantt"], setByView: { list: "A", gantt: "B" } },
    { id: "list-B__gantt-A", order: ["list", "gantt"], setByView: { list: "B", gantt: "A" } },
    { id: "gantt-A__list-B", order: ["gantt", "list"], setByView: { gantt: "A", list: "B" } },
    { id: "gantt-B__list-A", order: ["gantt", "list"], setByView: { gantt: "B", list: "A" } }
  ];

  const state = {
    mode: isCloudMode ? "cloud" : "demo",
    sessionId: null,
    participantCode: "",
    participantName: "",
    studyProgram: "",
    cohortYear: null,
    plan: null,
    trialIndex: 0,
    currentTasks: [],
    currentView: null,
    currentSet: null,
    currentTrialId: null,
    trialStartedAt: null,
    trialStartPerf: 0,
    trials: [],
    sessionStartedAt: null,
    sessionStartMs: 0,
    timerHandle: null,
    pendingCompletion: null
  };

  const app = document.getElementById("app");
  const modeLabel = document.getElementById("mode-label");
  const modeDot = document.getElementById("mode-dot");

  modeLabel.textContent = isCloudMode ? "Penyimpanan database aktif" : "Mode demo · lokal";
  if (isCloudMode) modeDot.classList.add("online");

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }


  function generateParticipantCode() {
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const randomValues = new Uint8Array(8);

    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      window.crypto.getRandomValues(randomValues);
    } else {
      for (let i = 0; i < randomValues.length; i += 1) {
        randomValues[i] = Math.floor(Math.random() * 256);
      }
    }

    const suffix = Array.from(randomValues, value => alphabet[value & 31]).join("");
    return `RSP-${suffix}`;
  }

  function chooseBalancedLocalPlan() {
    const sessions = getLocalStore().sessions.filter(session =>
      !String(session.participant_code || "").toUpperCase().startsWith("TEST-")
    );

    const counts = PLANS.map(plan => ({
      plan,
      count: sessions.filter(session => session.sequence_plan === plan.id).length
    }));

    const lowestCount = Math.min(...counts.map(item => item.count));
    const candidates = counts
      .filter(item => item.count === lowestCount)
      .map(item => item.plan);

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function shortDate(day) { return `${String(day).padStart(2, "0")} Okt`; }
  function fullDate(day) { return `2026-10-${String(day).padStart(2, "0")}`; }
  function formatMs(ms) {
    const safe = Math.max(0, Math.floor(ms || 0));
    const minutes = Math.floor(safe / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const centiseconds = Math.floor((safe % 1000) / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
  function formatSeconds(ms) {
    const seconds = Math.max(0, ms || 0) / 1000;
    return `${seconds.toFixed(2).replace(".", ",")} dtk`;
  }
  function formatPercent(numerator, denominator) {
    return denominator ? `${Math.round((numerator / denominator) * 100)}%` : "0%";
  }
  function nowIso() { return new Date().toISOString(); }
  function expectedTasks(tasks) {
    return [...tasks].sort((a, b) => a.dueDay - b.dueDay);
  }
  function categoryPill(category) {
    return `<span class="category-pill ${category}">${CATEGORY_LABELS[category]}</span>`;
  }
  function getLocalStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem("fieldnote-study-demo") || '{"sessions":[],"trials":[],"completions":[]}');
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        trials: Array.isArray(parsed.trials) ? parsed.trials : [],
        completions: Array.isArray(parsed.completions) ? parsed.completions : []
      };
    } catch (_) {
      return { sessions: [], trials: [], completions: [] };
    }
  }
  function setLocalStore(data) {
    localStorage.setItem("fieldnote-study-demo", JSON.stringify(data));
  }
  function appendLocal(collection, row) {
    const data = getLocalStore();
    data[collection].push(row);
    setLocalStore(data);
  }

  function dateStamp() {
    return `<div class="date-stamp"><div class="date-day">Jumat, 16 Oktober 2026</div><div class="date-caption">SKENARIO HARI INI</div></div>`;
  }

  function renderIntro(errorText = "") {
    stopTimer();
    const generatedParticipantCode = generateParticipantCode();
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">Participant onboarding</span>
            <h1>Tentukan prioritas tugas<br>berdasarkan deadline</h1>
            <p class="lead">Anda akan menyusun urutan 10 tugas pada dua tampilan: List View dan Gantt Chart.</p>
          </div>
          ${dateStamp()}
        </div>
        <div class="panel-rule"></div>
        <div class="intro-body">
          <div class="intro-grid">
            <section class="info-card soft">
              <div class="scenario-box">
                <span class="scenario-label">Scenario</span>
                <div class="scenario-date"><strong>Jumat, 16 Oktober 2026</strong></div>
                <p>Dalam studi ini, anggap hari acuannya adalah <strong>Jumat, 16 Oktober 2026</strong>. Tanggal ini hanya untuk simulasi dan tidak mengikuti waktu nyata saat Anda mengerjakan tes.</p>
              </div>
              <p class="mini-note">Instruksi singkat akan muncul sebelum setiap ronde.</p>
            </section>

            <section class="info-card">
              <h3>Mulai sesi</h3>
              <p>Isi biodata singkat berikut, lalu mulai eksperimen.</p>
              <form id="start-form">
                <label class="form-label" for="participant-name">Nama</label>
                <input class="text-input" id="participant-name" name="participant-name" maxlength="120" minlength="2" placeholder="Contoh: Lia Ninda" autocomplete="name" required>

                <label class="form-label" for="study-program">Program studi</label>
                <select class="text-input" id="study-program" name="study-program" required>
                  <option value="">Pilih program studi</option>
                  <option value="Sistem Informasi">Sistem Informasi</option>
                  <option value="Teknologi Informasi">Teknologi Informasi</option>
                  <option value="Pendidikan Teknologi Informasi">Pendidikan Teknologi Informasi</option>
                  <option value="Teknik Informatika">Teknik Informatika</option>
                  <option value="Teknik Komputer">Teknik Komputer</option>
                </select>

                <label class="form-label" for="cohort-year">Angkatan</label>
                <select class="text-input" id="cohort-year" name="cohort-year" required>
                  <option value="">Pilih angkatan</option>
                  <option value="2019">2019</option>
                  <option value="2020">2020</option>
                  <option value="2021">2021</option>
                  <option value="2022">2022</option>
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>

                <label class="form-label" for="participant-code">Kode responden</label>
                <input class="text-input" id="participant-code" name="participant-code" value="${escapeHtml(generatedParticipantCode)}" maxlength="40" minlength="3" autocomplete="off" readonly aria-readonly="true" required>
                <div class="input-hint">Kode dibuat otomatis. Catat jika peneliti memintanya.</div>

                <label class="consent">
                  <input id="consent-check" type="checkbox" required>
                  <span>Saya bersedia mengikuti penelitian ini dan memahami bahwa biodata singkat, jawaban, serta waktu pengerjaan akan direkam.</span>
                </label>

                <div class="form-actions">
                  <div class="status-message" id="start-error" role="alert">${escapeHtml(errorText)}</div>
                  <button class="btn btn-primary" type="submit" id="start-button">Mulai eksperimen <span aria-hidden="true">→</span></button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </section>`;
    document.getElementById("start-form").addEventListener("submit", handleStart);
  }

  async function handleStart(event) {
    event.preventDefault();
    const nameInput = document.getElementById("participant-name");
    const programInput = document.getElementById("study-program");
    const cohortInput = document.getElementById("cohort-year");
    const codeInput = document.getElementById("participant-code");
    const consent = document.getElementById("consent-check");
    const error = document.getElementById("start-error");
    const button = document.getElementById("start-button");

    const participantName = nameInput.value.trim();
    const studyProgram = programInput.value;
    const cohortYear = Number(cohortInput.value);
    const participantCode = codeInput.value.trim().toUpperCase();

    if (participantName.length < 2) {
      error.textContent = "Nama minimal 2 karakter.";
      nameInput.focus();
      return;
    }
    if (!studyProgram) {
      error.textContent = "Pilih program studi terlebih dahulu.";
      programInput.focus();
      return;
    }
    if (!cohortInput.value) {
      error.textContent = "Pilih angkatan terlebih dahulu.";
      cohortInput.focus();
      return;
    }
    if (participantCode.length < 3) {
      error.textContent = "Kode responden belum valid. Muat ulang halaman jika perlu.";
      return;
    }
    if (!consent.checked) {
      error.textContent = "Centang persetujuan sebelum mulai.";
      return;
    }

    button.disabled = true;
    button.textContent = "Menyiapkan sesi…";
    error.textContent = "";

    const sessionId = uuid();
    const startedAt = nowIso();

    try {
      let plan;

      if (isCloudMode) {
        const { data: assignedPlanId, error: allocationError } = await db.rpc(
          "create_study_session",
          {
            p_session_id: sessionId,
            p_participant_code: participantCode,
            p_started_at: startedAt,
            p_app_version: APP_VERSION,
            p_participant_name: participantName,
            p_study_program: studyProgram,
            p_cohort_year: cohortYear
          }
        );

        if (allocationError) throw allocationError;

        plan = PLANS.find(item => item.id === assignedPlanId);
        if (!plan) {
          throw new Error("Supabase returned an unknown counterbalancing plan.");
        }
      } else {
        plan = chooseBalancedLocalPlan();

        const sessionRow = {
          id: sessionId,
          participant_code: participantCode,
          participant_name: participantName,
          study_program: studyProgram,
          cohort_year: cohortYear,
          consent: true,
          sequence_plan: plan.id,
          started_at: startedAt,
          app_version: APP_VERSION
        };

        appendLocal("sessions", sessionRow);
      }

      state.sessionId = sessionId;
      state.participantCode = participantCode;
      state.participantName = participantName;
      state.studyProgram = studyProgram;
      state.cohortYear = cohortYear;
      state.plan = plan;
      state.trialIndex = 0;
      state.trials = [];
      state.sessionStartedAt = startedAt;
      state.sessionStartMs = Date.now();
      beginTrial();
    } catch (err) {
      console.error(err);
      error.textContent =
        "Sesi belum tersimpan. Periksa koneksi database atau konfigurasi Supabase.";
      button.disabled = false;
      button.innerHTML = 'Mulai eksperimen <span aria-hidden="true">→</span>';
    }
  }

  function beginTrial() {
    stopTimer();
    state.currentView = state.plan.order[state.trialIndex];
    state.currentSet = state.plan.setByView[state.currentView];
    state.currentTasks = TASK_SETS[state.currentSet].map(task => ({ ...task, rank: "" }));
    state.currentTrialId = uuid();
    state.trialStartedAt = null;
    state.trialStartPerf = 0;
    renderTrial();
  }

  function startTrial() {
    if (state.trialStartedAt) return;
    state.trialStartedAt = nowIso();
    state.trialStartPerf = performance.now();
    renderTrial();
    state.timerHandle = window.setInterval(updateTimer, 80);
  }

  function updateTimer() {
    const timer = document.getElementById("timer-value");
    if (!timer || !state.trialStartedAt) return;
    timer.textContent = formatMs(Date.now() - Date.parse(state.trialStartedAt));
  }

  function stopTimer() {
    if (state.timerHandle) window.clearInterval(state.timerHandle);
    state.timerHandle = null;
  }

  function renderTrial(errorText = "") {
    const viewName = state.currentView === "list" ? "List View" : "Gantt Chart";
    const viewIcon = state.currentView === "list" ? "▤" : "▥";
    const isSecond = state.trialIndex === 1;
    const showInstructionModal = !state.trialStartedAt;

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head study-head">
          <div>
            <span class="eyebrow">Ronde ${state.trialIndex + 1} dari 2</span>
            <h2>${viewName}</h2>
            <p class="lead">Urutkan task menurut prioritas berdasarkan deadline.</p>
            <div class="trial-progress">
              <span class="progress-segment active"></span>
              <span class="progress-segment ${isSecond ? "active" : ""}"></span>
              <span class="progress-caption">RONDE ${state.trialIndex + 1} / 2</span>
            </div>
          </div>
          <div class="trial-meta">
            <span class="view-chip"><span class="view-icon">${viewIcon}</span>${viewName}</span>
            <div class="timer-card"><span class="timer-label">WAKTU</span><span class="timer-value" id="timer-value">00:00.00</span></div>
          </div>
        </div>

        <div class="scenario-reminder">
          <span class="scenario-reminder-label">Acuan studi</span>
          <strong>Jumat, 16 Oktober 2026</strong>
          <span class="scenario-reminder-separator">·</span>
          <span>Tanggal ini hanya acuan simulasi, bukan waktu nyata</span>
        </div>

        <div class="error-banner ${errorText ? "visible" : ""}" id="trial-error" role="alert">${escapeHtml(errorText)}</div>

        <div class="view-container">
          <div class="view-caption">
            <span class="caption-title">${state.currentView === "list" ? "Daftar task" : "Timeline task"}</span>
            <span class="caption-right">Seret baris task untuk mengubah urutan</span>
          </div>
          <div class="view-scroll">${state.currentView === "list" ? renderListView() : renderGanttView()}</div>
        </div>

        <div class="trial-footer">
          <div class="trial-footer-note">Posisi teratas = prioritas paling penting menurut Anda.</div>
          <div class="trial-footer-actions">
            <button class="btn btn-primary" id="submit-trial" type="button">${isSecond ? "Kirim jawaban" : "Simpan & lanjut"} <span aria-hidden="true">→</span></button>
          </div>
        </div>

        ${showInstructionModal ? `
          <div class="instruction-modal-backdrop">
            <section class="instruction-modal" role="dialog" aria-modal="true" aria-labelledby="trial-instruction-title">
              <span class="modal-eyebrow">Sebelum mulai · Ronde ${state.trialIndex + 1}</span>
              <div class="modal-scenario">
                <span>SCENARIO</span>
                <strong>Jumat, 16 Oktober 2026</strong>
                <small>Tanggal ini hanya acuan simulasi dalam penelitian.</small>
              </div>
              <h3 id="trial-instruction-title">Urutkan prioritas task</h3>
              <p class="modal-main-instruction">Susun 10 tugas dari prioritas paling penting ke paling rendah dengan mempertimbangkan deadline.</p>
              <div class="modal-rule-list">
                <p><span class="modal-rule-number">1</span><span><strong>Nomor 1</strong> = prioritas paling penting menurut Anda.</span></p>
                <p><span class="modal-rule-number">↕</span><span>Seret seluruh baris untuk mengubah urutan.</span></p>
              </div>
              <p class="modal-reminder">Skenario hari pada studi ini hanya simulasi. Fokuskan penilaian pada deadline, bukan kategori atau jenis tugas.</p>
              <button class="btn btn-primary modal-start-button" id="start-trial-button" type="button">Mulai mengurutkan <span aria-hidden="true">→</span></button>
            </section>
          </div>
        ` : ""}
      </section>`;

    document.getElementById("submit-trial").addEventListener("click", handleTrialSubmit);
    const startButton = document.getElementById("start-trial-button");
    if (startButton) startButton.addEventListener("click", startTrial);
    attachReorderEvents();
    updateTimer();
  }

  function renderListView() {
    const rows = state.currentTasks.map((task, index) => `
      <tr class="task-row draggable-task-row" draggable="true" data-task-id="${task.id}" aria-label="Task ${escapeHtml(task.name)}">
        <td class="priority-col"><span class="rank-badge" aria-label="Prioritas ${index + 1}">${index + 1}</span></td>
        <td>
          <div class="task-copy">
            <span class="task-code">${task.id}</span>
            <span class="task-name">${escapeHtml(task.name)}</span>
          </div>
        </td>
        <td>${categoryPill(task.category)}</td>
        <td class="date-cell">${shortDate(task.startDay)}</td>
        <td class="date-cell deadline-cell"><strong>${shortDate(task.dueDay)}</strong></td>
      </tr>`).join("");

    return `
      <table class="task-table">
        <colgroup><col style="width:11%"><col style="width:39%"><col style="width:18%"><col style="width:14%"><col style="width:18%"></colgroup>
        <thead>
          <tr>
            <th>Prioritas</th>
            <th>Task</th>
            <th>Kategori</th>
            <th>Mulai</th>
            <th>Deadline</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderGanttView() {
    const days = Array.from({ length: 31 }, (_, i) => `<span>${i + 1}</span>`).join("");
    const rows = state.currentTasks.map((task, index) => {
      const left = ((task.startDay - 1) / 31) * 100;
      const width = ((task.dueDay - task.startDay + 1) / 31) * 100;

      return `
        <div class="gantt-row draggable-task-row" draggable="true" data-task-id="${task.id}" aria-label="Task ${escapeHtml(task.name)}">
          <div class="gantt-task">
            <span class="rank-badge" aria-label="Prioritas ${index + 1}">${index + 1}</span>
            <div class="gantt-task-copy">
              <span class="task-code">${task.id}</span>
              <span class="task-name">${escapeHtml(task.name)}</span>
              <div class="gantt-meta">
                ${categoryPill(task.category)}
                <span class="deadline-chip">Deadline ${shortDate(task.dueDay)}</span>
              </div>
            </div>
          </div>
          <div class="timeline-track">
            <span class="timeline-today" aria-hidden="true"></span>
            <div class="gantt-bar ${task.category}" style="left:${left}%;width:${width}%" title="${escapeHtml(task.name)} · ${shortDate(task.startDay)}–${shortDate(task.dueDay)}"></div>
          </div>
        </div>`;
    }).join("");

    return `
      <div class="gantt-shell">
        <div class="gantt-header">
          <div class="gantt-label-head">Prioritas / task</div>
          <div class="timeline-header">
            <div class="month-label">OKTOBER 2026</div>
            <div class="day-grid">${days}</div>
          </div>
        </div>
        <div class="timeline-rows">${rows}</div>
        <div class="gantt-bottom-note">
          <span class="legend-item"><span class="legend-dot akademis"></span>Akademis</span>
          <span class="legend-item"><span class="legend-dot lomba"></span>Lomba</span>
          <span class="legend-item"><span class="legend-dot kepanitiaan"></span>Kepanitiaan</span>
          <span class="legend-item"><span class="legend-dot organisasi"></span>Organisasi</span>
        </div>
      </div>`;
  }

  function attachReorderEvents() {
    const rows = app.querySelectorAll(".draggable-task-row");
    let draggedId = null;

    rows.forEach(row => {
      row.addEventListener("dragstart", event => {
        draggedId = row.dataset.taskId;
        row.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", draggedId);
          try {
            event.dataTransfer.setDragImage(row, 40, Math.min(24, row.offsetHeight / 2));
          } catch (_) {}
        }
      });

      row.addEventListener("dragover", event => {
        if (!draggedId || draggedId === row.dataset.taskId) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        rows.forEach(other => other.classList.remove("drag-over"));
        row.classList.add("drag-over");
      });

      row.addEventListener("drop", event => {
        event.preventDefault();
        const sourceId = draggedId || (event.dataTransfer && event.dataTransfer.getData("text/plain"));
        const targetId = row.dataset.taskId;
        if (sourceId && targetId && sourceId !== targetId) {
          reorderTask(sourceId, targetId);
        }
      });

      row.addEventListener("dragend", () => {
        draggedId = null;
        rows.forEach(other => other.classList.remove("is-dragging", "drag-over"));
      });
    });
  }

  function reorderTask(sourceId, targetId) {
    const fromIndex = state.currentTasks.findIndex(task => task.id === sourceId);
    const toIndex = state.currentTasks.findIndex(task => task.id === targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [movedTask] = state.currentTasks.splice(fromIndex, 1);
    state.currentTasks.splice(toIndex, 0, movedTask);
    renderTrial();
  }

  async function handleTrialSubmit() {
    const error = document.getElementById("trial-error");
    const button = document.getElementById("submit-trial");

    if (!state.trialStartedAt) {
      if (error) {
        error.textContent = "Klik “Mulai mengurutkan” sebelum mengirim jawaban.";
        error.classList.add("visible");
      }
      return;
    }

    if (state.currentTasks.length !== TASK_COUNT) {
      error.textContent = "Urutan tugas belum lengkap. Muat ulang ronde ini atau hubungi peneliti.";
      error.classList.add("visible");
      return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan jawaban…";
    const submittedAt = nowIso();
    const durationMs = Math.max(0, Math.round(Date.now() - Date.parse(state.trialStartedAt)));
    const expected = expectedTasks(state.currentTasks);
    const correctRankById = new Map(expected.map((task, index) => [task.id, index + 1]));
    const answers = state.currentTasks.map((task, index) => ({
      task_id: task.id,
      task_name: task.name,
      category: task.category,
      start_date: fullDate(task.startDay),
      due_date: fullDate(task.dueDay),
      selected_rank: index + 1,
      correct_rank: correctRankById.get(task.id),
      is_correct: index + 1 === correctRankById.get(task.id)
    }));
    const correctCount = answers.filter(answer => answer.is_correct).length;
    const trialRow = {
      id: state.currentTrialId,
      session_id: state.sessionId,
      condition_view: state.currentView,
      trial_order: state.trialIndex + 1,
      task_set: state.currentSet,
      started_at: state.trialStartedAt,
      submitted_at: submittedAt,
      duration_ms: durationMs,
      correct_count: correctCount,
      total_tasks: TASK_COUNT,
      accuracy_percent: Number((correctCount / TASK_COUNT * 100).toFixed(2)),
      answers,
      expected_order: expected.map(task => task.id)
    };

    try {
      if (isCloudMode) {
        const { error: insertError } = await db.from("trial_results").insert(trialRow);
        // Jika respons jaringan hilang setelah insert berhasil, retry dengan ID yang sama menghasilkan duplicate key.
        if (insertError && insertError.code !== "23505") throw insertError;
      } else {
        appendLocal("trials", trialRow);
      }
      state.trials.push(trialRow);
      stopTimer();
      if (state.trialIndex === 0) {
        state.trialIndex = 1;
        renderIntermission();
      } else {
        await finishSession();
      }
    } catch (err) {
      console.error(err);
      error.textContent = "Jawaban belum dapat dikonfirmasi tersimpan. Periksa koneksi, lalu tekan tombol simpan lagi. Jawaban Anda tetap tersedia.";
      error.classList.add("visible");
      button.disabled = false;
      button.innerHTML = state.trialIndex === 1 ? 'Kirim jawaban & selesai <span aria-hidden="true">→</span>' : 'Simpan jawaban & lanjut <span aria-hidden="true">→</span>';
    }
  }

  function renderIntermission() {
    app.innerHTML = `
      <section class="panel">
        <div class="completion simple-completion">
          <div class="success-mark">✓</div>
          <span class="eyebrow">Ronde pertama selesai</span>
          <h2>Lanjut ke tampilan berikutnya?</h2>
          <p class="lead">Instruksi singkat akan muncul sebelum Anda mulai lagi.</p>
          <button class="btn btn-primary" id="continue-trial">Lanjutkan <span aria-hidden="true">→</span></button>
        </div>
      </section>`;
    document.getElementById("continue-trial").addEventListener("click", beginTrial);
  }

  async function finishSession() {
    const totalTrialDuration = state.trials.reduce((sum, trial) => sum + trial.duration_ms, 0);
    const elapsedSessionDuration = Math.max(0, Date.now() - state.sessionStartMs);
    const totalCorrect = state.trials.reduce((sum, trial) => sum + trial.correct_count, 0);
    const totalAnswers = state.trials.reduce((sum, trial) => sum + trial.total_tasks, 0);
    const completionRow = {
      session_id: state.sessionId,
      completed_at: nowIso(),
      total_trial_duration_ms: totalTrialDuration,
      elapsed_session_duration_ms: elapsedSessionDuration,
      overall_correct_count: totalCorrect,
      overall_task_count: totalAnswers,
      overall_accuracy_percent: Number((totalCorrect / totalAnswers * 100).toFixed(2)),
      sequence_plan: state.plan.id
    };

    state.pendingCompletion = completionRow;
    if (isCloudMode) {
      try {
        const { error: insertError } = await db.from("session_completions").insert(completionRow);
        if (insertError && insertError.code !== "23505") {
          console.error(insertError);
          renderCompletion(false, "Kedua ronde tersimpan, tetapi konfirmasi penyelesaian sesi belum tersimpan. Hubungi peneliti.");
          return;
        }
      } catch (err) {
        console.error(err);
        renderCompletion(false, "Kedua ronde tersimpan, tetapi status penyelesaian belum berhasil dikirim. Hubungi peneliti.");
        return;
      }
    } else {
      appendLocal("completions", completionRow);
    }
    renderCompletion(true, "");
  }

  function renderCompletion(saved, warning) {
    stopTimer();
    app.innerHTML = `
      <section class="panel">
        <div class="completion simple-completion">
          <div class="success-mark">${saved ? "✓" : "!"}</div>
          <span class="eyebrow">${saved ? "Sesi selesai" : "Perlu perhatian"}</span>
          <h2>${saved ? "Terima kasih telah berpartisipasi." : "Sesi hampir selesai."}</h2>
          <p class="lead">${saved
            ? (isCloudMode
                ? "Jawaban Anda sudah direkam. Terima kasih telah meluangkan waktu."
                : "Terima kasih. Sesi selesai, tetapi mode demo belum mengirim data ke database peneliti.")
            : escapeHtml(warning)}</p>
          ${!saved && isCloudMode ? '<button class="btn btn-primary" id="retry-completion">Coba simpan lagi</button>' : ""}
        </div>
      </section>`;
    const retryButton = document.getElementById("retry-completion");
    if (retryButton) retryButton.addEventListener("click", retryCompletion);
  }

  async function retryCompletion() {
    const button = document.getElementById("retry-completion");
    if (!button || !state.pendingCompletion) return;
    button.disabled = true;
    button.textContent = "Mencoba menyimpan…";
    try {
      const { error } = await db.from("session_completions").insert(state.pendingCompletion);
      if (error && error.code !== "23505") throw error;
      renderCompletion(true, "");
    } catch (err) {
      console.error(err);
      button.disabled = false;
      button.textContent = "Coba simpan status selesai";
      alert("Status penyelesaian belum dapat dikirim. Data ronde tetap tersimpan; hubungi peneliti sebelum menutup halaman.");
    }
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  renderIntro();
})();
