/* Harness de contratos e HTML gerado, não um navegador. Sem acesso à rede.
   Mantém os formulários, as regras e o cliente da aplicação reais; substitui
   apenas o DOM visual e o servidor por objetos de teste explícitos. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const decode = (value = '') => String(value).replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#096;/g, '`').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attributes = (html) => Object.fromEntries([...html.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, decode(value ?? '')]));
const dataName = (key) => key.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());

class Element {
  constructor(attrs = {}) {
    this.listeners = new Map(); this.dataset = {}; this.style = { removeProperty() {} };
    this.classList = { add() {}, remove() {}, toggle() {} }; this.innerHTML = ''; this.textContent = '';
    this.hidden = false; this.disabled = 'disabled' in attrs; this.checked = 'checked' in attrs;
    this.required = 'required' in attrs; this.type = attrs.type || 'text'; this.name = attrs.name || '';
    this.value = attrs.value ?? ''; this.isConnected = true; this.attrs = attrs;
    for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[dataName(key)] = value;
  }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
  async emit(type, event = {}) { for (const fn of this.listeners.get(type) || []) await fn({ target: this, preventDefault() {}, ...event }); }
  closest(selector) { if (selector === 'label') return this.label ||= new Element(); return this.field || null; }
  insertAdjacentHTML(_position, html) { this.innerHTML += html; }
  setAttribute(key, value) { this.attrs[key] = value; }
  focus() {}
  remove() { this.isConnected = false; }
  getClientRects() { return this.hidden ? [] : [{}]; }
}

class Modal extends Element {
  constructor(options) {
    super(); this.options = options; this.parentElement = new Element(); this.nodes = new Map(); this.fields = new Map();
    this.controls = []; this.pdfSections = []; this.pdfFields = new Map(); this.innerHTML = `${options.body || ''}${options.footer || ''}`;
    const register = (attrs, value) => {
      const node = new Element(attrs);
      if (value != null) node.value = decode(value);
      this.controls.push(node); if (attrs.name) this.fields.set(attrs.name, node);
      for (const [key, val] of Object.entries(attrs)) if (key.startsWith('data-')) {
        this.nodes.set(`[${key}]`, node); this.nodes.set(`[${key}="${val}"]`, node);
      }
      return node;
    };
    for (const [, attr] of this.innerHTML.matchAll(/<input\b([^>]*)>/g)) register(attributes(attr));
    for (const [, attr, body] of this.innerHTML.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) register(attributes(attr), body);
    for (const [, attr, body] of this.innerHTML.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
      const choices = [...body.matchAll(/<option\b([^>]*)>/g)].map((m) => attributes(m[1]));
      register(attributes(attr), (choices.find((r) => 'selected' in r) || choices[0])?.value || '');
    }
    for (const [, tag, attr] of this.innerHTML.matchAll(/<(button|span|div|p)\b([^>]*\bdata-[^>]*)>/g)) {
      const attrs = attributes(attr); register(attrs);
    }
    for (const [, key, selected] of this.innerHTML.matchAll(/data-pdf-field="([^"]+)" data-selected="([^"]+)"/g)) {
      const field = new Element({ 'data-selected': selected }); this.pdfFields.set(key, field);
      const input = this.controls.find((n) => n.dataset.pdfCheck === key); if (input) input.field = field;
    }
    for (const [, body] of this.innerHTML.matchAll(/<section[^>]*data-pdf-section[^>]*>([\s\S]*?)<\/section>/g)) {
      const section = new Element(); const ids = [...body.matchAll(/data-pdf-field="([^"]+)"/g)].map((m) => m[1]);
      section.querySelector = () => ids.map((key) => this.pdfFields.get(key)).find((field) => field.dataset.selected === 'true') || null;
      this.pdfSections.push(section);
    }
    this.editor = new Element(); this.editor.elements = { namedItem: (name) => this.fields.get(name) };
    this.editor.reportValidity = () => [...this.fields.values()].every((n) => n.disabled || !n.required || String(n.value ?? '').length > 0);
    this.editor.requestSubmit = () => this.editor.emit('submit');
  }
  querySelector(selector) {
    if (selector === 'form') return this.editor;
    const field = selector.match(/^\[name="([^"]+)"\]$/)?.[1];
    if (field) return this.fields.get(field);
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector);
  }
  querySelectorAll(selector) {
    if (selector === '[data-pdf-check]') return this.controls.filter((r) => r.dataset.pdfCheck);
    if (selector === '[data-pdf-section]') return this.pdfSections;
    return [];
  }
  async submit(changes = {}) {
    for (const [name, value] of Object.entries(changes)) {
      const field = this.fields.get(name); if (!field) throw new Error(`Campo não está no formulário: ${name}`);
      if (field.disabled) throw new Error(`Campo está bloqueado: ${name}`);
      if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = value ?? '';
      await field.emit('change');
    }
    await this.editor.emit('input');
    await this.editor.emit('submit');
    return { error: this.querySelector('[data-form-error]').hidden ? '' : this.querySelector('[data-form-error]').innerHTML, disabled: this.querySelector('[data-save]').disabled };
  }
}

export function makeHarness({ role = 'admin', query = '' } = {}) {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-09-01T12:00:00.000Z'])); }
    static now() { return Date.parse('2026-09-01T12:00:00.000Z'); }
  }
  const h = { app: null, forms: [], drawers: [], notices: [], bindings: null, boot: [], network: [], printed: 0, locationChanges: [] };
  const document = new Element(); document.body = new Element(); document.title = 'Teste'; document.hidden = false;
  document.querySelector = (selector) => selector === '[data-t4-drawer]' ? h.drawer : selector === '[data-t4-modal-backdrop]' ? h.modal?.parentElement : null;
  document.querySelectorAll = () => [];
  const window = { document, location: { href: `https://local.invalid/index.html${query}`, search: query, replace(url) { h.locationChanges.push(url); }, reload() {} } };
  window.window = window; window.addEventListener = document.addEventListener.bind(document); window.confirm = () => true; window.print = () => { h.printed++; };
  const ctx = vm.createContext({ window, document, location: window.location, URL, URLSearchParams, Intl, Date: FixedDate, console, crypto: webcrypto,
    getComputedStyle: () => ({getPropertyValue:()=>''}), CSS: { escape: (v) => String(v) }, setTimeout, clearTimeout, requestAnimationFrame: (fn) => fn(),
    fetch: async (...args) => { h.network.push(args); throw new Error('Rede proibida nos testes'); }
  });
  h.ctx = ctx; h.window = window;
  h.run = (path) => vm.runInContext(readFileSync(resolve(root, path), 'utf8'), ctx, { filename: path });
  h.run('tests/fixtures-supabase.js'); h.fixture = window.T4Fixture.fixture; h.id = window.T4Fixture.id;
  if (role === null) h.fixture.db.usuarios = []; else h.fixture.db.usuarios[0].role = role;
  h.run('assets/t4-v2-core.js'); h.originalCore = window.T4V2;
  window.T4V2 = { ...window.T4V2,
    mount(config) {
      const listeners = [], app = { config, view: new URLSearchParams(query).get('view') || config.defaultView, pageRoot: new Element(), counts: {}, sync: [],
        route(view) { this.view = view; listeners.forEach((fn) => fn(view)); }, onRoute(fn) { listeners.push(fn); },
        setSync(...value) { this.sync.push(value); }, setUser(user) { this.user = user; }, setCounts(counts) { this.counts = counts; },
        setSearchHandler(fn) { this.search = fn; }, resetSearch() { this.search?.(''); }, setPrimaryAction(label, fn) { this.primary = fn; this.primaryLabel = label; }, setTitle() {}
      }; h.app = app; return app;
    },
    openModal(options) { const modal = new Modal(options); h.forms.push(modal); h.modal = modal; return modal; },
    closeModal() { if (h.modal?.parentElement.dataset.saving === 'true') return; h.modal?.options.onClose?.(); if (h.modal) h.modal.isConnected = false; h.modal = null; },
    openDrawer(options) { if (h.drawer) h.drawer.isConnected = false; const drawer = new Modal(options); drawer.isConnected = true; h.drawers.push(drawer); h.drawer = drawer; return drawer; },
    closeDrawer() { if (h.drawer) h.drawer.isConnected = false; h.drawer = null; },
    toast(...args) { h.notices.push(args); }, confirm: async () => true
  };
  h.run('assets/t4-v2-models.js'); h.run('assets/t4-v2-data.js'); h.run('assets/t4-v2-ui.js');
  window.T4Work = { ...window.T4Work,
    bind(_app, handlers) { h.bindings = handlers; },
    start(app, load) { h.boot.push(window.T4Data.init(app, { redirect: false }).then(load)); }
  };
  h.run('assets/t4-v2-records.js'); h.run('assets/t4-v2-pdf.js');
  h.D = window.T4Data; h.M = window.T4Models; h.W = window.T4Work; h.R = window.T4Records; h.U = window.T4V2;
  h.init = () => h.D.init({ setSync() {}, setUser() {} }, { redirect: false });
  h.load = async (module) => {
    if (module === 'talents') {
      h.run('tests/fixtures-talents-mapping.js');
      h.run('assets/talents-mapping-models.js'); h.run('assets/talents-mapping-ui.js'); h.T = window.T4TalentMapping;
    }
    h.run(`assets/${module}-v2.js`); await Promise.all(h.boot); return h;
  };
  h.action = (name, id = '') => h.bindings.action(name, id, new Element());
  h.filter = (key, value) => h.bindings.change(key, value);
  h.fields = () => [...h.forms.at(-1).fields.keys()];
  h.submit = (values) => h.forms.at(-1).submit(values);
  h.html = () => h.app.pageRoot.innerHTML;
  h.stateForRecords = async () => ({ talents: await h.D.loadCandidates({ activeOnly: false }), employers: await h.D.loadEmployers({ activeOnly: false }), openings: await h.D.loadOpenings(), selections: await h.D.loadMatches(), enrollments: await h.D.all(h.D.TABLES.enrollments), classes: await h.D.all(h.D.TABLES.classes) });
  return h;
}

export const plain = (value) => JSON.parse(JSON.stringify(value));
