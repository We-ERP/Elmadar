/**
 * ============================================================
 *  مركز المدار للتدريب والتأهيل والتنمية
 *  نظام إدارة وتسجيل متابعة المشتركين والكورسات
 *  Code.gs  —  Backend (Google Apps Script)
 * ============================================================
 */

/* ============================================================
 *  1) الإعدادات
 * ============================================================ */
const CONFIG = {
  SPREADSHEET_ID: '',   // فاضي لو السكريبت مربوط بالشيت مباشرة
  LOGO_URL: '',         // رابط عام لصورة اللوجو (شرحه في README.md)
  CENTER_NAME: 'مركز المدار',
  TIMEZONE: 'Africa/Cairo',
  SESSION_SECONDS: 6 * 60 * 60,
  DEFAULT_ADMIN: { username: 'admin', password: 'admin123' },
  PROOF_FOLDER_NAME: 'Al-Madar Payment Proofs',
  PROOF_MAX_BYTES: 5 * 1024 * 1024,
  PROOF_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  PAYMENT_METHODS: ['كاش', 'تحويل بنكي', 'فودافون كاش', 'إنستاباي', 'فيزا / بطاقة', 'أخرى']
};

const SHEETS = {
  USERS: 'المستخدمين والصلاحيات',
  STUDENTS: 'المشتركين والكورسات',
  LOGS: 'سجل الدفعات والتعديلات',
  MIRROR: 'المرور-الأرشيف'
};

const HEADERS = {
  USERS: ['User ID', 'Username', 'Password Hash', 'Role', 'Created At'],
  STUDENTS: [
    'ID', 'اسم المشترك', 'اسم الكورس', 'تكلفة الكورس', 'الدفعة الأولى',
    'المبلغ المتبقي', 'تاريخ إضافة الدفعة الأولى', 'المستخدم الذي أضاف', 'آخر تحديث',
    'طريقة الدفع الأولى', 'إثبات الدفعة الأولى'
  ],
  LOGS: [
    'Log ID', 'Student ID', 'اسم المشترك', 'المبلغ المدفوع', 'المبلغ المتبقي الجديد',
    'تاريخ الحركة', 'اسم المستخدم', 'نوع الحركة', 'طريقة الدفع', 'إثبات الدفع'
  ],
  MIRROR: ['تاريخ الأرشفة', 'الشيت الأصلي', 'نوع الحركة', 'البيانات (JSON)', 'بواسطة']
};

const COL = {
  ID: 0, NAME: 1, COURSE: 2, COST: 3, FIRST: 4,
  REMAINING: 5, FIRST_DATE: 6, ADDED_BY: 7, UPDATED: 8,
  FIRST_METHOD: 9, FIRST_PROOF: 10
};

const SESSION_PREFIX = 'madar_sess_';

/* ============================================================
 *  2) التشغيل الأولي والترحيل
 * ============================================================ */
function setupSystem() {
  ensureSheet_(SHEETS.USERS, HEADERS.USERS);
  ensureSheet_(SHEETS.STUDENTS, HEADERS.STUDENTS);
  ensureSheet_(SHEETS.LOGS, HEADERS.LOGS);
  ensureSheet_(SHEETS.MIRROR, HEADERS.MIRROR);

  const users = getSheet_(SHEETS.USERS);
  if (users.getLastRow() < 2) {
    users.appendRow([
      'U' + Date.now(),
      CONFIG.DEFAULT_ADMIN.username,
      hashPassword_(CONFIG.DEFAULT_ADMIN.password),
      'Admin',
      nowStr_()
    ]);
  }
  Logger.log('✅ تم إعداد النظام بنجاح');
}

// شغّلها مرة واحدة بعد التحديث عشان تضيف أعمدة الدفع الجديدة للشيتات الموجودة
function migrateSheets() {
  [['STUDENTS', SHEETS.STUDENTS], ['LOGS', SHEETS.LOGS]].forEach(([key, name]) => {
    const sh = getSheet_(name);
    sh.getRange(1, 1, 1, HEADERS[key].length).setValues([HEADERS[key]]);
    sh.setFrozenRows(1);
  });
  Logger.log('✅ تم تحديث أعمدة الشيتات');
}

function ensureSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  sh.setFrozenRows(1);
  return sh;
}

/* ============================================================
 *  3) واجهة الويب
 * ============================================================ */
function doGet() {
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.logoUrl = CONFIG.LOGO_URL;
  tpl.centerName = CONFIG.CENTER_NAME;
  return tpl.evaluate()
    .setTitle(CONFIG.CENTER_NAME + ' | إدارة المشتركين')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================================================
 *  4) أدوات مساعدة
 * ============================================================ */
