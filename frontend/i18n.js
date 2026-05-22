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

  document.documentElement.dir  = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;
  document.body.classList.toggle('rtl', isRTL);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else if (el.tagName === 'OPTION') {
      // keep option values as-is
    } else {
      el.textContent = val;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.placeholder = t('message_placeholder');

  // Re-render active view to apply translations (only if app is visible)
  const activeNav = document.querySelector('.nav-item.active');
  const appVisible = document.getElementById('app') && !document.getElementById('app').classList.contains('hidden');
  if (activeNav && appVisible) navigateTo(activeNav.dataset.view);
}

function initLanguage() {
  currentLang = localStorage.getItem('tt_lang') || 'en';
  applyLanguage();
}
