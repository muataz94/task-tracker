// ── Task Tracker — Google Apps Script Backend v2 ─────────────────
// Deploy as Web App: Execute as Me | Access: Anyone
// Set script property SPREADSHEET_ID to your sheet's ID (optional — falls back to active spreadsheet)

let _ss = null;
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
    switch (action) {
      case 'getAll':       return respond(getAll(sheet));
      case 'getDashboard': return respond(getDashboard());
      case 'addRow':       return respond(addRow(sheet, data, user.email));
      case 'updateRow':    return respond(updateRow(sheet, id, data, user.email));
      case 'deleteRow':    return respond(deleteRow(sheet, id));
      case 'getChat':      return respond(getChat());
      case 'sendMessage':   return respond(sendMessage(data, user.email));
      case 'editMessage':   return respond(editMessage(body.id, body.message));
      case 'deleteMessage': return respond(deleteMessage(body.id));
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
      case 'updatePRLineQty':  return respond(updatePRLineQty(body.line_id, body.received_qty, body.linked_po_id));
      default:                 return respond({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doGet() {
  return respond({ status: 'Task Tracker API v2 running', time: new Date().toISOString() });
}

// ── AUTH ─────────────────────────────────────────────────────────

function validateToken(token) {
  try {
    const res  = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    const info = JSON.parse(res.getContentText());
    if (info.error) return null;
    if (info.exp && Number(info.exp) < Math.floor(Date.now() / 1000)) return null;
    return { email: info.email, name: info.name || info.email, picture: info.picture || '' };
  } catch (e) { return null; }
}

function isAuthorized(email) {
  try {
    const sheet   = getSpreadsheet().getSheetByName('Users');
    if (!sheet) return true; // No Users sheet = open access (set up Users sheet to restrict)
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return true;
    const emails  = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().map(String);
    return emails.some(e => e.trim().toLowerCase() === email.toLowerCase());
  } catch (e) { return true; }
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

function editMessage(id, newMessage) {
  const sheet = getSpreadsheet().getSheetByName('Chat');
  if (!sheet) return { error: 'Chat sheet not found' };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'Message not found' };
  const data    = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');
  const msgCol  = headers.indexOf('message');
  const editCol = headers.indexOf('edited_at');
  const rowIdx  = data.findIndex((r, i) => i > 0 && r[idCol] === id);
  if (rowIdx === -1) return { error: 'Message not found' };
  sheet.getRange(rowIdx + 1, msgCol + 1).setValue(newMessage);
  if (editCol >= 0) sheet.getRange(rowIdx + 1, editCol + 1).setValue(new Date().toISOString());
  return { success: true };
}

function deleteMessage(id) {
  const sheet = getSpreadsheet().getSheetByName('Chat');
  if (!sheet) return { error: 'Chat sheet not found' };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'Message not found' };
  const data   = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const idCol  = data[0].indexOf('id');
  const rowIdx = data.findIndex((r, i) => i > 0 && r[idCol] === id);
  if (rowIdx === -1) return { error: 'Message not found' };
  sheet.deleteRow(rowIdx + 1);
  return { success: true };
}

function uploadFileToDrive(base64Data, fileName, mimeType, uploaderEmail) {
  try {
    const folder = getOrCreateFolder('TaskTrackerChat');
    const bytes  = Utilities.base64Decode(base64Data);
    const blob   = Utilities.newBlob(bytes, mimeType, fileName);
    const file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId     = file.getId();
    const viewUrl    = 'https://drive.google.com/file/d/' + fileId + '/view';
    const directUrl  = mimeType.startsWith('image/')
      ? 'https://drive.google.com/uc?export=view&id=' + fileId
      : viewUrl;
    return { success: true, url: directUrl, viewUrl, fileId, fileName };
  } catch(e) {
    return { error: 'Upload failed: ' + e.message };
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
  if (!sh) {
    sh = ss.insertSheet('Vendors');
    const headers = ['id','vendor_name','category','contact_person','phone','email',
      'address','website','payment_terms','currency','notes','logo_url','logo_base64',
      'status','created_at','created_by','updated_at'];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
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
    const to      = data.to;
    const subject = data.subject;
    const body    = data.body;
    if (!to || !subject || !body) return { error: 'Missing to, subject, or body' };
    MailApp.sendEmail({ to, subject, htmlBody: body.replace(/\n/g, '<br/>') });
    return { success: true };
  } catch(e) { return { error: e.message }; }
}

// ── PURCHASE REQUESTS ─────────────────────────────────────────────

function ensurePRSheets() {
  const ss = getSpreadsheet();
  let sh1 = ss.getSheetByName('PurchaseRequests');
  if (!sh1) {
    sh1 = ss.insertSheet('PurchaseRequests');
    sh1.getRange(1,1,1,20).setValues([[
      'id','pr_number','description','requested_by','department','priority','status',
      'budget_code','delivery_location','required_by_date','approval_date',
      'approved_by','linked_po_ids','notes','attachment_url',
      'total_estimated','currency','created_at','created_by','updated_at'
    ]]);
    sh1.setFrozenRows(1);
  }
  let sh2 = ss.getSheetByName('PRLineItems');
  if (!sh2) {
    sh2 = ss.insertSheet('PRLineItems');
    sh2.getRange(1,1,1,12).setValues([[
      'id','pr_id','item_name','quantity','unit','estimated_price','currency',
      'received_quantity','remaining_quantity','linked_po_id','notes','created_at'
    ]]);
    sh2.setFrozenRows(1);
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

// ── RESPONSE ──────────────────────────────────────────────────────

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