function api_(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (e) {
    return { ok: false, message: e.message || String(e) };
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('الشيت "' + name + '" غير موجود — شغّل setupSystem() أولاً');
  return sh;
}

function nowStr_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
}

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
  return v ? String(v) : '';
}

function clean_(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

function toMoney_(v) {
  const n = Number(String(v == null ? '' : v).replace(/,/g, '').trim() || 0);
  if (isNaN(n) || n < 0) throw new Error('المبلغ غير صحيح');
  return Math.round(n * 100) / 100;
}

function hashPassword_(pw) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw), Utilities.Charset.UTF_8)
    .map(b => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'))
    .join('');
}

/* ============================================================
 *  5) الدفع والإثبات
 * ============================================================ */
function validMethod_(m) {
  if (CONFIG.PAYMENT_METHODS.indexOf(m) === -1) throw new Error('اختار طريقة دفع صحيحة');
  return m;
}

// يحفظ ملف الإثبات في Google Drive ويرجّع رابطه
function saveProof_(dataUrl, studentName) {
  if (!dataUrl) throw new Error('لازم ترفع إثبات الدفع');

  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('ملف الإثبات غير صالح');

  const mime = match[1];
  if (CONFIG.PROOF_MIME_TYPES.indexOf(mime) === -1) {
    throw new Error('صيغة الإثبات لازم تكون صورة (JPG / PNG / WEBP) أو PDF');
  }

  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > CONFIG.PROOF_MAX_BYTES) throw new Error('حجم الإثبات أكبر من 5 ميجا');

  const safeName = String(studentName).replace(/[\\/:*?"<>|]/g, '_');
  const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1];
  const blob = Utilities.newBlob(bytes, mime, 'proof_' + Date.now() + '_' + safeName + '.' + ext);

  return getProofFolder_().createFile(blob).getUrl();
}

function getProofFolder_() {
  const it = DriveApp.getFoldersByName(CONFIG.PROOF_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.PROOF_FOLDER_NAME);
}

/* ============================================================
 *  6) الجلسات والصلاحيات
 * ============================================================ */
function requireSession_(token) {
  if (!token) throw new Error('يجب تسجيل الدخول أولاً');
  const raw = CacheService.getScriptCache().get(SESSION_PREFIX + token);
  if (!raw) throw new Error('انتهت الجلسة، سجّل الدخول مرة أخرى');
  return JSON.parse(raw);
}

function requireAdmin_(token) {
  const session = requireSession_(token);
  if (session.role !== 'Admin') throw new Error('هذه العملية للأدمن فقط');
  return session;
}

function login(username, password) {
  return api_(() => {
    const u = clean_(username);
    if (!u || !password) throw new Error('أدخل اسم المستخدم وكلمة المرور');

    const user = readUsers_().find(x => x.username.toLowerCase() === u.toLowerCase());
    if (!user || user.hash !== hashPassword_(password)) {
      throw new Error('بيانات الدخول غير صحيحة');
    }

    const token = Utilities.getUuid();
    CacheService.getScriptCache().put(
      SESSION_PREFIX + token,
      JSON.stringify({ username: user.username, role: user.role }),
      CONFIG.SESSION_SECONDS
    );
    return { token: token, username: user.username, role: user.role };
  });
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove(SESSION_PREFIX + token);
  return true;
}

/* ============================================================
 *  7) قراءة البيانات
 * ============================================================ */
function readUsers_() {
  const values = getSheet_(SHEETS.USERS).getDataRange().getValues();
  return values.slice(1).map((r, i) => ({
    row: i + 2,
    id: String(r[0]),
    username: String(r[1]),
    hash: String(r[2]),
    role: String(r[3]),
    createdAt: fmtDate_(r[4])
  })).filter(u => u.id);
}

function readStudents_() {
  const values = getSheet_(SHEETS.STUDENTS).getDataRange().getValues();
  return values.slice(1).map((r, i) => ({
    row: i + 2,
    id: String(r[COL.ID]),
    name: String(r[COL.NAME]),
    course: String(r[COL.COURSE]),
    cost: Number(r[COL.COST]) || 0,
    firstPayment: Number(r[COL.FIRST]) || 0,
    remaining: Number(r[COL.REMAINING]) || 0,
    firstDate: fmtDate_(r[COL.FIRST_DATE]),
    addedBy: String(r[COL.ADDED_BY]),
    updated: fmtDate_(r[COL.UPDATED]),
    firstMethod: String(r[COL.FIRST_METHOD] || ''),
    firstProof: String(r[COL.FIRST_PROOF] || '')
  })).filter(s => s.id);
}

