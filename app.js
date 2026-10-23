/* ---------- 1) الحالة ---------- */
  const state = {
    token: null,
    me: null,
    students: [],
    courses: [],
    stats: {},
    paymentMethods: [],
    view: 'dashboard',
    courseFilter: '',
    search: ''
  };

  const TITLES = {
    dashboard: 'الرئيسية',
    students: 'المشتركين والكورسات',
    admin: 'إدارة المستخدمين',
    logs: 'سجل الدفعات والتعديلات',
    archive: 'المرور / الأرشيف'
  };

  const MAX_PROOF_BYTES = 5 * 1024 * 1024;

  /* ---------- 2) أدوات مساعدة ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function money(n) {
    return Number(n || 0).toLocaleString('en-US') + ' ج.م';
  }

  function showLoader(on) {
    $('#loader').classList.toggle('hidden', !on);
  }

  let toastTimer;
  function toast(msg, type = 'ok') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + (type === 'error' ? 'error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
  }

  // تحويل ملف الإثبات لـ Base64 مع التحقق من الحجم
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.size) return resolve('');
      if (file.size > MAX_PROOF_BYTES) return reject(new Error('حجم الإثبات أكبر من 5 ميجا'));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('تعذر قراءة ملف الإثبات'));
      reader.readAsDataURL(file);
    });
  }

  /* ---------- 3) جسر السيرفر ---------- */
  // كل الطلبات بتروح للـ API على Apps Script (POST بصيغة JSON كنص عادي لتفادي CORS)
  function callServer(action, ...args) {
    return new Promise((resolve, reject) => {
      showLoader(true);
      fetch(window.APP_CONFIG.API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: action, args: args })
      })
        .then(r => r.json())
        .then(res => {
          showLoader(false);
          if (res && res.ok === undefined) return resolve(res);   // logout بيرجّع true
          if (res && res.ok) resolve(res.data);
          else reject(new Error((res && res.message) || 'حدث خطأ غير متوقع'));
        })
        .catch(() => {
          showLoader(false);
          reject(new Error('فشل الاتصال بالسيرفر، اتأكد من رابط الـ API في config.js'));
        });
    });
  }

  async function run(fnName, ...args) {
    try {
      return await callServer(fnName, ...args);
    } catch (e) {
      toast(e.message, 'error');
      if (/الجلسة|تسجيل الدخول/.test(e.message)) doLogout(true);
      return null;
    }
  }

  /* ---------- 4) المودال ---------- */
  function openModal(title, html, onSubmit) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    const form = $('#modalBody form');
    if (form && onSubmit) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        onSubmit(new FormData(form));
      });
    }
    $('#modal').classList.remove('hidden');
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
    $('#modalBody').innerHTML = '';
  }

  // حقول طريقة الدفع + الإثبات (مشتركة بين إضافة مشترك وتسجيل دفعة)
  function paymentFieldsHtml() {
    return `
      <label>طريقة الدفع
        <select name="paymentMethod">
          <option value="">— اختر —</option>
          ${state.paymentMethods.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}
        </select>
      </label>
      <label>إثبات الدفع (صورة أو PDF، حتى 5 ميجا)
        <input name="proofFile" type="file" accept="image/*,application/pdf">
      </label>`;
  }

  /* ---------- 5) الدخول والخروج ---------- */
  function enterApp() {
    $('#loginScreen').classList.add('hidden');
    $('#appScreen').classList.remove('hidden');
    $('#currentUser').textContent = state.me.username;
    $('#currentRole').textContent = state.me.role === 'Admin' ? 'أدمن' : 'مستخدم';
    document.body.classList.toggle('is-user', state.me.role !== 'Admin');
    setView('dashboard');
    loadStudents();
  }

  function doLogout(silent = false) {
    if (state.token) callServer('logout', state.token).catch(() => {});
    state.token = null;
    state.me = null;
    state.students = [];
    $('#appScreen').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
    $('#loginPass').value = '';
    if (!silent) toast('تم تسجيل الخروج');
  }

  /* ---------- 6) تحميل البيانات ---------- */
  async function loadStudents() {
    const d = await run('getStudents', state.token);
    if (!d) return;
    state.students = d.students;
    state.courses = d.courses;
    state.stats = d.stats;
    state.paymentMethods = d.paymentMethods || [];
    renderAll();
  }

  function renderAll() {
    renderStats();
    renderCourses();
    renderCourseFilter();
    renderStudents();
  }

  /* ---------- 7) الرسم ---------- */
  function renderStats() {
    const s = state.stats;
    const items = [
      ['👥', 'إجمالي المشتركين', s.students || 0, 'orange'],
      ['📚', 'عدد الكورسات', s.courses || 0, 'black'],
      ['💰', 'إجمالي المحصّل', money(s.collected), 'green'],
      ['⏳', 'إجمالي المتبقي', money(s.remaining), 'red']
    ];
    $('#statsCards').innerHTML = items.map(([icon, label, val, color]) => `
      <div class="stat stat-${color}">
        <div class="stat-icon">${icon}</div>
        <div>
          <div class="stat-label">${label}</div>
          <div class="stat-value">${esc(val)}</div>
        </div>
      </div>`).join('');
  }

  function renderCourses() {
    const grid = $('#courseGrid');
    if (!state.courses.length) {
      grid.innerHTML = '<div class="empty card">لا توجد كورسات بعد — أضف أول مشترك</div>';
      return;
    }
    grid.innerHTML = state.courses.map(c => {
      const pct = c.expected ? Math.round((c.collected / c.expected) * 100) : 0;
      return `
        <article class="course-card" data-course="${esc(c.name)}">
          <div class="course-top">
            <h4>${esc(c.name)}</h4>
            <span class="badge">${c.count} مشترك</span>
          </div>
          <div class="course-rows">
            <div><span>المحصّل</span><b class="text-green">${money(c.collected)}</b></div>
            <div><span>المتبقي</span><b class="text-red">${money(c.remaining)}</b></div>
          </div>
          <div class="progress"><div style="width:${pct}%"></div></div>
          <small>${pct}% محصّل من ${money(c.expected)}</small>
        </article>`;
    }).join('');
  }

  function renderCourseFilter() {
    const sel = $('#courseFilter');
    sel.innerHTML = '<option value="">كل الكورسات</option>' +
      state.courses.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    sel.value = state.courseFilter;
  }

  function renderStudents() {
    const q = state.search.trim().toLowerCase();
    const list = state.students.filter(s =>
      (!state.courseFilter || s.course === state.courseFilter) &&
      (!q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
    );

    $('#studentsBody').innerHTML = list.length ? list.map(s => `
      <tr>
        <td><code>${esc(s.id)}</code></td>
        <td><b>${esc(s.name)}</b></td>
        <td><span class="tag">${esc(s.course)}</span></td>
        <td>${money(s.cost)}</td>
        <td>
          ${money(s.firstPayment)}
          ${s.firstMethod ? `<br><small>${esc(s.firstMethod)}</small>` : ''}
          ${s.firstProof ? `<br><a href="${esc(s.firstProof)}" target="_blank" rel="noopener">📎 الإثبات</a>` : ''}
        </td>
        <td><span class="strong ${s.remaining > 0 ? 'text-red' : 'text-green'}">${money(s.remaining)}</span></td>
        <td><small>${esc(s.addedBy)}<br>${esc(s.firstDate)}</small></td>
        <td class="actions">
          <button class="btn btn-sm btn-primary" data-action="pay" data-id="${esc(s.id)}"
            ${s.remaining <= 0 ? 'disabled' : ''}>دفعة</button>
          <button class="btn btn-sm btn-ghost admin-only" data-action="edit" data-id="${esc(s.id)}">تعديل</button>
          <button class="btn btn-sm btn-danger admin-only" data-action="delete" data-id="${esc(s.id)}">حذف</button>
        </td>
      </tr>`).join('')
      : '<tr><td colspan="8" class="empty">لا توجد نتائج</td></tr>';
  }

  /* ---------- 8) التنقل ---------- */
  function setView(name) {
    state.view = name;
    $$('.view').forEach(el => el.classList.toggle('hidden', el.id !== 'view-' + name));
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $('#pageTitle').textContent = TITLES[name];

    if (name === 'students') renderStudents();
    if (name === 'admin') loadUsers();
    if (name === 'logs') loadLogs();
    if (name === 'archive') loadArchive();
  }

  /* ---------- 9) نماذج المشتركين ---------- */
  function openAddStudent() {
    const courseNames = [...new Set(state.students.map(s => s.course))];
    openModal('إضافة مشترك جديد', `
      <form class="form-grid">
        <label>اسم المشترك<input name="name" required></label>
        <label>اسم الكورس
          <input name="course" list="courseList" required placeholder="اختر أو اكتب كورس جديد">
        </label>
        <datalist id="courseList">
          ${courseNames.map(c => `<option value="${esc(c)}"></option>`).join('')}
        </datalist>
        <label>تكلفة الكورس (ج.م)<input name="cost" type="number" min="1" step="0.01" required></label>
        <label>الدفعة الأولى (ج.م)<input name="firstPayment" type="number" min="0" step="0.01" value="0"></label>
        <small>لو الدفعة الأولى أكبر من صفر لازم تختار طريقة الدفع وترفع الإثبات.</small>
        ${paymentFieldsHtml()}
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-close>إلغاء</button>
          <button class="btn btn-primary">حفظ المشترك</button>
        </div>
      </form>`, async fd => {
        const first = Number(fd.get('firstPayment') || 0);
        const file = fd.get('proofFile');
        const hasFile = file && file.size > 0;

        if (first > 0 && (!fd.get('paymentMethod') || !hasFile)) {
          return toast('لازم تختار طريقة الدفع وترفع إثبات الدفعة الأولى', 'error');
        }

        let proof = '';
        try {
          proof = await readFileAsDataUrl(hasFile ? file : null);
        } catch (e) {
          return toast(e.message, 'error');
        }

        const r = await run('addStudent', state.token, {
          name: fd.get('name'),
          course: fd.get('course'),
          cost: fd.get('cost'),
          firstPayment: fd.get('firstPayment'),
          paymentMethod: fd.get('paymentMethod'),
          proof: proof
        });
        if (r) {
          toast('تمت إضافة المشترك ✅');
          closeModal();
          loadStudents();
        }
      });
  }

  function openPaymentModal(s) {
    openModal('تسجيل دفعة — ' + s.name, `
      <div class="info-line">
        <span>المتبقي حالياً</span>
        <b class="text-red">${money(s.remaining)}</b>
      </div>
      <form class="form-grid">
        <label>المبلغ المدفوع (ج.م)
          <input name="amount" type="number" min="1" max="${s.remaining}" step="0.01" required>
        </label>
        ${paymentFieldsHtml()}
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-close>إلغاء</button>
          <button class="btn btn-primary">تأكيد الدفعة</button>
        </div>
      </form>`, async fd => {
        const file = fd.get('proofFile');
        if (!fd.get('paymentMethod')) return toast('اختار طريقة الدفع', 'error');
        if (!file || !file.size) return toast('لازم ترفع إثبات الدفع', 'error');

        let proof;
        try {
          proof = await readFileAsDataUrl(file);
        } catch (e) {
          return toast(e.message, 'error');
        }

        const r = await run('addPayment', state.token, s.id, fd.get('amount'), fd.get('paymentMethod'), proof);
        if (r) {
          toast('تم تسجيل الدفعة ✅ — المتبقي ' + money(r.remaining));
          closeModal();
          loadStudents();
        }
      });
  }

  function openEditModal(s) {
    openModal('تعديل بيانات المشترك', `
      <form class="form-grid">
        <label>اسم المشترك<input name="name" required value="${esc(s.name)}"></label>
        <label>اسم الكورس<input name="course" required value="${esc(s.course)}"></label>
        <label>تكلفة الكورس (ج.م)<input name="cost" type="number" min="1" step="0.01" required value="${esc(s.cost)}"></label>
        <small>المدفوع حتى الآن (${money(s.cost - s.remaining)}) هيتحسب تلقائياً من التكلفة الجديدة.</small>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-close>إلغاء</button>
          <button class="btn btn-primary">حفظ التعديل</button>
        </div>
      </form>`, async fd => {
        const r = await run('updateStudent', state.token, s.id, Object.fromEntries(fd.entries()));
        if (r) {
          toast('تم حفظ التعديل ✅');
          closeModal();
          loadStudents();
        }
      });
  }

  function openDeleteModal(s) {
    openModal('تأكيد الحذف', `
      <p class="confirm-text">
        هل أنت متأكد من حذف المشترك <b>${esc(s.name)}</b> من كورس <b>${esc(s.course)}</b>؟
        <br><small>النسخة القديمة هتتأرشف في شيت "المرور-الأرشيف" قبل الحذف.</small>
      </p>
      <div class="form-actions">
        <button class="btn btn-ghost" data-close>إلغاء</button>
        <button class="btn btn-danger" id="confirmDeleteBtn">نعم، احذف</button>
      </div>`);

    $('#confirmDeleteBtn').addEventListener('click', async () => {
      const r = await run('deleteStudent', state.token, s.id);
      if (r) {
        toast('تم حذف المشترك');
        closeModal();
        loadStudents();
      }
    });
  }

  /* ---------- 10) صفحات الأدمن ---------- */
  async function loadUsers() {
    const list = await run('getUsers', state.token);
    if (!list) return;
    $('#usersBody').innerHTML = list.map(u => `
      <tr>
        <td><b>${esc(u.username)}</b></td>
        <td><span class="badge ${u.role === 'Admin' ? 'badge-dark' : ''}">${u.role === 'Admin' ? 'أدمن' : 'مستخدم'}</span></td>
        <td><small>${esc(u.createdAt)}</small></td>
        <td><button class="btn btn-sm btn-danger" data-del-user="${esc(u.id)}">حذف</button></td>
      </tr>`).join('') || '<tr><td colspan="4" class="empty">لا يوجد مستخدمين</td></tr>';
  }

  async function loadLogs() {
    const list = await run('getLogs', state.token);
    if (!list) return;
    $('#logsBody').innerHTML = list.map(l => `
      <tr>
        <td><small>${esc(l.date)}</small></td>
        <td><span class="badge">${esc(l.type)}</span></td>
        <td>${esc(l.studentName)}</td>
        <td class="text-green strong">${money(l.paid)}</td>
        <td>${esc(l.method || '-')}</td>
        <td class="text-red">${money(l.remaining)}</td>
        <td>${l.proof ? `<a href="${esc(l.proof)}" target="_blank" rel="noopener">📎 عرض</a>` : '-'}</td>
        <td>${esc(l.user)}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="empty">لا توجد حركات بعد</td></tr>';
  }

  async function loadArchive() {
    const list = await run('getMirror', state.token);
    if (!list) return;
    $('#archiveBody').innerHTML = list.map(a => `
      <tr>
        <td><small>${esc(a.time)}</small></td>
        <td>${esc(a.sheet)}</td>
        <td><span class="badge">${esc(a.action)}</span></td>
        <td><pre>${esc(JSON.stringify(a.data, null, 2))}</pre></td>
        <td>${esc(a.user)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="empty">الأرشيف فاضي</td></tr>';
  }

  /* ---------- 11) تهيئة الأحداث ---------- */
  function init() {
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const r = await run('login', $('#loginUser').value, $('#loginPass').value);
      if (!r) return;
      state.token = r.token;
      state.me = { username: r.username, role: r.role };
      toast('أهلاً ' + r.username + ' 👋');
      enterApp();
    });

    $('#logoutBtn').addEventListener('click', () => doLogout());

    $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));

    $('#addStudentBtn').addEventListener('click', openAddStudent);

    $('#searchInput').addEventListener('input', e => { state.search = e.target.value; renderStudents(); });
    $('#courseFilter').addEventListener('change', e => { state.courseFilter = e.target.value; renderStudents(); });

    $('#courseGrid').addEventListener('click', e => {
      const card = e.target.closest('.course-card');
      if (!card) return;
      state.courseFilter = card.dataset.course;
      setView('students');
    });

    $('#studentsBody').addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const s = state.students.find(x => x.id === btn.dataset.id);
      if (!s) return;
      if (btn.dataset.action === 'pay') openPaymentModal(s);
      if (btn.dataset.action === 'edit') openEditModal(s);
      if (btn.dataset.action === 'delete') openDeleteModal(s);
    });

    $('#userForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const r = await run('addUser', state.token, f.username.value, f.password.value, f.role.value);
      if (r) {
        toast('تمت إضافة المستخدم ✅');
        f.reset();
        loadUsers();
      }
    });

    $('#usersBody').addEventListener('click', async e => {
      const btn = e.target.closest('button[data-del-user]');
      if (!btn) return;
      if (!confirm('متأكد من حذف المستخدم؟')) return;
      const r = await run('deleteUser', state.token, btn.dataset.delUser);
      if (r) {
        toast('تم حذف المستخدم');
        loadUsers();
      }
    });

    $('#modal').addEventListener('click', e => {
      if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }

  document.addEventListener('DOMContentLoaded', init);
