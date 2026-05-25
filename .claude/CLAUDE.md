# Task Tracker — Claude Code Project Instructions

## Project Overview
Vanilla JS task tracker app. Google Sheets backend via Apps Script.
Files: E:\task-tracker\frontend\ (index.html, style.css, config.js, api.js, cache.js, i18n.js, tables.js, dashboard.js, kanban.js, chat.js)

## ALWAYS follow these design skills when making UI changes:
Use /impeccable and /taste principles on every UI modification.

## Tech Stack
- Vanilla JS (no framework)
- CSS custom properties for theming
- Google Identity Services for auth
- Chart.js for charts
- Inter font (Google Fonts)
- Liquid glass aesthetic

## Critical Rules
1. NEVER hardcode colors — always use CSS variables (--text-1, --accent, etc.)
2. NEVER use localStorage for tokens — profile only
3. Script load order: i18n.js → config.js → cache.js → api.js → tables.js → dashboard.js → kanban.js → chat.js → inline
4. ALL user-facing text must use t('key') from i18n.js
5. Content-Type must be 'text/plain' for Apps Script fetch calls
6. Always test both dark AND light mode after CSS changes
7. Always test both LTR (English) AND RTL (Arabic) after layout changes

## File Ownership
- config.js: DO NOT MODIFY content
- api.js: Only modify callAPI() error handling
- i18n.js: Add translations here for new text
- cache.js: Manage caching here