function findStudent_(id) {
  return readStudents_().find(s => s.id === String(id)) || null;
}

function summarizeCourses_(students) {
  const map = {};
  students.forEach(s => {
    if (!map[s.course]) {
      map[s.course] = { name: s.course, count: 0, expected: 0, collected: 0, remaining: 0 };
    }
    const c = map[s.course];
    c.count++;
    c.expected += s.cost;
    c.collected += s.cost - s.remaining;
    c.remaining += s.remaining;
  });
  return Object.values(map).sort((a, b) => b.count - a.count);
}

function appendLog_(studentId, studentName, paid, newRemaining, user, type, method, proof) {
  getSheet_(SHEETS.LOGS).appendRow([
    'L' + Date.now() + Math.floor(Math.random() * 1000),
    studentId, studentName, paid, newRemaining, nowStr_(), user, type,
    method || '', proof || ''
  ]);
}

function archive_(sourceSheet, action, data, user) {
  getSheet_(SHEETS.MIRROR).appendRow([nowStr_(), sourceSheet, action, JSON.stringify(data), user]);
}

/* ============================================================
 *  8) عمليات المشتركين
 * ============================================================ */
function getStudents(token) {
  return api_(() => {
    const session = requireSession_(token);
    const students = readStudents_();
    const courses = summarizeCourses_(students);
    const stats = {
      students: students.length,
      courses: courses.length,
      expected: students.reduce((a, s) => a + s.cost, 0),
      collected: students.reduce((a, s) => a + (s.cost - s.remaining), 0),
      remaining: students.reduce((a, s) => a + s.remaining, 0)
    };
    return {
      students: students,
      courses: courses,
      stats: stats,
      me: session,
      paymentMethods: CONFIG.PAYMENT_METHODS
    };
  });
}

function addStudent(token, data) {
  return api_(() => {
    const session = requireSession_(token);
    const name = clean_(data.name);
    const course = clean_(data.course);
    const cost = toMoney_(data.cost);
    const first = toMoney_(data.firstPayment);

    if (!name) throw new Error('اسم المشترك مطلوب');
    if (!course) throw new Error('اسم الكورس مطلوب');
    if (cost <= 0) throw new Error('تكلفة الكورس لازم تكون أكبر من صفر');
    if (first > cost) throw new Error('الدفعة الأولى أكبر من تكلفة الكورس');

    let method = '';
    let proofUrl = '';
    if (first > 0) {
      method = validMethod_(data.paymentMethod);
      proofUrl = saveProof_(data.proof, name);
    }

    return withLock_(() => {
      const id = 'ST' + Date.now();
      const remaining = cost - first;
      const now = nowStr_();

      getSheet_(SHEETS.STUDENTS).appendRow([
        id, name, course, cost, first, remaining, now, session.username, now,
        method, proofUrl
      ]);
      appendLog_(id, name, first, remaining, session.username,
        'دفعة أولى - إضافة مشترك', method, proofUrl);
      return { id: id };
    });
  });
}

function addPayment(token, studentId, amount, paymentMethod, proof) {
  return api_(() => {
    const session = requireSession_(token);
    const pay = toMoney_(amount);
    if (pay <= 0) throw new Error('أدخل مبلغ أكبر من صفر');
    const method = validMethod_(paymentMethod);

    return withLock_(() => {
      const st = findStudent_(studentId);
      if (!st) throw new Error('المشترك غير موجود');
      if (pay > st.remaining) throw new Error('المبلغ أكبر من المتبقي (' + st.remaining + ')');

      const proofUrl = saveProof_(proof, st.name);
      const newRemaining = st.remaining - pay;

      const sh = getSheet_(SHEETS.STUDENTS);
      sh.getRange(st.row, COL.REMAINING + 1).setValue(newRemaining);
      sh.getRange(st.row, COL.UPDATED + 1).setValue(nowStr_());

      appendLog_(st.id, st.name, pay, newRemaining, session.username, 'دفعة جديدة', method, proofUrl);
      return { remaining: newRemaining };
    });
  });
}

