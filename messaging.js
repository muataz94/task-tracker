// ─── WhatsApp + Email Messaging System ───────────────────────────────────────

function openWhatsApp(phone, contextMessage) {
  if (!phone) { showToast('No phone number available', 'error'); return; }
  let clean = String(phone).replace(/[\s\-\(\)\+]/g, '');
  if (clean.startsWith('0')) clean = '964' + clean.substring(1);
  if (!clean.match(/^\d{10,15}$/)) { showToast('Invalid phone number format', 'error'); return; }
  const msg = encodeURIComponent(contextMessage || '');
  window.open('https://wa.me/' + clean + (msg ? '?text=' + msg : ''), '_blank');
}

function openMailto(email, subject, body) {
  if (!email) { showToast('No email address available', 'error'); return; }
  window.open('mailto:' + email + '?subject=' + encodeURIComponent(subject||'') + '&body=' + encodeURIComponent(body||''), '_self');
}

function _companyName() {
  return typeof getCompanyName === 'function' ? getCompanyName() : 'Task Tracker';
}

function buildTaskFollowUpMsg(task) {
  return '*' + _companyName() + ' — Task Follow-Up*\n\n' +
    'Task: ' + (task.title || task.name || '—') + '\n' +
    'Status: ' + (task.status || '—') + '\n' +
    'Priority: ' + (task.priority || '—') + '\n' +
    'Due: ' + (task.due_date || '—') + '\n\n' +
    'Please provide an update on this task. Thank you.';
}

function buildPOFollowUpMsg(po) {
  return '*' + _companyName() + ' — Purchase Order Follow-Up*\n\n' +
    'PO: ' + (po.po_number || po.id || '—') + '\n' +
    'Vendor: ' + (po.supplier || po.vendor || '—') + '\n' +
    'Amount: ' + (po.currency || 'IQD') + ' ' + parseFloat(po.total_amount || po.total_value || po.amount || 0).toLocaleString() + '\n' +
    'Status: ' + (po.status || '—') + '\n\n' +
    'Kindly update us on the delivery status. Thank you.';
}

function buildInvoiceFollowUpMsg(inv) {
  return '*' + _companyName() + ' — Invoice Follow-Up*\n\n' +
    'Invoice: ' + (inv.invoice_number || '—') + '\n' +
    'Vendor: ' + (inv.vendor || '—') + '\n' +
    'Amount: ' + (inv.currency || 'IQD') + ' ' + parseFloat(inv.amount || 0).toLocaleString() + '\n' +
    'Due: ' + (inv.due_date || '—') + '\n' +
    'Status: ' + (inv.status || '—') + '\n\n' +
    'Please confirm payment status. Thank you.';
}

function buildPRFollowUpMsg(pr) {
  return '*' + _companyName() + ' — Purchase Request Follow-Up*\n\n' +
    'PR: ' + (pr.pr_number || '—') + '\n' +
    'Description: ' + (pr.description || '—') + '\n' +
    'Requested By: ' + (pr.requested_by || '—') + '\n' +
    'Status: ' + (pr.status || '—') + '\n\n' +
    'Please review and approve this request. Thank you.';
}

function showComposeModal(opts) {
  opts = opts || {};
  const type   = opts.type   || 'general';
  const record = opts.record || {};
  const email  = opts.email  || '';
  const phone  = opts.phone  || '';

  let defaultMsg = '';
  if (type === 'task')    defaultMsg = buildTaskFollowUpMsg(record);
  else if (type === 'po') defaultMsg = buildPOFollowUpMsg(record);
  else if (type === 'invoice') defaultMsg = buildInvoiceFollowUpMsg(record);
  else if (type === 'pr') defaultMsg = buildPRFollowUpMsg(record);

  const company = _companyName();
  const ref = record.po_number || record.invoice_number || record.pr_number || record.title || '';
  const defaultSubject = type === 'general' ? '' : (company + ' — ' + type.toUpperCase() + ' Follow-Up' + (ref ? ': ' + ref : ''));
  const cleanMsg = defaultMsg.replace(/\*/g, '');

  const prev = document.getElementById('msg-modal-overlay');
  if (prev) prev.remove();

  const div = document.createElement('div');
  div.id = 'msg-modal-overlay';
  div.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(10px);padding:1rem;';
  div.innerHTML = `
    <div onclick="event.stopPropagation()" style="position:relative;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;border-radius:var(--r-lg);padding:1.5rem;background:var(--glass-bg-strong);backdrop-filter:var(--glass-blur);border:1px solid var(--border);box-shadow:0 24px 64px rgba(0,0,0,0.45);animation:modalSpringIn var(--dur-enter) var(--spring-bounce) both;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h2 style="font-size:17px;font-weight:700;color:var(--text-1);">Send Message</h2>
        <button onclick="closeMsgModal()" style="background:var(--glass-bg);border:1px solid var(--border);color:var(--text-3);width:30px;height:30px;border-radius:var(--r-sm);cursor:pointer;font-size:16px;font-family:Inter,sans-serif;">✕</button>
      </div>

      <div style="display:flex;gap:2px;background:var(--glass-bg);border:1px solid var(--border);border-radius:var(--r-sm);padding:3px;margin-bottom:1rem;">
        <button id="msg-tab-wa" onclick="setMsgTab('wa')" style="flex:1;padding:7px;border-radius:var(--r-xs);border:none;cursor:pointer;font-size:12px;font-weight:600;font-family:Inter,sans-serif;transition:all 0.15s;background:rgba(37,211,102,0.2);color:#25d366;">WhatsApp</button>
        <button id="msg-tab-email" onclick="setMsgTab('email')" style="flex:1;padding:7px;border-radius:var(--r-xs);border:none;cursor:pointer;font-size:12px;font-weight:500;font-family:Inter,sans-serif;transition:all 0.15s;background:transparent;color:var(--text-3);">Email</button>
      </div>

      <div id="msg-wa-section">
        <div class="form-group" style="margin-bottom:12px;">
          <label>Phone Number</label>
          <input id="msg-wa-phone" type="tel" placeholder="+964 7XX XXX XXXX" value="${escapeHtml(phone)}"/>
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label>Message</label>
          <textarea id="msg-wa-body" rows="6" style="resize:vertical;font-size:13px;" placeholder="Type your message…">${escapeHtml(cleanMsg)}</textarea>
        </div>
        <button class="btn-primary" style="width:100%;background:#25d366;box-shadow:0 6px 20px rgba(37,211,102,0.3);" onclick="sendWhatsAppFromModal()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;vertical-align:middle;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Open WhatsApp
        </button>
      </div>

      <div id="msg-email-section" style="display:none;">
        <div class="form-group" style="margin-bottom:12px;">
          <label>To (Email)</label>
          <input id="msg-email-to" type="email" placeholder="recipient@example.com" value="${escapeHtml(email)}"/>
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label>Subject</label>
          <input id="msg-email-subject" type="text" value="${escapeHtml(defaultSubject)}"/>
        </div>
        <div class="form-group" style="margin-bottom:12px;">
          <label>Message</label>
          <textarea id="msg-email-body" rows="6" style="resize:vertical;font-size:13px;" placeholder="Type your email…">${escapeHtml(cleanMsg)}</textarea>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn-primary" style="flex:1;" onclick="sendEmailFromModal()">Send via App</button>
          <button class="btn-export" style="flex:1;" onclick="sendEmailViaMailto()">Open in Mail Client</button>
        </div>
      </div>
    </div>`;

  div.addEventListener('click', e => { if (e.target === div) closeMsgModal(); });
  document.body.appendChild(div);
  if (opts.startTab === 'email') setTimeout(() => setMsgTab('email'), 10);
}

