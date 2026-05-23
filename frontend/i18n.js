const TRANSLATIONS = {
  en: {
    dashboard:        'Dashboard',
    tasks:            'Tasks',
    purchase_orders:  'Purchase Orders',
    milestones:       'Milestones',
    expenses:         'Expenses',
    team_chat:        'Team Chat',
    settings:         'Settings',
    sign_out:         'Sign out',

    add_task:         'Add Task',
    add_po:           'Add PO',
    add_milestone:    'Add Milestone',
    add_expense:      'Add Expense',
    edit:             'Edit',
    delete:           'Delete',
    save:             'Save',
    cancel:           'Cancel',
    search:           'Search...',
    refresh:          'Refresh',
    view_all:         'View all →',

    open_tasks:       'Open Tasks',
    overdue:          'Overdue',
    po_spend:         'PO Spend',
    avg_progress:     'Avg Progress',
    total_expenses:   'Total Expenses',
    task_status:      'Task Status',
    po_status:        'PO Status',
    recent_tasks:     'Recent Tasks',
    recent_expenses:  'Recent Expenses',

    message_placeholder:    'Message your team...',
    send_failed:            'Failed. Tap to retry.',
    confirm_delete_message: 'Delete this message?',
    live:                   'Live',

    title:    'Title',
    status:   'Status',
    priority: 'Priority',
    assignee: 'Assignee',
    due_date: 'Due Date',
    project:  'Project',
    supplier: 'Supplier',
    amount:   'Amount',
    date:     'Date',
    actions:  'Actions',

    open:           'Open',
    in_progress:    'In Progress',
    done:           'Done',
    overdue_status: 'Overdue',
    draft:          'Draft',
    submitted:      'Submitted',
    received:       'Received',
    cancelled:      'Cancelled',
    not_started:    'Not Started',
    completed:      'Completed',
    blocked:        'Blocked',
    low:            'Low',
    medium:         'Medium',
    high:           'High',

    team_members:          'Team Members',
    preferences:           'Preferences',
    language:              'Language',
    currency:              'Currency',
    date_format:           'Date format',
    save_preferences:      'Save preferences',
    add_member:            'Add',
    remove:                'Remove',
    you:                   'You',
    about:                 'About',
    notifications_enabled: 'Notifications are enabled for this device.',

    welcome_back:     'Welcome back',
    sign_in_subtitle: 'Sign in to continue to your workspace',
    secured_by:       'Secured with Google OAuth 2.0',
    continue_as:      'Continue as',

    good_morning:   'Good morning',
    good_afternoon: 'Good afternoon',
    good_evening:   'Good evening',

    active:          'Active',
    attention:       'Attention',
    committed:       'Committed',
    all_time:        'All time',
    recent_activity: 'Recent Activity',
    tasks_tab:       'Tasks',
    expenses_tab:    'Expenses',
    activity_tab:    'Activity',
    records:         'records',
    loading:         'Loading...',
    category:        'Category',
    description:     'Description',
    who:             'Who',
    what:            'What',
    when:            'When',

    settings_sub:          'Manage your workspace, team, and preferences',
    workspace_access_sub:  'Control workspace access',
    data_management:       'Data Management',
    data_management_sub:   'Export and clear local data',
    tasks_csv:             'Tasks CSV',
    pos_csv:               'POs CSV',
    expenses_csv:          'Expenses CSV',
    milestones_csv:        'Milestones CSV',
    clear_cache:           'Clear local cache',
    prefs_sub:             'Stored locally on your device',
    currency_sub:          'Default for expenses and POs',
    date_format_sub:       'How dates are displayed',
    dashboard_refresh:     'Dashboard refresh',
    refresh_sub:           'Auto-refresh interval',
    default_assignee:      'Default assignee',
    prefilled_sub:         'Pre-filled in new tasks',
    default_project:       'Default project',
    sheet_url:             'Google Sheet URL',
    sheet_url_sub:         'Your spreadsheet link (for reference)',
    monthly_budget:        'Monthly Budget',
    budget_sub:            'Total budget limit for expenses',
    automation:            'Automation',
    automation_sub:        'Smart triggers in the backend',
    auto_milestones:       'Auto-create milestones',
    auto_milestones_sub:   'When a task with a new project is saved',
    auto_expenses:         'Auto-create expenses',
    auto_expenses_sub:     'When a PO is marked as received',
    redeploy_note:         'Redeploy Code.gs for automation changes to take effect.',
    notifications:         'Notifications',
    notifications_sub:     'Push alerts enabled',
    active_device:         'Active on this device',
    about_backend:         'Backend',
    about_database:        'Database',
    about_auth:            'Auth',
    your_name_ph:          'Your name',
    project_name_ph:       'Project name',
  },

  ar: {
    dashboard:        'لوحة التحكم',
    tasks:            'المهام',
    purchase_orders:  'طلبات الشراء',
    milestones:       'المراحل',
    expenses:         'المصروفات',
    team_chat:        'دردشة الفريق',
    settings:         'الإعدادات',
    sign_out:         'تسجيل الخروج',

    add_task:         'إضافة مهمة',
    add_po:           'إضافة طلب شراء',
    add_milestone:    'إضافة مرحلة',
    add_expense:      'إضافة مصروف',
    edit:             'تعديل',
    delete:           'حذف',
    save:             'حفظ',
    cancel:           'إلغاء',
    search:           'بحث...',
    refresh:          'تحديث',
    view_all:         'عرض الكل ←',

    open_tasks:       'المهام المفتوحة',
    overdue:          'متأخرة',
    po_spend:         'إجمالي الطلبات',
    avg_progress:     'متوسط التقدم',
    total_expenses:   'إجمالي المصروفات',
    task_status:      'حالة المهام',
    po_status:        'حالة الطلبات',
    recent_tasks:     'أحدث المهام',
    recent_expenses:  'أحدث المصروفات',

    message_placeholder:    'أرسل رسالة للفريق...',
    send_failed:            'فشل الإرسال. انقر للمحاولة.',
    confirm_delete_message: 'حذف هذه الرسالة؟',
    live:                   'مباشر',

    title:    'العنوان',
    status:   'الحالة',
    priority: 'الأولوية',
    assignee: 'المسؤول',
    due_date: 'تاريخ الاستحقاق',
    project:  'المشروع',
    supplier: 'المورد',
    amount:   'المبلغ',
    date:     'التاريخ',
    actions:  'الإجراءات',

    open:           'مفتوح',
    in_progress:    'قيد التنفيذ',
    done:           'مكتمل',
    overdue_status: 'متأخر',
    draft:          'مسودة',
    submitted:      'مُقدَّم',
    received:       'مُستلَم',
    cancelled:      'ملغي',
    not_started:    'لم يبدأ',
    completed:      'مكتمل',
    blocked:        'محظور',
    low:            'منخفض',
    medium:         'متوسط',
    high:           'عالٍ',

    team_members:          'أعضاء الفريق',
    preferences:           'التفضيلات',
    language:              'اللغة',
    currency:              'العملة',
    date_format:           'تنسيق التاريخ',
    save_preferences:      'حفظ التفضيلات',
    add_member:            'إضافة',
    remove:                'إزالة',
    you:                   'أنت',
    about:                 'حول التطبيق',
    notifications_enabled: 'الإشعارات مفعّلة على هذا الجهاز.',

    welcome_back:     'مرحباً بعودتك',
    sign_in_subtitle: 'سجّل دخولك للمتابعة إلى مساحة عملك',
    secured_by:       'محمي بـ Google OAuth 2.0',
    continue_as:      'متابعة كـ',

    good_morning:   'صباح الخير',
    good_afternoon: 'مساء الخير',
    good_evening:   'مساء النور',

    active:          'نشط',
    attention:       'تنبيه',
    committed:       'ملتزم',
    all_time:        'الإجمالي',
    recent_activity: 'النشاط الأخير',
    tasks_tab:       'المهام',
    expenses_tab:    'المصروفات',
    activity_tab:    'النشاط',
    records:         'سجل',
    loading:         'جار التحميل...',
    category:        'التصنيف',
    description:     'الوصف',
    who:             'من',
    what:            'ماذا',
    when:            'متى',

    settings_sub:          'إدارة مساحة العمل والفريق والتفضيلات',
    workspace_access_sub:  'التحكم في صلاحيات الوصول',
    data_management:       'إدارة البيانات',
    data_management_sub:   'تصدير وحذف البيانات المحلية',
    tasks_csv:             'CSV المهام',
    pos_csv:               'CSV الطلبات',
    expenses_csv:          'CSV المصروفات',
    milestones_csv:        'CSV المراحل',
    clear_cache:           'مسح الذاكرة المؤقتة',
    prefs_sub:             'محفوظة محلياً على جهازك',
    currency_sub:          'الافتراضي للمصروفات والطلبات',
    date_format_sub:       'طريقة عرض التواريخ',
    dashboard_refresh:     'تحديث لوحة التحكم',
    refresh_sub:           'فترة التحديث التلقائي',
    default_assignee:      'المسؤول الافتراضي',
    prefilled_sub:         'يُملأ مسبقاً في المهام الجديدة',
    default_project:       'المشروع الافتراضي',
    sheet_url:             'رابط جدول Google',
    sheet_url_sub:         'رابط الجدول الخاص بك (للمرجعية)',
    monthly_budget:        'الميزانية الشهرية',
    budget_sub:            'الحد الأقصى لميزانية المصروفات',
    automation:            'الأتمتة',
    automation_sub:        'مشغلات ذكية في الخلفية',
    auto_milestones:       'إنشاء مراحل تلقائياً',
    auto_milestones_sub:   'عند حفظ مهمة بمشروع جديد',
    auto_expenses:         'إنشاء مصروفات تلقائياً',
    auto_expenses_sub:     'عند تحديد طلب الشراء كمُستلَم',
    redeploy_note:         'أعد نشر Code.gs لتطبيق تغييرات الأتمتة.',
    notifications:         'الإشعارات',
    notifications_sub:     'الإشعارات الفورية مفعّلة',
    active_device:         'نشط على هذا الجهاز',
    about_backend:         'الخلفية',
    about_database:        'قاعدة البيانات',
    about_auth:            'المصادقة',
    your_name_ph:          'اسمك',
    project_name_ph:       'اسم المشروع',
  }
};