function updateStudent(token, studentId, data) {
  return api_(() => {
    const session = requireAdmin_(token);
    const name = clean_(data.name);
    const course = clean_(data.course);
    const cost = toMoney_(data.cost);

    if (!name) throw new Error('اسم المشترك مطلوب');
    if (!course) throw new Error('اسم الكورس مطلوب');
    if (cost <= 0) throw new Error('تكلفة الكورس لازم تكون أكبر من صفر');

    return withLock_(() => {
      const st = findStudent_(studentId);
      if (!st) throw new Error('المشترك غير موجود');

      const paidSoFar = st.cost - st.remaining;
      const newRemaining = cost - paidSoFar;
      if (newRemaining < 0) {
        throw new Error('التكلفة الجديدة أقل من المبلغ المدفوع حتى الآن (' + paidSoFar + ')');
      }

      archive_(SHEETS.STUDENTS, 'تعديل', st, session.username);

      getSheet_(SHEETS.STUDENTS)
        .getRange(st.row, 1, 1, HEADERS.STUDENTS.length)
        .setValues([[
          st.id, name, course, cost, st.firstPayment, newRemaining, st.firstDate,
          st.addedBy, nowStr_(), st.firstMethod, st.firstProof
        ]]);

      appendLog_(st.id, name, 0, newRemaining, session.username, 'تعديل بيانات');
      return true;
    });
  });
}

function deleteStudent(token, studentId) {
  return api_(() => {
    const session = requireAdmin_(token);
    return withLock_(() => {
      const st = findStudent_(studentId);
      if (!st) throw new Error('المشترك غير موجود');

      archive_(SHEETS.STUDENTS, 'حذف', st, session.username);
      getSheet_(SHEETS.STUDENTS).deleteRow(st.row);
      appendLog_(st.id, st.name, 0, st.remaining, session.username, 'حذف مشترك');
      return true;
    });
  });
}

/* ============================================================
 *  9) السجلات والأرشيف (Admin)
 * ============================================================ */
function getLogs(token) {
  return api_(() => {
    requireAdmin_(token);
    const values = getSheet_(SHEETS.LOGS).getDataRange().getValues();
    return values.slice(1).reverse().slice(0, 300).map(r => ({
      id: String(r[0]),
      studentId: String(r[1]),
      studentName: String(r[2]),
      paid: Number(r[3]) || 0,
      remaining: Number(r[4]) || 0,
      date: fmtDate_(r[5]),
      user: String(r[6]),
      type: String(r[7]),
      method: String(r[8] || ''),
      proof: String(r[9] || '')
    }));
  });
}

function getMirror(token) {
  return api_(() => {
    requireAdmin_(token);
    const values = getSheet_(SHEETS.MIRROR).getDataRange().getValues();
    return values.slice(1).reverse().slice(0, 300).map(r => {
      let data = {};
      try { data = JSON.parse(r[3]); } catch (e) { data = { raw: String(r[3]) }; }
      return {
        time: fmtDate_(r[0]),
        sheet: String(r[1]),
        action: String(r[2]),
        data: data,
        user: String(r[4])
      };
    });
  });
}

/* ============================================================
 *  10) إدارة المستخدمين (Admin)
 * ============================================================ */
function getUsers(token) {
  return api_(() => {
    requireAdmin_(token);
    return readUsers_().map(u => ({
      id: u.id, username: u.username, role: u.role, createdAt: u.createdAt
    }));
  });
}

function addUser(token, username, password, role) {
  return api_(() => {
    requireAdmin_(token);
    const u = clean_(username);
    const p = String(password || '');

    if (!u) throw new Error('اسم المستخدم مطلوب');
    if (p.length < 4) throw new Error('كلمة المرور لازم تكون 4 حروف على الأقل');
    if (['Admin', 'User'].indexOf(role) === -1) throw new Error('الصلاحية غير صحيحة');

    return withLock_(() => {
      const exists = readUsers_().some(x => x.username.toLowerCase() === u.toLowerCase());
      if (exists) throw new Error('اسم المستخدم موجود بالفعل');

      getSheet_(SHEETS.USERS).appendRow(['U' + Date.now(), u, hashPassword_(p), role, nowStr_()]);
      return true;
    });
  });
}

function deleteUser(token, userId) {
  return api_(() => {
    const admin = requireAdmin_(token);
    return withLock_(() => {
      const users = readUsers_();
      const target = users.find(x => x.id === String(userId));
      if (!target) throw new Error('المستخدم غير موجود');
      if (target.username === admin.username) throw new Error('مش ممكن تحذف حسابك انت');
      if (target.role === 'Admin' && users.filter(x => x.role === 'Admin').length <= 1) {
        throw new Error('لازم يفضل أدمن واحد على الأقل');
      }
      getSheet_(SHEETS.USERS).deleteRow(target.row);
      return true;
    });
  });
}
