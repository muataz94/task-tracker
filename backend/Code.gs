// ── Task Tracker — Google Apps Script Backend v2 ─────────────────
// Deploy as Web App: Execute as Me | Access: Anyone
// Set script property SPREADSHEET_ID to your sheet's ID (optional — falls back to active spreadsheet)

let _ss = null;
const GOOGLE_CLIENT_ID = '536004951636-66ltg9ksnvts6m90mftcl6fd99avbdcv.apps.googleusercontent.com';
const OWNER_EMAIL = 'muatazthaaer@gmail.com';
function getSpreadsheet() {
  if (!_ss) {
    try {
      const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      _ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
      _ss = SpreadsheetApp.getActiveSpreadsheet();
    }
  }
  return _ss;
}

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const token  = body.token;
    const user   = validateToken(token);
    if (!user) return respond({ error: 'Unauthorized' });
    if (!isAuthorized(user.email)) return respond({ error: 'Unauthorized' });

    const { action, sheet, data, id } = body;
    if (!action || !allowRequestRate(user.email, action)) return respond({ error: 'Too many requests' });
    if (!authorizeRequest(user.email, action, body)) return respond({ error: 'Forbidden' });
    switch (action) {
      case 'getAll':       return respond(sheet === 'Users' ? getUsersForRequester(user.email) : getAll(sheet));
      case 'getDashboard': return respond(getDashboard());
      case 'addRow':       return respond(addRow(sheet, validateRecordData(data), user.email));
      case 'updateRow':    return respond(updateRow(sheet, id, validateRecordData(data), user.email));
      case 'deleteRow':    return respond(deleteRow(sheet, id));
      case 'getChat':      return respond(getChat());
      case 'sendMessage':   return respond(sendMessage(data, user.email));
      case 'editMessage':   return respond(editMessage(body.id, body.message, user.email));
      case 'deleteMessage': return respond(deleteMessage(body.id, user.email));
      case 'uploadFile':    return respond(uploadFileToDrive(body.fileData, body.fileName, body.fileType, user.email));
      case 'bulkGet':          return respond(bulkGet(body.sheets));
      case 'getComparisons':   return respond(getAll('Comparisons'));
      case 'getCompVendors':   return respond(getCompVendors(body.comparison_id));
      case 'saveComparison':   return respond(saveComparison(body.data, body.vendors, user.email));
      case 'updateComparison': return respond(updateComparison(body.id, body.data, body.vendors, user.email));
      case 'deleteComparison': return respond(deleteComparisonFull(body.id));
      case 'getInvoices':      return respond(getInvoices());
      case 'saveInvoice':      return respond(saveInvoice(body));
      case 'updateInvoice':    return respond(updateInvoice(body));
      case 'deleteInvoice':    return respond(deleteInvoice(body.id));
      case 'getVendors':       return respond(getVendors());
      case 'saveVendor':       return respond(saveVendor(body));
      case 'updateVendor':     return respond(updateVendor(body));
      case 'deleteVendor':     return respond(deleteVendor(body.id));
      case 'getVendorByName':  return respond(getVendorByName(body.name));
      case 'sendEmail':        return respond(sendEmailAction(body));
      case 'getPRs':           return respond(getPRs());
      case 'getPRLineItems':   return respond(getPRLineItems(body.pr_id));
      case 'savePR':           return respond(savePR(body));
      case 'updatePR':         return respond(updatePR(body));
      case 'deletePR':         return respond(deletePR(body.id));
      case 'savePRLineItems':  return respond(savePRLineItems(body.pr_id, body.items));
      case 'updatePRLineQty':       return respond(updatePRLineQty(body.line_id, body.received_qty, body.linked_po_id));
      case 'getUserPermissions':    return respond(getUserPermissions(body.email));
      case 'updateUserPermissions': return respond(updateUserPermissions(body.email, body.permissions));

      case 'setupPhase1Columns': setupPhase1Columns(); return respond({ success: true });

      case 'getBudgets':       return respond(getBudgets());
      case 'saveBudget':       return respond(saveBudget(body));
      case 'updateBudget':     return respond(updateBudget(body));
      case 'deleteBudget':     return respond(deleteBudget(body.id));
      case 'checkBudget':      return respond(checkBudget(body.department, body.amount));

      case 'getNotifications':  return respond(getNotifications(user.email));
      case 'createNotif':       return respond(createNotification(body));
      case 'markNotifRead':     return respond(markNotifRead(body.id, user.email));
      case 'markAllNotifsRead': return respond(markAllNotifsRead(user.email));

      case 'logAudit':    return respond(logAudit(Object.assign({}, body, { user_email: user.email })));
      case 'getAuditLog': return respond(getAuditLog(body.sheet, body.record_id));

      case 'globalSearch': return respond(globalSearch(body.query));

      case 'rateVendor':     return respond(rateVendor(body.vendor_id, body.scores));
      case 'getVendorSpend': return respond(getVendorSpend(body.vendor_name));

      case 'getInvoiceAging': return respond(getInvoiceAging());
      case 'saveUserTheme':   return respond(saveUserTheme(user.email, body.theme));

      default:                      return respond({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    console.error('Task Tracker API error', err && err.stack ? err.stack : err);
    return respond({ error: 'Request failed', code: 'SERVER_ERROR' });
  }
}

function doGet() {
  return respond({ status: 'Task Tracker API v2 running', time: new Date().toISOString() });
}

// ── AUTH ─────────────────────────────────────────────────────────

function validateToken(token) {
  try {
    if (!token) return null;
    const res  = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    const info = JSON.parse(res.getContentText());
    if (info.error) return null;
    if (info.aud !== GOOGLE_CLIENT_ID) return null;
    if (info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') return null;
    if (String(info.email_verified).toLowerCase() !== 'true') return null;
    if (info.exp && Number(info.exp) < Math.floor(Date.now() / 1000)) return null;
    return { email: info.email, name: info.name || info.email, picture: info.picture || '' };
  } catch (e) { return null; }
}

function isAuthorized(email) {
  try {
    const sheet   = getSpreadsheet().getSheetByName('Users');
    if (!sheet) return false;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    const emails  = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
    return emails.some(e => e.trim().toLowerCase() === email.toLowerCase());
  } catch (e) { return false; }
}

const API_READ_ACTIONS = [
  'getAll','getDashboard','getChat','bulkGet','getComparisons','getCompVendors',
  'getInvoices','getVendors','getVendorByName','getPRs','getPRLineItems',
  'getUserPermissions','getBudgets','checkBudget','getNotifications','globalSearch',
  'getVendorSpend','getInvoiceAging'
];
const API_ALLOWED_SHEETS = [
  'Tasks','POs','Milestones','Expenses','Comparisons','ComparisonVendors',
  'Invoices','Vendors','PurchaseRequests','PurchaseRequestItems','Budgets','Users'
];

function authorizeRequest(email, action, body) {
  const normalizedEmail = String(email || '').toLowerCase();
  const isOwner = normalizedEmail === OWNER_EMAIL.toLowerCase();
  if (isOwner) return true;

  if (action === 'getAll' && !API_ALLOWED_SHEETS.includes(body.sheet)) return false;
  if (action === 'bulkGet' && !(body.sheets || []).every(name => name !== 'Users' && API_ALLOWED_SHEETS.includes(name))) return false;
  if (action === 'getUserPermissions') return !body.email || String(body.email).toLowerCase() === normalizedEmail;
  if (action === 'getAuditLog' || action === 'updateUserPermissions' || action === 'setupPhase1Columns') return false;
  if (API_READ_ACTIONS.includes(action)) return true;

  const permissionInfo = getUserPermissions(email);
  const permissions = permissionInfo.permissions || {};
  const permissionForSheet = {
    Tasks: 'can_edit_tasks', POs: 'can_edit_pos', Milestones: 'can_edit_tasks',
    Expenses: 'can_edit_expenses', Comparisons: 'can_edit_quotations',
    ComparisonVendors: 'can_edit_quotations', Invoices: 'can_edit_invoices',
    Vendors: 'can_edit_vendors', PurchaseRequests: 'can_edit_prs',
    PurchaseRequestItems: 'can_edit_prs', Budgets: 'can_edit_expenses'
  };
  const deletePermissionForSheet = {
    Tasks: 'can_delete_tasks', POs: 'can_delete_pos', Expenses: 'can_delete_expenses'
  };
  const actionSheet = resolveActionSheet(action, body);
  if (action.startsWith('delete')) {
    const specificDelete = deletePermissionForSheet[actionSheet];
    return specificDelete ? permissions[specificDelete] === true : permissions.can_delete === true;
  }
  if (actionSheet) {
    if (actionSheet === 'Users' || !API_ALLOWED_SHEETS.includes(actionSheet)) return false;
    const requiredPermission = permissionForSheet[actionSheet];
    return !requiredPermission || permissions[requiredPermission] !== false;
  }

  return ['sendMessage','editMessage','deleteMessage','uploadFile','sendEmail',
    'getNotifications','createNotif','markNotifRead','markAllNotifsRead',
    'logAudit','saveUserTheme'].includes(action);
}

function resolveActionSheet(action, body) {
  if (['addRow','updateRow','deleteRow'].includes(action)) return body.sheet;
  if (/Comparison/.test(action)) return 'Comparisons';
  if (/Invoice/.test(action)) return 'Invoices';
  if (/Vendor/.test(action)) return 'Vendors';
  if (/PR/.test(action)) return 'PurchaseRequests';
  if (/Budget/.test(action)) return 'Budgets';
  return '';
}

function allowRequestRate(email, action) {
  const isRead = API_READ_ACTIONS.includes(action);
  const limit = isRead ? 180 : 45;
  const minute = Math.floor(Date.now() / 60000);
  const digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(email).toLowerCase()
  )).slice(0, 18);
  const key = 'rl:' + digest + ':' + action + ':' + minute;
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), 70);
  return count <= limit;
}

