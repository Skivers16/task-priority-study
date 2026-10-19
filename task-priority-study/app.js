(() => {
  "use strict";

  const APP_VERSION = "1.0.0";
  const REFERENCE_DATE = "2026-10-16";
  const TASK_COUNT = 10;
  const config = window.STUDY_CONFIG || {};
  const isCloudMode = Boolean(
    config.supabaseUrl &&
    config.supabasePublishableKey &&
    window.supabase &&
    typeof window.supabase.createClient === "function",
  );
  const db = isCloudMode
    ? window.supabase.createClient(
        config.supabaseUrl,
        config.supabasePublishableKey,
      )
    : null;

  const CATEGORY_LABELS = {
    akademis: "Akademis",
    lomba: "Lomba",
    kepanitiaan: "Kepanitiaan",
    organisasi: "Organisasi",
  };

  // Dua set tugas menggunakan sepuluh deadline unik yang sama untuk menjaga tingkat kesulitan relatif.
  // Urutan baris sengaja tidak mengikuti urutan deadline.
  const TASK_SETS = {
    A: [
      {
        id: "A01",
        name: "Mengumpulkan laporan praktikum",
        category: "akademis",
        startDay: 12,
        dueDay: 23,
      },
      {
        id: "A02",
        name: "Menyelesaikan validasi basis data",
        category: "akademis",
        startDay: 10,
        dueDay: 17,
      },
      {
        id: "A03",
        name: "Finalisasi desain antarmuka lomba",
        category: "lomba",
        startDay: 6,
        dueDay: 25,
      },
      {
        id: "A04",
        name: "Mengedit video teaser acara",
        category: "kepanitiaan",
        startDay: 14,
        dueDay: 20,
      },
      {
        id: "A05",
        name: "Membuat proposal kegiatan",
        category: "organisasi",
        startDay: 11,
        dueDay: 26,
      },
      {
        id: "A06",
        name: "Menyusun ringkasan evaluasi lomba",
        category: "lomba",
        startDay: 5,
        dueDay: 18,
      },
      {
        id: "A07",
        name: "Membuat desain poster publikasi",
        category: "kepanitiaan",
        startDay: 15,
        dueDay: 22,
      },
      {
        id: "A08",
        name: "Menyusun laporan program kerja",
        category: "organisasi",
        startDay: 8,
        dueDay: 24,
      },
      {
        id: "A09",
        name: "Menyiapkan presentasi proyek",
        category: "akademis",
        startDay: 9,
        dueDay: 19,
      },
      {
        id: "A10",
        name: "Melengkapi dokumen pendaftaran",
        category: "lomba",
        startDay: 3,
        dueDay: 21,
      },
    ],
    B: [
      {
        id: "B01",
        name: "Mengunggah berkas administrasi lomba",
        category: "lomba",
        startDay: 7,
        dueDay: 22,
      },
      {
        id: "B02",
        name: "Menyusun rundown final kegiatan",
        category: "kepanitiaan",
        startDay: 13,
        dueDay: 18,
      },
      {
        id: "B03",
        name: "Finalisasi desain poster lomba",
        category: "lomba",
        startDay: 9,
        dueDay: 25,
      },
      {
        id: "B04",
        name: "Mengirim notulen rapat organisasi",
        category: "organisasi",
        startDay: 10,
        dueDay: 20,
      },
      {
        id: "B05",
        name: "Menyerahkan revisi laporan penelitian",
        category: "akademis",
        startDay: 8,
        dueDay: 17,
      },
      {
        id: "B06",
        name: "Menyusun evaluasi program organisasi",
        category: "organisasi",
        startDay: 3,
        dueDay: 24,
      },
      {
        id: "B07",
        name: "Menguji prototipe fitur utama",
        category: "akademis",
        startDay: 14,
        dueDay: 21,
      },
      {
        id: "B08",
        name: "Menyiapkan lampiran presentasi",
        category: "akademis",
        startDay: 15,
        dueDay: 26,
      },
      {
        id: "B09",
        name: "Menyelesaikan draft anggaran lomba",
        category: "lomba",
        startDay: 5,
        dueDay: 19,
      },
      {
        id: "B10",
        name: "Menyelesaikan materi publikasi acara",
        category: "kepanitiaan",
        startDay: 11,
        dueDay: 23,
      },
    ],
  };

  const PLANS = [
    {
      id: "list-A__gantt-B",
      order: ["list", "gantt"],
      setByView: { list: "A", gantt: "B" },
    },
    {
      id: "list-B__gantt-A",
      order: ["list", "gantt"],
      setByView: { list: "B", gantt: "A" },
    },
    {
      id: "gantt-A__list-B",
      order: ["gantt", "list"],
      setByView: { gantt: "A", list: "B" },
    },
    {
      id: "gantt-B__list-A",
      order: ["gantt", "list"],
      setByView: { gantt: "B", list: "A" },
    },
  ];

  const state = {
    mode: isCloudMode ? "cloud" : "demo",
    sessionId: null,
    participantCode: "",
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
    pendingCompletion: null,
  };

  const app = document.getElementById("app");
  const modeLabel = document.getElementById("mode-label");
  const modeDot = document.getElementById("mode-dot");

  modeLabel.textContent = isCloudMode
    ? "Penyimpanan database aktif"
    : "Mode demo · lokal";
  if (isCloudMode) modeDot.classList.add("online");

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function")
      return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }

  function shortDate(day) {
    return `${String(day).padStart(2, "0")} Okt`;
  }
  function fullDate(day) {
    return `2026-10-${String(day).padStart(2, "0")}`;
  }
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
    return denominator
      ? `${Math.round((numerator / denominator) * 100)}%`
      : "0%";
  }
  function nowIso() {
    return new Date().toISOString();
  }
  function expectedTasks(tasks) {
    return [...tasks].sort((a, b) => a.dueDay - b.dueDay);
  }
  function categoryPill(category) {
    return `<span class="category-pill ${category}">${CATEGORY_LABELS[category]}</span>`;
  }
  function getLocalStore() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem("fieldnote-study-demo") ||
          '{"sessions":[],"trials":[],"completions":[]}',
      );
      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        trials: Array.isArray(parsed.trials) ? parsed.trials : [],
        completions: Array.isArray(parsed.completions)
          ? parsed.completions
          : [],
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
    return `<div class="date-stamp"><div class="date-day">Jum'at, 16 Oktober 2026</div><div class="date-caption">TANGGAL ACUAN PENELITIAN</div></div>`;
  }

  function renderIntro(errorText = "") {
    stopTimer();
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <div>
            <span class="eyebrow">Participant onboarding</span>
            <h1>Bagaimana Anda<br>menentukan prioritas?</h1>
            <p class="lead">Bantu penelitian ini dengan mengurutkan tugas berdasarkan deadline. Anda akan mencoba dua tampilan pengelolaan tugas: List View dan Gantt Chart.</p>
          </div>
          ${dateStamp()}
        </div>
        <div class="panel-rule"></div>
        <div class="intro-body">
          <div class="intro-grid">
            <section class="info-card soft">
              <h3>Alur eksperimen</h3>
              <p>Eksperimen terdiri dari dua ronde. Setiap ronde memiliki 10 tugas dengan tingkat kesulitan deadline yang sebanding. Seret tugas untuk menyusun urutan prioritas dari atas ke bawah.</p>
              <ol class="protocol-list">
                <li><span class="protocol-number">01</span><div><strong>Pelajari deadline</strong><span>Perhatikan tanggal jatuh tempo setiap tugas. Tanggal mulai ditampilkan sebagai konteks.</span></div></li>
                <li><span class="protocol-number">02</span><div><strong>Susun urutan prioritas</strong><span>Letakkan deadline paling dekat di posisi teratas dan deadline paling jauh di posisi terbawah.</span></div></li>
                <li><span class="protocol-number">03</span><div><strong>Lanjutkan ke tampilan kedua</strong><span>Kerjakan ronde kedua dengan aturan yang sama. Waktu dan ketepatan jawaban akan dicatat.</span></div></li>
              </ol>
            </section>
            <section class="info-card">
              <h3>Mulai sesi penelitian</h3>
              <p>Gunakan kode anonim yang diberikan peneliti. Jangan masukkan nama lengkap, alamat email, atau informasi pribadi lainnya.</p>
              <form id="start-form">
                <label class="form-label" for="participant-code">Kode responden</label>
                <input class="text-input" id="participant-code" name="participant-code" maxlength="40" minlength="3" placeholder="Contoh: RSP-024" autocomplete="off" required>
                <div class="input-hint">Gunakan kode yang sama jika peneliti meminta Anda mengulang sesi.</div>
                <label class="consent">
                  <input id="consent-check" type="checkbox" required>
                  <span>Saya telah membaca penjelasan penelitian, bersedia berpartisipasi secara sukarela, dan memahami bahwa data jawaban serta waktu pengerjaan akan direkam menggunakan kode anonim.</span>
                </label>
                <div class="privacy-note">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 5 6v5c0 4.8 3 8 7 10 4-2 7-5.2 7-10V6l-7-3Z" stroke="currentColor" stroke-width="1.7"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <span>${isCloudMode ? "Database penelitian terhubung. Jawaban akan dikirim saat Anda menyelesaikan setiap ronde." : "Mode demo aktif. Data tersimpan hanya di browser ini, bukan di database online. Hubungkan Supabase sebelum pengambilan data resmi."}</span>
                </div>
                <div class="form-actions">
                  <div class="status-message" id="start-error" role="alert">${escapeHtml(errorText)}</div>
                  <button class="btn btn-primary" type="submit" id="start-button">Mulai eksperimen <span aria-hidden="true">→</span></button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </section>`;
    document
      .getElementById("start-form")
      .addEventListener("submit", handleStart);
  }

  async function handleStart(event) {
    event.preventDefault();
    const codeInput = document.getElementById("participant-code");
    const consent = document.getElementById("consent-check");
    const error = document.getElementById("start-error");
    const button = document.getElementById("start-button");
    const participantCode = codeInput.value.trim().toUpperCase();

    if (participantCode.length < 3) {
      error.textContent = "Kode responden minimal 3 karakter.";
      codeInput.focus();
      return;
    }
    if (!consent.checked) {
      error.textContent =
        "Persetujuan partisipasi perlu dicentang sebelum mulai.";
      return;
    }

    button.disabled = true;
    button.textContent = "Menyiapkan sesi…";
    error.textContent = "";

    const plan = PLANS[Math.floor(Math.random() * PLANS.length)];
    const sessionId = uuid();
    const startedAt = nowIso();
    const sessionRow = {
      id: sessionId,
      participant_code: participantCode,
      consent: true,
      sequence_plan: plan.id,
      started_at: startedAt,
      app_version: APP_VERSION,
    };

    try {
      if (isCloudMode) {
        const { error: insertError } = await db
          .from("study_sessions")
          .insert(sessionRow);
        if (insertError) throw insertError;
      } else {
        appendLocal("sessions", sessionRow);
      }
      state.sessionId = sessionId;
      state.participantCode = participantCode;
      state.plan = plan;
      state.trialIndex = 0;
      state.trials = [];
      state.sessionStartedAt = startedAt;
      state.sessionStartMs = Date.now();
      beginTrial();
    } catch (err) {
      console.error(err);
      error.textContent =
        "Sesi belum tersimpan. Periksa koneksi database atau konfigurasi Supabase, lalu coba lagi.";
      button.disabled = false;
      button.innerHTML = 'Mulai eksperimen <span aria-hidden="true">→</span>';
    }
  }

  function beginTrial() {
    stopTimer();
    state.currentView = state.plan.order[state.trialIndex];
    state.currentSet = state.plan.setByView[state.currentView];
    state.currentTasks = TASK_SETS[state.currentSet].map((task) => ({
      ...task,
      rank: "",
    }));
    state.currentTrialId = uuid();
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
    const instruction =
      "Seret tugas dari atas ke bawah berdasarkan deadline. Tugas dengan deadline paling dekat harus berada di posisi pertama; deadline paling jauh berada di posisi terakhir.";
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head study-head">
          <div>
            <span class="eyebrow">Experiment in progress</span>
            <h2>${viewName}</h2>
            <p class="lead">Seret tugas untuk mengurutkan prioritas dari posisi teratas ke terbawah. Jawaban tidak dapat diubah setelah dikirim.</p>
            <div class="trial-progress">
              <span class="progress-segment active"></span>
              <span class="progress-segment ${isSecond ? "active" : ""}"></span>
              <span class="progress-caption">RONDE ${state.trialIndex + 1} DARI 2</span>
            </div>
          </div>
          <div class="trial-meta">
            <span class="view-chip"><span class="view-icon">${viewIcon}</span>${viewName}</span>
            <div class="timer-card"><span class="timer-label">WAKTU</span><span class="timer-value" id="timer-value">00:00.00</span></div>
          </div>
        </div>
        <div class="instruction-strip">
          <div class="instruction-icon">i</div>
          <div><strong>Instruksi tugas</strong><p>${instruction} Gunakan ikon pegangan untuk drag and drop. Pada layar sentuh, Anda juga dapat menggunakan tombol panah naik/turun.</p></div>
        </div>
        <div class="error-banner ${errorText ? "visible" : ""}" id="trial-error" role="alert">${escapeHtml(errorText)}</div>
        <div class="view-container">
          <div class="view-caption"><span class="caption-title">${state.currentView === "list" ? "Daftar tugas / task list" : "Timeline tugas / October 2026"}</span><span class="caption-right">Seret baris untuk mengubah urutan · 10 tugas</span></div>
          <div class="view-scroll">${state.currentView === "list" ? renderListView() : renderGanttView()}</div>
          <div class="table-footnote"><b>Catatan:</b> deadline yang lebih dekat mendapatkan prioritas lebih tinggi. Tanggal acuan: 16 Okt 2026.</div>
        </div>
        <div class="trial-footer">
          <div class="trial-footer-note"><strong>Urutan teratas = prioritas tertinggi.</strong><br>Timer berjalan sejak tampilan ronde ini muncul.</div>
          <div class="trial-footer-actions">
            <button class="btn btn-primary" id="submit-trial" type="button">${isSecond ? "Kirim jawaban & selesai" : "Simpan jawaban & lanjut"} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </section>`;
    document
      .getElementById("submit-trial")
      .addEventListener("click", handleTrialSubmit);
    attachReorderEvents();
    updateTimer();
  }

  function renderListView() {
    const rows = state.currentTasks
      .map(
        (task, index) => `
      <tr class="task-row draggable-task-row" draggable="true" data-task-id="${task.id}">
        <td>
          <div class="task-cell-content">
            <button type="button" class="drag-handle" aria-label="Seret untuk mengurutkan ${escapeHtml(task.name)}" title="Seret untuk mengurutkan">⠿</button>
            <div class="task-copy"><span class="task-code">${task.id}</span><span class="task-name">${escapeHtml(task.name)}</span></div>
          </div>
        </td>
        <td>${categoryPill(task.category)}</td>
        <td class="date-cell">${shortDate(task.startDay)}</td>
        <td class="arrow-cell">→</td>
        <td class="date-cell"><strong>${shortDate(task.dueDay)}</strong></td>
        <td>
          <div class="order-control">
            <span class="rank-badge" aria-label="Prioritas ${index + 1}">${index + 1}</span>
            <div class="move-controls">
              <button type="button" class="move-task" data-task-id="${task.id}" data-direction="-1" aria-label="Naikkan ${escapeHtml(task.name)}" title="Naikkan" ${index === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="move-task" data-task-id="${task.id}" data-direction="1" aria-label="Turunkan ${escapeHtml(task.name)}" title="Turunkan" ${index === state.currentTasks.length - 1 ? "disabled" : ""}>↓</button>
            </div>
          </div>
        </td>
      </tr>`,
      )
      .join("");
    return `
      <table class="task-table">
        <colgroup><col style="width:34%"><col style="width:15%"><col style="width:11%"><col style="width:4%"><col style="width:12%"><col style="width:24%"></colgroup>
        <thead><tr><th>Task list / drag</th><th>Kategori</th><th>Mulai</th><th></th><th>Deadline</th><th>Urutan prioritas</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderGanttView() {
    const days = Array.from(
      { length: 31 },
      (_, i) => `<span>${i + 1}</span>`,
    ).join("");
    const rows = state.currentTasks
      .map((task, index) => {
        const left = ((task.startDay - 1) / 31) * 100;
        const width = ((task.dueDay - task.startDay + 1) / 31) * 100;
        return `
        <div class="gantt-row draggable-task-row" draggable="true" data-task-id="${task.id}">
          <div class="gantt-task">
            <button type="button" class="drag-handle gantt-drag-handle" aria-label="Seret untuk mengurutkan ${escapeHtml(task.name)}" title="Seret untuk mengurutkan">⠿</button>
            <div class="gantt-task-copy"><span class="task-code">${task.id}</span><span class="task-name">${escapeHtml(task.name)}</span></div>
            ${categoryPill(task.category)}
            <div class="gantt-order">
              <span class="rank-badge" aria-label="Prioritas ${index + 1}">${index + 1}</span>
              <div class="move-controls">
                <button type="button" class="move-task" data-task-id="${task.id}" data-direction="-1" aria-label="Naikkan ${escapeHtml(task.name)}" title="Naikkan" ${index === 0 ? "disabled" : ""}>↑</button>
                <button type="button" class="move-task" data-task-id="${task.id}" data-direction="1" aria-label="Turunkan ${escapeHtml(task.name)}" title="Turunkan" ${index === state.currentTasks.length - 1 ? "disabled" : ""}>↓</button>
              </div>
            </div>
          </div>
          <div class="timeline-track"><span class="timeline-today" aria-hidden="true"></span>
            <div class="gantt-bar ${task.category}" style="left:${left}%;width:${width}%" title="${escapeHtml(task.name)} · ${shortDate(task.startDay)}–${shortDate(task.dueDay)}"></div>
          </div>
        </div>`;
      })
      .join("");
    return `
      <div class="gantt-shell">
        <div class="gantt-header">
          <div class="gantt-label-head">Tugas / kategori / prioritas</div>
          <div class="timeline-header"><div class="month-label">OKTOBER 2026</div><div class="day-grid">${days}</div></div>
        </div>
        <div class="timeline-rows">${rows}</div>
        <div class="gantt-bottom-note">
          <span class="legend-item"><span class="legend-dot akademis"></span>Akademis</span>
          <span class="legend-item"><span class="legend-dot lomba"></span>Lomba</span>
          <span class="legend-item"><span class="legend-dot kepanitiaan"></span>Kepanitiaan</span>
          <span class="legend-item"><span class="legend-dot organisasi"></span>Organisasi</span>
          <span>● Batang menunjukkan durasi tugas; urutan baris menunjukkan prioritas</span>
        </div>
      </div>`;
  }

  function attachReorderEvents() {
    const rows = app.querySelectorAll(".draggable-task-row");
    let draggedId = null;

    rows.forEach((row) => {
      row.addEventListener("dragstart", (event) => {
        if (!event.target.closest(".drag-handle")) {
          event.preventDefault();
          return;
        }
        draggedId = row.dataset.taskId;
        row.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", draggedId);
        }
      });

      row.addEventListener("dragover", (event) => {
        if (!draggedId || draggedId === row.dataset.taskId) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        rows.forEach((other) => other.classList.remove("drag-over"));
        row.classList.add("drag-over");
      });

      row.addEventListener("drop", (event) => {
        event.preventDefault();
        const sourceId =
          draggedId ||
          (event.dataTransfer && event.dataTransfer.getData("text/plain"));
        const targetId = row.dataset.taskId;
        if (sourceId && targetId && sourceId !== targetId)
          reorderTask(sourceId, targetId);
      });

      row.addEventListener("dragend", () => {
        draggedId = null;
        rows.forEach((other) =>
          other.classList.remove("is-dragging", "drag-over"),
        );
      });
    });

    app.querySelectorAll(".move-task").forEach((button) => {
      button.addEventListener("click", () => {
        const taskId = button.dataset.taskId;
        const direction = Number(button.dataset.direction);
        moveTask(taskId, direction);
      });
    });
  }

  function reorderTask(sourceId, targetId) {
    const fromIndex = state.currentTasks.findIndex(
      (task) => task.id === sourceId,
    );
    const toIndex = state.currentTasks.findIndex(
      (task) => task.id === targetId,
    );
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [movedTask] = state.currentTasks.splice(fromIndex, 1);
    state.currentTasks.splice(toIndex, 0, movedTask);
    renderTrial();
  }

  function moveTask(taskId, direction) {
    const fromIndex = state.currentTasks.findIndex(
      (task) => task.id === taskId,
    );
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= state.currentTasks.length)
      return;
    const [movedTask] = state.currentTasks.splice(fromIndex, 1);
    state.currentTasks.splice(toIndex, 0, movedTask);
    renderTrial();
  }

  async function handleTrialSubmit() {
    const error = document.getElementById("trial-error");
    const button = document.getElementById("submit-trial");

    if (state.currentTasks.length !== TASK_COUNT) {
      error.textContent =
        "Urutan tugas belum lengkap. Muat ulang ronde ini atau hubungi peneliti.";
      error.classList.add("visible");
      return;
    }

    button.disabled = true;
    button.textContent = "Menyimpan jawaban…";
    const submittedAt = nowIso();
    const durationMs = Math.max(
      0,
      Math.round(Date.now() - Date.parse(state.trialStartedAt)),
    );
    const expected = expectedTasks(state.currentTasks);
    const correctRankById = new Map(
      expected.map((task, index) => [task.id, index + 1]),
    );
    const answers = state.currentTasks.map((task, index) => ({
      task_id: task.id,
      task_name: task.name,
      category: task.category,
      start_date: fullDate(task.startDay),
      due_date: fullDate(task.dueDay),
      selected_rank: index + 1,
      correct_rank: correctRankById.get(task.id),
      is_correct: index + 1 === correctRankById.get(task.id),
    }));
    const correctCount = answers.filter((answer) => answer.is_correct).length;
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
      accuracy_percent: Number(((correctCount / TASK_COUNT) * 100).toFixed(2)),
      answers,
      expected_order: expected.map((task) => task.id),
    };

    try {
      if (isCloudMode) {
        const { error: insertError } = await db
          .from("trial_results")
          .insert(trialRow);
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
      error.textContent =
        "Jawaban belum dapat dikonfirmasi tersimpan. Periksa koneksi, lalu tekan tombol simpan lagi. Jawaban Anda tetap tersedia.";
      error.classList.add("visible");
      button.disabled = false;
      button.innerHTML =
        state.trialIndex === 1
          ? 'Kirim jawaban & selesai <span aria-hidden="true">→</span>'
          : 'Simpan jawaban & lanjut <span aria-hidden="true">→</span>';
    }
  }

  function renderIntermission() {
    app.innerHTML = `
      <section class="panel">
        <div class="completion">
          <div class="success-mark">✓</div>
          <span class="eyebrow">Ronde pertama tersimpan</span>
          <h2>Terima kasih. Lanjutkan ke tampilan berikutnya.</h2>
          <p class="lead">Jawaban ronde pertama sudah direkam. Untuk menjaga hasil eksperimen, skor benar belum ditampilkan sampai kedua ronde selesai.</p>
          <div class="result-grid">
            <div class="metric-card"><span class="metric-label">Ronde selesai</span><span class="metric-value">01 / 02</span><span class="metric-sub">Satu ronde tersisa</span></div>
            <div class="metric-card"><span class="metric-label">Tugas berikutnya</span><span class="metric-value">${state.plan.order[1] === "list" ? "List View" : "Gantt Chart"}</span><span class="metric-sub">Dataset setara</span></div>
            <div class="metric-card"><span class="metric-label">Penyimpanan</span><span class="metric-value">${isCloudMode ? "Online" : "Demo"}</span><span class="metric-sub">${isCloudMode ? "Database terhubung" : "Browser lokal"}</span></div>
          </div>
          <button class="btn btn-primary" id="continue-trial">Mulai ronde kedua <span aria-hidden="true">→</span></button>
        </div>
      </section>`;
    document
      .getElementById("continue-trial")
      .addEventListener("click", beginTrial);
  }

  async function finishSession() {
    const totalTrialDuration = state.trials.reduce(
      (sum, trial) => sum + trial.duration_ms,
      0,
    );
    const elapsedSessionDuration = Math.max(
      0,
      Date.now() - state.sessionStartMs,
    );
    const totalCorrect = state.trials.reduce(
      (sum, trial) => sum + trial.correct_count,
      0,
    );
    const totalAnswers = state.trials.reduce(
      (sum, trial) => sum + trial.total_tasks,
      0,
    );
    const completionRow = {
      session_id: state.sessionId,
      completed_at: nowIso(),
      total_trial_duration_ms: totalTrialDuration,
      elapsed_session_duration_ms: elapsedSessionDuration,
      overall_correct_count: totalCorrect,
      overall_task_count: totalAnswers,
      overall_accuracy_percent: Number(
        ((totalCorrect / totalAnswers) * 100).toFixed(2),
      ),
      sequence_plan: state.plan.id,
    };

    state.pendingCompletion = completionRow;
    if (isCloudMode) {
      try {
        const { error: insertError } = await db
          .from("session_completions")
          .insert(completionRow);
        if (insertError && insertError.code !== "23505") {
          console.error(insertError);
          renderCompletion(
            false,
            "Kedua ronde tersimpan, tetapi konfirmasi penyelesaian sesi belum tersimpan. Hubungi peneliti.",
          );
          return;
        }
      } catch (err) {
        console.error(err);
        renderCompletion(
          false,
          "Kedua ronde tersimpan, tetapi status penyelesaian belum berhasil dikirim. Hubungi peneliti.",
        );
        return;
      }
    } else {
      appendLocal("completions", completionRow);
    }
    renderCompletion(true, "");
  }

  function renderCompletion(saved, warning) {
    stopTimer();
    const totalTrialDuration = state.trials.reduce(
      (sum, trial) => sum + trial.duration_ms,
      0,
    );
    const totalCorrect = state.trials.reduce(
      (sum, trial) => sum + trial.correct_count,
      0,
    );
    const totalAnswers = state.trials.reduce(
      (sum, trial) => sum + trial.total_tasks,
      0,
    );
    const rows = state.trials
      .map(
        (trial) => `
      <tr>
        <td><strong>${trial.condition_view === "list" ? "List View" : "Gantt Chart"}</strong><br><span class="task-code">Dataset ${trial.task_set}</span></td>
        <td>${formatSeconds(trial.duration_ms)}</td>
        <td>${trial.correct_count} / ${trial.total_tasks}</td>
        <td><strong>${trial.accuracy_percent}%</strong></td>
      </tr>`,
      )
      .join("");
    const sessionExport = {
      session: {
        session_id: state.sessionId,
        participant_code: state.participantCode,
        sequence_plan: state.plan.id,
        started_at: state.sessionStartedAt,
        completed_at: state.pendingCompletion
          ? state.pendingCompletion.completed_at
          : nowIso(),
        app_version: APP_VERSION,
        storage_mode: state.mode,
      },
      trials: state.trials,
      completion: state.pendingCompletion,
      note: "Data menggunakan kode responden anonim. Peringkat benar dihitung dari deadline paling dekat ke paling jauh.",
    };
    state.exportPayload = sessionExport;

    app.innerHTML = `
      <section class="panel">
        <div class="completion">
          <div class="success-mark">${saved ? "✓" : "!"}</div>
          <span class="eyebrow">${saved ? "Experiment completed" : "Completion needs attention"}</span>
          <h2>${saved ? "Sesi Anda selesai." : "Jawaban ronde sudah direkam."}</h2>
          <p class="lead">${saved ? "Terima kasih telah berpartisipasi. Waktu pengerjaan dan ketepatan jawaban untuk kedua tampilan sudah dihitung." : escapeHtml(warning)}</p>
          <div class="result-grid">
            <div class="metric-card"><span class="metric-label">Akurasi keseluruhan</span><span class="metric-value">${formatPercent(totalCorrect, totalAnswers)}</span><span class="metric-sub">${totalCorrect} dari ${totalAnswers} peringkat tepat</span></div>
            <div class="metric-card"><span class="metric-label">Waktu aktif</span><span class="metric-value">${formatMs(totalTrialDuration).split(".")[0]}</span><span class="metric-sub">Total waktu kedua ronde</span></div>
            <div class="metric-card"><span class="metric-label">Mode penyimpanan</span><span class="metric-value">${isCloudMode ? "Online" : "Demo"}</span><span class="metric-sub">${isCloudMode ? "Supabase" : "Browser ini saja"}</span></div>
          </div>
          <h3 style="margin-bottom:10px">Ringkasan per tampilan</h3>
          <table class="result-table">
            <thead><tr><th>Tampilan</th><th>Durasi</th><th>Jawaban tepat</th><th>Akurasi</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="result-actions">
            <button class="btn btn-primary" id="download-session">Unduh data sesi (.json) <span aria-hidden="true">↓</span></button>
            ${!isCloudMode ? '<button class="btn btn-secondary" id="download-all">Ekspor semua data demo (.json)</button>' : ""}
            ${!saved && isCloudMode ? '<button class="btn btn-secondary" id="retry-completion">Coba simpan status selesai</button>' : ""}
          </div>
          <div class="session-code">SESSION ID · ${escapeHtml(state.sessionId)}</div>
          <p class="completion-footnote">${isCloudMode ? "Data penelitian sudah dikirim ke database Supabase. Peneliti dapat mengekspor seluruh hasil dari SQL Editor Supabase." : "Ini masih mode demo. Data berada di local storage browser ini dan tidak akan terkumpul otomatis di perangkat peneliti. Hubungkan Supabase sebelum mengundang responden."}</p>
        </div>
      </section>`;
    document
      .getElementById("download-session")
      .addEventListener("click", () =>
        downloadJson(
          state.exportPayload,
          `hasil-sesi-${state.participantCode}.json`,
        ),
      );
    const allButton = document.getElementById("download-all");
    if (allButton)
      allButton.addEventListener("click", () =>
        downloadJson(getLocalStore(), "semua-data-demo.json"),
      );
    const retryButton = document.getElementById("retry-completion");
    if (retryButton) retryButton.addEventListener("click", retryCompletion);
  }

  async function retryCompletion() {
    const button = document.getElementById("retry-completion");
    if (!button || !state.pendingCompletion) return;
    button.disabled = true;
    button.textContent = "Mencoba menyimpan…";
    try {
      const { error } = await db
        .from("session_completions")
        .insert(state.pendingCompletion);
      if (error && error.code !== "23505") throw error;
      renderCompletion(true, "");
    } catch (err) {
      console.error(err);
      button.disabled = false;
      button.textContent = "Coba simpan status selesai";
      alert(
        "Status penyelesaian belum dapat dikirim. Data ronde tetap tersimpan; hubungi peneliti sebelum menutup halaman.",
      );
    }
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
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