let currentLang = localStorage.getItem('tt_lang') || 'en';

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
    || TRANSLATIONS['en'][key]
    || key;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('tt_lang', lang);
  applyLanguage();
}

function applyLanguage() {
  const isRTL = currentLang === 'ar';

  // 1. Set HTML attributes
  document.documentElement.lang = currentLang;
  document.documentElement.dir  = isRTL ? 'rtl' : 'ltr';
  document.body.classList.toggle('rtl', isRTL);

  // 2. Translate ALL data-i18n elements — preserve child SVGs/badges
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (!val) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else if (el.tagName === 'OPTION') {
      // keep option values as-is
    } else {
      const childNodes = Array.from(el.childNodes);
      const textNodes  = childNodes.filter(n => n.nodeType === Node.TEXT_NODE);
      if (textNodes.length > 0) {
        textNodes.forEach(n => { if (n.textContent.trim()) n.textContent = ' ' + val; });
      } else if (el.children.length === 0) {
        el.textContent = val;
      }
    }
  });

  // 3. Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  // 4. Update topbar title
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) {
    const view = activeNav.dataset.view;
    const titleEl = document.getElementById('topbar-title');
    const titleMap = {
      dashboard: 'dashboard', tasks: 'tasks', pos: 'purchase_orders',
      milestones: 'milestones', expenses: 'expenses',
      chat: 'team_chat', settings: 'settings'
    };
    if (titleEl && titleMap[view]) titleEl.textContent = t(titleMap[view]);
  }

  // 5. Update Add buttons
  const btnMap = { Tasks: 'add_task', POs: 'add_po', Milestones: 'add_milestone', Expenses: 'add_expense' };
  document.querySelectorAll('.btn-add[data-sheet]').forEach(btn => {
    const key = btnMap[btn.dataset.sheet];
    if (key) btn.textContent = t(key);
  });

  // 6. Update modal buttons
  const saveBtn   = document.getElementById('modal-save');
  const cancelBtn = document.getElementById('modal-cancel');
  if (saveBtn)   saveBtn.textContent   = t('save');
  if (cancelBtn) cancelBtn.textContent = t('cancel');

  // 7. Update sign out button (preserve SVG)
  const signoutBtn = document.getElementById('signout-btn');
  if (signoutBtn) {
    const svgEl = signoutBtn.querySelector('svg');
    signoutBtn.textContent = t('sign_out');
    if (svgEl) signoutBtn.prepend(svgEl);
  }

  // 8. Chat input placeholder
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.placeholder = t('message_placeholder');

  // 9. Language selector
  const langSelect = document.getElementById('pref-language');
  if (langSelect) langSelect.value = currentLang;

  // 10. Greeting
  if (typeof setGreeting === 'function') setGreeting();
}

function initLanguage() {
  currentLang = localStorage.getItem('tt_lang') || 'en';
  applyLanguage();
}