function validateRecordData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid record');
  const clean = {};
  Object.keys(data).forEach(key => {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) throw new Error('Invalid field');
    const value = data[key];
    if (value !== null && typeof value === 'object') throw new Error('Invalid field value');
    if (String(value == null ? '' : value).length > 10000) throw new Error('Field too long');
    clean[key] = value;
  });
  return clean;
}

// ── BULK GET ─────────────────────────────────────────────────────

function bulkGet(sheetNames) {
  const result = {};
  (sheetNames || []).forEach(name => { result[name] = getAll(name); });
  return result;
}

// ── READ ─────────────────────────────────────────────────────────

function getAll(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { rows: [] };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rows: [] };
  const data    = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data[0].map(String);
  const idIdx   = headers.indexOf('id');
  const rows    = [];

  for (let i = 1; i < lastRow; i++) {
    const row = data[i];
    if (!row.some(cell => cell !== '')) continue;
    const obj = {};
    headers.forEach((h, j) => { if (h) obj[h] = row[j]; });

    // Auto-assign UUID to rows manually added without an id
    if (idIdx >= 0) {
      const rawId = String(obj.id == null ? '' : obj.id).trim();
      if (!rawId) {
        const newId = Utilities.getUuid();
        sheet.getRange(i + 1, idIdx + 1).setValue(newId);
        obj.id = newId;
      } else {
        obj.id = rawId;
      }
    }
    rows.push(obj);
  }
  return { rows };
}

function getDashboard() {
  const tasks      = getAll('Tasks').rows      || [];
  const pos        = getAll('POs').rows        || [];
  const milestones = getAll('Milestones').rows || [];
  const expenses   = getAll('Expenses').rows   || [];

  const now = new Date();
  const taskSummary = { total: tasks.length, open: 0, in_progress: 0, done: 0, overdue: 0 };
  tasks.forEach(t => {
    const s = (t.status || '').toLowerCase();
    if (s === 'done')        { taskSummary.done++;        return; }
    if (s === 'overdue')     { taskSummary.overdue++;     return; }
    if (s === 'in_progress') { taskSummary.in_progress++; return; }
    if (t.due_date && new Date(t.due_date) < now) taskSummary.overdue++;
    else taskSummary.open++;
  });

  const poByStatus = { draft: 0, submitted: 0, received: 0, cancelled: 0 };
  let poSpend = 0;
  pos.forEach(p => {
    const s = (p.status || 'draft').toLowerCase();
    if (s in poByStatus) poByStatus[s]++;
    // Use total_value if present, otherwise quantity * unit_price
    const tv = parseFloat(p.total_value);
    poSpend += (!isNaN(tv) && tv > 0)
      ? tv
      : (parseFloat(p.quantity) || 0) * (parseFloat(p.unit_price) || 0);
  });

  let totalPct = 0, pctCount = 0;
  milestones.forEach(m => {
    const pct = parseFloat(m.completion_pct);
    if (!isNaN(pct)) { totalPct += pct; pctCount++; }
  });
  const avgProgress = pctCount ? Math.round(totalPct / pctCount) : 0;

  let totalExpenses = 0;
  expenses.forEach(ex => { totalExpenses += parseFloat(ex.amount) || 0; });

  return { taskSummary, poByStatus, poSpend, avgProgress, totalExpenses, tasks, milestones, expenses };
}

function getChat() {
  const sheet = getSpreadsheet().getSheetByName('Chat');
  if (!sheet) return { rows: [] };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rows: [] };
  const startRow = Math.max(2, lastRow - 99);
  const headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rawRows  = sheet.getRange(startRow, 1, lastRow - startRow + 1, headers.length).getValues();
  const rows = rawRows
    .filter(row => row[0] !== '')
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
      return obj;
    })
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return { rows };
}

// ── WRITE ─────────────────────────────────────────────────────────

