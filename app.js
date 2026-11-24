// AX Project Tracker — front end. Data and access rules live in Supabase (see supabase/).
(() => {
  const PH = ["Idea", "Scoping", "Build", "Pilot", "Live"];
  const ST = { ok: "On track", risk: "At risk", block: "Blocked", done: "Done" };
  const TS = ["todo", "doing", "review", "done"];
  const TL = { todo: "To do", doing: "In progress", review: "Review", done: "Done" };
  const VIEWS = ["portfolio", "tasks", "weekly", "members"];
  const DEPTS = ["HR", "Finance", "Creative", "Strategy", "New Business", "B2B (Telesales)", "Digital (SEIN account)", "IT"];

  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
  const fd = (d) => {
    if (!d) return "";
    const x = new Date(String(d).slice(0, 10) + "T00:00:00");
    return isNaN(x) ? "" : x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  const days = (d) => (new Date(today()) - new Date(String(d).slice(0, 10))) / 864e5;
  const stc = (s) => (ST[s] ? s : "ok");
  const show = (id) => { for (const s of ["setup", "signin", "noaccess", "app"]) $("#" + s).hidden = s !== id; };
  const msg = (t) => { $("#msg").textContent = t || ""; };
  const gmsg = (t) => { $("#gmsg").textContent = t || ""; };

  const cfg = window.AX_CONFIG || {};
  if (!window.supabase || !cfg.supabaseUrl || cfg.supabaseUrl.includes("YOUR-PROJECT") || !cfg.supabaseAnonKey || cfg.supabaseAnonKey.startsWith("YOUR-")) {
    show("setup");
    return;
  }
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  let me = "", role = null, P = [], T = [], U = [], C = [], M = [], fP = "", fO = "", fD = "", chan = null, rt = 0;
  let openKind = null, openId = null; // which dialog is open, for live comment refresh
  const canEdit = () => role === "owner" || role === "editor";
  const sortedP = () => [...P].sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99) || String(a.name).localeCompare(b.name));
  const pn = (id) => (P.find((p) => p.id === id) || {}).name || "No project";
  const nm = (email) => (M.find((m) => m.email === email) || {}).name || String(email || "Someone").split("@")[0];
  const depts = () => [...new Set([...P.map((p) => p.department).filter(Boolean), ...DEPTS])].sort();
  const pComments = (id) => C.filter((c) => c.project_id === id && !c.task_id);
  const tComments = (id) => C.filter((c) => c.task_id === id);
  const openAll = (pid) => C.filter((c) => c.project_id === pid && !c.resolved).length;
  const fail = (e) => { msg(e?.message ? "Couldn't save: " + e.message : "Couldn't save. Try again."); };

  // ---------- auth ----------
  let startSeq = 0;
  async function start(session) {
    const seq = ++startSeq;
    if (!session) { role = null; show("signin"); return; }
    me = String(session.user.email || "").toLowerCase();
    const { data, error } = await sb.rpc("my_role");
    if (seq !== startSeq) return;
    if (error) { show("signin"); gmsg("Couldn't check your access: " + error.message); return; }
    role = data || null;
    if (!role) { $("#na-email").textContent = me; show("noaccess"); return; }
    document.body.classList.toggle("ro", !canEdit());
    document.body.classList.toggle("isowner", role === "owner");
    $("#who").textContent = me + " · " + role;
    show("app");
    route();
    await load();
    if (!chan) {
      chan = sb.channel("ax-tracker")
        .on("postgres_changes", { event: "*", schema: "public" }, () => { clearTimeout(rt); rt = setTimeout(load, 400); })
        .subscribe();
    }
  }
  // Supabase advises against awaiting its own calls inside this callback, so defer.
  sb.auth.onAuthStateChange((_ev, session) => { setTimeout(() => start(session), 0); });

  $("#sif").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#si-email").value.trim().toLowerCase();
    const password = $("#si-pass").value;
    if (!email) return;
    if (!password) { gmsg("Enter your password, or use the sign-in link below."); $("#si-pass").focus(); return; }
    const b = $("#si-btn");
    b.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    b.disabled = false;
    gmsg(error ? (error.message === "Invalid login credentials" ? "Wrong email or password." : "Couldn't sign in: " + error.message) : "");
  });
  $("#si-link").addEventListener("click", async () => {
    const email = $("#si-email").value.trim().toLowerCase();
    if (!email || !$("#si-email").checkValidity()) { gmsg("Enter your work email first."); $("#si-email").focus(); return; }
    const b = $("#si-link");
    b.disabled = true;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    b.disabled = false;
    gmsg(error ? "Couldn't send the link: " + error.message : "Check your inbox for a sign-in link. It can take a minute.");
  });
  const signOut = async () => { if (chan) { sb.removeChannel(chan); chan = null; } await sb.auth.signOut(); };
  $("#out").onclick = signOut;
  $("#na-out").onclick = signOut;

  // ---------- data ----------
  async function load() {
    const q = (t) => sb.from(t).select("*");
    const [p, t, u, c, m] = await Promise.all([
      q("projects"), q("tasks"), q("updates").order("date", { ascending: false }),
      q("comments").order("created_at"), q("members").order("email"),
    ]);
    const err = [p, t, u, c, m].find((r) => r.error);
    if (err) msg("Couldn't load everything: " + err.error.message);
    else msg("");
    P = p.data || []; T = t.data || []; U = u.data || []; C = c.data || []; M = m.data || [];
    render();
    if (openKind && $("#cmlist")) renderComments();
  }

  // ---------- routing ----------
  function route() {
    let v = location.hash.slice(1);
    if (!VIEWS.includes(v) || (v === "members" && role !== "owner")) v = "portfolio";
    for (const k of VIEWS) $("#v-" + k).hidden = k !== v;
    document.querySelectorAll("nav a").forEach((a) => {
      if (a.dataset.v === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", route);

  // ---------- render ----------
  function render() {
    const ps = sortedP();
    const act = P.filter((p) => p.status !== "done");
    const n = (s) => P.filter((p) => stc(p.status) === s).length;
    const open = T.filter((t) => t.status !== "done");
    const late = open.filter((t) => t.due && days(t.due) > 0);

    const last = [...P.map((p) => p.updated_at), ...U.map((u) => u.created_at)].filter(Boolean).sort().pop();
    $("#upd").textContent = last ? "last updated " + fd(last) + " " + String(last).slice(0, 4) : "no updates yet";
    $("#key").textContent = P.length
      ? `${n("ok")} of ${act.length} active AX projects on track` +
        (n("risk") ? `, ${n("risk")} at risk` : "") + (n("block") ? `, ${n("block")} blocked` : "") + "."
      : "No projects yet.";

    const K = [["Active projects", act.length, ""], ["On track", n("ok"), "ok"], ["At risk", n("risk"), "risk"],
      ["Blocked", n("block"), "block"], ["Open tasks", open.length, ""], ["Overdue tasks", late.length, late.length ? "block" : ""]];
    $("#kpis").innerHTML = K.map(([l, v, c]) => `<div class="kpi"><b class="num ${c}">${v}</b><span>${l}</span></div>`).join("");
    $("#phh").innerHTML = PH.map((p) => `<span>${p}</span>`).join("");

    const used = [...new Set(P.map((p) => p.department).filter(Boolean))].sort();
    if (fD && !used.includes(fD)) fD = "";
    $("#fD").innerHTML = `<option value="">All departments</option>` + used.map((d) => `<option value="${esc(d)}"${d === fD ? " selected" : ""}>${esc(d)}</option>`).join("");
    const shown = ps.filter((p) => !fD || p.department === fD);
    $("#pipe").innerHTML = shown.length ? shown.map((p) => {
      const i = Math.max(0, PH.indexOf(p.phase)), c = stc(p.status), pct = (k) => (k / (PH.length - 1)) * 100;
      const oc = openAll(p.id);
      return `<button class="row" data-p="${esc(p.id)}">
        <div><b>${esc(p.name)}</b><small>${esc(p.area)}</small>${p.department ? `<span class="dept">${esc(p.department)}</span>` : ""}
          <div class="chips"><span class="pill ${c}">${ST[c]} · ${esc(PH[i])}</span>${oc ? `<span class="badge">${oc} comment${oc > 1 ? "s" : ""}</span>` : ""}</div></div>
        <div class="track ${c}" aria-label="Phase ${esc(PH[i])} of ${PH.length}"><span class="fill" style="width:${pct(i)}%"></span>${PH.map((_, k) => `<span class="st${k <= i ? " on" : ""}" style="left:${pct(k)}%"></span>`).join("")}<span class="cur" style="left:${pct(i)}%"></span></div>
        <div class="ms">${esc(p.next) || "Next milestone not set"}<br><em>${p.next_date ? "by " + esc(fd(p.next_date)) : "date to confirm"}</em>${p.blocker ? `<br><span class="block">Blocker: ${esc(p.blocker)}</span>` : ""}</div>
      </button>`;
    }).join("") : `<p class="empty">${P.length ? "No projects in this department." : "No projects yet."}</p>`;

    const lg = U.filter((u) => days(u.date) <= 14).sort((a, b) => String(b.date).localeCompare(a.date));
    $("#log").innerHTML = lg.length
      ? lg.map((u) => `<li><time>${esc(fd(u.date))}</time><span class="pn">${esc(pn(u.project_id))}</span><span>${esc(u.text)}</span></li>`).join("")
      : `<li class="empty">No updates logged in the last 14 days.</li>`;

    // tasks
    const owners = [...new Set(T.map((t) => t.owner).filter(Boolean))].sort();
    $("#fP").innerHTML = `<option value="">All projects</option>` + ps.map((p) => `<option value="${esc(p.id)}"${p.id === fP ? " selected" : ""}>${esc(p.name)}</option>`).join("");
    $("#fO").innerHTML = `<option value="">Everyone</option>` + owners.map((o) => `<option value="${esc(o)}"${o === fO ? " selected" : ""}>${esc(o)}</option>`).join("");
    const ft = T.filter((t) => (!fP || t.project_id === fP) && (!fO || t.owner === fO))
      .sort((a, b) => String(a.due || "9").localeCompare(b.due || "9"));
    $("#kan").innerHTML = TS.map((s) => {
      const L = ft.filter((t) => (t.status || "todo") === s);
      return `<div class="col"><h3>${TL[s]}<span>${L.length}</span></h3>${L.map((t) => {
        const lt = s !== "done" && t.due && days(t.due) > 0;
        const oc = tComments(t.id).filter((c) => !c.resolved).length;
        return `<button class="task" data-t="${esc(t.id)}"><b>${esc(t.title)}</b><small><span>${esc(pn(t.project_id))}</span><span>${esc(t.owner || "Unassigned")}</span>${t.due ? `<span class="${lt ? "late" : ""}">${lt ? "Overdue · " : "Due "}${esc(fd(t.due))}</span>` : ""}${oc ? `<span class="badge">${oc} comment${oc > 1 ? "s" : ""}</span>` : ""}</small></button>`;
      }).join("") || `<p class="empty">Nothing here.</p>`}</div>`;
    }).join("");

    $("#dig").textContent = digest();

    // members
    $("#mem").innerHTML = M.map((m) => `<tr>
      <td>${esc(m.name)}</td><td>${esc(m.email)}</td>
      <td><select data-role="${esc(m.email)}" aria-label="Role for ${esc(m.email)}"${m.email === me ? " disabled" : ""}>${["viewer", "editor", "owner"].map((r) => `<option value="${r}"${r === m.role ? " selected" : ""}>${r[0].toUpperCase() + r.slice(1)}</option>`).join("")}</select></td>
      <td>${m.email === me ? `<span class="sub">You</span>` : `<button class="ghost small" data-rm="${esc(m.email)}">Remove</button>`}</td></tr>`).join("");
  }

  function digest() {
    if (!P.length) return "No projects yet.";
    const ps = sortedP(), n = (s) => P.filter((p) => stc(p.status) === s).length;
    let o = `AX projects – weekly update (${fd(today())} ${today().slice(0, 4)})\n\n`;
    o += `Summary: ${P.filter((p) => p.status !== "done").length} active projects – ${n("ok")} on track, ${n("risk")} at risk, ${n("block")} blocked.\n`;
    o += `\nBy project:\n`;
    for (const p of ps) {
      const wk = U.filter((u) => u.project_id === p.id && days(u.date) <= 7);
      o += `\n${p.name}${p.department ? " (" + p.department + ")" : ""} [${ST[stc(p.status)]} · ${p.phase || "Idea"}]\n`;
      o += wk.length ? wk.map((u) => `  – ${u.text}`).join("\n") + "\n" : `  – No change this week\n`;
      if (p.next) o += `  Next: ${p.next}${p.next_date ? " (by " + fd(p.next_date) + ")" : ""}\n`;
      if (p.blocker) o += `  Blocker: ${p.blocker}\n`;
    }
    return o;
  }

  // ---------- dialogs ----------
  const ov = $("#ov"), dlg = $("#dlg");
  const close = () => { ov.classList.remove("show"); dlg.innerHTML = ""; openKind = openId = null; };
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ov.classList.contains("show")) close(); });
  const opt = (arr, v, lab) => arr.map((x) => `<option value="${esc(x)}"${x === v ? " selected" : ""}>${esc(lab ? lab[x] : x)}</option>`).join("");
  const confirmTwice = (btn, fn) => { btn.onclick = () => { if (btn.dataset.c) fn(); else { btn.dataset.c = "1"; btn.textContent = "Click again to delete"; } }; };
  const commentBlock = `<div class="sec" id="cmsec"><h3>Comments</h3><div id="cmlist"></div>
    <form class="cmf" id="cmf"><textarea id="cm-body" maxlength="4000" placeholder="Write a comment or question" required></textarea><button>Post</button></form></div>`;

  function wireComments(projectId, taskId) {
    renderComments();
    $("#cmf").onsubmit = async (e) => {
      e.preventDefault();
      const body = $("#cm-body").value.trim();
      if (!body) return;
      const b = e.target.querySelector("button");
      b.disabled = true;
      const row = { project_id: projectId, body };
      if (taskId) row.task_id = taskId;
      const { error } = await sb.from("comments").insert(row);
      b.disabled = false;
      if (error) return fail(error);
      $("#cm-body").value = "";
      await load();
    };
  }

  function renderComments() {
    const el = $("#cmlist");
    if (!el || !openId) return;
    const list = openKind === "task" ? tComments(openId) : pComments(openId);
    el.innerHTML = list.length ? list.map((c) => {
      const mine = c.author === me;
      return `<div class="cm${c.resolved ? " res" : ""}"><div class="h"><span><b>${esc(nm(c.author))}</b> · ${esc(fd(c.created_at))}</span>${c.resolved ? "<span>Resolved</span>" : ""}</div>
        <p>${esc(c.body)}</p>
        <div class="ca">${(canEdit() || mine) ? `<button class="ghost small" data-res="${esc(c.id)}" data-val="${c.resolved ? "0" : "1"}">${c.resolved ? "Reopen" : "Resolve"}</button>` : ""}${(role === "owner" || mine) ? `<button class="ghost small" data-del="${esc(c.id)}">Delete</button>` : ""}</div></div>`;
    }).join("") : `<p class="empty">No comments yet.</p>`;
  }

  function openP(id) {
    const p = P.find((x) => x.id === id) || { phase: "Idea", status: "ok" };
    const ro = !canEdit(), dis = ro ? " disabled" : "";
    const h = U.filter((u) => u.project_id === id).sort((a, b) => String(b.date).localeCompare(a.date));
    const taskNotes = id ? T.filter((t) => t.project_id === id).reduce((s, t) => s + tComments(t.id).filter((c) => !c.resolved).length, 0) : 0;
    openKind = id ? "project" : null; openId = id || null;
    dlg.innerHTML = `<h2>${id ? esc(p.name) : "New project"}</h2>
      <form class="f" id="pf">
        <label class="w2">Project name<input id="p-name" required maxlength="120" value="${esc(p.name)}"${dis}></label>
        <label>Client or area<input id="p-area" value="${esc(p.area)}"${dis}></label>
        <label>Related department<input id="p-dept" list="deptlist" value="${esc(p.department)}"${dis}><datalist id="deptlist">${depts().map((d) => `<option value="${esc(d)}">`).join("")}</datalist></label>
        <label>Owner<input id="p-owner" value="${esc(p.owner)}"${dis}></label>
        <label>Phase<select id="p-phase"${dis}>${opt(PH, p.phase)}</select></label>
        <label>Status<select id="p-status"${dis}>${opt(Object.keys(ST), stc(p.status), ST)}</select></label>
        <label>Milestone date<input id="p-date" type="date" value="${esc(p.next_date)}"${dis}></label>
        <label class="w2">Next milestone<input id="p-next" value="${esc(p.next)}"${dis}></label>
        <label class="w2">Blocker<input id="p-block" value="${esc(p.blocker)}"${dis}></label>
        <label class="w2">Summary<textarea id="p-sum"${dis}>${esc(p.summary)}</textarea></label>
        ${!ro ? `<label class="w2">Log an update<textarea id="p-upd" placeholder="What changed this week?"></textarea></label>` : ""}
      </form>
      <div class="acts"><div>${id && !ro ? `<button class="ghost" id="pdel">Delete project</button>` : ""}</div>
        <div><button class="ghost" id="pcl">Close</button>${ro ? "" : `<button id="psv">Save</button>`}</div></div>
      ${id ? commentBlock + (taskNotes ? `<p class="sub">Plus ${taskNotes} open comment${taskNotes > 1 ? "s" : ""} on this project's tasks. See the Tasks view.</p>` : "") +
        `<div class="sec"><h3>History</h3>${h.length ? h.map((u) => `<p><b>${esc(fd(u.date))}</b> · ${esc(u.text)}</p>`).join("") : `<p class="empty">No updates logged yet.</p>`}</div>` : ""}`;
    ov.classList.add("show");
    $("#pcl").onclick = close;
    if (id) wireComments(id, null);
    const sv = $("#psv");
    if (sv) sv.onclick = async () => {
      const name = $("#p-name").value.trim();
      if (!name) { $("#p-name").focus(); return; }
      const d = {
        name, area: $("#p-area").value.trim(), department: $("#p-dept").value.trim(), owner: $("#p-owner").value.trim(),
        phase: $("#p-phase").value, status: $("#p-status").value,
        next: $("#p-next").value.trim(), next_date: $("#p-date").value || null,
        blocker: $("#p-block").value.trim(), summary: $("#p-sum").value.trim(),
        updated_at: new Date().toISOString(),
      };
      sv.disabled = true;
      let pid = id, error;
      if (id) ({ error } = await sb.from("projects").update(d).eq("id", id));
      else {
        d.sort = P.length + 1;
        const r = await sb.from("projects").insert(d).select("id").single();
        error = r.error; pid = r.data?.id;
      }
      if (!error) {
        const u = $("#p-upd")?.value.trim();
        if (u && pid) ({ error } = await sb.from("updates").insert({ project_id: pid, text: u, date: today() }));
      }
      sv.disabled = false;
      if (error) return fail(error);
      close();
      await load();
    };
    const dl = $("#pdel");
    if (dl) confirmTwice(dl, async () => {
      const { error } = await sb.from("projects").delete().eq("id", id);
      if (error) return fail(error);
      close();
      await load();
    });
  }

  function openT(id) {
    if (!P.length) { msg("Add a project first."); return; }
    const t = T.find((x) => x.id === id) || { status: "todo", project_id: fP || (sortedP()[0] || {}).id };
    const ro = !canEdit(), dis = ro ? " disabled" : "";
    openKind = id ? "task" : null; openId = id || null;
    dlg.innerHTML = `<h2>${id ? esc(t.title) : "New task"}</h2>
      <form class="f">
        <label class="w2">Task<input id="t-title" required maxlength="300" value="${esc(t.title)}"${dis}></label>
        <label>Project<select id="t-p"${dis}>${sortedP().map((p) => `<option value="${esc(p.id)}"${p.id === t.project_id ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
        <label>Owner<input id="t-o" list="own" value="${esc(t.owner)}"${dis}><datalist id="own">${[...new Set([...T.map((x) => x.owner), ...M.map((m) => m.name)].filter(Boolean))].map((o) => `<option value="${esc(o)}">`).join("")}</datalist></label>
        <label>Status<select id="t-s"${dis}>${opt(TS, t.status || "todo", TL)}</select></label>
        <label>Due date<input id="t-d" type="date" value="${esc(t.due)}"${dis}></label>
      </form>
      <div class="acts"><div>${id && !ro ? `<button class="ghost" id="tdel">Delete</button>` : ""}</div>
        <div><button class="ghost" id="tcl">Close</button>${ro ? "" : `<button id="tsv">Save</button>`}</div></div>
      ${id ? commentBlock : ""}`;
    ov.classList.add("show");
    $("#tcl").onclick = close;
    if (id) wireComments(t.project_id, id);
    const sv = $("#tsv");
    if (sv) sv.onclick = async () => {
      const title = $("#t-title").value.trim();
      if (!title) { $("#t-title").focus(); return; }
      const st = $("#t-s").value;
      const d = { title, project_id: $("#t-p").value, owner: $("#t-o").value.trim(), status: st,
        due: $("#t-d").value || null, done_at: st === "done" ? (t.done_at || today()) : null };
      sv.disabled = true;
      const { error } = id ? await sb.from("tasks").update(d).eq("id", id) : await sb.from("tasks").insert(d);
      sv.disabled = false;
      if (error) return fail(error);
      close();
      await load();
    };
    const dl = $("#tdel");
    if (dl) confirmTwice(dl, async () => {
      const { error } = await sb.from("tasks").delete().eq("id", id);
      if (error) return fail(error);
      close();
      await load();
    });
  }

  function openPw() {
    openKind = openId = null;
    dlg.innerHTML = `<h2>Set your password</h2>
      <p class="sub" style="margin-top:0">Use it to sign in with your email and password instead of a link.</p>
      <form class="f" id="pwf">
        <label>New password<input id="pw1" type="password" autocomplete="new-password" minlength="8" required></label>
        <label>Repeat it<input id="pw2" type="password" autocomplete="new-password" minlength="8" required></label>
      </form>
      <div id="pwmsg" class="sub"></div>
      <div class="acts"><div></div><div><button class="ghost" id="pwc">Close</button><button id="pws">Save password</button></div></div>`;
    ov.classList.add("show");
    $("#pwc").onclick = close;
    $("#pws").onclick = async () => {
      const a = $("#pw1").value, b = $("#pw2").value, m = $("#pwmsg");
      if (a.length < 8) { m.textContent = "Use at least 8 characters."; return; }
      if (a !== b) { m.textContent = "The two passwords don't match."; return; }
      $("#pws").disabled = true;
      const { error } = await sb.auth.updateUser({ password: a });
      $("#pws").disabled = false;
      m.textContent = error ? "Couldn't save: " + error.message : "Saved. Next time, sign in with your email and this password.";
    };
  }

  // ---------- events ----------
  document.addEventListener("click", async (e) => {
    const r = e.target.closest(".row");
    if (r) { openP(r.dataset.p); return; }
    const t = e.target.closest(".task");
    if (t) { openT(t.dataset.t); return; }
    const res = e.target.closest("[data-res]");
    if (res) {
      res.disabled = true;
      const { error } = await sb.from("comments").update({ resolved: res.dataset.val === "1" }).eq("id", res.dataset.res);
      if (error) { res.disabled = false; return fail(error); }
      await load();
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del) {
      if (!del.dataset.c) { del.dataset.c = "1"; del.textContent = "Click again"; return; }
      const { error } = await sb.from("comments").delete().eq("id", del.dataset.del);
      if (error) return fail(error);
      await load();
      return;
    }
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      if (!rm.dataset.c) { rm.dataset.c = "1"; rm.textContent = "Click again to remove"; return; }
      const { error } = await sb.from("members").delete().eq("email", rm.dataset.rm);
      if (error) return fail(error);
      await load();
    }
  });
  document.addEventListener("change", async (e) => {
    const s = e.target.closest("[data-role]");
    if (!s) return;
    const { error } = await sb.from("members").update({ role: s.value }).eq("email", s.dataset.role);
    if (error) fail(error);
    await load();
  });
  $("#mf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#m-email").value.trim().toLowerCase();
    if (!email) return;
    const { error } = await sb.from("members").insert({ email, name: $("#m-name").value.trim(), role: $("#m-role").value });
    if (error) return fail(error);
    e.target.reset();
    msg(`Added ${email}. Create their login in Supabase (Authentication > Users > Add user), or they can use a sign-in link.`);
    await load();
  });
  $("#addP").onclick = () => openP("");
  $("#addT").onclick = () => openT("");
  $("#pw").onclick = openPw;
  $("#fP").onchange = (e) => { fP = e.target.value; render(); };
  $("#fO").onchange = (e) => { fO = e.target.value; render(); };
  $("#fD").onchange = (e) => { fD = e.target.value; render(); };
  $("#copy").onclick = async () => {
    const b = $("#copy");
    try { await navigator.clipboard.writeText(digest()); b.textContent = "Copied"; }
    catch { b.textContent = "Select the text to copy"; }
    setTimeout(() => { b.textContent = "Copy update"; }, 2000);
  };
  window.addEventListener("focus", () => { if (role) load(); });
})();