function setMsgTab(tab) {
  const waBtn  = document.getElementById('msg-tab-wa');
  const emBtn  = document.getElementById('msg-tab-email');
  const waSec  = document.getElementById('msg-wa-section');
  const emSec  = document.getElementById('msg-email-section');
  if (tab === 'wa') {
    if (waBtn) { waBtn.style.background='rgba(37,211,102,0.2)'; waBtn.style.color='#25d366'; waBtn.style.fontWeight='600'; }
    if (emBtn) { emBtn.style.background='transparent'; emBtn.style.color='var(--text-3)'; emBtn.style.fontWeight='500'; }
    if (waSec) waSec.style.display = 'block';
    if (emSec) emSec.style.display = 'none';
  } else {
    if (emBtn) { emBtn.style.background='rgba(167,139,250,0.2)'; emBtn.style.color='var(--accent)'; emBtn.style.fontWeight='600'; }
    if (waBtn) { waBtn.style.background='transparent'; waBtn.style.color='var(--text-3)'; waBtn.style.fontWeight='500'; }
    if (waSec) waSec.style.display = 'none';
    if (emSec) emSec.style.display = 'block';
  }
}

function sendWhatsAppFromModal() {
  const phone = document.getElementById('msg-wa-phone')?.value?.trim();
  const body  = document.getElementById('msg-wa-body')?.value?.trim();
  if (!phone) { showToast('Phone number is required', 'error'); return; }
  openWhatsApp(phone, body);
  closeMsgModal();
}

async function sendEmailFromModal() {
  const to      = document.getElementById('msg-email-to')?.value?.trim();
  const subject = document.getElementById('msg-email-subject')?.value?.trim();
  const body    = document.getElementById('msg-email-body')?.value?.trim();
  if (!to)      { showToast('Recipient email is required', 'error'); return; }
  if (!subject) { showToast('Subject is required', 'error'); return; }
  try {
    await callAPI('sendEmail', { to, subject, body });
    showToast('Email sent ✓', 'success');
    closeMsgModal();
  } catch(e) {
    showToast('Failed to send: ' + e.message + '. Try "Open in Mail Client" instead.', 'error');
  }
}

function sendEmailViaMailto() {
  const to      = document.getElementById('msg-email-to')?.value?.trim();
  const subject = document.getElementById('msg-email-subject')?.value?.trim();
  const body    = document.getElementById('msg-email-body')?.value?.trim();
  openMailto(to, subject, body);
  closeMsgModal();
}

function closeMsgModal() {
  document.getElementById('msg-modal-overlay')?.remove();
}

// ── Row messaging buttons (WA + Email) ────────────────────────────────────────
function renderMsgButtons(type, record, phoneKey, emailKey) {
  const phone = (record && record[phoneKey]) || '';
  const email = (record && record[emailKey]) || '';
  if (!phone && !email) return '';
  if (!window.__msgBtnCache) window.__msgBtnCache = [];
  const idx = window.__msgBtnCache.length;
  window.__msgBtnCache.push({ type, record: Object.assign({}, record), phone, email });
  const waIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
  const emailIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>`;
  let html = '';
  if (phone) html += `<button class="btn-edit btn-icon-action" title="WhatsApp" onclick="showComposeModal(window.__msgBtnCache[${idx}])" style="background:rgba(37,211,102,0.12);border-color:rgba(37,211,102,0.25);min-width:26px;">${waIcon}</button>`;
  if (email) html += `<button class="btn-edit btn-icon-action" title="Email" onclick="(function(){var o=window.__msgBtnCache[${idx}];showComposeModal({type:o.type,record:o.record,phone:o.phone,email:o.email,startTab:'email'});})()" style="background:rgba(99,102,241,0.10);border-color:rgba(99,102,241,0.20);min-width:26px;">${emailIcon}</button>`;
  return html;
}