function addRow(sheetName, data, createdBy) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const now     = new Date().toISOString();
  const id      = Utilities.getUuid();
  const payload = Object.assign({}, data, {
    id, created_at: now, updated_at: now, created_by: createdBy
  });
  const row = headers.map(h => (h && payload[h] !== undefined) ? payload[h] : '');
  sheet.appendRow(row);

  // Auto-create milestone when a task with a new project name is saved
  if (sheetName === 'Tasks' && data && data.project && String(data.project).trim()) {
    autoCreateMilestone(String(data.project).trim(), createdBy);
  }

  return { id, success: true };
}

function updateRow(sheetName, id, data, updatedBy) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Row not found: ' + id);
  const allData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = allData[0].map(String);
  const idIdx   = headers.indexOf('id');
  const normalId = String(id).trim();
  const rowIdx  = allData.findIndex((r, i) => i > 0 && String(r[idIdx]).trim() === normalId);
  if (rowIdx === -1) throw new Error('Row not found: ' + id);

  // Capture old row before updating
  const oldRow = {};
  headers.forEach((h, j) => { oldRow[h] = allData[rowIdx][j]; });

  const now = new Date().toISOString();
  headers.forEach((h, colIdx) => {
    if (h === 'id' || h === 'created_at') return;
    if (h === 'updated_at') { sheet.getRange(rowIdx + 1, colIdx + 1).setValue(now); return; }
    if (data && data[h] !== undefined) sheet.getRange(rowIdx + 1, colIdx + 1).setValue(data[h]);
  });

  // Auto-create expense when PO status changes to 'received'
  if (sheetName === 'POs' && data && data.status === 'received'
      && String(oldRow.status || '').toLowerCase() !== 'received') {
    autoCreateExpense(Object.assign({}, oldRow, data));
  }

  return { success: true };
}

function deleteRow(sheetName, id) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Row not found: ' + id);
  const allData  = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers  = allData[0].map(String);
  const idIdx    = headers.indexOf('id');
  const normalId = String(id).trim();
  const rowIdx   = allData.findIndex((r, i) => i > 0 && String(r[idIdx]).trim() === normalId);
  if (rowIdx === -1) throw new Error('Row not found: ' + id);
  sheet.deleteRow(rowIdx + 1);
  return { success: true };
}

function sendMessage(data, senderEmail) {
  const sheet = getSpreadsheet().getSheetByName('Chat');
  if (!sheet) return { error: 'Chat sheet not found — add a "Chat" tab with columns: id, message, sender_email, sender_name, sender_avatar, topic, timestamp, edited_at, file_url, file_name, file_type' };
  const now = new Date().toISOString();
  const id  = Utilities.getUuid();
  sheet.appendRow([
    id,
    data.message       || '',
    senderEmail,
    data.sender_name   || senderEmail,
    data.sender_avatar || '',
    data.topic         || 'general',
    now,
    '',                       // edited_at  (col H)
    data.file_url  || '',     // file_url   (col I)
    data.file_name || '',     // file_name  (col J)
    data.file_type || ''      // file_type  (col K)
  ]);
  return { success: true, id, timestamp: now };
}

function editMessage(id, newMessage, requesterEmail) {
  const sheet = getSpreadsheet().getSheetByName('Chat');
  if (!sheet) return { error: 'Chat sheet not found' };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'Message not found' };
  const data    = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');
  const msgCol  = headers.indexOf('message');
  const senderCol = headers.indexOf('sender_email');
  const editCol = headers.indexOf('edited_at');
  const rowIdx  = data.findIndex((r, i) => i > 0 && r[idCol] === id);
  if (rowIdx === -1) return { error: 'Message not found' };
  if (String(data[rowIdx][senderCol]).toLowerCase() !== String(requesterEmail).toLowerCase()) return { error: 'Forbidden' };
  sheet.getRange(rowIdx + 1, msgCol + 1).setValue(newMessage);
  if (editCol >= 0) sheet.getRange(rowIdx + 1, editCol + 1).setValue(new Date().toISOString());
  return { success: true };
}

function deleteMessage(id, requesterEmail) {
  const sheet = getSpreadsheet().getSheetByName('Chat');
  if (!sheet) return { error: 'Chat sheet not found' };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'Message not found' };
  const data   = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const idCol  = data[0].indexOf('id');
  const senderCol = data[0].indexOf('sender_email');
  const rowIdx = data.findIndex((r, i) => i > 0 && r[idCol] === id);
  if (rowIdx === -1) return { error: 'Message not found' };
  if (String(data[rowIdx][senderCol]).toLowerCase() !== String(requesterEmail).toLowerCase()) return { error: 'Forbidden' };
  sheet.deleteRow(rowIdx + 1);
  return { success: true };
}

function uploadFileToDrive(base64Data, fileName, mimeType, uploaderEmail) {
  try {
    const allowedTypes = [
      'image/png','image/jpeg','image/gif','image/webp','application/pdf','text/plain',
      'text/csv','application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(String(mimeType || '').toLowerCase())) return { error: 'Unsupported file type' };
    if (!base64Data || String(base64Data).length > 9500000) return { error: 'File is too large' };
    const safeFileName = String(fileName || 'upload').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180);
    const folder = getOrCreateFolder('TaskTrackerChat');
    const bytes  = Utilities.base64Decode(base64Data);
    if (bytes.length > 7000000) return { error: 'File is too large' };
    const blob   = Utilities.newBlob(bytes, mimeType, safeFileName);
    const file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId     = file.getId();
    const viewUrl    = 'https://drive.google.com/file/d/' + fileId + '/view';
    const directUrl  = mimeType.startsWith('image/')
      ? 'https://drive.google.com/uc?export=view&id=' + fileId
      : viewUrl;
    return { success: true, url: directUrl, viewUrl, fileId, fileName: safeFileName };
  } catch(e) {
    console.error('Upload failed', e);
    return { error: 'Upload failed' };
  }
}

function getOrCreateFolder(name) {
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

// ── AUTO-AUTOMATION ────────────────────────────────────────────────

function autoCreateMilestone(projectName, createdBy) {
  const sheet = getSpreadsheet().getSheetByName('Milestones');
  if (!sheet) return;
  const all    = sheet.getDataRange().getValues();
  if (!all.length) return;
  const headers  = all[0].map(String);
  const projIdx  = headers.indexOf('project');
  if (projIdx < 0) return;
  for (let i = 1; i < all.length; i++) {
    if (String(all[i][projIdx]).trim().toLowerCase() === projectName.toLowerCase()) return;
  }
  const id  = Utilities.getUuid();
  const now = new Date().toISOString();
  const row = headers.map(h => {
    if (h === 'id')             return id;
    if (h === 'project')        return projectName;
    if (h === 'milestone_name') return projectName + ' — Main Milestone';
    if (h === 'owner')          return createdBy || '';
    if (h === 'status')         return 'not_started';
    if (h === 'completion_pct') return 0;
    if (h === 'created_at' || h === 'updated_at') return now;
    return '';
  });
  sheet.appendRow(row);
}

function autoCreateExpense(poRow) {
  const sheet = getSpreadsheet().getSheetByName('Expenses');
  if (!sheet) return;
  const poRef   = 'PO:' + (poRow.po_number || poRow.id || '');
  const expData = sheet.getDataRange().getValues();
  const expHdrs = expData[0].map(String);
  const blIdx   = expHdrs.indexOf('budget_line');
  if (blIdx >= 0) {
    for (let i = 1; i < expData.length; i++) {
      if (String(expData[i][blIdx]) === poRef) return;
    }
  }
  const id     = Utilities.getUuid();
  const now    = new Date().toISOString();
  const amount = (parseFloat(poRow.quantity) || 0) * (parseFloat(poRow.unit_price) || 0);
  const row    = expHdrs.map(h => {
    if (h === 'id')          return id;
    if (h === 'category')    return poRow.supplier        || 'Purchase Order';
    if (h === 'description') return poRow.item_description || poRow.po_number || '';
    if (h === 'amount')      return amount;
    if (h === 'currency')    return poRow.currency        || 'USD';
    if (h === 'date')        return now.split('T')[0];
    if (h === 'budget_line') return poRef;
    if (h === 'created_at' || h === 'updated_at') return now;
    return '';
  });
  sheet.appendRow(row);
}

// ── QUOTATION COMPARISON ─────────────────────────────────────────

function getCompVendors(compId) {
  const sheet = getSpreadsheet().getSheetByName('ComparisonVendors');
  if (!sheet || sheet.getLastRow() < 2) return { rows: [] };
  const data    = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = data[0];
  const cidCol  = headers.indexOf('comparison_id');
  const rows    = data.slice(1)
    .filter(r => r[0] !== '' && r[cidCol] === compId)
    .map(r => { const o={}; headers.forEach((h,i)=>{if(h)o[h]=r[i];}); return o; });
  return { rows };
}

function saveComparison(data, vendors, createdBy) {
  const sheet = getSpreadsheet().getSheetByName('Comparisons');
  if (!sheet) return { error: 'Comparisons sheet not found. Create it first.' };
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const now = new Date().toISOString();
  const id  = Utilities.getUuid();
  data.id = id; data.created_at = now; data.updated_at = now; data.created_by = createdBy;
  if (!data.status) data.status = 'draft';
  sheet.appendRow(headers.map(h => data[h] !== undefined ? data[h] : ''));

  const vs = getSpreadsheet().getSheetByName('ComparisonVendors');
  if (vs) {
    const vh = vs.getRange(1,1,1,vs.getLastColumn()).getValues()[0];
    (vendors || []).forEach(v => {
      v.id = Utilities.getUuid();
      v.comparison_id = id;
      v.created_at = now;
      vs.appendRow(vh.map(h => v[h] !== undefined ? v[h] : ''));
    });
  }

  if (data.linked_po_id) {
    try {
      const pos = getSpreadsheet().getSheetByName('POs');
      const pd  = pos.getRange(1,1,pos.getLastRow(),pos.getLastColumn()).getValues();
      const ph  = pd[0];
      const idC = ph.indexOf('id'), cC = ph.indexOf('comparison_id');
      if (cC >= 0) {
        const ri = pd.findIndex((r,i) => i>0 && r[idC]===data.linked_po_id);
        if (ri > -1) pos.getRange(ri+1, cC+1).setValue(id);
      }
    } catch(e) {}
  }
  return { success: true, id };
}

function updateComparison(id, data, vendors, updatedBy) {
  const sheet = getSpreadsheet().getSheetByName('Comparisons');
  if (!sheet) return { error: 'Comparisons sheet not found' };
  const lastRow = sheet.getLastRow();
  const allData = sheet.getRange(1,1,lastRow,sheet.getLastColumn()).getValues();
  const headers = allData[0];
  const idCol   = headers.indexOf('id');
  const rowIdx  = allData.findIndex((r,i) => i>0 && r[idCol]===id);
  if (rowIdx === -1) return { error: 'Comparison not found' };
  data.updated_at = new Date().toISOString();
  headers.forEach((h,ci) => { if (data[h] !== undefined) sheet.getRange(rowIdx+1, ci+1).setValue(data[h]); });

  const vs = getSpreadsheet().getSheetByName('ComparisonVendors');
  if (vs && vs.getLastRow() >= 2) {
    const vd  = vs.getRange(1,1,vs.getLastRow(),vs.getLastColumn()).getValues();
    const vh  = vd[0];
    const cic = vh.indexOf('comparison_id');
    for (let i = vs.getLastRow(); i >= 2; i--) {
      if (vd[i-1][cic] === id) vs.deleteRow(i);
    }
  }
  if (vs) {
    const vh2 = vs.getRange(1,1,1,vs.getLastColumn()).getValues()[0];
    const now = new Date().toISOString();
    (vendors || []).forEach(v => {
      v.id = Utilities.getUuid(); v.comparison_id = id; v.created_at = now;
      vs.appendRow(vh2.map(h => v[h] !== undefined ? v[h] : ''));
    });
  }
  return { success: true };
}

function deleteComparisonFull(id) {
  deleteRow('Comparisons', id);
  const vs = getSpreadsheet().getSheetByName('ComparisonVendors');
  if (vs && vs.getLastRow() >= 2) {
    const vd  = vs.getRange(1,1,vs.getLastRow(),vs.getLastColumn()).getValues();
    const cic = vd[0].indexOf('comparison_id');
    for (let i = vs.getLastRow(); i >= 2; i--) {
      if (vd[i-1][cic] === id) vs.deleteRow(i);
    }
  }
  return { success: true };
}

// ── INVOICES ──────────────────────────────────────────────────────

function ensureInvoicesSheet() {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName('Invoices');
  const requiredHeaders = [
    'id','invoice_number','vendor','amount','currency','invoice_date','due_date',
    'po_reference','status','description','payment_date','payment_method',
    'bank_account','approved_by','notes','attachment_url',
    'created_at','created_by','updated_at','linked_po_id','amount_paid'
  ];
  if (!sh) {
    sh = ss.insertSheet('Invoices');
    sh.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sh.setFrozenRows(1);
  } else {
    // Auto-add any missing columns to existing sheet
    const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    requiredHeaders.forEach(h => {
      if (!existing.includes(h)) sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
    });
  }
  return sh;
}

function getInvoices() {
  try {
    ensureInvoicesSheet();
    const sh   = getSpreadsheet().getSheetByName('Invoices');
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { rows: [] };
    const headers = data[0];
    const rows    = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
      return obj;
    }).filter(r => r.id);
    return { rows };
  } catch(e) { return { error: e.message }; }
}

function saveInvoice(data) {
  try {
    ensureInvoicesSheet();
    const sh      = getSpreadsheet().getSheetByName('Invoices');
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const id      = 'INV-' + Date.now();
    const now     = new Date().toISOString();
    if (!data.status) data.status = 'Unpaid';
    const rowObj  = Object.assign({ id, created_at: now, updated_at: now, created_by: data.created_by || '' }, data);
    const row     = headers.map(h => rowObj[h] !== undefined ? rowObj[h] : '');
    sh.appendRow(row);
    return { success: true, id };
  } catch(e) { return { error: e.message }; }
}

function updateInvoice(data) {
  try {
    ensureInvoicesSheet();
    const sh      = getSpreadsheet().getSheetByName('Invoices');
    const allData = sh.getDataRange().getValues();
    const headers = allData[0];
    const idCol   = headers.indexOf('id');
    const rowIdx  = allData.findIndex((r, i) => i > 0 && String(r[idCol]) === String(data.id));
    if (rowIdx === -1) return { error: 'Invoice not found' };
    data.updated_at = new Date().toISOString();
    const clearableFields = new Set(['notes','payment_date','payment_method','bank_account','attachment_url','description']);
    headers.forEach((h, ci) => {
      if (h === 'id' || h === 'created_at' || h === 'created_by') return;
      if (data[h] !== undefined && data[h] !== null && data[h] !== '') {
        sh.getRange(rowIdx + 1, ci + 1).setValue(data[h]);
      } else if (clearableFields.has(h) && data[h] === '') {
        sh.getRange(rowIdx + 1, ci + 1).setValue('');
      }
    });
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

function deleteInvoice(id) {
  try {
    ensureInvoicesSheet();
    const sh      = getSpreadsheet().getSheetByName('Invoices');
    const allData = sh.getDataRange().getValues();
    const headers = allData[0];
    const idCol   = headers.indexOf('id');
    const rowIdx  = allData.findIndex((r, i) => i > 0 && String(r[idCol]) === String(id));
    if (rowIdx === -1) return { error: 'Not found' };
    sh.deleteRow(rowIdx + 1);
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

// ── VENDORS ──────────────────────────────────────────────────────

function ensureVendorsSheet() {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName('Vendors');
  const headers = ['id','vendor_name','category','contact_person','phone','email',
    'address','website','payment_terms','currency','notes','logo_url','logo_base64',
    'status','created_at','created_by','updated_at'];
  if (!sh) {
    sh = ss.insertSheet('Vendors');
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    headers.forEach(h => { if (!existing.includes(h)) sh.getRange(1, sh.getLastColumn() + 1).setValue(h); });
  }
  return sh;
}

function getVendors() {
  try {
    ensureVendorsSheet();
    const sh = getSpreadsheet().getSheetByName('Vendors');
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { rows: [] };
    const headers = data[0];
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        if (h === 'logo_base64') { obj['has_logo'] = row[i] ? 'true' : 'false'; }
        else { obj[h] = row[i] !== undefined ? String(row[i]) : ''; }
      });
      return obj;
    }).filter(r => r.id);
    return { rows };
  } catch(e) { return { error: e.message }; }
}

function getVendorByName(name) {
  try {
    ensureVendorsSheet();
    const sh = getSpreadsheet().getSheetByName('Vendors');
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { vendor: null };
    const headers = data[0];
    const nameIdx = headers.indexOf('vendor_name');
    const row = data.slice(1).find(r => nameIdx >= 0 && String(r[nameIdx]).toLowerCase() === String(name).toLowerCase());
    if (!row) return { vendor: null };
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
    return { vendor: obj };
  } catch(e) { return { error: e.message }; }
}

function saveVendor(data) {
  try {
    ensureVendorsSheet();
    const sh = getSpreadsheet().getSheetByName('Vendors');
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const id = 'VND-' + Date.now();
    const now = new Date().toISOString();
    if (!data.status) data.status = 'Active';
    const rowObj = Object.assign({ id, created_at: now, updated_at: now }, data);
    sh.appendRow(headers.map(h => rowObj[h] !== undefined ? rowObj[h] : ''));
    return { success: true, id };
  } catch(e) { return { error: e.message }; }
}

function updateVendor(data) {
  try {
    ensureVendorsSheet();
    const sh = getSpreadsheet().getSheetByName('Vendors');
    const allData = sh.getDataRange().getValues();
    const headers = allData[0];
    const idCol = headers.indexOf('id');
    const rowIdx = allData.findIndex((r, i) => i > 0 && String(r[idCol]) === String(data.id));
    if (rowIdx === -1) return { error: 'Vendor not found' };
    data.updated_at = new Date().toISOString();
    headers.forEach((h, ci) => {
      if (data[h] !== undefined) sh.getRange(rowIdx + 1, ci + 1).setValue(data[h]);
    });
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

function deleteVendor(id) {
  try {
    ensureVendorsSheet();
    const sh = getSpreadsheet().getSheetByName('Vendors');
    const allData = sh.getDataRange().getValues();
    const idCol = allData[0].indexOf('id');
    const rowIdx = allData.findIndex((r, i) => i > 0 && String(r[idCol]) === String(id));
    if (rowIdx === -1) return { error: 'Not found' };
    sh.deleteRow(rowIdx + 1);
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

// ── EMAIL ─────────────────────────────────────────────────────────

function sendEmailAction(data) {
  try {
    const to      = String(data.to || '').trim();
    const subject = String(data.subject || '').trim();
    const body    = String(data.body || '');
    if (!to || !subject || !body) return { error: 'Missing to, subject, or body' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: 'Invalid email address' };
    if (subject.length > 200 || body.length > 20000) return { error: 'Message is too long' };
    MailApp.sendEmail(to, subject, body);
    return { success: true };
  } catch(e) { console.error('Email send failed', e); return { error: 'Email could not be sent' }; }
}

function getUsersForRequester(requesterEmail) {
  const result = getAll('Users');
  if (String(requesterEmail).toLowerCase() === OWNER_EMAIL.toLowerCase()) return result;
  return { rows: (result.rows || []).map(user => {
    if (String(user.email || '').toLowerCase() === String(requesterEmail).toLowerCase()) return user;
    return { id: user.id || '', name: user.name || '', email: user.email || '' };
  }) };
}

// ── PURCHASE REQUESTS ─────────────────────────────────────────────

function ensurePRSheets() {
  const ss = getSpreadsheet();
  const prHeaders = [
    'id','pr_number','description','requested_by','department','priority','status',
    'budget_code','delivery_location','required_by_date','approval_date',
    'approved_by','linked_po_ids','notes','attachment_url',
    'total_estimated','currency','created_at','created_by','updated_at'
  ];
  let sh1 = ss.getSheetByName('PurchaseRequests');
  if (!sh1) {
    sh1 = ss.insertSheet('PurchaseRequests');
    sh1.getRange(1,1,1,prHeaders.length).setValues([prHeaders]);
    sh1.setFrozenRows(1);
  } else {
    const existing1 = sh1.getRange(1,1,1,sh1.getLastColumn()).getValues()[0];
    prHeaders.forEach(h => { if (!existing1.includes(h)) sh1.getRange(1, sh1.getLastColumn()+1).setValue(h); });
  }
  const lineHeaders = [
    'id','pr_id','item_name','quantity','unit','estimated_price','currency',
    'received_quantity','remaining_quantity','linked_po_id','notes','created_at'
  ];
  let sh2 = ss.getSheetByName('PRLineItems');
  if (!sh2) {
    sh2 = ss.insertSheet('PRLineItems');
    sh2.getRange(1,1,1,lineHeaders.length).setValues([lineHeaders]);
    sh2.setFrozenRows(1);
  } else {
    const existing2 = sh2.getRange(1,1,1,sh2.getLastColumn()).getValues()[0];
    lineHeaders.forEach(h => { if (!existing2.includes(h)) sh2.getRange(1, sh2.getLastColumn()+1).setValue(h); });
  }
}

function getPRs() {
  try {
    ensurePRSheets();
    const sh = getSpreadsheet().getSheetByName('PurchaseRequests');
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { rows: [] };
    const headers = data[0];
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
      return obj;
    }).filter(r => r.id);
    return { rows };
  } catch(e) { return { error: e.message }; }
}

function getPRLineItems(prId) {
  try {
    ensurePRSheets();
    const sh = getSpreadsheet().getSheetByName('PRLineItems');
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return { rows: [] };
    const headers = data[0];
    const rows = data.slice(1)
      .map(row => { const obj={}; headers.forEach((h,i)=>{obj[h]=row[i]!==undefined?String(row[i]):'';});return obj;})
      .filter(r => r.pr_id === prId);
    return { rows };
  } catch(e) { return { error: e.message }; }
}

function savePR(data) {
  try {
    ensurePRSheets();
    const sh = getSpreadsheet().getSheetByName('PurchaseRequests');
    const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    const id = 'PR-' + Date.now();
    const now = new Date().toISOString();
    if (!data.status) data.status = 'Draft';
    const rowObj = Object.assign({ id, created_at: now, updated_at: now }, data);
    sh.appendRow(headers.map(h => rowObj[h] !== undefined ? rowObj[h] : ''));
    return { success: true, id };
  } catch(e) { return { error: e.message }; }
}

function updatePR(data) {
  try {
    ensurePRSheets();
    const sh = getSpreadsheet().getSheetByName('PurchaseRequests');
    const allData = sh.getDataRange().getValues();
    const headers = allData[0];
    const idCol = headers.indexOf('id');
    const rowIdx = allData.findIndex((r,i) => i>0 && String(r[idCol])===String(data.id));
    if (rowIdx === -1) return { error: 'PR not found' };
    data.updated_at = new Date().toISOString();
    headers.forEach((h, ci) => {
      if (data[h] !== undefined) sh.getRange(rowIdx+1, ci+1).setValue(data[h]);
    });
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

function deletePR(id) {
  try {
    ensurePRSheets();
    const sh = getSpreadsheet().getSheetByName('PurchaseRequests');
    const allData = sh.getDataRange().getValues();
    const headers = allData[0];
    const idCol = headers.indexOf('id');
    const rowIdx = allData.findIndex((r,i) => i>0 && String(r[idCol])===String(id));
    if (rowIdx === -1) return { error: 'Not found' };
    sh.deleteRow(rowIdx + 1);
    const sh2 = getSpreadsheet().getSheetByName('PRLineItems');
    if (sh2) {
      const d2 = sh2.getDataRange().getValues();
      const piCol = d2[0].indexOf('pr_id');
      for (let i = d2.length-1; i > 0; i--) {
        if (String(d2[i][piCol]) === String(id)) sh2.deleteRow(i+1);
      }
    }
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

function savePRLineItems(prId, items) {
  try {
    ensurePRSheets();
    const sh = getSpreadsheet().getSheetByName('PRLineItems');
    const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    const now = new Date().toISOString();
    const existing = sh.getDataRange().getValues();
    const piCol = existing[0].indexOf('pr_id');
    for (let i = existing.length-1; i > 0; i--) {
      if (String(existing[i][piCol]) === String(prId)) sh.deleteRow(i+1);
    }
    (items || []).forEach((item, idx) => {
      const id = 'PLI-' + Date.now() + '-' + idx;
      const qty = parseFloat(item.quantity) || 0;
      const received = parseFloat(item.received_quantity) || 0;
      const rowObj = {
        id, pr_id: prId,
        item_name: item.item_name || '', quantity: qty, unit: item.unit || 'pcs',
        estimated_price: item.estimated_price || 0, currency: item.currency || 'IQD',
        received_quantity: received, remaining_quantity: qty - received,
        linked_po_id: item.linked_po_id || '', notes: item.notes || '', created_at: now,
      };
      sh.appendRow(headers.map(h => rowObj[h] !== undefined ? rowObj[h] : ''));
    });
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

function updatePRLineQty(lineId, receivedQty, linkedPoId) {
  try {
    ensurePRSheets();
    const sh = getSpreadsheet().getSheetByName('PRLineItems');
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    const idCol  = headers.indexOf('id');
    const rowIdx = data.findIndex((r,i) => i>0 && String(r[idCol])===String(lineId));
    if (rowIdx === -1) return { error: 'Line item not found' };
    const qtyCol = headers.indexOf('quantity');
    const recCol = headers.indexOf('received_quantity');
    const remCol = headers.indexOf('remaining_quantity');
    const poCol  = headers.indexOf('linked_po_id');
    const totalQty = parseFloat(data[rowIdx][qtyCol]) || 0;
    const newRec   = parseFloat(receivedQty) || 0;
    sh.getRange(rowIdx+1, recCol+1).setValue(newRec);
    sh.getRange(rowIdx+1, remCol+1).setValue(totalQty - newRec);
    if (linkedPoId) sh.getRange(rowIdx+1, poCol+1).setValue(linkedPoId);
    const prIdCol = headers.indexOf('pr_id');
    const prId = data[rowIdx][prIdCol];
    const prItems = data.filter((r,i) => i>0 && String(r[prIdCol])===String(prId));
    const allReceived = prItems.every(r => {
      const q = parseFloat(r[qtyCol]) || 0;
      const rec = r[idCol]===lineId ? newRec : (parseFloat(r[recCol])||0);
      return rec >= q;
    });
    return { success: true, all_received: allReceived };
  } catch(e) { return { error: e.message }; }
}

// ── USER PERMISSIONS ─────────────────────────────────────────────

function getUserPermissions(email) {
  try {
    const sh = getSpreadsheet().getSheetByName('Users');
    if (!sh) return { role: 'editor', permissions: {} };
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf('email');
    const roleCol  = headers.indexOf('role');
    const permCol  = headers.indexOf('permissions');
    const themeCol = headers.indexOf('theme');
    const row = data.find((r, i) => i > 0 && String(r[emailCol]).toLowerCase() === email.toLowerCase());
    if (!row) return { role: 'editor', permissions: {} };
    let perms = {};
    try { perms = JSON.parse(row[permCol] || '{}'); } catch(e) {}
    return { role: row[roleCol] || 'editor', permissions: perms, theme: themeCol >= 0 ? (row[themeCol] || '') : '' };
  } catch(e) { return { role: 'editor', permissions: {} }; }
}

function updateUserPermissions(email, permissions) {
  try {
    const sh = getSpreadsheet().getSheetByName('Users');
    if (!sh) return { error: 'Users sheet not found' };
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf('email');
    let permCol = headers.indexOf('permissions');
    if (permCol === -1) {
      permCol = headers.length;
      sh.getRange(1, permCol + 1).setValue('permissions');
    }
    const rowIdx = data.findIndex((r, i) => i > 0 && String(r[emailCol]).toLowerCase() === email.toLowerCase());
    if (rowIdx === -1) return { error: 'User not found' };
    sh.getRange(rowIdx + 1, permCol + 1).setValue(JSON.stringify(permissions));
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

// ── PHASE 1 SETUP ─────────────────────────────────────────────────

function addColumnsIfMissing(sheetName, columnNames) {
  const sh = getSpreadsheet().getSheetByName(sheetName);
  if (!sh) return;
  const existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  columnNames.forEach(col => {
    if (!existing.includes(col)) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
      existing.push(col);
    }
  });
}

function setupPhase1Columns() {
  addColumnsIfMissing('Tasks', ['dependency_ids','recurring','time_logged_minutes','subtasks_json']);
  addColumnsIfMissing('POs',   ['received_quantity','amendment_log']);
  addColumnsIfMissing('Invoices', ['recurring','recurring_day']);
  addColumnsIfMissing('Vendors', ['performance_score','total_spend','blacklist_reason','contract_expiry']);
  addColumnsIfMissing('PurchaseRequests', ['approval_stage','dept_head_approval','finance_approval','gm_approval','aging_notified']);
}

// ── BUDGETS ──────────────────────────────────────────────────────

function ensureBudgetsSheet() {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName('Budgets');
  const headers = ['id','department','fiscal_year','total_budget','spent',
    'currency','cost_center','status','created_at','created_by','updated_at'];
  if (!sh) {
    sh = ss.insertSheet('Budgets');
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    headers.forEach(h => { if (!existing.includes(h)) sh.getRange(1, sh.getLastColumn()+1).setValue(h); });
  }
  return sh;
}

function getBudgets() {
  ensureBudgetsSheet();
  const sh = getSpreadsheet().getSheetByName('Budgets');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { rows: [] };
  const headers = data[0];
  const rows = data.slice(1).map(r => { const o={}; headers.forEach((h,i)=>o[h]=String(r[i]||'')); return o; }).filter(r=>r.id);
  return { rows };
}

function saveBudget(data) {
  ensureBudgetsSheet();
  const sh = getSpreadsheet().getSheetByName('Budgets');
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const id = 'BDG-' + Date.now();
  const now = new Date().toISOString();
  if (!data.spent) data.spent = 0;
  if (!data.status) data.status = 'Active';
  const rowObj = Object.assign({ id, created_at: now, updated_at: now }, data);
  sh.appendRow(headers.map(h => rowObj[h] !== undefined ? rowObj[h] : ''));
  return { success: true, id };
}

function updateBudget(data) {
  const sh = getSpreadsheet().getSheetByName('Budgets');
  if (!sh) return { error: 'Not found' };
  const allData = sh.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');
  const rowIdx = allData.findIndex((r,i) => i>0 && String(r[idCol])===String(data.id));
  if (rowIdx === -1) return { error: 'Not found' };
  data.updated_at = new Date().toISOString();
  headers.forEach((h,ci) => { if (data[h]!==undefined) sh.getRange(rowIdx+1,ci+1).setValue(data[h]); });
  return { success: true };
}

function deleteBudget(id) {
  const sh = getSpreadsheet().getSheetByName('Budgets');
  if (!sh) return { error: 'Not found' };
  const data = sh.getDataRange().getValues();
  const idCol = data[0].indexOf('id');
  const idx = data.findIndex((r,i) => i>0 && String(r[idCol])===String(id));
  if (idx === -1) return { error: 'Not found' };
  sh.deleteRow(idx+1);
  return { success: true };
}

function checkBudget(department, amount) {
  const budgets = getBudgets().rows || [];
  const year = String(new Date().getFullYear());
  const dept = budgets.find(b => b.department === department && b.fiscal_year === year);
  if (!dept) return { available: true, message: 'No budget set for this department' };
  const total = parseFloat(dept.total_budget||0);
  const spent = parseFloat(dept.spent||0);
  const amt   = parseFloat(amount||0);
  const pctAfter = total > 0 ? ((spent+amt)/total)*100 : 0;
  return {
    available: (spent+amt) <= total,
    total, spent, remaining: total-spent, pct_after: pctAfter,
    alert_level: pctAfter>=100 ? 'exceeded' : pctAfter>=90 ? 'critical' : pctAfter>=75 ? 'warning' : 'ok'
  };
}

// ── NOTIFICATIONS ────────────────────────────────────────────────

function ensureNotificationsSheet() {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName('Notifications');
  const headers = ['id','user_email','type','title','message','link','read','created_at'];
  if (!sh) {
    sh = ss.insertSheet('Notifications');
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function createNotification(data) {
  ensureNotificationsSheet();
  const sh = getSpreadsheet().getSheetByName('Notifications');
  const id = 'NTF-' + Date.now();
  sh.appendRow([id, data.user_email||'all', data.type||'info', data.title||'',
    data.message||'', data.link||'', 'false', new Date().toISOString()]);
  return { success: true, id };
}

function getNotifications(email) {
  ensureNotificationsSheet();
  const sh = getSpreadsheet().getSheetByName('Notifications');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { rows: [] };
  const headers = data[0];
  const rows = data.slice(1)
    .map(r => { const o={}; headers.forEach((h,i)=>o[h]=String(r[i]||'')); return o; })
    .filter(r => r.id && (!email || String(r.user_email).toLowerCase()===String(email).toLowerCase() || String(r.user_email).toLowerCase()==='all'))
    .sort((a,b) => new Date(b.created_at)-new Date(a.created_at))
    .slice(0,50);
  return { rows };
}

function markNotifRead(id, email) {
  const sh = getSpreadsheet().getSheetByName('Notifications');
  if (!sh) return { error: 'Not found' };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id'), readCol = headers.indexOf('read'), emailCol = headers.indexOf('user_email');
  const idx = data.findIndex((r,i) => i>0 && String(r[idCol])===String(id) &&
    String(r[emailCol]).toLowerCase() === String(email).toLowerCase());
  if (idx === -1) return { error: 'Not found' };
  sh.getRange(idx+1, readCol+1).setValue('true');
  return { success: true };
}

function markAllNotifsRead(email) {
  const sh = getSpreadsheet().getSheetByName('Notifications');
  if (!sh) return { error: 'Not found' };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('user_email'), readCol = headers.indexOf('read');
  data.forEach((r,i) => {
    if (i>0 && String(r[emailCol]).toLowerCase()===String(email).toLowerCase()) {
      sh.getRange(i+1, readCol+1).setValue('true');
    }
  });
  return { success: true };
}

// ── AUDIT LOG ────────────────────────────────────────────────────

function ensureAuditSheet() {
  const ss = getSpreadsheet();
  let sh = ss.getSheetByName('AuditLog');
  const headers = ['id','timestamp','user_email','action','sheet','record_id','summary'];
  if (!sh) {
    sh = ss.insertSheet('AuditLog');
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function logAudit(data) {
  try {
    ensureAuditSheet();
    const sh = getSpreadsheet().getSheetByName('AuditLog');
    sh.appendRow(['AUD-'+Date.now(), new Date().toISOString(),
      data.user_email||'', data.action||'', data.sheet||'', data.record_id||'', data.summary||'']);
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

function getAuditLog(sheetName, recordId) {
  ensureAuditSheet();
  const sh = getSpreadsheet().getSheetByName('AuditLog');
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { rows: [] };
  const headers = data[0];
  const rows = data.slice(1)
    .map(r => { const o={}; headers.forEach((h,i)=>o[h]=String(r[i]||'')); return o; })
    .filter(r => (!sheetName || r.sheet===sheetName) && (!recordId || r.record_id===recordId))
    .sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))
    .slice(0,200);
  return { rows };
}

// ── GLOBAL SEARCH ────────────────────────────────────────────────

function globalSearch(query) {
  if (!query || String(query).length < 2) return { results: [] };
  const q = String(query).toLowerCase();
  const results = [];
  const sheets = ['Tasks','POs','Invoices','PurchaseRequests','Vendors','Comparisons','Milestones','Expenses'];
  sheets.forEach(sheetName => {
    try {
      const sh = getSpreadsheet().getSheetByName(sheetName);
      if (!sh) return;
      const data = sh.getDataRange().getValues();
      if (data.length < 2) return;
      const headers = data[0];
      data.slice(1).forEach(row => {
        const combined = row.join(' ').toLowerCase();
        if (combined.includes(q)) {
          const obj = {}; headers.forEach((h,i) => obj[h]=String(row[i]||''));
          results.push({
            sheet: sheetName, id: obj.id||'',
            title: obj.title || obj.po_number || obj.invoice_number || obj.pr_number ||
                   obj.vendor_name || obj.milestone_name || obj.category || '',
          });
        }
      });
    } catch(e) {}
  });
  return { results: results.slice(0, 30) };
}

// ── VENDOR RATING + SPEND ────────────────────────────────────────

function rateVendor(vendorId, scores) {
  const sh = getSpreadsheet().getSheetByName('Vendors');
  if (!sh) return { error: 'Not found' };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id'), scoreCol = headers.indexOf('performance_score');
  const rowIdx = data.findIndex((r,i) => i>0 && String(r[idCol])===String(vendorId));
  if (rowIdx === -1) return { error: 'Vendor not found' };
  const avg = (parseFloat(scores.delivery||0)+parseFloat(scores.quality||0)+parseFloat(scores.price||0))/3;
  const existing = parseFloat(data[rowIdx][scoreCol]||0);
  const newScore = existing > 0 ? (existing+avg)/2 : avg;
  sh.getRange(rowIdx+1, scoreCol+1).setValue(newScore.toFixed(1));
  return { success: true, score: newScore };
}

function getVendorSpend(vendorName) {
  let total = 0;
  ['POs','Invoices'].forEach(sheetName => {
    const sh = getSpreadsheet().getSheetByName(sheetName);
    if (!sh) return;
    const data = sh.getDataRange().getValues();
    if (data.length < 2) return;
    const headers = data[0];
    const vendorCol = headers.indexOf(sheetName==='POs' ? 'supplier' : 'vendor');
    const amtCol = headers.indexOf(sheetName==='POs' ? 'total_value' : 'amount');
    if (vendorCol<0 || amtCol<0) return;
    data.slice(1).forEach(r => {
      if (String(r[vendorCol]).toLowerCase() === String(vendorName).toLowerCase()) {
        total += parseFloat(r[amtCol]) || 0;
      }
    });
  });
  const sh = getSpreadsheet().getSheetByName('Vendors');
  if (sh) {
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    const nameCol = headers.indexOf('vendor_name'), spendCol = headers.indexOf('total_spend');
    const rowIdx = data.findIndex((r,i) => i>0 && String(r[nameCol]).toLowerCase()===String(vendorName).toLowerCase());
    if (rowIdx > -1 && spendCol > -1) sh.getRange(rowIdx+1, spendCol+1).setValue(total);
  }
  return { total_spend: total };
}

// ── INVOICE AGING ────────────────────────────────────────────────

function getInvoiceAging() {
  const sh = getSpreadsheet().getSheetByName('Invoices');
  if (!sh) return { buckets: { current:[], d30:[], d60:[], d90:[] } };
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { buckets: { current:[], d30:[], d60:[], d90:[] } };
  const headers = data[0];
  const today = new Date(); today.setHours(0,0,0,0);
  const buckets = { current: [], d30: [], d60: [], d90: [] };
  data.slice(1).forEach(row => {
    const obj = {}; headers.forEach((h,i) => obj[h]=String(row[i]||''));
    if (obj.status==='Paid' || obj.status==='Cancelled') return;
    const due = new Date(obj.due_date);
    if (isNaN(due)) return;
    const days = Math.floor((today-due)/86400000);
    if (days <= 0) buckets.current.push(obj);
    else if (days <= 30) buckets.d30.push(obj);
    else if (days <= 60) buckets.d60.push(obj);
    else buckets.d90.push(obj);
  });
  return { buckets };
}

// ── THEME TO SERVER (Users sheet, keyed by email — not id) ───────

function saveUserTheme(email, theme) {
  const sh = getSpreadsheet().getSheetByName('Users');
  if (!sh) return { error: 'Users sheet not found' };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const emailCol = headers.indexOf('email');
  let themeCol = headers.indexOf('theme');
  if (themeCol === -1) { themeCol = headers.length; sh.getRange(1, themeCol+1).setValue('theme'); }
  const rowIdx = data.findIndex((r,i) => i>0 && String(r[emailCol]).toLowerCase()===String(email).toLowerCase());
  if (rowIdx === -1) return { error: 'User row not found' };
  sh.getRange(rowIdx+1, themeCol+1).setValue(theme);
  return { success: true };
}

// ── RESPONSE ──────────────────────────────────────────────────────

function respond(data) {
  if (data && data.error) {
    const safeError = /^(Unauthorized|Forbidden|Too many requests|Request failed|Invalid (record|field|field value|email address)|Field too long|Unsupported file type|File is too large|Message is too long|Email could not be sent|Upload failed|Missing to, subject, or body|Unknown action|Message not found|User not found|Line item not found)/.test(String(data.error));
    if (!safeError) {
      console.error('API operation error', data.error);
      data = { error: 'Request failed', code: 'SERVER_ERROR' };
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
