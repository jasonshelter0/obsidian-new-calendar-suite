'use strict';

var obsidian = require('obsidian');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var obsidian__default = /*#__PURE__*/_interopDefaultLegacy(obsidian);

// View types
const VIEW_TYPE_CALENDAR = "gc-calendar";
const VIEW_TYPE_NC_CALENDAR = "nc-calendar";
// Event triggers
const TRIGGER_ON_OPEN = "calendar:open";
const SETTINGS_UPDATED = "periodic-notes:settings-updated";
// General defaults
const DEFAULT_WEEK_FORMAT = "gggg-[W]ww";
const DEFAULT_WORDS_PER_DOT = 250;
// GC defaults
const DEFAULT_DAILY_FORMAT = "YYYY-MM-DD";
const DEFAULT_WEEKLY_FORMAT = "gggg-[W]ww";
const DEFAULT_MONTHLY_FORMAT = "YYYY-MM";
const DEFAULT_QUARTERLY_FORMAT = "YYYY-[Q]Q";
const DEFAULT_YEARLY_FORMAT = "YYYY";
// NC defaults
const DEFAULT_NC_PHASE_FORMAT = "NC-YY-MM-[P]P";
const DEFAULT_NC_MONTH_FORMAT = "NC-YY-MM";
const DEFAULT_NC_SEASON_FORMAT = "NC-YY-[S]S";
const DEFAULT_NC_YEAR_FORMAT = "NC-YY";

const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";
const DEFAULT_WEEKLY_NOTE_FORMAT = "gggg-[W]ww";
const DEFAULT_MONTHLY_NOTE_FORMAT = "YYYY-MM";

function shouldUsePeriodicNotesSettings(periodicity) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodicNotes = window.app.plugins.getPlugin("periodic-notes");
    return periodicNotes && periodicNotes.settings?.[periodicity]?.enabled;
}
/**
 * Read the user settings for the `daily-notes` plugin
 * to keep behavior of creating a new note in-sync.
 */
function getDailyNoteSettings$1() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { internalPlugins, plugins } = window.app;
        if (shouldUsePeriodicNotesSettings("daily")) {
            const { format, folder, template } = plugins.getPlugin("periodic-notes")?.settings?.daily || {};
            return {
                format: format || DEFAULT_DAILY_NOTE_FORMAT,
                folder: folder?.trim() || "",
                template: template?.trim() || "",
            };
        }
        const { folder, format, template } = internalPlugins.getPluginById("daily-notes")?.instance?.options || {};
        return {
            format: format || DEFAULT_DAILY_NOTE_FORMAT,
            folder: folder?.trim() || "",
            template: template?.trim() || "",
        };
    }
    catch (err) {
        console.info("No custom daily note settings found!", err);
    }
}
/**
 * Read the user settings for the `weekly-notes` plugin
 * to keep behavior of creating a new note in-sync.
 */
function getWeeklyNoteSettings$1() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pluginManager = window.app.plugins;
        const calendarSettings = pluginManager.getPlugin("calendar")?.options;
        const periodicNotesSettings = pluginManager.getPlugin("periodic-notes")
            ?.settings?.weekly;
        if (shouldUsePeriodicNotesSettings("weekly")) {
            return {
                format: periodicNotesSettings.format || DEFAULT_WEEKLY_NOTE_FORMAT,
                folder: periodicNotesSettings.folder?.trim() || "",
                template: periodicNotesSettings.template?.trim() || "",
            };
        }
        const settings = calendarSettings || {};
        return {
            format: settings.weeklyNoteFormat || DEFAULT_WEEKLY_NOTE_FORMAT,
            folder: settings.weeklyNoteFolder?.trim() || "",
            template: settings.weeklyNoteTemplate?.trim() || "",
        };
    }
    catch (err) {
        console.info("No custom weekly note settings found!", err);
    }
}
/**
 * Read the user settings for the `periodic-notes` plugin
 * to keep behavior of creating a new note in-sync.
 */
function getMonthlyNoteSettings$1() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginManager = window.app.plugins;
    try {
        const settings = (shouldUsePeriodicNotesSettings("monthly") &&
            pluginManager.getPlugin("periodic-notes")?.settings?.monthly) ||
            {};
        return {
            format: settings.format || DEFAULT_MONTHLY_NOTE_FORMAT,
            folder: settings.folder?.trim() || "",
            template: settings.template?.trim() || "",
        };
    }
    catch (err) {
        console.info("No custom monthly note settings found!", err);
    }
}

/**
 * dateUID is a way of weekly identifying daily/weekly/monthly notes.
 * They are prefixed with the granularity to avoid ambiguity.
 */
function getDateUID$1(date, granularity = "day") {
    const ts = date.clone().startOf(granularity).format();
    return `${granularity}-${ts}`;
}
function removeEscapedCharacters$1(format) {
    return format.replace(/\[[^\]]*\]/g, ""); // remove everything within brackets
}
/**
 * XXX: When parsing dates that contain both week numbers and months,
 * Moment choses to ignore the week numbers. For the week dateUID, we
 * want the opposite behavior. Strip the MMM from the format to patch.
 */
function isFormatAmbiguous$1(format, granularity) {
    if (granularity === "week") {
        const cleanFormat = removeEscapedCharacters$1(format);
        return (/w{1,2}/i.test(cleanFormat) &&
            (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat)));
    }
    return false;
}
function getDateFromFile$1(file, granularity) {
    const getSettings = {
        day: getDailyNoteSettings$1,
        week: getWeeklyNoteSettings$1,
        month: getMonthlyNoteSettings$1,
    };
    const format = getSettings[granularity]().format.split("/").pop();
    const noteDate = window.moment(file.basename, format, true);
    if (!noteDate.isValid()) {
        return null;
    }
    if (isFormatAmbiguous$1(format, granularity)) {
        if (granularity === "week") {
            const cleanFormat = removeEscapedCharacters$1(format);
            if (/w{1,2}/i.test(cleanFormat)) {
                return window.moment(file.basename, 
                // If format contains week, remove day & month formatting
                format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""), false);
            }
        }
    }
    return noteDate;
}

class DailyNotesFolderMissingError extends Error {
}
function getDailyNote$2(date, dailyNotes) {
    return dailyNotes[getDateUID$1(date, "day")] ?? null;
}
function getAllDailyNotes() {
    /**
     * Find all daily notes in the daily note folder
     */
    const { vault } = window.app;
    const { folder } = getDailyNoteSettings$1();
    const dailyNotesFolder = vault.getAbstractFileByPath(obsidian__default['default'].normalizePath(folder));
    if (!dailyNotesFolder) {
        throw new DailyNotesFolderMissingError("Failed to find daily notes folder");
    }
    const dailyNotes = {};
    obsidian__default['default'].Vault.recurseChildren(dailyNotesFolder, (note) => {
        if (note instanceof obsidian__default['default'].TFile) {
            const date = getDateFromFile$1(note, "day");
            if (date) {
                const dateString = getDateUID$1(date, "day");
                dailyNotes[dateString] = note;
            }
        }
    });
    return dailyNotes;
}

class WeeklyNotesFolderMissingError extends Error {
}
function getWeeklyNote$2(date, weeklyNotes) {
    return weeklyNotes[getDateUID$1(date, "week")] ?? null;
}
function getAllWeeklyNotes() {
    const { vault } = window.app;
    const { folder } = getWeeklyNoteSettings$1();
    const weeklyNotesFolder = vault.getAbstractFileByPath(obsidian__default['default'].normalizePath(folder));
    if (!weeklyNotesFolder) {
        throw new WeeklyNotesFolderMissingError("Failed to find weekly notes folder");
    }
    const weeklyNotes = {};
    obsidian__default['default'].Vault.recurseChildren(weeklyNotesFolder, (note) => {
        if (note instanceof obsidian__default['default'].TFile) {
            const date = getDateFromFile$1(note, "week");
            if (date) {
                const dateString = getDateUID$1(date, "week");
                weeklyNotes[dateString] = note;
            }
        }
    });
    return weeklyNotes;
}
var getAllDailyNotes_1 = getAllDailyNotes;
var getAllWeeklyNotes_1 = getAllWeeklyNotes;
var getDailyNote_1 = getDailyNote$2;
var getWeeklyNote_1 = getWeeklyNote$2;

function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function not_equal(a, b) {
    return a != a ? b == b : a !== b;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function get_store_value(store) {
    let value;
    subscribe(store, _ => value = _)();
    return value;
}
function component_subscribe(component, store, callback) {
    component.$$.on_destroy.push(subscribe(store, callback));
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function set_style(node, key, value, important) {
    node.style.setProperty(key, value, important ? 'important' : '');
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function afterUpdate(fn) {
    get_current_component().$$.after_update.push(fn);
}
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function tick() {
    schedule_update();
    return resolved_promise;
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
function add_flush_callback(fn) {
    flush_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}

const globals = (typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
        ? globalThis
        : global);

function bind(component, name, callback) {
    const index = component.$$.props[name];
    if (index !== undefined) {
        component.$$.bound[index] = callback;
        callback(component.$$.ctx[index]);
    }
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

const subscriber_queue = [];
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = [];
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (let i = 0; i < subscribers.length; i += 1) {
                    const s = subscribers[i];
                    s[1]();
                    subscriber_queue.push(s, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.push(subscriber);
        if (subscribers.length === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            const index = subscribers.indexOf(subscriber);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
            if (subscribers.length === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}

const weekdays$1 = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];
function periodicDefaults(overrides) {
    return Object.assign({ enabled: false, format: "", template: "", folder: "" }, overrides);
}
const defaultSettings = {
    shouldConfirmBeforeCreate: true,
    weekStart: "locale",
    wordsPerDot: DEFAULT_WORDS_PER_DOT,
    wordCountOffset: 0,
    showWeeklyNote: false,
    weeklyNoteFormat: "",
    weeklyNoteTemplate: "",
    weeklyNoteFolder: "",
    localeOverride: "system-default",
    holidayRegion: "None",
    daily: periodicDefaults({ enabled: true }),
    weekly: periodicDefaults(),
    monthly: periodicDefaults(),
    quarterly: periodicDefaults(),
    yearly: periodicDefaults(),
    ncPhase: periodicDefaults(),
    ncMonth: periodicDefaults({ enabled: true }),
    ncSeason: periodicDefaults(),
    ncYear: periodicDefaults(),
    hasMigratedLegacySettings: false,
};
// ── Autocomplete helpers for settings inputs ──────────────────────
class FileSuggest extends obsidian.AbstractInputSuggest {
    constructor(app, inputEl) {
        super(app, inputEl);
        this.inputEl = inputEl;
    }
    getSuggestions(query) {
        const lower = query.toLowerCase();
        return this.app.vault
            .getFiles()
            .filter((f) => f.extension === "md" && f.path.toLowerCase().includes(lower));
    }
    renderSuggestion(file, el) {
        el.setText(file.path);
    }
    selectSuggestion(file) {
        this.inputEl.value = file.path;
        this.inputEl.dispatchEvent(new Event("input"));
        this.close();
    }
}
class FolderSuggest extends obsidian.AbstractInputSuggest {
    constructor(app, inputEl) {
        super(app, inputEl);
        this.inputEl = inputEl;
    }
    getSuggestions(query) {
        const lower = query.toLowerCase();
        const folders = [];
        // Walk all files/dirs to get folders
        const root = this.app.vault.getRoot();
        this.app.vault.recurseChildren(root, (child) => {
            if (child instanceof obsidian.TFolder && child.path.toLowerCase().includes(lower)) {
                folders.push(child);
            }
        });
        return folders;
    }
    renderSuggestion(folder, el) {
        el.setText(folder.path);
    }
    selectSuggestion(folder) {
        this.inputEl.value = folder.path;
        this.inputEl.dispatchEvent(new Event("input"));
        this.close();
    }
}
class CalendarSettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        this.containerEl.empty();
        this.containerEl.createEl("h3", { text: "General Settings" });
        this.addDotThresholdSetting();
        this.addWordCountOffsetSetting();
        this.addWeekStartSetting();
        this.addConfirmCreateSetting();
        this.addShowWeeklyNoteSetting();
        this.containerEl.createEl("h3", { text: "General Notes" });
        this.addPeriodicSection("daily", "Daily", "YYYY-MM-DD");
        this.addPeriodicSection("weekly", "Weekly", "gggg-[W]ww");
        this.containerEl.createEl("h3", { text: "Gregorian Calendar Notes" });
        this.addPeriodicSection("monthly", "Monthly", "YYYY-MM");
        this.addPeriodicSection("quarterly", "Quarterly", "YYYY-[Q]Q");
        this.addPeriodicSection("yearly", "Yearly", "YYYY");
        this.containerEl.createEl("h3", { text: "New Calendar Notes" });
        this.addPeriodicSection("ncPhase", "NC Phase", "NC-YY-MM-[P]P");
        this.addPeriodicSection("ncMonth", "NC Month", "NC-YY-MM");
        this.addPeriodicSection("ncSeason", "NC Season", "NC-YY-[S]S");
        this.addPeriodicSection("ncYear", "NC Year", "NC-YY");
        this.containerEl.createEl("h3", { text: "Advanced Settings" });
        this.addLocaleOverrideSetting();
        this.containerEl.createEl("h3", { text: "Holiday System" });
        this.addHolidayRegionSetting();
    }
    addPeriodicSection(key, label, defaultFormat) {
        const opts = this.plugin.options[key];
        new obsidian.Setting(this.containerEl)
            .setName(`${label} Notes`)
            .setDesc(`Enable ${label.toLowerCase()} note creation`)
            .addToggle((toggle) => {
            var _a;
            toggle.setValue((_a = opts === null || opts === void 0 ? void 0 : opts.enabled) !== null && _a !== void 0 ? _a : false);
            toggle.onChange(async (value) => {
                await this.plugin.writeOptions((s) => ({
                    [key]: Object.assign(Object.assign({}, s[key]), { enabled: value }),
                }));
                this.display();
            });
        });
        if (!(opts === null || opts === void 0 ? void 0 : opts.enabled))
            return;
        new obsidian.Setting(this.containerEl)
            .setName(`${label} format`)
            .addText((textfield) => {
            textfield.setPlaceholder(defaultFormat);
            textfield.setValue((opts === null || opts === void 0 ? void 0 : opts.format) || "");
            textfield.onChange(async (value) => {
                await this.plugin.writeOptions((s) => ({
                    [key]: Object.assign(Object.assign({}, s[key]), { format: value }),
                }));
            });
        });
        new obsidian.Setting(this.containerEl)
            .setName(`${label} template`)
            .addText((textfield) => {
            textfield.setPlaceholder("Example: Templates/Note.md");
            textfield.setValue((opts === null || opts === void 0 ? void 0 : opts.template) || "");
            new FileSuggest(this.app, textfield.inputEl);
            textfield.onChange(async (value) => {
                await this.plugin.writeOptions((s) => ({
                    [key]: Object.assign(Object.assign({}, s[key]), { template: value }),
                }));
            });
        });
        new obsidian.Setting(this.containerEl)
            .setName(`${label} folder`)
            .addText((textfield) => {
            textfield.setPlaceholder("Example: NC/Monthly");
            textfield.setValue((opts === null || opts === void 0 ? void 0 : opts.folder) || "");
            new FolderSuggest(this.app, textfield.inputEl);
            textfield.onChange(async (value) => {
                await this.plugin.writeOptions((s) => ({
                    [key]: Object.assign(Object.assign({}, s[key]), { folder: value }),
                }));
            });
        });
    }
    async addHolidayRegionSetting() {
        const holidayPath = `${this.plugin.manifest.dir}/holidays`;
        let regions = ["None"];
        try {
            const adapter = this.app.vault.adapter;
            if (await adapter.exists(holidayPath)) {
                const result = await adapter.list(holidayPath);
                const folders = result.folders
                    .map((f) => f.split("/").pop())
                    .filter((f) => f && f !== "None");
                regions = ["None", ...folders];
            }
        }
        catch (e) {
            console.error("Failed to list holiday regions", e);
        }
        new obsidian.Setting(this.containerEl)
            .setName("Holiday Region")
            .setDesc("Select a region to load custom holiday data from the 'holidays/' folder.")
            .addDropdown((dropdown) => {
            regions.forEach((r) => dropdown.addOption(r, r));
            dropdown.setValue(this.plugin.options.holidayRegion || "None");
            dropdown.onChange(async (value) => {
                await this.plugin.writeOptions(() => ({ holidayRegion: value }));
            });
        });
    }
    addDotThresholdSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Words per dot")
            .setDesc("How many words should be represented by a single dot?")
            .addText((textfield) => {
            textfield.setPlaceholder(String(DEFAULT_WORDS_PER_DOT));
            textfield.inputEl.type = "number";
            textfield.setValue(String(this.plugin.options.wordsPerDot));
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    wordsPerDot: value !== "" ? Number(value) : undefined,
                }));
            });
        });
    }
    addWordCountOffsetSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Word count offset")
            .setDesc("Ignore this number of words from the beginning of the note.")
            .addText((textfield) => {
            textfield.setPlaceholder("0");
            textfield.inputEl.type = "number";
            textfield.setValue(String(this.plugin.options.wordCountOffset));
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    wordCountOffset: value !== "" ? Number(value) : 0,
                }));
            });
        });
    }
    addWeekStartSetting() {
        const { moment } = window;
        const localizedWeekdays = moment.weekdays();
        const localeWeekStartNum = window._bundledLocaleWeekSpec.dow;
        const localeWeekStart = moment.weekdays()[localeWeekStartNum];
        new obsidian.Setting(this.containerEl)
            .setName("Start week on:")
            .setDesc("Choose what day of the week to start. Select 'Locale default' to use the default specified by moment.js")
            .addDropdown((dropdown) => {
            dropdown.addOption("locale", `Locale default (${localeWeekStart})`);
            localizedWeekdays.forEach((day, i) => {
                dropdown.addOption(weekdays$1[i], day);
            });
            dropdown.setValue(this.plugin.options.weekStart);
            dropdown.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    weekStart: value,
                }));
            });
        });
    }
    addConfirmCreateSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Confirm before creating new note")
            .setDesc("Show a confirmation modal before creating a new note")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.options.shouldConfirmBeforeCreate);
            toggle.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    shouldConfirmBeforeCreate: value,
                }));
            });
        });
    }
    addShowWeeklyNoteSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Show week number")
            .setDesc("Enable this to add a column with the week number")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.options.showWeeklyNote);
            toggle.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ showWeeklyNote: value }));
                this.display(); // show/hide weekly settings
            });
        });
    }
    addWeeklyNoteFormatSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Weekly note format")
            .setDesc("For more syntax help, refer to format reference")
            .addText((textfield) => {
            textfield.setValue(this.plugin.options.weeklyNoteFormat);
            textfield.setPlaceholder(DEFAULT_WEEK_FORMAT);
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ weeklyNoteFormat: value }));
            });
        });
    }
    addWeeklyNoteTemplateSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Weekly note template")
            .setDesc("Choose the file you want to use as the template for your weekly notes")
            .addText((textfield) => {
            textfield.setValue(this.plugin.options.weeklyNoteTemplate);
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ weeklyNoteTemplate: value }));
            });
        });
    }
    addWeeklyNoteFolderSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Weekly note folder")
            .setDesc("New weekly notes will be placed here")
            .addText((textfield) => {
            textfield.setValue(this.plugin.options.weeklyNoteFolder);
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ weeklyNoteFolder: value }));
            });
        });
    }
    addLocaleOverrideSetting() {
        var _a;
        const { moment } = window;
        const sysLocale = (_a = navigator.language) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        new obsidian.Setting(this.containerEl)
            .setName("Override locale:")
            .setDesc("Set this if you want to use a locale different from the default")
            .addDropdown((dropdown) => {
            dropdown.addOption("system-default", `Same as system (${sysLocale})`);
            moment.locales().forEach((locale) => {
                dropdown.addOption(locale, locale);
            });
            dropdown.setValue(this.plugin.options.localeOverride);
            dropdown.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    localeOverride: value,
                }));
            });
        });
    }
}

// ── File path utilities ──────────────────────────────────────────
// Credit: @creationix/path.js
function join(...partSegments) {
    let parts = [];
    for (let i = 0, l = partSegments.length; i < l; i++) {
        parts = parts.concat(partSegments[i].split("/"));
    }
    const newParts = [];
    for (let i = 0, l = parts.length; i < l; i++) {
        const part = parts[i];
        if (!part || part === ".")
            continue;
        else
            newParts.push(part);
    }
    if (parts[0] === "")
        newParts.unshift("");
    return newParts.join("/");
}
async function ensureFolderExists(path) {
    const dirs = path.replace(/\\/g, "/").split("/");
    dirs.pop(); // remove basename
    if (dirs.length) {
        const dir = join(...dirs);
        if (!window.app.vault.getAbstractFileByPath(dir)) {
            await window.app.vault.createFolder(dir);
        }
    }
}
async function getNotePath(directory, filename) {
    if (!filename.endsWith(".md")) {
        filename += ".md";
    }
    const path = obsidian.normalizePath(join(directory, filename));
    await ensureFolderExists(path);
    return path;
}
async function getTemplateInfo(template) {
    const { metadataCache, vault } = window.app;
    const templatePath = obsidian.normalizePath(template);
    if (templatePath === "/") {
        return Promise.resolve(["", null]);
    }
    try {
        const templateFile = metadataCache.getFirstLinkpathDest(templatePath, "");
        const contents = await vault.cachedRead(templateFile);
        const IFoldInfo = window.app.foldManager.load(templateFile);
        return [contents, IFoldInfo];
    }
    catch (err) {
        console.error(`Failed to read the template '${templatePath}'`, err);
        return ["", null];
    }
}
// ── Date key utilities ───────────────────────────────────────────
/**
 * dateUID: canonical key for identifying daily/weekly/monthly/etc. notes
 * Format: "{granularity}-{ISO timestamp}"
 */
function getDateUID(date, granularity = "day") {
    const ts = date.clone().startOf(granularity).format();
    return `${granularity}-${ts}`;
}
function removeEscapedCharacters(format) {
    return format.replace(/\[[^\]]*\]/g, "");
}
/**
 * When parsing week formats that contain both week numbers and months,
 * moment chooses to ignore week numbers. Strip month/day formatting.
 */
function isFormatAmbiguous(format, granularity) {
    if (granularity === "week") {
        const cleanFormat = removeEscapedCharacters(format);
        return (/w{1,2}/i.test(cleanFormat) &&
            (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat)));
    }
    return false;
}
function getDateFromFilename(filename, granularity) {
    const { moment } = window;
    const getSettings = {
        day: () => {
            const s = getDailyNoteSettings();
            return s.format;
        },
        week: () => {
            const s = getWeeklyNoteSettings();
            return s.format;
        },
        month: () => {
            const s = getMonthlyNoteSettings();
            return s.format;
        },
        quarter: () => {
            const s = getQuarterlyNoteSettings();
            return s.format;
        },
        year: () => {
            const s = getYearlyNoteSettings();
            return s.format;
        },
    };
    const formatFn = getSettings[granularity];
    if (!formatFn)
        return null;
    const format = formatFn().split("/").pop();
    const noteDate = moment(filename, format, true);
    if (!noteDate.isValid()) {
        return null;
    }
    if (isFormatAmbiguous(format, granularity)) {
        if (granularity === "week") {
            const cleanFormat = removeEscapedCharacters(format);
            if (/w{1,2}/i.test(cleanFormat)) {
                return moment(filename, format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""), false);
            }
        }
    }
    return noteDate;
}
function getDateFromFile(file, granularity) {
    return getDateFromFilename(file.basename, granularity);
}
// ── Template token engine ────────────────────────────────────────
function getDaysOfWeek() {
    const { moment } = window;
    let weekStart = moment.localeData()._week.dow;
    const daysOfWeek = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
    ];
    while (weekStart) {
        daysOfWeek.push(daysOfWeek.shift());
        weekStart--;
    }
    return daysOfWeek;
}
function getDayOfWeekNumericalValue(dayOfWeekName) {
    return getDaysOfWeek().indexOf(dayOfWeekName.toLowerCase());
}
function replaceTemplateTokens(contents, date, opts) {
    const { moment } = window;
    const { format } = opts;
    let result = contents
        .replace(/{{\s*date\s*}}/gi, date.format(format))
        .replace(/{{\s*time\s*}}/gi, moment().format("HH:mm"))
        .replace(/{{\s*title\s*}}/gi, date.format(format))
        .replace(/{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi, (_, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
        const now = moment();
        const currentDate = date.clone().set({
            hour: now.get("hour"),
            minute: now.get("minute"),
            second: now.get("second"),
        });
        if (calc) {
            currentDate.add(parseInt(timeDelta, 10), unit);
        }
        if (momentFormat) {
            return currentDate.format(momentFormat.substring(1).trim());
        }
        return currentDate.format(format);
    });
    // NC date token
    if (opts.nc && opts.ncInfo) {
        const ncDateStr = `${opts.ncInfo.pNy}-${opts.ncInfo.pNm}-${opts.ncInfo.pNd}`;
        result = result.replace(/{{\s*nc-date\s*}}/gi, ncDateStr);
    }
    // Daily note specific
    result = result
        .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(format))
        .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "day").format(format));
    // Weekly note specific: day-of-week tokens
    result = result.replace(/{{\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:(.*?)}}/gi, (_, dayOfWeek, fmt) => {
        const day = getDayOfWeekNumericalValue(dayOfWeek);
        return date.weekday(day).format(fmt.trim());
    });
    return result;
}
// ── Frontmatter utilities ────────────────────────────────────────
function getFrontmatterFromCache(file) {
    const cache = window.app.metadataCache.getFileCache(file);
    return (cache === null || cache === void 0 ? void 0 : cache.frontmatter) || null;
}
// ── Settings readers ─────────────────────────────────────────────
// (defined here to avoid circular imports; re-exported from io/settings.ts)
function getPlugin() {
    return window.app.plugins.getPlugin("new-calendar-suite");
}
function getSuiteSettings() {
    const plugin = getPlugin();
    return (plugin === null || plugin === void 0 ? void 0 : plugin.settings) || (plugin === null || plugin === void 0 ? void 0 : plugin.options) || null;
}
function getDailyNoteSettings() {
    var _a, _b, _c, _d, _e;
    const suiteSettings = getSuiteSettings();
    const ds = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.daily;
    // Read core daily-notes plugin settings as base fallback
    let coreFormat = DEFAULT_DAILY_FORMAT;
    let coreFolder = "";
    let coreTemplate = "";
    try {
        const { internalPlugins } = window.app;
        const dailyNotesPlugin = (_a = internalPlugins.getPluginById("daily-notes")) === null || _a === void 0 ? void 0 : _a.instance;
        const options = (dailyNotesPlugin === null || dailyNotesPlugin === void 0 ? void 0 : dailyNotesPlugin.options) || {};
        coreFormat = options.format || DEFAULT_DAILY_FORMAT;
        coreFolder = ((_b = options.folder) === null || _b === void 0 ? void 0 : _b.trim()) || "";
        coreTemplate = ((_c = options.template) === null || _c === void 0 ? void 0 : _c.trim()) || "";
    }
    catch (_f) {
        // Core plugin not available — use defaults
    }
    // Per-field override: suite value if non-empty, otherwise fall back to core
    return {
        format: (ds === null || ds === void 0 ? void 0 : ds.format) || coreFormat,
        folder: ((_d = ds === null || ds === void 0 ? void 0 : ds.folder) === null || _d === void 0 ? void 0 : _d.trim()) || coreFolder,
        template: ((_e = ds === null || ds === void 0 ? void 0 : ds.template) === null || _e === void 0 ? void 0 : _e.trim()) || coreTemplate,
    };
}
function getWeeklyNoteSettings() {
    var _a, _b, _c;
    const suiteSettings = getSuiteSettings();
    if ((_a = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.weekly) === null || _a === void 0 ? void 0 : _a.enabled) {
        return {
            format: suiteSettings.weekly.format || DEFAULT_WEEKLY_FORMAT,
            folder: ((_b = suiteSettings.weekly.folder) === null || _b === void 0 ? void 0 : _b.trim()) || "",
            template: ((_c = suiteSettings.weekly.template) === null || _c === void 0 ? void 0 : _c.trim()) || "",
        };
    }
    return { format: DEFAULT_WEEKLY_FORMAT, folder: "", template: "" };
}
function getMonthlyNoteSettings() {
    var _a, _b, _c, _d, _e;
    const suiteSettings = getSuiteSettings();
    return {
        format: ((_a = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.monthly) === null || _a === void 0 ? void 0 : _a.format) || DEFAULT_MONTHLY_FORMAT,
        folder: ((_c = (_b = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.monthly) === null || _b === void 0 ? void 0 : _b.folder) === null || _c === void 0 ? void 0 : _c.trim()) || "",
        template: ((_e = (_d = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.monthly) === null || _d === void 0 ? void 0 : _d.template) === null || _e === void 0 ? void 0 : _e.trim()) || "",
    };
}
function getQuarterlyNoteSettings() {
    var _a, _b, _c, _d, _e;
    const suiteSettings = getSuiteSettings();
    return {
        format: ((_a = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.quarterly) === null || _a === void 0 ? void 0 : _a.format) || DEFAULT_QUARTERLY_FORMAT,
        folder: ((_c = (_b = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.quarterly) === null || _b === void 0 ? void 0 : _b.folder) === null || _c === void 0 ? void 0 : _c.trim()) || "",
        template: ((_e = (_d = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.quarterly) === null || _d === void 0 ? void 0 : _d.template) === null || _e === void 0 ? void 0 : _e.trim()) || "",
    };
}
function getYearlyNoteSettings() {
    var _a, _b, _c, _d, _e;
    const suiteSettings = getSuiteSettings();
    return {
        format: ((_a = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.yearly) === null || _a === void 0 ? void 0 : _a.format) || DEFAULT_YEARLY_FORMAT,
        folder: ((_c = (_b = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.yearly) === null || _b === void 0 ? void 0 : _b.folder) === null || _c === void 0 ? void 0 : _c.trim()) || "",
        template: ((_e = (_d = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.yearly) === null || _d === void 0 ? void 0 : _d.template) === null || _e === void 0 ? void 0 : _e.trim()) || "",
    };
}
// NC settings readers
function getNCPhaseSettings() {
    var _a, _b, _c, _d, _e;
    const suiteSettings = getSuiteSettings();
    return {
        format: ((_a = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncPhase) === null || _a === void 0 ? void 0 : _a.format) || DEFAULT_NC_PHASE_FORMAT,
        folder: ((_c = (_b = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncPhase) === null || _b === void 0 ? void 0 : _b.folder) === null || _c === void 0 ? void 0 : _c.trim()) || "",
        template: ((_e = (_d = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncPhase) === null || _d === void 0 ? void 0 : _d.template) === null || _e === void 0 ? void 0 : _e.trim()) || "",
    };
}
function getNCMonthSettings() {
    var _a, _b, _c, _d, _e;
    const suiteSettings = getSuiteSettings();
    return {
        format: ((_a = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncMonth) === null || _a === void 0 ? void 0 : _a.format) || DEFAULT_NC_MONTH_FORMAT,
        folder: ((_c = (_b = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncMonth) === null || _b === void 0 ? void 0 : _b.folder) === null || _c === void 0 ? void 0 : _c.trim()) || "",
        template: ((_e = (_d = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncMonth) === null || _d === void 0 ? void 0 : _d.template) === null || _e === void 0 ? void 0 : _e.trim()) || "",
    };
}
function getNCSeasonSettings() {
    var _a, _b, _c, _d, _e;
    const suiteSettings = getSuiteSettings();
    return {
        format: ((_a = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncSeason) === null || _a === void 0 ? void 0 : _a.format) || DEFAULT_NC_SEASON_FORMAT,
        folder: ((_c = (_b = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncSeason) === null || _b === void 0 ? void 0 : _b.folder) === null || _c === void 0 ? void 0 : _c.trim()) || "",
        template: ((_e = (_d = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncSeason) === null || _d === void 0 ? void 0 : _d.template) === null || _e === void 0 ? void 0 : _e.trim()) || "",
    };
}
function getNCYearSettings() {
    var _a, _b, _c, _d, _e;
    const suiteSettings = getSuiteSettings();
    return {
        format: ((_a = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncYear) === null || _a === void 0 ? void 0 : _a.format) || DEFAULT_NC_YEAR_FORMAT,
        folder: ((_c = (_b = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncYear) === null || _b === void 0 ? void 0 : _b.folder) === null || _c === void 0 ? void 0 : _c.trim()) || "",
        template: ((_e = (_d = suiteSettings === null || suiteSettings === void 0 ? void 0 : suiteSettings.ncYear) === null || _d === void 0 ? void 0 : _d.template) === null || _e === void 0 ? void 0 : _e.trim()) || "",
    };
}

async function createPeriodicNote(date, granularity) {
    const { vault } = window.app;
    const getSettings = {
        month: getMonthlyNoteSettings,
        quarter: getQuarterlyNoteSettings,
        year: getYearlyNoteSettings,
    };
    const { template, format, folder } = getSettings[granularity]();
    const filename = date.format(format);
    const normalizedPath = await getNotePath(folder, filename);
    // Return existing file if already created
    const existingFile = vault.getAbstractFileByPath(normalizedPath);
    if (existingFile && existingFile instanceof obsidian.TFile)
        return existingFile;
    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
    try {
        const contents = replaceTemplateTokens(templateContents, date, { format });
        const createdFile = await vault.create(normalizedPath, contents);
        if (IFoldInfo)
            window.app.foldManager.save(createdFile, IFoldInfo);
        return createdFile;
    }
    catch (err) {
        console.error(`Failed to create file: '${normalizedPath}'`, err);
        return undefined;
    }
}
// ── Monthly ──────────────────────────────────────────────────────
async function createMonthlyNote(date) {
    return createPeriodicNote(date, "month");
}
function getAllMonthlyNotes() {
    const monthlyNotes = {};
    try {
        const { vault } = window.app;
        const { folder } = getMonthlyNoteSettings();
        const folderPath = folder;
        if (!folderPath)
            return monthlyNotes;
        const monthlyNotesFolder = vault.getAbstractFileByPath(folderPath);
        if (!monthlyNotesFolder)
            return monthlyNotes;
        obsidian.Vault.recurseChildren(monthlyNotesFolder, (note) => {
            if (note instanceof obsidian.TFile) {
                const date = getDateFromFile(note, "month");
                if (date) {
                    monthlyNotes[getDateUID(date, "month")] = note;
                }
            }
        });
    }
    catch (err) {
        console.log("[New Calendar Suite] Failed to find monthly notes folder", err);
    }
    return monthlyNotes;
}
// ── Quarterly ────────────────────────────────────────────────────
async function createQuarterlyNote(date) {
    return createPeriodicNote(date, "quarter");
}
function getAllQuarterlyNotes() {
    const quarterly = {};
    try {
        const { vault } = window.app;
        const { folder } = getQuarterlyNoteSettings();
        if (!folder)
            return quarterly;
        const folderObj = vault.getAbstractFileByPath(folder);
        if (!folderObj)
            return quarterly;
        obsidian.Vault.recurseChildren(folderObj, (note) => {
            if (note instanceof obsidian.TFile) {
                const date = getDateFromFile(note, "quarter");
                if (date) {
                    quarterly[getDateUID(date, "quarter")] = note;
                }
            }
        });
    }
    catch (err) {
        console.log("[New Calendar Suite] Failed to find quarterly notes folder", err);
    }
    return quarterly;
}
// ── Yearly ───────────────────────────────────────────────────────
async function createYearlyNote(date) {
    return createPeriodicNote(date, "year");
}
function getAllYearlyNotes() {
    const yearly = {};
    try {
        const { vault } = window.app;
        const { folder } = getYearlyNoteSettings();
        if (!folder)
            return yearly;
        const folderObj = vault.getAbstractFileByPath(folder);
        if (!folderObj)
            return yearly;
        obsidian.Vault.recurseChildren(folderObj, (note) => {
            if (note instanceof obsidian.TFile) {
                const date = getDateFromFile(note, "year");
                if (date) {
                    yearly[getDateUID(date, "year")] = note;
                }
            }
        });
    }
    catch (err) {
        console.log("[New Calendar Suite] Failed to find yearly notes folder", err);
    }
    return yearly;
}

/**
 * 辅助函数：将数字转化为中文
 */
const numToChinese = (num) => {
    const chars = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六'];
    return chars[num] || num.toString();
};
/**
 * 辅助函数：生成新历年月的中文字符串
 */
const toChineseYearMonth = (ny, nm) => {
    const yearStr = ny === 1 ? "元年" : `${numToChinese(ny)}年`;
    return `新历${yearStr}${numToChinese(nm)}月`;
};
/**
 * 独有的 16 个月份色彩映射表
 */
const ncMonthColour = {
    '01': '#E63C3C',
    '02': '#F27828',
    '03': '#C89100',
    '04': '#82A528',
    '05': '#28AA5A',
    '06': '#00A091',
    '07': '#0096C8',
    '08': '#3278E6',
    '09': '#6464F0',
    '10': '#9655E6',
    '11': '#BE4BC8',
    '12': '#DC4696',
    '13': '#EB6478',
    '14': '#6E829B',
    '15': '#AF6E4B',
    '16': '#558773', // Deep Moss / 墨绿 (低调冷色)
};
// 旧，因区分度不高与暗色模式下可见度不高而废弃
// export const ncMonthColour: Record<string, string> = {
//   '01': '#CE3738', '02': '#FF8000', '03': '#2D756D', '04': '#2D5F5C',
//   '05': '#243D62', '06': '#656981', '07': '#AC6A6A', '08': '#BCBA63',
//   '09': '#95B26F', '10': '#7CC1B3', '11': '#3F36EE', '12': '#B4A758',
//   '13': '#9B9992', '14': '#2D3037', '15': '#78979F', '16': '#3F4F61',
// };
/**
 * 特殊日期的强制覆盖规则
 */
const OVERRIDES = {
    '2024-4': '2024-11-03', '2021-3': '2021-08-01', '2021-4': '2021-10-31',
    '2019-4': '2019-11-10', '2018-1': '2018-03-21', '2390-4': '2390-11-04'
};
/**
 * 核心天文计算：根据年份和节气索引计算公历日期 (儒略日/黄经计算)
 */
const getSolarTermDate = (y, termIndex) => {
    const termLong = (termIndex * 15 + 270) % 360;
    let jd = (Date.UTC(y, 0, 1) / 86400000) + 2440587.5;
    jd += (termLong - 280 + 360) % 360;
    for (let i = 0; i < 20; i++) {
        const T = (jd - 2451545.0) / 36525;
        const L0 = 280.46646 + 36000.76983 * T;
        const M = (357.52911 + 35999.05029 * T) * Math.PI / 180;
        const C = 1.914602 * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
        const lambda = (L0 + C + 360) % 360;
        let diff = (lambda - termLong + 540) % 360 - 180;
        jd -= diff * 1.0145;
    }
    const date = new Date((jd + 8 / 24 - 2440587.5) * 86400000 + 0.001);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};
/**
 * 辅助规则：获取最近的星期日
 */
const getNearestSunday = (d) => {
    const w = d.getUTCDay();
    const offset = (w >= 4) ? (7 - w) : -w;
    d.setUTCDate(d.getUTCDate() + offset);
    return d;
};
/**
 * 获取公历对应的”检查点” (用于切分新历月份)
 * Results are memoized — checkpoint dates are deterministic and never change.
 */
const _cpCache = new Map();
const _ncCache = new Map();
const getGCheckPoint = (y, tgt) => {
    const key = `${y}-${tgt}`;
    const cached = _cpCache.get(key);
    if (cached)
        return new Date(cached);
    let d;
    if (OVERRIDES[key]) {
        d = new Date(OVERRIDES[key] + 'T00:00:00Z');
    }
    else {
        let m = (tgt - 1) * 6 + (y >= 2020 ? 3 : 6);
        let useSunday = (y >= 2020);
        if (y === 2019) {
            if (tgt === 3) {
                m = 21;
                useSunday = true;
            }
            else if (tgt === 4) {
                m = 0;
            }
        }
        d = getSolarTermDate(y, m % 24);
        if (useSunday)
            d = getNearestSunday(d);
    }
    _cpCache.set(key, d);
    return new Date(d);
};
/**
 * 年月转换规则：公历转内部目标系
 */
const toTN = (y, tgt) => {
    let ny = Math.floor((y - 2013) / 4) + 1;
    let nm = (y - 2013 - 4 * (ny - 1)) * 4 + tgt;
    if (ny === 2 && nm >= 12)
        nm -= 1;
    return { ny, nm };
};
/**
 * 年月转换规则：内部目标系转公历
 */
const toNT = (ny, nm) => {
    if (ny === 2) {
        if (nm <= 10)
            return { y: 2017 + Math.floor((nm - 1) / 4), tgt: (nm - 1) % 4 + 1 };
        if (nm === 11)
            return { y: 2019, tgt: 3 };
        return { y: 2020, tgt: nm - 11 };
    }
    return { y: 2013 + 4 * (ny - 1) + Math.floor((nm - 1) / 4), tgt: (nm - 1) % 4 + 1 };
};
/**
 * 对外暴露的核心 API 对象
 */
const NC = {
    /**
     * 将给定的公历年月日 (gy, gm, gd) 转换为新历对象
     * Results are memoized — the NC date for any GC date is deterministic.
     */
    toNewCalendar: (gy, gm, gd) => {
        const dateKey = `${gy}-${gm}-${gd}`;
        const cached = _ncCache.get(dateKey);
        if (cached)
            return cached;
        const targetDate = new Date(Date.UTC(gy, gm - 1, gd));
        let result = { ny: 0, nm: 0, nd: 0, pNy: '00', pNm: '00', pNd: '00', color: '#333' };
        for (let y = gy - 1; y <= gy + 1; y++) {
            for (let tgt = 1; tgt <= 4; tgt++) {
                const cp = getGCheckPoint(y, tgt);
                const nextCp = (tgt === 4) ? getGCheckPoint(y + 1, 1) : getGCheckPoint(y, tgt + 1);
                if (targetDate >= cp && targetDate < nextCp) {
                    let nd = Math.floor((targetDate.getTime() - cp.getTime()) / 86400000) + 1;
                    let res = toTN(y, tgt);
                    if (y === 2019 && tgt === 3)
                        res = { ny: 2, nm: 11 };
                    else if (y === 2019 && tgt === 4) {
                        res = { ny: 2, nm: 11 };
                        nd = nd + Math.round((cp.getTime() - getGCheckPoint(2019, 3).getTime()) / 86400000);
                    }
                    const pNy = res.ny.toString().padStart(2, '0');
                    const pNm = res.nm.toString().padStart(2, '0');
                    const pNd = nd.toString().padStart(2, '0');
                    result = { ny: res.ny, nm: res.nm, nd: nd, pNy, pNm, pNd, color: ncMonthColour[pNm] };
                }
            }
        }
        _ncCache.set(dateKey, result);
        return result;
    },
    /**
     * 获取某一年/某个月的新历起始日期的 moment 对象 (需确保环境中存在 window.moment)
     */
    getNCMonthStart: (ny, nm) => {
        const { y, tgt } = toNT(ny, nm);
        return window.moment(getGCheckPoint(y, tgt));
    },
    /**
     * 计算某日期属于特定新历年月的第几周
     */
    getNCWeekOfMonth: (date, ny, nm) => {
        const monthStart = NC.getNCMonthStart(ny, nm);
        const firstWeekStart = monthStart.clone().startOf("week");
        const mDate = window.moment(date).startOf("day");
        const diffDays = mDate.diff(firstWeekStart, "days");
        return Math.floor(diffDays / 7) + 1;
    },
    /**
     * 格式化新历日期
     * 支持 Y: 年, M: 月, D: 日 (不足2位不补0)
     * 支持 YY, MM, DD (不足2位补0)
     * 支持 ww: 新历月周序 (补0), w: 不补0
     * 支持 PP: Phase (补0), P: 不补0
     * 支持 SS: Season (补0), S: 不补0
     * 支持 CY: 汉字年, CM: 汉字月
     * 支持 [text]: 原样保留文本
     */
    format: (date, pattern) => {
        const m = window.moment(date);
        if (!m.isValid())
            return "";
        const nc = NC.toNewCalendar(m.year(), m.month() + 1, m.date());
        const weekNum = NC.getNCWeekOfMonth(m, nc.ny, nc.nm);
        const phase = NC.getPhase(nc.ny, nc.nm, nc.nd);
        const season = NC.getSeason(nc.ny, nc.nm);
        const pWw = weekNum.toString().padStart(2, "0");
        const pPp = phase.toString().padStart(2, "0");
        const pSs = season.toString().padStart(2, "0");
        let res = pattern;
        // 将括号内容替换为占位符，防止 token 匹配括号内的字符
        const bracketContents = [];
        res = res.replace(/\[(.*?)\]/g, (_m, content) => {
            bracketContents.push(content);
            return `\x00B${bracketContents.length - 1}\x00`;
        });
        // 注意替换顺序，先替换长的再替换短的
        res = res.replace("YY", nc.pNy);
        res = res.replace("Y", nc.ny.toString());
        res = res.replace("MM", nc.pNm);
        res = res.replace("M", nc.nm.toString());
        res = res.replace("DD", nc.pNd);
        res = res.replace("D", nc.nd.toString());
        res = res.replace("ww", pWw);
        res = res.replace("w", weekNum.toString());
        res = res.replace("PP", pPp);
        res = res.replace("P", phase.toString());
        res = res.replace("SS", pSs);
        res = res.replace("S", season.toString());
        res = res.replace("CY", nc.ny === 1 ? "元年" : numToChinese(nc.ny) + "年");
        res = res.replace("CM", numToChinese(nc.nm) + "月");
        // 恢复括号内容
        res = res.replace(/\x00B(\d+)\x00/g, (_m, i) => bracketContents[parseInt(i)]);
        return res;
    },
    /**
     * 获取新历某月的公历日期范围 [开始, 结束]
     */
    getMonthRange: (ny, nm) => {
        const start = NC.getNCMonthStart(ny, nm);
        let nextNy = ny;
        let nextNm = nm + 1;
        const maxMonths = (ny === 2) ? 15 : 16;
        if (nextNm > maxMonths) {
            nextNy++;
            nextNm = 1;
        }
        const end = NC.getNCMonthStart(nextNy, nextNm).clone().subtract(1, "day");
        return [start, end];
    },
    /**
     * 计算该月总周数
     */
    _getTotalWeeks: (ny, nm) => {
        const [start, end] = NC.getMonthRange(ny, nm);
        return NC.getNCWeekOfMonth(end, ny, nm);
    },
    /**
     * Phase 周数分配: P1,P2,P3 各 floor(T/4) 周，P4 取余。
     */
    _getPhaseSizes: (ny, nm) => {
        const T = NC._getTotalWeeks(ny, nm);
        const base = Math.floor(T / 4);
        return [base, base, base, T - base * 3];
    },
    /**
     * 计算给定 NC 月中的 Phase (1-4)
     */
    getPhase: (ny, nm, nd) => {
        const [start] = NC.getMonthRange(ny, nm);
        const day = start.clone().add(nd - 1, 'days');
        const weekNum = NC.getNCWeekOfMonth(day, ny, nm);
        const [s1, s2, s3] = NC._getPhaseSizes(ny, nm);
        if (weekNum <= s1)
            return 1;
        if (weekNum <= s1 + s2)
            return 2;
        if (weekNum <= s1 + s2 + s3)
            return 3;
        return 4;
    },
    /**
     * 计算给定 NC 月所属的 Season (1-4)
     * Year 2 (15个月): S1=1-4, S2=5-8, S3=9-11, S4=12-15
     */
    getSeason: (ny, nm) => {
        if (ny === 2) {
            if (nm <= 4)
                return 1;
            if (nm <= 8)
                return 2;
            if (nm <= 11)
                return 3;
            return 4;
        }
        return Math.ceil(nm / 4);
    },
    /**
     * 获取某个 Phase 的 GC 日期范围 [start, end]
     */
    getPhaseRange: (ny, nm, phase) => {
        const [monthStart, monthEnd] = NC.getMonthRange(ny, nm);
        const monthDays = monthEnd.diff(monthStart, 'days') + 1;
        let startDay = monthDays + 1, endDay = 0;
        for (let d = 1; d <= monthDays; d++) {
            if (NC.getPhase(ny, nm, d) === phase) {
                if (d < startDay)
                    startDay = d;
                if (d > endDay)
                    endDay = d;
            }
        }
        if (startDay > monthDays)
            return [monthStart.clone(), monthStart.clone()];
        const start = monthStart.clone().add(startDay - 1, 'days');
        const end = monthStart.clone().add(endDay - 1, 'days');
        return [start, end];
    },
    /**
     * 获取一个 Season 包含的月份范围 [startMonth, endMonth]
     */
    getSeasonMonths: (ny, season) => {
        const maxMonths = (ny === 2) ? 15 : 16;
        if (ny === 2) {
            if (season === 1)
                return [1, 4];
            if (season === 2)
                return [5, 8];
            if (season === 3)
                return [9, 11];
            return [12, 15];
        }
        const start = (season - 1) * 4 + 1;
        return [start, Math.min(start + 3, maxMonths)];
    },
    /**
     * 便捷方法：从 moment 对象获取完整 NC 信息 (含 phase/season)
     */
    getNCDate: (date) => {
        const m = window.moment(date);
        const nc = NC.toNewCalendar(m.year(), m.month() + 1, m.date());
        const phase = NC.getPhase(nc.ny, nc.nm, nc.nd);
        const season = NC.getSeason(nc.ny, nc.nm);
        return Object.assign(Object.assign({}, nc), { phase, season });
    },
    /**
     * 暴露汉字转换
     */
    numToChinese: (num) => numToChinese(num),
    /**
     * 智能格式化：根据文件名标题自动解析日期并格式化
     * @param title 文件标题 (通常是 tp.file.title)
     * @param pattern 格式字符串
     * @param type 历法类型: 'GC' (公历) 或 'NC' (新历)
     */
    smartFormat: (title, pattern, type = 'NC') => {
        // 1. 尝试解析标题中的 YYYY-MM-DD 日期
        let m = window.moment(title, "YYYY-MM-DD", true);
        // 2. 如果标题不是合法日期，则回退到当前时间
        if (!m.isValid()) {
            m = window.moment();
        }
        if (type === 'GC') {
            return m.format(pattern);
        }
        else {
            return NC.format(m, pattern);
        }
    },
    // ── NC date arithmetic & navigation ──────────────────────────
    /**
     * Add NC days to an NC date. Returns new {ny, nm, nd}.
     */
    addDays: (ny, nm, nd, days) => {
        const start = NC.getNCMonthStart(ny, nm);
        const gc = start.clone().add(nd - 1 + days, "days");
        return NC.toNewCalendar(gc.year(), gc.month() + 1, gc.date());
    },
    /**
     * Compare two NC dates. Returns -1 if a < b, 0 if equal, 1 if a > b.
     */
    compare: (a, b) => {
        if (a.ny !== b.ny)
            return a.ny - b.ny;
        if (a.nm !== b.nm)
            return a.nm - b.nm;
        return a.nd - b.nd;
    },
    /**
     * Get today's NC date info.
     */
    today: () => NC.getNCDate(window.moment()),
    /**
     * Get yesterday's NC date info.
     */
    yesterday: () => NC.getNCDate(window.moment().subtract(1, "day")),
    /**
     * Get tomorrow's NC date info.
     */
    tomorrow: () => NC.getNCDate(window.moment().add(1, "day")),
    /**
     * Navigate to the next NC period of the given granularity.
     * Returns {ny, nm, nd, phase?, season?} for the start of the next period.
     */
    nextPeriod: (currentNC, granularity) => {
        const maxMonths = currentNC.ny === 2 ? 15 : 16;
        switch (granularity) {
            case "day": {
                const start = NC.getNCMonthStart(currentNC.ny, currentNC.nm);
                const gc = start.clone().add(currentNC.nd, "days"); // nd is 1-based, so this gives next day
                return NC.getNCDate(gc);
            }
            case "nc-phase": {
                let nextPhase = currentNC.phase + 1;
                let nextNy = currentNC.ny, nextNm = currentNC.nm;
                if (nextPhase > 4) {
                    nextPhase = 1;
                    nextNm++;
                    if (nextNm > maxMonths) {
                        nextNy++;
                        nextNm = 1;
                    }
                }
                const [start] = NC.getPhaseRange(nextNy, nextNm, nextPhase);
                return NC.getNCDate(start);
            }
            case "nc-month": {
                let nextNm = currentNC.nm + 1;
                let nextNy = currentNC.ny;
                if (nextNm > maxMonths) {
                    nextNy++;
                    nextNm = 1;
                }
                const start = NC.getNCMonthStart(nextNy, nextNm);
                return NC.getNCDate(start);
            }
            case "nc-season": {
                const season = NC.getSeason(currentNC.ny, currentNC.nm);
                let nextSeason = season + 1;
                let nextNy = currentNC.ny;
                if (nextSeason > 4) {
                    nextNy++;
                    nextSeason = 1;
                }
                const [startNm] = NC.getSeasonMonths(nextNy, nextSeason);
                const start = NC.getNCMonthStart(nextNy, startNm);
                return NC.getNCDate(start);
            }
            case "nc-year": {
                const start = NC.getNCMonthStart(currentNC.ny + 1, 1);
                return NC.getNCDate(start);
            }
            default: return currentNC;
        }
    },
    /**
     * Navigate to the previous NC period. Inverse of nextPeriod.
     */
    prevPeriod: (currentNC, granularity) => {
        currentNC.ny === 2 ? 15 : 16;
        switch (granularity) {
            case "day": {
                const start = NC.getNCMonthStart(currentNC.ny, currentNC.nm);
                const gc = start.clone().add(currentNC.nd - 2, "days"); // nd is 1-based
                return NC.getNCDate(gc);
            }
            case "nc-phase": {
                let prevPhase = currentNC.phase - 1;
                let prevNy = currentNC.ny, prevNm = currentNC.nm;
                if (prevPhase < 1) {
                    prevPhase = 4;
                    prevNm--;
                    if (prevNm < 1) {
                        prevNy--;
                        prevNm = prevNy === 2 ? 15 : 16;
                    }
                }
                if (prevNy < 1)
                    return currentNC;
                const [start] = NC.getPhaseRange(prevNy, prevNm, prevPhase);
                return NC.getNCDate(start);
            }
            case "nc-month": {
                let prevNm = currentNC.nm - 1;
                let prevNy = currentNC.ny;
                if (prevNm < 1) {
                    prevNy--;
                    if (prevNy < 1)
                        return currentNC;
                    prevNm = prevNy === 2 ? 15 : 16;
                }
                const start = NC.getNCMonthStart(prevNy, prevNm);
                return NC.getNCDate(start);
            }
            case "nc-season": {
                const season = NC.getSeason(currentNC.ny, currentNC.nm);
                let prevSeason = season - 1;
                let prevNy = currentNC.ny;
                if (prevSeason < 1) {
                    prevNy--;
                    if (prevNy < 1)
                        return currentNC;
                    prevSeason = 4;
                }
                const [startNm] = NC.getSeasonMonths(prevNy, prevSeason);
                const start = NC.getNCMonthStart(prevNy, startNm);
                return NC.getNCDate(start);
            }
            case "nc-year": {
                if (currentNC.ny <= 1)
                    return currentNC;
                const start = NC.getNCMonthStart(currentNC.ny - 1, 1);
                return NC.getNCDate(start);
            }
            default: return currentNC;
        }
    },
    /**
     * Get the GC date range [start, end] for an NC period, suitable for Dataview WHERE clauses.
     * @returns [moment, moment] — GC start and end moments
     */
    getPeriodRange: (granularity, ny, nm, ndOrPhaseOrSeason) => {
        switch (granularity) {
            case "day": {
                const start = NC.getNCMonthStart(ny, nm).clone().add((ndOrPhaseOrSeason || 1) - 1, "days");
                return [start.clone(), start.clone().endOf("day")];
            }
            case "nc-phase":
                return NC.getPhaseRange(ny, nm, ndOrPhaseOrSeason || 1);
            case "nc-month":
                return NC.getMonthRange(ny, nm);
            case "nc-season": {
                // Supports both calling patterns:
                //   (granularity, ny, season)          → season in nm
                //   (granularity, ny, placeholder, s)  → season in ndOrPhaseOrSeason
                const season = ndOrPhaseOrSeason || nm || 1;
                const [startNm, endNm] = NC.getSeasonMonths(ny, season);
                const start = NC.getNCMonthStart(ny, startNm);
                const maxMonths = ny === 2 ? 15 : 16;
                let nextNy = ny, nextNm = endNm + 1;
                if (nextNm > maxMonths) {
                    nextNy++;
                    nextNm = 1;
                }
                const end = NC.getNCMonthStart(nextNy, nextNm);
                return [start.clone(), end.clone().subtract(1, "day")];
            }
            case "nc-year": {
                const start = NC.getNCMonthStart(ny, 1);
                const maxMonths = ny === 2 ? 15 : 16;
                let endNy = ny, endNm = maxMonths + 1;
                if (endNm > maxMonths) {
                    endNy++;
                    endNm = 1;
                }
                const end = NC.getNCMonthStart(endNy, endNm);
                return [start.clone(), end.clone().subtract(1, "day")];
            }
            default:
                return [window.moment(), window.moment()];
        }
    },
    /**
     * Format an NC date {ny, nm, nd} as a canonical sortable string "YY-MM-DD".
     */
    toDateString: (nc) => {
        return `${nc.ny.toString().padStart(2, "0")}-${nc.nm.toString().padStart(2, "0")}-${nc.nd.toString().padStart(2, "0")}`;
    },
    /**
     * Get the approximate GC year for an NC period.
     *   approxGCYear(4)           → GC year of NC year 4 start
     *   approxGCYear(4, 6)        → GC year of NC month 6 start
     *   approxGCYear(4, 2, true)  → GC year of NC season 2 start
     */
    approxGCYear: (ny, nmOrSeason, isSeason) => {
        let gc;
        if (nmOrSeason == null) {
            gc = NC.getNCMonthStart(ny, 1);
        }
        else if (isSeason) {
            const [startNm] = NC.getSeasonMonths(ny, nmOrSeason);
            gc = NC.getNCMonthStart(ny, startNm);
        }
        else {
            gc = NC.getNCMonthStart(ny, nmOrSeason);
        }
        return gc.year();
    },
    /**
     * Parse a canonical NC date string "YY-MM-DD" back into {ny, nm, nd}.
     */
    parseDateString: (str) => {
        const parts = str.split("-");
        if (parts.length !== 3)
            return null;
        const ny = parseInt(parts[0], 10);
        const nm = parseInt(parts[1], 10);
        const nd = parseInt(parts[2], 10);
        if (isNaN(ny) || isNaN(nm) || isNaN(nd))
            return null;
        const phase = NC.getPhase(ny, nm, nd);
        const season = NC.getSeason(ny, nm);
        const color = ncMonthColour[nm.toString().padStart(2, "0")] || "#333";
        return { ny, nm, nd, pNy: parts[0], pNm: parts[1], pNd: parts[2], phase, season, color };
    },
};

/**
 * 生成 NC 周期笔记的规范排序 key
 *   nc-phase:  "nc-phase-24-03-2"  (ny-nm-phase)
 *   nc-month:  "nc-month-24-03"    (ny-nm)
 *   nc-season: "nc-season-24-2"    (ny-season)
 *   nc-year:   "nc-year-24"        (ny)
 */
function buildNCKey(granularity, ny, nm, phaseOrSeason) {
    const pNy = ny.toString().padStart(2, "0");
    const pNm = nm.toString().padStart(2, "0");
    switch (granularity) {
        case "nc-phase":
            return `nc-phase-${pNy}-${pNm}-${phaseOrSeason}`;
        case "nc-month":
            return `nc-month-${pNy}-${pNm}`;
        case "nc-season":
            return `nc-season-${pNy}-${phaseOrSeason}`;
        case "nc-year":
            return `nc-year-${pNy}`;
    }
}
/**
 * 将 NC format pattern 转换为正则表达式
 * Token mapping:
 *   YY,MM,DD,ww,PP,SS → (\d{2})
 *   Y,M,D,w,P,S       → (\d+)
 *   CY,CM             → (.+)
 *   [text]            → 原样保留
 *   其他字符            → 转义
 */
function buildNCFormatRegex(pattern) {
    let regexStr = "";
    // 移除 [text] 转义 （NC.format 使用前已处理，我们在此也处理）
    const cleaned = pattern.replace(/\[(.*?)\]/g, "$1");
    // 构建 token 正则，匹配 YY|MM|DD|ww|PP|SS|CY|CM|Y|M|D|w|P|S 和普通字符
    const tokenRegex = /YY|MM|DD|ww|PP|SS|CY|CM|Y|M|D|w|P|S|./g;
    let match;
    while ((match = tokenRegex.exec(cleaned)) !== null) {
        const token = match[0];
        switch (token) {
            case "YY":
            case "MM":
            case "DD":
            case "ww":
            case "PP":
            case "SS":
                regexStr += "(\\d{2})";
                break;
            case "Y":
            case "M":
            case "D":
            case "w":
            case "P":
            case "S":
                regexStr += "(\\d+)";
                break;
            case "CY":
            case "CM":
                regexStr += "(.+)";
                break;
            default:
                // 转义正则特殊字符
                regexStr += token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
    }
    return new RegExp("^" + regexStr + "$");
}
/**
 * 从文件名解析 NC 日期
 * 先尝试正则匹配，再尝试从文件 frontmatter 读取
 */
function parseNCFilename(filename, format, granularity, frontmatter) {
    const basename = filename.replace(/\.md$/, "");
    const regex = buildNCFormatRegex(format);
    const match = basename.match(regex);
    if (match) {
        const tokens = match.slice(1); // 去掉完整匹配
        let yy = 0, mm = 0, dd = 1, pp = 1, ss = 1;
        // 根据 format 中的 token 顺序映射
        const cleaned = format.replace(/\[(.*?)\]/g, "$1");
        const tokenRegex = /YY|MM|DD|ww|PP|SS|CY|CM|Y|M|D|w|P|S/g;
        let idx = 0;
        let m2;
        while ((m2 = tokenRegex.exec(cleaned)) !== null) {
            const token = m2[0];
            const val = parseInt(tokens[idx], 10);
            switch (token) {
                case "YY":
                case "Y":
                    yy = val || 0;
                    break;
                case "MM":
                case "M":
                    mm = val || 0;
                    break;
                case "DD":
                case "D":
                    dd = val || 1;
                    break;
                case "PP":
                case "P":
                    pp = val || 1;
                    break;
                case "SS":
                case "S":
                    ss = val || 1;
                    break;
            }
            idx++;
        }
        const phase = granularity === "nc-phase" ? pp : NC.getPhase(yy, mm, dd);
        const season = granularity === "nc-season" ? ss : NC.getSeason(yy, mm);
        return { ny: yy, nm: mm, nd: dd, phase, season };
    }
    // 回退：从 frontmatter 读取
    if (frontmatter && frontmatter["nc-date"]) {
        const ncDate = frontmatter["nc-date"];
        const parts = ncDate.split("-");
        if (parts.length === 3) {
            const yy = parseInt(parts[0], 10);
            const mm = parseInt(parts[1], 10);
            const dd = parseInt(parts[2], 10);
            const phase = NC.getPhase(yy, mm, dd);
            const season = NC.getSeason(yy, mm);
            return { ny: yy, nm: mm, nd: dd, phase, season };
        }
    }
    return null;
}
/**
 * 获取某个 Phase 的起始 GC moment
 */
function getPhaseStart(ny, nm, phase) {
    const [start] = NC.getPhaseRange(ny, nm, phase);
    return start;
}
/**
 * 获取某个 Season 的起始 GC moment
 */
function getSeasonStart(ny, season) {
    const [startNm] = NC.getSeasonMonths(ny, season);
    return NC.getNCMonthStart(ny, startNm);
}
/**
 * 获取某个 NC Year 的起始 GC moment
 */
function getNCYearStart(ny) {
    return NC.getNCMonthStart(ny, 1);
}

// ── Frontmatter injection ────────────────────────────────────────
function injectFrontmatter(contents, ncType, ncDate, gcDate) {
    const fmBlock = [
        `nc-type: ${ncType}`,
        `nc-date: "${ncDate}"`,
        `gc-date: ${gcDate}`,
    ].join("\n");
    // If template already has frontmatter, insert into existing block
    if (contents.startsWith("---")) {
        const endIdx = contents.indexOf("---", 3);
        if (endIdx !== -1) {
            return (contents.slice(0, endIdx) +
                fmBlock +
                "\n" +
                contents.slice(endIdx));
        }
    }
    // Prepend new frontmatter block
    return `---\n${fmBlock}\n---\n${contents}`;
}
async function createNCNote(date, granularity) {
    const { vault } = window.app;
    const moment = window.moment;
    const m = moment(date);
    const getSettings = {
        "nc-phase": getNCPhaseSettings,
        "nc-month": getNCMonthSettings,
        "nc-season": getNCSeasonSettings,
        "nc-year": getNCYearSettings,
    };
    const { template, format, folder } = getSettings[granularity]();
    const ncInfo = NC.getNCDate(m);
    // Determine period-start GC moment
    let periodStart;
    let ncDateStr;
    switch (granularity) {
        case "nc-phase": {
            const phase = ncInfo.phase;
            periodStart = getPhaseStart(ncInfo.ny, ncInfo.nm, phase);
            ncDateStr = `${ncInfo.pNy}-${ncInfo.pNm}-${phase.toString().padStart(2, "0")}`;
            break;
        }
        case "nc-month": {
            periodStart = NC.getNCMonthStart(ncInfo.ny, ncInfo.nm);
            ncDateStr = `${ncInfo.pNy}-${ncInfo.pNm}-01`;
            break;
        }
        case "nc-season": {
            const season = ncInfo.season;
            periodStart = getSeasonStart(ncInfo.ny, season);
            ncDateStr = `${ncInfo.pNy}-${season.toString().padStart(2, "0")}-01`;
            break;
        }
        case "nc-year": {
            periodStart = getNCYearStart(ncInfo.ny);
            ncDateStr = `${ncInfo.pNy}-01-01`;
            break;
        }
        default:
            periodStart = m;
            ncDateStr = "00-00-00";
    }
    const filename = NC.format(periodStart, format);
    const normalizedPath = await getNotePath(folder, filename);
    // Return existing file if already created
    const existingFile = vault.getAbstractFileByPath(normalizedPath);
    if (existingFile && existingFile instanceof obsidian.TFile)
        return existingFile;
    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
    const periodNcInfo = NC.getNCDate(periodStart);
    const gcDateStr = periodStart.format("YYYY-MM-DD");
    const tokenContents = replaceTemplateTokens(templateContents, periodStart, {
        format,
        nc: true,
        ncInfo: periodNcInfo,
    });
    const contentsWithFm = injectFrontmatter(tokenContents, granularity === "nc-phase" ? "phase" : granularity === "nc-month" ? "month" : granularity === "nc-season" ? "season" : "year", ncDateStr, gcDateStr);
    try {
        const createdFile = await vault.create(normalizedPath, contentsWithFm);
        if (IFoldInfo) {
            window.app.foldManager.save(createdFile, IFoldInfo);
        }
        return createdFile;
    }
    catch (err) {
        console.error(`Failed to create NC note: '${normalizedPath}'`, err);
        new obsidian.Notice(`Failed to create ${granularity} note: ${err.message || err}`);
        return undefined;
    }
}
// ── NC Note lookup ───────────────────────────────────────────────
function getNCNote(key, allNotes) {
    var _a;
    return (_a = allNotes[key]) !== null && _a !== void 0 ? _a : null;
}
// ── NC Note indexing ─────────────────────────────────────────────
function getAllNCNotes(granularity) {
    const notes = {};
    try {
        const { vault } = window.app;
        const getSettings = {
            "nc-phase": getNCPhaseSettings,
            "nc-month": getNCMonthSettings,
            "nc-season": getNCSeasonSettings,
            "nc-year": getNCYearSettings,
        };
        const { folder, format } = getSettings[granularity]();
        if (!folder)
            return notes;
        const folderObj = vault.getAbstractFileByPath(folder);
        if (!folderObj)
            return notes;
        obsidian.Vault.recurseChildren(folderObj, (note) => {
            if (note instanceof obsidian.TFile) {
                const basename = note.basename;
                const frontmatter = getFrontmatterFromCache(note);
                const parsed = parseNCFilename(basename, format, granularity, frontmatter);
                if (parsed) {
                    const key = buildNCKey(granularity, parsed.ny, parsed.nm, granularity === "nc-phase" ? parsed.phase : granularity === "nc-season" ? parsed.season : undefined);
                    notes[key] = note;
                }
            }
        });
    }
    catch (err) {
        console.log(`[New Calendar Suite] Failed to find ${granularity} notes folder`, err);
    }
    return notes;
}
// ── window.NCNotes API for DataviewJS / Templater ─────────────────
const NCNotesAPI = {
    createNCNote,
    getNCNote,
    getAllNCNotes,
    getNCPhaseNote: (date, all) => {
        const info = NC.getNCDate(window.moment(date));
        const key = buildNCKey("nc-phase", info.ny, info.nm, info.phase);
        return getNCNote(key, all);
    },
    getNCMonthNote: (date, all) => {
        const info = NC.getNCDate(window.moment(date));
        const key = buildNCKey("nc-month", info.ny, info.nm);
        return getNCNote(key, all);
    },
    getNCSeasonNote: (date, all) => {
        const info = NC.getNCDate(window.moment(date));
        const key = buildNCKey("nc-season", info.ny, info.nm, info.season);
        return getNCNote(key, all);
    },
    getNCYearNote: (date, all) => {
        const info = NC.getNCDate(window.moment(date));
        const key = buildNCKey("nc-year", info.ny, info.nm);
        return getNCNote(key, all);
    },
    getAllNCPhaseNotes: () => getAllNCNotes("nc-phase"),
    getAllNCMonthNotes: () => getAllNCNotes("nc-month"),
    getAllNCSeasonNotes: () => getAllNCNotes("nc-season"),
    getAllNCYearNotes: () => getAllNCNotes("nc-year"),
    NC,
};

const classList = (obj) => {
    return Object.entries(obj)
        .filter(([_k, v]) => !!v)
        .map(([k, _k]) => k);
};
function clamp(num, lowerBound, upperBound) {
    return Math.min(Math.max(lowerBound, num), upperBound);
}
function partition(arr, predicate) {
    const pass = [];
    const fail = [];
    arr.forEach((elem) => {
        if (predicate(elem)) {
            pass.push(elem);
        }
        else {
            fail.push(elem);
        }
    });
    return [pass, fail];
}
/**
 * Lookup the dateUID for a given file. It compares the filename
 * to the daily and weekly note formats to find a match.
 *
 * @param file
 */
function getDateUIDFromFile(file) {
    if (!file)
        return null;
    let date = getDateFromFile(file, "day");
    if (date)
        return getDateUID(date, "day");
    date = getDateFromFile(file, "week");
    if (date)
        return getDateUID(date, "week");
    date = getDateFromFile(file, "month");
    if (date)
        return getDateUID(date, "month");
    // Try NC granularities
    const ncReaders = {
        "nc-phase": getNCPhaseSettings,
        "nc-month": getNCMonthSettings,
        "nc-season": getNCSeasonSettings,
        "nc-year": getNCYearSettings,
    };
    for (const [g, reader] of Object.entries(ncReaders)) {
        try {
            const s = reader();
            if (s.format && s.folder) {
                const p = parseNCFilename(file.basename, s.format, g);
                if (p)
                    return `nc-${g}-${p.ny.toString().padStart(2, "0")}-${p.nm.toString().padStart(2, "0")}`;
            }
        }
        catch ( /* skip */_a) { /* skip */ }
    }
    return null;
}
function getWordCount(text) {
    const spaceDelimitedChars = /'’A-Za-z\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC/
        .source;
    const nonSpaceDelimitedWords = /\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u4E00-\u9FD5/.source;
    const nonSpaceDelimitedWordsOther = /[\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u4E00-\u9FD5]{1}/
        .source;
    const pattern = new RegExp([
        `(?:[0-9]+(?:(?:,|\\.)[0-9]+)*|[\\-${spaceDelimitedChars}])+`,
        nonSpaceDelimitedWords,
        nonSpaceDelimitedWordsOther,
    ].join("|"), "g");
    return (text.match(pattern) || []).length;
}

// ── Generalized note store factory ─────────────────────────────
function createNotesStore(name, getAllFn) {
    let hasError = false;
    const store = writable(null);
    return Object.assign({ reindex: () => {
            try {
                const notes = getAllFn();
                store.set(notes);
                hasError = false;
            }
            catch (err) {
                if (!hasError) {
                    console.log(`[New Calendar Suite] Failed to find ${name} notes folder`, err);
                }
                store.set({});
                hasError = true;
            }
        } }, store);
}
/**
 * Fallback: scan all markdown files in the vault, filtering by the given
 * format string. Used when the daily/weekly notes folder is not configured.
 */
function scanVaultForNotes(format, granularity) {
    const notes = {};
    const files = window.app.vault.getMarkdownFiles();
    for (const file of files) {
        const date = window.moment(file.basename, format, true);
        if (date.isValid()) {
            const key = `${granularity}-${date.clone().startOf(granularity).format()}`;
            notes[key] = file;
        }
    }
    return notes;
}
function createDailyNotesStore() {
    let hasError = false;
    const store = writable(null);
    return Object.assign({ reindex: () => {
            try {
                const notes = getAllDailyNotes_1();
                store.set(notes);
                hasError = false;
            }
            catch (err) {
                // Folder not configured — fall back to scanning entire vault
                try {
                    const { format } = getDailyNoteSettings();
                    const notes = scanVaultForNotes(format, "day");
                    store.set(notes);
                    hasError = false;
                }
                catch (e) {
                    if (!hasError)
                        console.log("[New Calendar Suite] Failed to find daily notes", e);
                    store.set({});
                    hasError = true;
                }
            }
        } }, store);
}
function createWeeklyNotesStore() {
    let hasError = false;
    const store = writable(null);
    return Object.assign({ reindex: () => {
            try {
                const notes = getAllWeeklyNotes_1();
                store.set(notes);
                hasError = false;
            }
            catch (err) {
                // Folder not configured — fall back to scanning entire vault
                try {
                    const { format } = getWeeklyNoteSettings();
                    const notes = scanVaultForNotes(format, "week");
                    store.set(notes);
                    hasError = false;
                }
                catch (e) {
                    if (!hasError)
                        console.log("[New Calendar Suite] Failed to find weekly notes", e);
                    store.set({});
                    hasError = true;
                }
            }
        } }, store);
}
const settings = writable(defaultSettings);
const dailyNotes = createDailyNotesStore();
const weeklyNotes = createWeeklyNotesStore();
const monthlyNotes = createNotesStore("monthly", getAllMonthlyNotes);
const quarterlyNotes = createNotesStore("quarterly", getAllQuarterlyNotes);
const yearlyNotes = createNotesStore("yearly", getAllYearlyNotes);
const ncPhaseNotes = createNotesStore("nc-phase", () => getAllNCNotes("nc-phase"));
const ncMonthNotes = createNotesStore("nc-month", () => getAllNCNotes("nc-month"));
const ncSeasonNotes = createNotesStore("nc-season", () => getAllNCNotes("nc-season"));
const ncYearNotes = createNotesStore("nc-year", () => getAllNCNotes("nc-year"));
function createSelectedFileStore() {
    const store = writable(null);
    return Object.assign({ setFile: (file) => {
            const id = getDateUIDFromFile(file);
            store.set(id);
        } }, store);
}
const activeFile = createSelectedFileStore();
const holidays = writable({});

/**
 * Migrate legacy settings from:
 * 1. Periodic Notes plugin data.json
 * 2. Old calendar plugin weekly note settings
 * 3. Core daily-notes plugin options
 */
async function migrateIfNeeded(plugin) {
    var _a, _b;
    if (plugin.options.hasMigratedLegacySettings)
        return;
    const adapter = plugin.app.vault.adapter;
    let migrated = false;
    // 1. Try to read periodic-notes data.json
    try {
        const pnPath = ".obsidian/plugins/periodic-notes/data.json";
        if (await adapter.exists(pnPath)) {
            const content = await adapter.read(pnPath);
            const pnSettings = JSON.parse(content);
            if (pnSettings.daily) {
                plugin.options.daily = Object.assign(Object.assign({}, plugin.options.daily), pnSettings.daily);
            }
            if (pnSettings.weekly) {
                plugin.options.weekly = Object.assign(Object.assign({}, plugin.options.weekly), pnSettings.weekly);
            }
            if (pnSettings.monthly) {
                plugin.options.monthly = Object.assign(Object.assign({}, plugin.options.monthly), pnSettings.monthly);
            }
            if (pnSettings.quarterly) {
                plugin.options.quarterly = Object.assign(Object.assign({}, plugin.options.quarterly), pnSettings.quarterly);
            }
            if (pnSettings.yearly) {
                plugin.options.yearly = Object.assign(Object.assign({}, plugin.options.yearly), pnSettings.yearly);
            }
            migrated = true;
        }
    }
    catch (e) {
        console.log("[New Calendar Suite] No periodic-notes settings to migrate");
    }
    // 2. Check for old calendar plugin weekly note settings in our own data
    try {
        const oldOptions = plugin.options;
        // If old flat fields exist, migrate them to new nested format
        if (oldOptions.weeklyNoteFormat || oldOptions.weeklyNoteTemplate || oldOptions.weeklyNoteFolder) {
            if (!plugin.options.weekly.enabled) {
                plugin.options.weekly = {
                    enabled: true,
                    format: oldOptions.weeklyNoteFormat || plugin.options.weekly.format,
                    template: oldOptions.weeklyNoteTemplate || plugin.options.weekly.template,
                    folder: oldOptions.weeklyNoteFolder || plugin.options.weekly.folder,
                };
            }
            migrated = true;
        }
        // Migrate showWeeklyNote flag
        if (oldOptions.showWeeklyNote && !plugin.options.weekly.enabled) {
            plugin.options.weekly.enabled = true;
        }
    }
    catch (e) {
        // ignore
    }
    // 3. Seed daily from core daily-notes plugin
    try {
        const dailyNotesPlugin = (_b = (_a = plugin.app.internalPlugins) === null || _a === void 0 ? void 0 : _a.getPluginById("daily-notes")) === null || _b === void 0 ? void 0 : _b.instance;
        if (dailyNotesPlugin === null || dailyNotesPlugin === void 0 ? void 0 : dailyNotesPlugin.options) {
            const opts = dailyNotesPlugin.options;
            if (opts.format && !plugin.options.daily.format) {
                plugin.options.daily.format = opts.format;
            }
            if (opts.folder && !plugin.options.daily.folder) {
                plugin.options.daily.folder = opts.folder;
            }
            if (opts.template && !plugin.options.daily.template) {
                plugin.options.daily.template = opts.template;
            }
        }
    }
    catch (e) {
        // ignore
    }
    plugin.options.hasMigratedLegacySettings = true;
    await plugin.saveData(plugin.options);
    if (migrated) {
        console.log("[New Calendar Suite] Migrated legacy settings from periodic-notes and calendar plugins");
    }
}

class ConfirmationModal extends obsidian.Modal {
    constructor(app, config) {
        super(app);
        const { cta, onAccept, text, title } = config;
        this.contentEl.createEl("h2", { text: title });
        this.contentEl.createEl("p", { text });
        this.contentEl.createDiv("modal-button-container", (buttonsEl) => {
            buttonsEl
                .createEl("button", { text: "Never mind" })
                .addEventListener("click", () => this.close());
            buttonsEl
                .createEl("button", {
                cls: "mod-cta",
                text: cta,
            })
                .addEventListener("click", async (e) => {
                await onAccept(e);
                this.close();
            });
        });
    }
}
function createConfirmationDialog({ cta, onAccept, text, title, }) {
    new ConfirmationModal(window.app, { cta, onAccept, text, title }).open();
}

/**
 * Create a Daily Note for a given date.
 * Checks filesystem first — if the file already exists on disk (e.g. store
 * hasn't reindexed yet), opens it directly without showing the "Create?" dialog.
 */
async function tryToCreateDailyNote(date, inNewSplit, settings, cb) {
    const { workspace, vault } = window.app;
    const { format, folder, template } = getDailyNoteSettings();
    const filename = date.format(format);
    const normalizedPath = await getNotePath(folder, filename);
    // ── Check filesystem first — file may exist even if store isn't indexed ──
    const existingFile = vault.getAbstractFileByPath(normalizedPath);
    if (existingFile && existingFile instanceof TFile) {
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile, { active: true });
        cb === null || cb === void 0 ? void 0 : cb(existingFile);
        return;
    }
    // ── File truly doesn't exist — create it ──
    const createFile = async () => {
        try {
            const [templateContents, IFoldInfo] = await getTemplateInfo(template);
            const contents = replaceTemplateTokens(templateContents, date, { format });
            const createdFile = await vault.create(normalizedPath, contents);
            if (IFoldInfo) {
                window.app.foldManager.save(createdFile, IFoldInfo);
            }
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(createdFile, { active: true });
            cb === null || cb === void 0 ? void 0 : cb(createdFile);
        }
        catch (err) {
            console.error(`Failed to create daily note: '${normalizedPath}'`, err);
            // Last-resort fallback: re-check filesystem in case of race
            const file = vault.getAbstractFileByPath(normalizedPath);
            if (file instanceof TFile) {
                const leaf = inNewSplit
                    ? workspace.splitActiveLeaf()
                    : workspace.getUnpinnedLeaf();
                await leaf.openFile(file, { active: true });
                cb === null || cb === void 0 ? void 0 : cb(file);
            }
        }
    };
    if (settings.shouldConfirmBeforeCreate) {
        createConfirmationDialog({
            cta: "Create",
            onAccept: createFile,
            text: `File ${filename} does not exist. Would you like to create it?`,
            title: "New Daily Note",
        });
    }
    else {
        await createFile();
    }
}

/**
 * Create a Weekly Note for a given date.
 * Checks filesystem first — if the file already exists on disk (e.g. store
 * hasn't reindexed yet), opens it directly without showing the "Create?" dialog.
 */
async function tryToCreateWeeklyNote(date, inNewSplit, settings, cb) {
    const { workspace, vault } = window.app;
    const { format, folder, template } = getWeeklyNoteSettings();
    const filename = date.format(format);
    const normalizedPath = await getNotePath(folder, filename);
    // ── Check filesystem first — file may exist even if store isn't indexed ──
    const existingFile = vault.getAbstractFileByPath(normalizedPath);
    if (existingFile && existingFile instanceof TFile) {
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile, { active: true });
        cb === null || cb === void 0 ? void 0 : cb(existingFile);
        return;
    }
    // ── File truly doesn't exist — create it ──
    const createFile = async () => {
        try {
            const [templateContents, IFoldInfo] = await getTemplateInfo(template);
            const contents = replaceTemplateTokens(templateContents, date, { format });
            const createdFile = await vault.create(normalizedPath, contents);
            if (IFoldInfo) {
                window.app.foldManager.save(createdFile, IFoldInfo);
            }
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(createdFile, { active: true });
            cb === null || cb === void 0 ? void 0 : cb(createdFile);
        }
        catch (err) {
            console.error(`Failed to create weekly note: '${normalizedPath}'`, err);
            // Last-resort fallback: re-check filesystem in case of race
            const file = vault.getAbstractFileByPath(normalizedPath);
            if (file instanceof TFile) {
                const leaf = inNewSplit
                    ? workspace.splitActiveLeaf()
                    : workspace.getUnpinnedLeaf();
                await leaf.openFile(file, { active: true });
                cb === null || cb === void 0 ? void 0 : cb(file);
            }
        }
    };
    if (settings.shouldConfirmBeforeCreate) {
        createConfirmationDialog({
            cta: "Create",
            onAccept: createFile,
            text: `File ${filename} does not exist. Would you like to create it?`,
            title: "New Weekly Note",
        });
    }
    else {
        await createFile();
    }
}

/* src/ui/CalendarGrid.svelte generated by Svelte v3.35.0 */

const { document: document_1 } = globals;

function add_css() {
	var style = element("style");
	style.id = "svelte-1vcc0d-style";
	style.textContent = ".calendar-container.svelte-1vcc0d.svelte-1vcc0d{padding:10px;user-select:none;background-color:var(--background-primary);color:var(--text-normal)}.calendar-top-bar.svelte-1vcc0d.svelte-1vcc0d{position:sticky;top:0;background-color:var(--background-primary);z-index:10;padding-bottom:4px}.calendar-header.svelte-1vcc0d.svelte-1vcc0d{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:6px;padding-top:2px;padding-bottom:4px}.month-matrix.svelte-1vcc0d.svelte-1vcc0d{display:grid;grid-template-rows:repeat(2, 1fr);grid-template-columns:repeat(8, 1fr);gap:2px}.calendar-title-row.svelte-1vcc0d.svelte-1vcc0d{text-align:center;margin-bottom:4px;font-weight:bold;font-size:1.1em;color:var(--text-accent);white-space:nowrap;min-width:22em;display:flex;align-items:center;gap:6px;justify-content:center;flex:1}.nc-month-text.svelte-1vcc0d.svelte-1vcc0d{white-space:nowrap}.calendar-gc-range.svelte-1vcc0d.svelte-1vcc0d{text-align:center;font-size:0.75em;color:var(--text-faint);margin-bottom:4px}.month-dot.svelte-1vcc0d.svelte-1vcc0d{width:6px;height:6px;border-radius:50%;background-color:var(--dot-color);opacity:0.25;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1)}.month-dot.active.svelte-1vcc0d.svelte-1vcc0d{opacity:1;transform:scale(1.4);box-shadow:0 0 5px var(--dot-color)}.nav-btn.svelte-1vcc0d.svelte-1vcc0d{cursor:pointer;background:none;border:1px solid var(--background-modifier-border);padding:2px 8px;border-radius:4px;color:var(--text-muted);font-size:0.9em}.nav-btn.svelte-1vcc0d.svelte-1vcc0d:hover{background-color:var(--background-modifier-hover);color:var(--text-normal)}.nav-btn-year.svelte-1vcc0d.svelte-1vcc0d{font-weight:bold;font-size:0.9em}.nav-btn-today.svelte-1vcc0d.svelte-1vcc0d{margin-left:6px;font-size:0.8em}.gc-title-text.svelte-1vcc0d.svelte-1vcc0d{color:var(--text-accent)}.nc-year-text.svelte-1vcc0d.svelte-1vcc0d{cursor:pointer;color:var(--text-normal);transition:opacity 0.15s}.nc-year-text.svelte-1vcc0d.svelte-1vcc0d:hover{opacity:0.7}.nc-season-text.svelte-1vcc0d.svelte-1vcc0d{cursor:pointer;font-weight:bold;transition:opacity 0.15s}.nc-season-text.svelte-1vcc0d.svelte-1vcc0d:hover{opacity:0.7}.nc-month-text.svelte-1vcc0d.svelte-1vcc0d{cursor:pointer;font-weight:bold;white-space:nowrap;transition:opacity 0.15s}.nc-month-text.svelte-1vcc0d.svelte-1vcc0d:hover{opacity:0.7}.nc-sep.svelte-1vcc0d.svelte-1vcc0d{color:var(--text-faint);font-weight:normal}.nc-phase-buttons.svelte-1vcc0d.svelte-1vcc0d{display:flex;justify-content:center;gap:6px;margin:4px 0 8px 0}.calendar-subheader.svelte-1vcc0d.svelte-1vcc0d{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px}.calendar-nav.svelte-1vcc0d.svelte-1vcc0d{display:flex;align-items:center;gap:2px;flex-shrink:0}.calendar-grid.svelte-1vcc0d.svelte-1vcc0d{width:100%;border-collapse:collapse;table-layout:fixed}.calendar-grid.svelte-1vcc0d th.svelte-1vcc0d{font-size:0.75em;color:var(--text-faint);text-transform:uppercase;font-weight:normal;padding-bottom:8px;width:13.1%}.calendar-grid-head.svelte-1vcc0d.svelte-1vcc0d{margin-bottom:0}.calendar-grid-body.svelte-1vcc0d.svelte-1vcc0d{margin-top:0}.week-num-header.svelte-1vcc0d.svelte-1vcc0d{width:8% !important}.week-num.svelte-1vcc0d.svelte-1vcc0d{font-size:0.7em;color:var(--text-faint);vertical-align:middle !important}.week-num-stack.svelte-1vcc0d.svelte-1vcc0d{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.2}.nc-week.svelte-1vcc0d.svelte-1vcc0d{font-size:1.3em;font-weight:bold}.gc-week.svelte-1vcc0d.svelte-1vcc0d{font-size:0.85em;color:var(--text-faint)}.calendar-grid.svelte-1vcc0d td.svelte-1vcc0d{cursor:pointer;vertical-align:top;height:92px;border:1px solid transparent;transition:background-color 0.1s;overflow:hidden}.calendar-grid.svelte-1vcc0d td.svelte-1vcc0d:hover{background-color:var(--background-modifier-hover);border-radius:4px}.day-content.svelte-1vcc0d.svelte-1vcc0d{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;padding:4px 2px}.primary-date.svelte-1vcc0d.svelte-1vcc0d{font-size:1em;line-height:1.2}.secondary-date.svelte-1vcc0d.svelte-1vcc0d{font-size:0.7em;line-height:1.2;margin-top:1px;white-space:nowrap}.not-current-month.svelte-1vcc0d.svelte-1vcc0d{opacity:0.3}.is-holiday.svelte-1vcc0d.svelte-1vcc0d{background-color:rgba(255, 0, 0, 0.05)}.is-transfer-workday.svelte-1vcc0d.svelte-1vcc0d{background-color:rgba(var(--text-muted-rgb), 0.1)}tr.phase-start.svelte-1vcc0d td.svelte-1vcc0d{border-top:1px solid var(--text-accent) !important}.is-today.svelte-1vcc0d.svelte-1vcc0d{box-shadow:inset 0 0 0 2px var(--text-accent) !important;border-radius:4px;z-index:1;position:relative}.is-today.svelte-1vcc0d .primary-date.svelte-1vcc0d{color:var(--text-accent);font-weight:bold}.is-selected.svelte-1vcc0d.svelte-1vcc0d{box-shadow:inset 0 0 0 1px var(--text-accent) !important;border-radius:4px;position:relative;z-index:0}.holiday-name.svelte-1vcc0d.svelte-1vcc0d{font-size:0.65em;line-height:1.1;color:var(--text-accent);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;font-weight:500}.dots.svelte-1vcc0d.svelte-1vcc0d{display:flex;justify-content:center;gap:2px;margin-top:2px;min-height:6px}.dot.svelte-1vcc0d.svelte-1vcc0d{width:4px;height:4px;border-radius:50%;background-color:var(--dot-color);border:1px solid var(--dot-color)}.dot.hollow.svelte-1vcc0d.svelte-1vcc0d{background-color:transparent !important}.dot.overflow-dot.svelte-1vcc0d.svelte-1vcc0d{width:6px;height:6px;border-radius:1px;background-color:var(--text-accent);border-color:var(--text-accent);transform:rotate(45deg)}.day-info.svelte-1vcc0d.svelte-1vcc0d{font-size:0.65em;line-height:1.1;margin-top:2px;color:var(--text-muted);text-align:center;word-break:break-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.nc-phase-chip.svelte-1vcc0d.svelte-1vcc0d{font-size:0.55em;line-height:1;padding:1px 3px;border-radius:3px;font-weight:600;margin-top:1px;opacity:0.7;text-align:center}";
	append(document_1.head, style);
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[42] = list[i];
	child_ctx[44] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[45] = list[i];
	child_ctx[47] = i;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[48] = list[i];
	return child_ctx;
}

function get_each_context_3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[45] = list[i];
	return child_ctx;
}

function get_each_context_4(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[53] = list[i];
	return child_ctx;
}

function get_each_context_5(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[56] = list[i];
	return child_ctx;
}

// (291:21) 
function create_if_block_12(ctx) {
	let span0;

	let t0_value = (/*ncInfo*/ ctx[10].ny === 1
	? "元年"
	: `${numToChinese(/*ncInfo*/ ctx[10].ny)}年`) + "";

	let t0;
	let t1;
	let span1;
	let t3;
	let span2;
	let t4;
	let t5_value = numToChinese(/*ncInfo*/ ctx[10].season) + "";
	let t5;
	let t6;
	let t7;
	let span3;
	let t9;
	let span4;
	let t10_value = numToChinese(/*ncInfo*/ ctx[10].nm) + "";
	let t10;
	let t11;
	let mounted;
	let dispose;

	return {
		c() {
			span0 = element("span");
			t0 = text(t0_value);
			t1 = space();
			span1 = element("span");
			span1.textContent = "·";
			t3 = space();
			span2 = element("span");
			t4 = text("第");
			t5 = text(t5_value);
			t6 = text("季");
			t7 = space();
			span3 = element("span");
			span3.textContent = "·";
			t9 = space();
			span4 = element("span");
			t10 = text(t10_value);
			t11 = text("月");
			attr(span0, "class", "nc-year-text svelte-1vcc0d");
			attr(span0, "title", "Open NC Year note");
			attr(span1, "class", "nc-sep svelte-1vcc0d");
			attr(span2, "class", "nc-season-text svelte-1vcc0d");
			set_style(span2, "color", /*ncInfo*/ ctx[10].color);
			attr(span2, "title", "Open NC Season note");
			attr(span3, "class", "nc-sep svelte-1vcc0d");
			attr(span4, "class", "nc-month-text svelte-1vcc0d");
			set_style(span4, "color", /*ncInfo*/ ctx[10].color);
			attr(span4, "title", "Open NC Month note");
		},
		m(target, anchor) {
			insert(target, span0, anchor);
			append(span0, t0);
			insert(target, t1, anchor);
			insert(target, span1, anchor);
			insert(target, t3, anchor);
			insert(target, span2, anchor);
			append(span2, t4);
			append(span2, t5);
			append(span2, t6);
			insert(target, t7, anchor);
			insert(target, span3, anchor);
			insert(target, t9, anchor);
			insert(target, span4, anchor);
			append(span4, t10);
			append(span4, t11);

			if (!mounted) {
				dispose = [
					listen(span0, "click", /*click_handler*/ ctx[29]),
					listen(span2, "click", /*click_handler_1*/ ctx[30]),
					listen(span4, "click", /*click_handler_2*/ ctx[31])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*ncInfo*/ 1024 && t0_value !== (t0_value = (/*ncInfo*/ ctx[10].ny === 1
			? "元年"
			: `${numToChinese(/*ncInfo*/ ctx[10].ny)}年`) + "")) set_data(t0, t0_value);

			if (dirty[0] & /*ncInfo*/ 1024 && t5_value !== (t5_value = numToChinese(/*ncInfo*/ ctx[10].season) + "")) set_data(t5, t5_value);

			if (dirty[0] & /*ncInfo*/ 1024) {
				set_style(span2, "color", /*ncInfo*/ ctx[10].color);
			}

			if (dirty[0] & /*ncInfo*/ 1024 && t10_value !== (t10_value = numToChinese(/*ncInfo*/ ctx[10].nm) + "")) set_data(t10, t10_value);

			if (dirty[0] & /*ncInfo*/ 1024) {
				set_style(span4, "color", /*ncInfo*/ ctx[10].color);
			}
		},
		d(detaching) {
			if (detaching) detach(span0);
			if (detaching) detach(t1);
			if (detaching) detach(span1);
			if (detaching) detach(t3);
			if (detaching) detach(span2);
			if (detaching) detach(t7);
			if (detaching) detach(span3);
			if (detaching) detach(t9);
			if (detaching) detach(span4);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (289:4) {#if mode === "GC"}
function create_if_block_11(ctx) {
	let span;
	let t;

	return {
		c() {
			span = element("span");
			t = text(/*title*/ ctx[12]);
			attr(span, "class", "gc-title-text svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*title*/ 4096) set_data(t, /*title*/ ctx[12]);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (307:2) {#if mode === "NC" && ncInfo}
function create_if_block_10(ctx) {
	let div;
	let t0_value = (/*ncInfo*/ ctx[10].gcStart || "") + "";
	let t0;
	let t1;
	let t2_value = (/*ncInfo*/ ctx[10].gcEnd || "") + "";
	let t2;

	return {
		c() {
			div = element("div");
			t0 = text(t0_value);
			t1 = text(" – ");
			t2 = text(t2_value);
			attr(div, "class", "calendar-gc-range svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t0);
			append(div, t1);
			append(div, t2);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*ncInfo*/ 1024 && t0_value !== (t0_value = (/*ncInfo*/ ctx[10].gcStart || "") + "")) set_data(t0, t0_value);
			if (dirty[0] & /*ncInfo*/ 1024 && t2_value !== (t2_value = (/*ncInfo*/ ctx[10].gcEnd || "") + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (317:6) {#if mode === "NC" && ncInfo}
function create_if_block_9(ctx) {
	let button;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			button.textContent = "季-";
			attr(button, "class", "nav-btn svelte-1vcc0d");
			attr(button, "title", "Previous season");
		},
		m(target, anchor) {
			insert(target, button, anchor);

			if (!mounted) {
				dispose = listen(button, "click", /*prevSeason*/ ctx[20]);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (323:4) {#if mode === "NC" && ncInfo}
function create_if_block_8(ctx) {
	let span;
	let each_value_5 = /*monthIndices*/ ctx[14];
	let each_blocks = [];

	for (let i = 0; i < each_value_5.length; i += 1) {
		each_blocks[i] = create_each_block_5(get_each_context_5(ctx, each_value_5, i));
	}

	return {
		c() {
			span = element("span");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(span, "class", "month-matrix svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, span, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(span, null);
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*monthIndices, ncInfo*/ 17408) {
				each_value_5 = /*monthIndices*/ ctx[14];
				let i;

				for (i = 0; i < each_value_5.length; i += 1) {
					const child_ctx = get_each_context_5(ctx, each_value_5, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_5(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(span, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_5.length;
			}
		},
		d(detaching) {
			if (detaching) detach(span);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (325:8) {#each monthIndices as mIdx}
function create_each_block_5(ctx) {
	let span;

	return {
		c() {
			span = element("span");
			attr(span, "class", "month-dot svelte-1vcc0d");
			set_style(span, "--dot-color", ncMonthColour[/*mIdx*/ ctx[56]]);
			attr(span, "title", "" + (parseInt(/*mIdx*/ ctx[56]) + "月"));
			toggle_class(span, "active", /*ncInfo*/ ctx[10].nm === parseInt(/*mIdx*/ ctx[56]));
		},
		m(target, anchor) {
			insert(target, span, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*ncInfo, monthIndices*/ 17408) {
				toggle_class(span, "active", /*ncInfo*/ ctx[10].nm === parseInt(/*mIdx*/ ctx[56]));
			}
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (331:6) {#if mode === "NC" && ncInfo}
function create_if_block_7(ctx) {
	let button;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			button.textContent = "季+";
			attr(button, "class", "nav-btn svelte-1vcc0d");
			attr(button, "title", "Next season");
		},
		m(target, anchor) {
			insert(target, button, anchor);

			if (!mounted) {
				dispose = listen(button, "click", /*nextSeason*/ ctx[21]);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (340:4) {#if mode === "NC" && ncInfo}
function create_if_block_6(ctx) {
	let div;
	let each_value_4 = [1, 2, 3, 4];
	let each_blocks = [];

	for (let i = 0; i < 4; i += 1) {
		each_blocks[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < 4; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "nc-phase-buttons svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < 4; i += 1) {
				each_blocks[i].m(div, null);
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*ncInfo, onClickNCPhase*/ 1280) {
				each_value_4 = [1, 2, 3, 4];
				let i;

				for (i = 0; i < 4; i += 1) {
					const child_ctx = get_each_context_4(ctx, each_value_4, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_4(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < 4; i += 1) {
					each_blocks[i].d(1);
				}
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (342:8) {#each [1, 2, 3, 4] as phase}
function create_each_block_4(ctx) {
	let button;
	let t0;
	let t1;
	let button_style_value;
	let mounted;
	let dispose;

	function click_handler_3() {
		return /*click_handler_3*/ ctx[32](/*phase*/ ctx[53]);
	}

	return {
		c() {
			button = element("button");
			t0 = text("P");
			t1 = text(/*phase*/ ctx[53]);
			attr(button, "class", "nc-phase-btn");

			attr(button, "style", button_style_value = /*ncInfo*/ ctx[10].phase === /*phase*/ ctx[53]
			? "background-color:" + /*ncInfo*/ ctx[10].color
			: "");

			attr(button, "title", "Open Phase " + /*phase*/ ctx[53] + " note");
			toggle_class(button, "active", /*ncInfo*/ ctx[10].phase === /*phase*/ ctx[53]);
		},
		m(target, anchor) {
			insert(target, button, anchor);
			append(button, t0);
			append(button, t1);

			if (!mounted) {
				dispose = listen(button, "click", click_handler_3);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*ncInfo*/ 1024 && button_style_value !== (button_style_value = /*ncInfo*/ ctx[10].phase === /*phase*/ ctx[53]
			? "background-color:" + /*ncInfo*/ ctx[10].color
			: "")) {
				attr(button, "style", button_style_value);
			}

			if (dirty[0] & /*ncInfo*/ 1024) {
				toggle_class(button, "active", /*ncInfo*/ ctx[10].phase === /*phase*/ ctx[53]);
			}
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (352:8) {#if showWeekNums}
function create_if_block_5(ctx) {
	let th;

	return {
		c() {
			th = element("th");
			attr(th, "class", "week-num-header svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, th, anchor);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (355:8) {#each weekDays as day}
function create_each_block_3(ctx) {
	let th;
	let t_value = /*day*/ ctx[45] + "";
	let t;

	return {
		c() {
			th = element("th");
			t = text(t_value);
			attr(th, "class", "svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, th, anchor);
			append(th, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*weekDays*/ 8192 && t_value !== (t_value = /*day*/ ctx[45] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (366:10) {#if showWeekNums}
function create_if_block_3(ctx) {
	let td;
	let mounted;
	let dispose;

	function select_block_type_1(ctx, dirty) {
		if (/*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10]) return create_if_block_4;
		return create_else_block;
	}

	let current_block_type = select_block_type_1(ctx);
	let if_block = current_block_type(ctx);

	function click_handler_4() {
		return /*click_handler_4*/ ctx[33](/*week*/ ctx[42]);
	}

	return {
		c() {
			td = element("td");
			if_block.c();
			attr(td, "class", "week-num svelte-1vcc0d");
			toggle_class(td, "is-selected", /*selectedId*/ ctx[1] === getDateUID(/*week*/ ctx[42][0].date, "week"));
		},
		m(target, anchor) {
			insert(target, td, anchor);
			if_block.m(td, null);

			if (!mounted) {
				dispose = listen(td, "click", click_handler_4);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(td, null);
				}
			}

			if (dirty[0] & /*selectedId, days*/ 2050) {
				toggle_class(td, "is-selected", /*selectedId*/ ctx[1] === getDateUID(/*week*/ ctx[42][0].date, "week"));
			}
		},
		d(detaching) {
			if (detaching) detach(td);
			if_block.d();
			mounted = false;
			dispose();
		}
	};
}

// (381:14) {:else}
function create_else_block(ctx) {
	let t_value = /*week*/ ctx[42][0].date.format("ww") + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days*/ 2048 && t_value !== (t_value = /*week*/ ctx[42][0].date.format("ww") + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (372:14) {#if mode === "NC" && ncInfo}
function create_if_block_4(ctx) {
	let div2;
	let div0;
	let t0_value = NC.getNCWeekOfMonth(/*week*/ ctx[42][0].date, /*ncInfo*/ ctx[10].ny, /*ncInfo*/ ctx[10].nm) + "";
	let t0;
	let t1;
	let div1;
	let t2_value = /*week*/ ctx[42][0].date.format("ww") + "";
	let t2;

	return {
		c() {
			div2 = element("div");
			div0 = element("div");
			t0 = text(t0_value);
			t1 = space();
			div1 = element("div");
			t2 = text(t2_value);
			attr(div0, "class", "nc-week svelte-1vcc0d");
			set_style(div0, "color", /*ncInfo*/ ctx[10].color);
			attr(div1, "class", "gc-week svelte-1vcc0d");
			attr(div2, "class", "week-num-stack svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, div0);
			append(div0, t0);
			append(div2, t1);
			append(div2, div1);
			append(div1, t2);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days, ncInfo*/ 3072 && t0_value !== (t0_value = NC.getNCWeekOfMonth(/*week*/ ctx[42][0].date, /*ncInfo*/ ctx[10].ny, /*ncInfo*/ ctx[10].nm) + "")) set_data(t0, t0_value);

			if (dirty[0] & /*ncInfo*/ 1024) {
				set_style(div0, "color", /*ncInfo*/ ctx[10].color);
			}

			if (dirty[0] & /*days*/ 2048 && t2_value !== (t2_value = /*week*/ ctx[42][0].date.format("ww") + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(div2);
		}
	};
}

// (404:16) {#if day.metadata.holidayName}
function create_if_block_2(ctx) {
	let div;
	let t_value = /*day*/ ctx[45].metadata.holidayName + "";
	let t;

	return {
		c() {
			div = element("div");
			t = text(t_value);
			attr(div, "class", "holiday-name svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days*/ 2048 && t_value !== (t_value = /*day*/ ctx[45].metadata.holidayName + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (407:16) {#if mode === "NC" && day.isPhaseStart && day.isCurrentMonth}
function create_if_block_1(ctx) {
	let div;
	let t0;
	let t1_value = /*day*/ ctx[45].ncPhaseVal + "";
	let t1;

	return {
		c() {
			div = element("div");
			t0 = text("P");
			t1 = text(t1_value);
			attr(div, "class", "nc-phase-chip svelte-1vcc0d");
			set_style(div, "background", /*day*/ ctx[45].nc.color);
			set_style(div, "color", "#fff");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t0);
			append(div, t1);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days*/ 2048 && t1_value !== (t1_value = /*day*/ ctx[45].ncPhaseVal + "")) set_data(t1, t1_value);

			if (dirty[0] & /*days*/ 2048) {
				set_style(div, "background", /*day*/ ctx[45].nc.color);
			}
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (411:18) {#each day.metadata.dots as dot}
function create_each_block_2(ctx) {
	let span;
	let span_class_value;

	return {
		c() {
			span = element("span");
			attr(span, "class", span_class_value = "dot " + (/*dot*/ ctx[48].className || "") + " svelte-1vcc0d");

			set_style(span, "--dot-color", /*dot*/ ctx[48].color === "default"
			? "var(--text-muted)"
			: /*dot*/ ctx[48].color);

			toggle_class(span, "hollow", !/*dot*/ ctx[48].isFilled);
		},
		m(target, anchor) {
			insert(target, span, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days*/ 2048 && span_class_value !== (span_class_value = "dot " + (/*dot*/ ctx[48].className || "") + " svelte-1vcc0d")) {
				attr(span, "class", span_class_value);
			}

			if (dirty[0] & /*days*/ 2048) {
				set_style(span, "--dot-color", /*dot*/ ctx[48].color === "default"
				? "var(--text-muted)"
				: /*dot*/ ctx[48].color);
			}

			if (dirty[0] & /*days, days*/ 2048) {
				toggle_class(span, "hollow", !/*dot*/ ctx[48].isFilled);
			}
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (419:16) {#if day.metadata.info}
function create_if_block(ctx) {
	let div;
	let t_value = /*day*/ ctx[45].metadata.info + "";
	let t;

	return {
		c() {
			div = element("div");
			t = text(t_value);
			attr(div, "class", "day-info svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days*/ 2048 && t_value !== (t_value = /*day*/ ctx[45].metadata.info + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (386:10) {#each week as day, j}
function create_each_block_1(ctx) {
	let td;
	let div3;
	let div0;

	let t0_value = (/*mode*/ ctx[0] === "GC"
	? /*day*/ ctx[45].date.date()
	: /*day*/ ctx[45].nc.pNd) + "";

	let t0;
	let t1;
	let div1;

	let t2_value = getSecondaryText(
		/*day*/ ctx[45],
		/*j*/ ctx[47] > 0
		? /*week*/ ctx[42][/*j*/ ctx[47] - 1]
		: /*i*/ ctx[44] > 0
			? /*days*/ ctx[11][/*i*/ ctx[44] - 1][6]
			: null,
		/*mode*/ ctx[0]
	) + "";

	let t2;
	let t3;
	let t4;
	let t5;
	let div2;
	let t6;
	let mounted;
	let dispose;
	let if_block0 = /*day*/ ctx[45].metadata.holidayName && create_if_block_2(ctx);
	let if_block1 = /*mode*/ ctx[0] === "NC" && /*day*/ ctx[45].isPhaseStart && /*day*/ ctx[45].isCurrentMonth && create_if_block_1(ctx);
	let each_value_2 = /*day*/ ctx[45].metadata.dots;
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	let if_block2 = /*day*/ ctx[45].metadata.info && create_if_block(ctx);

	function click_handler_5(...args) {
		return /*click_handler_5*/ ctx[34](/*day*/ ctx[45], ...args);
	}

	function mouseenter_handler(...args) {
		return /*mouseenter_handler*/ ctx[35](/*day*/ ctx[45], ...args);
	}

	function contextmenu_handler(...args) {
		return /*contextmenu_handler*/ ctx[36](/*day*/ ctx[45], ...args);
	}

	return {
		c() {
			td = element("td");
			div3 = element("div");
			div0 = element("div");
			t0 = text(t0_value);
			t1 = space();
			div1 = element("div");
			t2 = text(t2_value);
			t3 = space();
			if (if_block0) if_block0.c();
			t4 = space();
			if (if_block1) if_block1.c();
			t5 = space();
			div2 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t6 = space();
			if (if_block2) if_block2.c();
			attr(div0, "class", "primary-date svelte-1vcc0d");

			set_style(div0, "color", /*mode*/ ctx[0] === "NC"
			? /*day*/ ctx[45].nc.color
			: "inherit");

			attr(div1, "class", "secondary-date svelte-1vcc0d");

			set_style(div1, "color", /*mode*/ ctx[0] === "GC"
			? /*day*/ ctx[45].nc.color
			: "inherit");

			attr(div2, "class", "dots svelte-1vcc0d");
			attr(div3, "class", "day-content svelte-1vcc0d");
			attr(td, "class", "svelte-1vcc0d");
			toggle_class(td, "is-today", /*day*/ ctx[45].isToday);
			toggle_class(td, "is-selected", /*selectedId*/ ctx[1] === getDateUID(/*day*/ ctx[45].date, "day"));
			toggle_class(td, "not-current-month", !/*day*/ ctx[45].isCurrentMonth);
			toggle_class(td, "is-holiday", /*day*/ ctx[45].dayType === "public_holiday");
			toggle_class(td, "is-transfer-workday", /*day*/ ctx[45].dayType === "transfer_workday");
		},
		m(target, anchor) {
			insert(target, td, anchor);
			append(td, div3);
			append(div3, div0);
			append(div0, t0);
			append(div3, t1);
			append(div3, div1);
			append(div1, t2);
			append(div3, t3);
			if (if_block0) if_block0.m(div3, null);
			append(div3, t4);
			if (if_block1) if_block1.m(div3, null);
			append(div3, t5);
			append(div3, div2);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div2, null);
			}

			append(div3, t6);
			if (if_block2) if_block2.m(div3, null);

			if (!mounted) {
				dispose = [
					listen(td, "click", click_handler_5),
					listen(td, "mouseenter", mouseenter_handler),
					listen(td, "contextmenu", contextmenu_handler)
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*mode, days*/ 2049 && t0_value !== (t0_value = (/*mode*/ ctx[0] === "GC"
			? /*day*/ ctx[45].date.date()
			: /*day*/ ctx[45].nc.pNd) + "")) set_data(t0, t0_value);

			if (dirty[0] & /*mode, days*/ 2049) {
				set_style(div0, "color", /*mode*/ ctx[0] === "NC"
				? /*day*/ ctx[45].nc.color
				: "inherit");
			}

			if (dirty[0] & /*days, mode*/ 2049 && t2_value !== (t2_value = getSecondaryText(
				/*day*/ ctx[45],
				/*j*/ ctx[47] > 0
				? /*week*/ ctx[42][/*j*/ ctx[47] - 1]
				: /*i*/ ctx[44] > 0
					? /*days*/ ctx[11][/*i*/ ctx[44] - 1][6]
					: null,
				/*mode*/ ctx[0]
			) + "")) set_data(t2, t2_value);

			if (dirty[0] & /*mode, days*/ 2049) {
				set_style(div1, "color", /*mode*/ ctx[0] === "GC"
				? /*day*/ ctx[45].nc.color
				: "inherit");
			}

			if (/*day*/ ctx[45].metadata.holidayName) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_2(ctx);
					if_block0.c();
					if_block0.m(div3, t4);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*mode*/ ctx[0] === "NC" && /*day*/ ctx[45].isPhaseStart && /*day*/ ctx[45].isCurrentMonth) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_1(ctx);
					if_block1.c();
					if_block1.m(div3, t5);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (dirty[0] & /*days*/ 2048) {
				each_value_2 = /*day*/ ctx[45].metadata.dots;
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div2, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_2.length;
			}

			if (/*day*/ ctx[45].metadata.info) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block(ctx);
					if_block2.c();
					if_block2.m(div3, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (dirty[0] & /*days*/ 2048) {
				toggle_class(td, "is-today", /*day*/ ctx[45].isToday);
			}

			if (dirty[0] & /*selectedId, days*/ 2050) {
				toggle_class(td, "is-selected", /*selectedId*/ ctx[1] === getDateUID(/*day*/ ctx[45].date, "day"));
			}

			if (dirty[0] & /*days*/ 2048) {
				toggle_class(td, "not-current-month", !/*day*/ ctx[45].isCurrentMonth);
			}

			if (dirty[0] & /*days*/ 2048) {
				toggle_class(td, "is-holiday", /*day*/ ctx[45].dayType === "public_holiday");
			}

			if (dirty[0] & /*days*/ 2048) {
				toggle_class(td, "is-transfer-workday", /*day*/ ctx[45].dayType === "transfer_workday");
			}
		},
		d(detaching) {
			if (detaching) detach(td);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			destroy_each(each_blocks, detaching);
			if (if_block2) if_block2.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (364:6) {#each days as week, i}
function create_each_block(ctx) {
	let tr;
	let t0;
	let t1;
	let if_block = /*showWeekNums*/ ctx[2] && create_if_block_3(ctx);
	let each_value_1 = /*week*/ ctx[42];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			tr = element("tr");
			if (if_block) if_block.c();
			t0 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			attr(tr, "class", "svelte-1vcc0d");
			toggle_class(tr, "phase-start", /*i*/ ctx[44] > 0 && /*mode*/ ctx[0] === "NC" && /*week*/ ctx[42].phase !== /*days*/ ctx[11][/*i*/ ctx[44] - 1].phase);
		},
		m(target, anchor) {
			insert(target, tr, anchor);
			if (if_block) if_block.m(tr, null);
			append(tr, t0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tr, null);
			}

			append(tr, t1);
		},
		p(ctx, dirty) {
			if (/*showWeekNums*/ ctx[2]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_3(ctx);
					if_block.c();
					if_block.m(tr, t0);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty[0] & /*days, selectedId, onClickDay, onHoverDay, onContextMenuDay, mode*/ 2155) {
				each_value_1 = /*week*/ ctx[42];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(tr, t1);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}

			if (dirty[0] & /*mode, days*/ 2049) {
				toggle_class(tr, "phase-start", /*i*/ ctx[44] > 0 && /*mode*/ ctx[0] === "NC" && /*week*/ ctx[42].phase !== /*days*/ ctx[11][/*i*/ ctx[44] - 1].phase);
			}
		},
		d(detaching) {
			if (detaching) detach(tr);
			if (if_block) if_block.d();
			destroy_each(each_blocks, detaching);
		}
	};
}

function create_fragment$1(ctx) {
	let div6;
	let div5;
	let div0;
	let t0;
	let t1;
	let div3;
	let div1;
	let button0;
	let t2_value = (/*mode*/ ctx[0] === "NC" ? "年-" : "Y-") + "";
	let t2;
	let t3;
	let t4;
	let button1;
	let t5_value = (/*mode*/ ctx[0] === "NC" ? "月-" : "M-") + "";
	let t5;
	let t6;
	let t7;
	let div2;
	let button2;
	let t8_value = (/*mode*/ ctx[0] === "NC" ? "月+" : "M+") + "";
	let t8;
	let t9;
	let t10;
	let button3;
	let t11_value = (/*mode*/ ctx[0] === "NC" ? "年+" : "Y+") + "";
	let t11;
	let t12;
	let div4;
	let t13;
	let button4;
	let t15;
	let table0;
	let thead;
	let tr;
	let t16;
	let t17;
	let table1;
	let tbody;
	let mounted;
	let dispose;

	function select_block_type(ctx, dirty) {
		if (/*mode*/ ctx[0] === "GC") return create_if_block_11;
		if (/*ncInfo*/ ctx[10]) return create_if_block_12;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type && current_block_type(ctx);
	let if_block1 = /*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10] && create_if_block_10(ctx);
	let if_block2 = /*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10] && create_if_block_9(ctx);
	let if_block3 = /*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10] && create_if_block_8(ctx);
	let if_block4 = /*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10] && create_if_block_7(ctx);
	let if_block5 = /*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10] && create_if_block_6(ctx);
	let if_block6 = /*showWeekNums*/ ctx[2] && create_if_block_5();
	let each_value_3 = /*weekDays*/ ctx[13];
	let each_blocks_1 = [];

	for (let i = 0; i < each_value_3.length; i += 1) {
		each_blocks_1[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
	}

	let each_value = /*days*/ ctx[11];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div6 = element("div");
			div5 = element("div");
			div0 = element("div");
			if (if_block0) if_block0.c();
			t0 = space();
			if (if_block1) if_block1.c();
			t1 = space();
			div3 = element("div");
			div1 = element("div");
			button0 = element("button");
			t2 = text(t2_value);
			t3 = space();
			if (if_block2) if_block2.c();
			t4 = space();
			button1 = element("button");
			t5 = text(t5_value);
			t6 = space();
			if (if_block3) if_block3.c();
			t7 = space();
			div2 = element("div");
			button2 = element("button");
			t8 = text(t8_value);
			t9 = space();
			if (if_block4) if_block4.c();
			t10 = space();
			button3 = element("button");
			t11 = text(t11_value);
			t12 = space();
			div4 = element("div");
			if (if_block5) if_block5.c();
			t13 = space();
			button4 = element("button");
			button4.textContent = "Today";
			t15 = space();
			table0 = element("table");
			thead = element("thead");
			tr = element("tr");
			if (if_block6) if_block6.c();
			t16 = space();

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t17 = space();
			table1 = element("table");
			tbody = element("tbody");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div0, "class", "calendar-title-row svelte-1vcc0d");
			attr(button0, "class", "nav-btn nav-btn-year svelte-1vcc0d");
			attr(button0, "title", "Previous year");
			attr(button1, "class", "nav-btn svelte-1vcc0d");
			attr(div1, "class", "calendar-nav svelte-1vcc0d");
			attr(button2, "class", "nav-btn svelte-1vcc0d");
			attr(button3, "class", "nav-btn nav-btn-year svelte-1vcc0d");
			attr(button3, "title", "Next year");
			attr(div2, "class", "calendar-nav svelte-1vcc0d");
			attr(div3, "class", "calendar-header svelte-1vcc0d");
			attr(button4, "class", "nav-btn nav-btn-today svelte-1vcc0d");
			attr(div4, "class", "calendar-subheader svelte-1vcc0d");
			attr(table0, "class", "calendar-grid calendar-grid-head svelte-1vcc0d");
			attr(div5, "class", "calendar-top-bar svelte-1vcc0d");
			attr(table1, "class", "calendar-grid calendar-grid-body svelte-1vcc0d");
			attr(div6, "class", "calendar-container svelte-1vcc0d");
		},
		m(target, anchor) {
			insert(target, div6, anchor);
			append(div6, div5);
			append(div5, div0);
			if (if_block0) if_block0.m(div0, null);
			append(div5, t0);
			if (if_block1) if_block1.m(div5, null);
			append(div5, t1);
			append(div5, div3);
			append(div3, div1);
			append(div1, button0);
			append(button0, t2);
			append(div1, t3);
			if (if_block2) if_block2.m(div1, null);
			append(div1, t4);
			append(div1, button1);
			append(button1, t5);
			append(div3, t6);
			if (if_block3) if_block3.m(div3, null);
			append(div3, t7);
			append(div3, div2);
			append(div2, button2);
			append(button2, t8);
			append(div2, t9);
			if (if_block4) if_block4.m(div2, null);
			append(div2, t10);
			append(div2, button3);
			append(button3, t11);
			append(div5, t12);
			append(div5, div4);
			if (if_block5) if_block5.m(div4, null);
			append(div4, t13);
			append(div4, button4);
			append(div5, t15);
			append(div5, table0);
			append(table0, thead);
			append(thead, tr);
			if (if_block6) if_block6.m(tr, null);
			append(tr, t16);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(tr, null);
			}

			append(div6, t17);
			append(div6, table1);
			append(table1, tbody);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tbody, null);
			}

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*prevYear*/ ctx[18]),
					listen(button1, "click", /*prevMonth*/ ctx[15]),
					listen(button2, "click", /*nextMonth*/ ctx[16]),
					listen(button3, "click", /*nextYear*/ ctx[19]),
					listen(button4, "click", /*goToday*/ ctx[17])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
				if_block0.p(ctx, dirty);
			} else {
				if (if_block0) if_block0.d(1);
				if_block0 = current_block_type && current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(div0, null);
				}
			}

			if (/*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_10(ctx);
					if_block1.c();
					if_block1.m(div5, t1);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (dirty[0] & /*mode*/ 1 && t2_value !== (t2_value = (/*mode*/ ctx[0] === "NC" ? "年-" : "Y-") + "")) set_data(t2, t2_value);

			if (/*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10]) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_9(ctx);
					if_block2.c();
					if_block2.m(div1, t4);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (dirty[0] & /*mode*/ 1 && t5_value !== (t5_value = (/*mode*/ ctx[0] === "NC" ? "月-" : "M-") + "")) set_data(t5, t5_value);

			if (/*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10]) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block_8(ctx);
					if_block3.c();
					if_block3.m(div3, t7);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}

			if (dirty[0] & /*mode*/ 1 && t8_value !== (t8_value = (/*mode*/ ctx[0] === "NC" ? "月+" : "M+") + "")) set_data(t8, t8_value);

			if (/*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10]) {
				if (if_block4) {
					if_block4.p(ctx, dirty);
				} else {
					if_block4 = create_if_block_7(ctx);
					if_block4.c();
					if_block4.m(div2, t10);
				}
			} else if (if_block4) {
				if_block4.d(1);
				if_block4 = null;
			}

			if (dirty[0] & /*mode*/ 1 && t11_value !== (t11_value = (/*mode*/ ctx[0] === "NC" ? "年+" : "Y+") + "")) set_data(t11, t11_value);

			if (/*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[10]) {
				if (if_block5) {
					if_block5.p(ctx, dirty);
				} else {
					if_block5 = create_if_block_6(ctx);
					if_block5.c();
					if_block5.m(div4, t13);
				}
			} else if (if_block5) {
				if_block5.d(1);
				if_block5 = null;
			}

			if (/*showWeekNums*/ ctx[2]) {
				if (if_block6) ; else {
					if_block6 = create_if_block_5();
					if_block6.c();
					if_block6.m(tr, t16);
				}
			} else if (if_block6) {
				if_block6.d(1);
				if_block6 = null;
			}

			if (dirty[0] & /*weekDays*/ 8192) {
				each_value_3 = /*weekDays*/ ctx[13];
				let i;

				for (i = 0; i < each_value_3.length; i += 1) {
					const child_ctx = get_each_context_3(ctx, each_value_3, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(child_ctx, dirty);
					} else {
						each_blocks_1[i] = create_each_block_3(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(tr, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}

				each_blocks_1.length = each_value_3.length;
			}

			if (dirty[0] & /*mode, days, selectedId, onClickDay, onHoverDay, onContextMenuDay, onClickWeek, ncInfo, showWeekNums*/ 3199) {
				each_value = /*days*/ ctx[11];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(tbody, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div6);

			if (if_block0) {
				if_block0.d();
			}

			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
			if (if_block4) if_block4.d();
			if (if_block5) if_block5.d();
			if (if_block6) if_block6.d();
			destroy_each(each_blocks_1, detaching);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function getSecondaryText(day, prevDay, mode) {
	if (mode === "GC") {
		const nc = day.nc;
		if (!prevDay) return `${nc.pNm}-${nc.pNd}`;
		const prevNc = prevDay.nc;
		if (nc.ny !== prevNc.ny) return `${nc.pNy}-${nc.pNm}-${nc.pNd}`;
		if (nc.nm !== prevNc.nm) return `${nc.pNm}-${nc.pNd}`;
		return nc.pNd;
	} else {
		const date = day.date;
		if (!prevDay) return `${date.month() + 1}-${date.date()}`;
		const prevDate = prevDay.date;
		if (date.year() !== prevDate.year()) return `${date.year()}-${date.month() + 1}-${date.date()}`;
		if (date.month() !== prevDate.month()) return `${date.month() + 1}-${date.date()}`;
		return `${date.date()}`;
	}
}

function instance$1($$self, $$props, $$invalidate) {
	let title;
	let weekDays;

	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
		function adopt(value) {
			return value instanceof P
			? value
			: new P(function (resolve) {
						resolve(value);
					});
		}

		return new (P || (P = Promise))(function (resolve, reject) {
				function fulfilled(value) {
					try {
						step(generator.next(value));
					} catch(e) {
						reject(e);
					}
				}

				function rejected(value) {
					try {
						step(generator["throw"](value));
					} catch(e) {
						reject(e);
					}
				}

				function step(result) {
					result.done
					? resolve(result.value)
					: adopt(result.value).then(fulfilled, rejected);
				}

				step((generator = generator.apply(thisArg, _arguments || [])).next());
			});
	};

	
	
	
	const dispatch = createEventDispatcher();
	let { app } = $$props;
	let { mode = "GC" } = $$props;
	let { displayedMonth } = $$props;
	let { today } = $$props;
	let { sources = [] } = $$props;
	let { selectedId = null } = $$props;
	let { showWeekNums = false } = $$props;
	let { metadataUpdateTrigger = 0 } = $$props;
	let { onClickDay } = $$props;
	let { onClickWeek } = $$props;
	let { onHoverDay } = $$props;
	let { onHoverWeek } = $$props;
	let { onContextMenuDay } = $$props;
	let { onContextMenuWeek } = $$props;
	let { onClickNCMonth = null } = $$props;
	let { onClickNCPhase = null } = $$props;
	let { onClickNCSeason = null } = $$props;
	let days = [];
	let ncInfo = null;
	const monthIndices = Array.from({ length: 16 }, (_, i) => (i + 1).toString().padStart(2, "0"));
	let hasScrolledToToday = false;

	onMount(() => {
		if (displayedMonth && today) {
			updateGrid(displayedMonth, mode, sources, today);
		}
	});

	afterUpdate(() => __awaiter(void 0, void 0, void 0, function* () {
		if (!hasScrolledToToday && days.length > 0) {
			yield tick();

			// Use querySelector restricted to the component's container if possible, 
			// but is-today is a safe unique marker for now.
			const container = document.querySelector(".calendar-container");

			const todayEl = container === null || container === void 0
			? void 0
			: container.querySelector(".is-today");

			if (todayEl) {
				todayEl.scrollIntoView({ block: "center", behavior: "auto" });
				hasScrolledToToday = true;
			}
		}
	}));

	function updateGrid(display, m, srcs, td) {
		var _a;

		return __awaiter(this, void 0, void 0, function* () {
			if (!display || !td) return;
			const newDays = [];
			let start;
			let end;

			if (m === "GC") {
				start = display.clone().startOf("month").startOf("week");
				end = display.clone().endOf("month").endOf("week");
			} else {
				const info = NC.toNewCalendar(display.year(), display.month() + 1, display.date());
				const monthStart = NC.getNCMonthStart(info.ny, info.nm);
				let nextNy = info.ny;
				let nextNm = info.nm + 1;
				const maxMonths = info.ny === 2 ? 15 : 16;

				if (nextNm > maxMonths) {
					nextNy++;
					nextNm = 1;
				}

				const nextMonthStart = NC.getNCMonthStart(nextNy, nextNm);
				start = monthStart.clone().startOf("week");
				end = nextMonthStart.clone().subtract(1, "day").endOf("week");
			}

			let curr = start.clone();
			let prevPhase = -1;
			const allNotes = get_store_value(dailyNotes);
			const holidayData = get_store_value(holidays);

			// Collect dot-metadata promises during the first pass to avoid a second loop
			const dotPromises = [];

			while (curr.isBefore(end) || curr.isSame(end, "day")) {
				const week = [];

				for (let i = 0; i < 7; i++) {
					const date = curr.clone();
					const dateStr = date.format("YYYY-MM-DD");
					const nc = NC.toNewCalendar(date.year(), date.month() + 1, date.date());
					const ncPhaseVal = NC.getPhase(nc.ny, nc.nm, nc.nd);
					const isPhaseStart = ncPhaseVal !== prevPhase;
					prevPhase = ncPhaseVal;
					let isCurrentMonth = false;

					if (m === "GC") {
						isCurrentMonth = date.isSame(display, "month");
					} else {
						isCurrentMonth = ncInfo && nc.ny === ncInfo.ny && nc.nm === ncInfo.nm;
					}

					// Fetch calendar-info from frontmatter
					let infoText = "";

					const note = (_a = allNotes[getDateUID(date, "day")]) !== null && _a !== void 0
					? _a
					: null;

					if (note) {
						const cache = app.metadataCache.getFileCache(note);

						if ((cache === null || cache === void 0
						? void 0
						: cache.frontmatter) && cache.frontmatter["calendar-info"]) {
							infoText = cache.frontmatter["calendar-info"];
						}
					}

					// Determine holiday status
					let dayType = "workday";

					let holidayName = "";
					const holidayEntry = holidayData[dateStr];

					if (holidayEntry) {
						dayType = holidayEntry.type;
						holidayName = holidayEntry.name;
					} else {
						const dow = date.isoWeekday(); // 1-7 (Mon-Sun)

						if (dow >= 6) {
							dayType = "public_holiday"; // Default weekend
						}
					}

					const dayObj = {
						date,
						isCurrentMonth,
						isToday: date.isSame(td, "day"),
						nc,
						dayType,
						isPhaseStart,
						ncPhaseVal,
						metadata: { dots: [], info: infoText, holidayName }
					};

					week.push(dayObj);

					// Kick off dot-metadata fetch now (will await all at once below)
					dotPromises.push(Promise.all(srcs.map(s => s.getDailyMetadata(date))).then(metaResults => {
						dayObj.metadata.dots = metaResults.flatMap(m => m.dots || []);
					}));

					curr.add(1, "day");
				}

				week.phase = m === "NC"
				? NC.getPhase(week[0].nc.ny, week[0].nc.nm, week[0].nc.nd)
				: 0;

				newDays.push(week);
			}

			$$invalidate(11, days = newDays);

			// Await all dot-metadata fetches kicked off during the first pass
			yield Promise.all(dotPromises);

			// Force Svelte to detect the dot updates
			$$invalidate(11, days = days.map(week => week.map(day => Object.assign(Object.assign({}, day), {
				metadata: Object.assign({}, day.metadata)
			}))));
		});
	}

	function prevMonth() {
		if (mode === "GC") {
			$$invalidate(22, displayedMonth = displayedMonth.clone().subtract(1, "month"));
		} else {
			let ny = ncInfo.ny;
			let nm = ncInfo.nm - 1;

			if (nm < 1) {
				ny--;
				nm = ny === 2 ? 15 : 16;
			}

			if (ny < 1) return;
			$$invalidate(22, displayedMonth = NC.getNCMonthStart(ny, nm));
		}
	}

	function nextMonth() {
		if (mode === "GC") {
			$$invalidate(22, displayedMonth = displayedMonth.clone().add(1, "month"));
		} else {
			let ny = ncInfo.ny;
			let nm = ncInfo.nm + 1;
			const maxMonths = ny === 2 ? 15 : 16;

			if (nm > maxMonths) {
				ny++;
				nm = 1;
			}

			$$invalidate(22, displayedMonth = NC.getNCMonthStart(ny, nm));
		}
	}

	function goToday() {
		$$invalidate(22, displayedMonth = today.clone());
	}

	function prevYear() {
		if (mode === "GC") {
			$$invalidate(22, displayedMonth = displayedMonth.clone().subtract(1, "year"));
		} else if (ncInfo) {
			const ny = ncInfo.ny - 1;
			if (ny < 1) return;
			$$invalidate(22, displayedMonth = NC.getNCMonthStart(ny, ncInfo.nm));
		}
	}

	function nextYear() {
		if (mode === "GC") {
			$$invalidate(22, displayedMonth = displayedMonth.clone().add(1, "year"));
		} else if (ncInfo) {
			const ny = ncInfo.ny + 1;
			$$invalidate(22, displayedMonth = NC.getNCMonthStart(ny, ncInfo.nm));
		}
	}

	function prevSeason() {
		if (!ncInfo) return;
		const s = ncInfo.season - 1;

		if (s < 1) {
			const ny = ncInfo.ny - 1;
			if (ny < 1) return;
			const maxMonths = ny === 2 ? 15 : 16;
			$$invalidate(22, displayedMonth = NC.getNCMonthStart(ny, maxMonths));
		} else {
			const [startNm] = NC.getSeasonMonths(ncInfo.ny, s);
			$$invalidate(22, displayedMonth = NC.getNCMonthStart(ncInfo.ny, startNm));
		}
	}

	function nextSeason() {
		if (!ncInfo) return;
		const s = ncInfo.season + 1;

		if (s > 4) {
			const ny = ncInfo.ny + 1;
			$$invalidate(22, displayedMonth = NC.getNCMonthStart(ny, 1));
		} else {
			const [startNm] = NC.getSeasonMonths(ncInfo.ny, s);
			$$invalidate(22, displayedMonth = NC.getNCMonthStart(ncInfo.ny, startNm));
		}
	}

	const click_handler = () => onClickNCMonth?.(ncInfo.ny, 1);
	const click_handler_1 = () => onClickNCSeason?.(ncInfo.ny, ncInfo.season);
	const click_handler_2 = () => onClickNCMonth?.(ncInfo.ny, ncInfo.nm);
	const click_handler_3 = phase => onClickNCPhase?.(ncInfo.ny, ncInfo.nm, phase);
	const click_handler_4 = week => onClickWeek(week[0].date, false);
	const click_handler_5 = (day, e) => onClickDay(day.date, e.metaKey || e.ctrlKey);
	const mouseenter_handler = (day, e) => onHoverDay(day.date, e.target);
	const contextmenu_handler = (day, e) => onContextMenuDay(day.date, e);

	$$self.$$set = $$props => {
		if ("app" in $$props) $$invalidate(23, app = $$props.app);
		if ("mode" in $$props) $$invalidate(0, mode = $$props.mode);
		if ("displayedMonth" in $$props) $$invalidate(22, displayedMonth = $$props.displayedMonth);
		if ("today" in $$props) $$invalidate(24, today = $$props.today);
		if ("sources" in $$props) $$invalidate(25, sources = $$props.sources);
		if ("selectedId" in $$props) $$invalidate(1, selectedId = $$props.selectedId);
		if ("showWeekNums" in $$props) $$invalidate(2, showWeekNums = $$props.showWeekNums);
		if ("metadataUpdateTrigger" in $$props) $$invalidate(26, metadataUpdateTrigger = $$props.metadataUpdateTrigger);
		if ("onClickDay" in $$props) $$invalidate(3, onClickDay = $$props.onClickDay);
		if ("onClickWeek" in $$props) $$invalidate(4, onClickWeek = $$props.onClickWeek);
		if ("onHoverDay" in $$props) $$invalidate(5, onHoverDay = $$props.onHoverDay);
		if ("onHoverWeek" in $$props) $$invalidate(27, onHoverWeek = $$props.onHoverWeek);
		if ("onContextMenuDay" in $$props) $$invalidate(6, onContextMenuDay = $$props.onContextMenuDay);
		if ("onContextMenuWeek" in $$props) $$invalidate(28, onContextMenuWeek = $$props.onContextMenuWeek);
		if ("onClickNCMonth" in $$props) $$invalidate(7, onClickNCMonth = $$props.onClickNCMonth);
		if ("onClickNCPhase" in $$props) $$invalidate(8, onClickNCPhase = $$props.onClickNCPhase);
		if ("onClickNCSeason" in $$props) $$invalidate(9, onClickNCSeason = $$props.onClickNCSeason);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty[0] & /*displayedMonth*/ 4194304) {
			dispatch("displayedMonthChange", displayedMonth);
		}

		if ($$self.$$.dirty[0] & /*mode, displayedMonth*/ 4194305) {
			if (mode === "NC" && displayedMonth) {
				const info = NC.getNCDate(displayedMonth);
				const range = NC.getMonthRange(info.ny, info.nm);

				$$invalidate(10, ncInfo = {
					ny: info.ny,
					nm: info.nm,
					color: info.color,
					phase: info.phase,
					season: info.season,
					gcStart: range[0].format("YYYY-MM-DD"),
					gcEnd: range[1].format("YYYY-MM-DD")
				});
			} else {
				$$invalidate(10, ncInfo = null);
			}
		}

		if ($$self.$$.dirty[0] & /*mode, displayedMonth, ncInfo*/ 4195329) {
			$$invalidate(12, title = mode === "GC" && displayedMonth
			? displayedMonth.format("MMMM YYYY")
			: ncInfo ? toChineseYearMonth(ncInfo.ny, ncInfo.nm) : "");
		}

		if ($$self.$$.dirty[0] & /*displayedMonth, today, mode, sources*/ 54525953) {
			if (displayedMonth && today) {
				updateGrid(displayedMonth, mode, sources, today);
			}
		}

		if ($$self.$$.dirty[0] & /*ncInfo*/ 1024) {
			ncInfo ? `S${ncInfo.season}` : "";
		}

		if ($$self.$$.dirty[0] & /*today*/ 16777216) {
			$$invalidate(13, weekDays = Array.from({ length: 7 }, (_, i) => today.clone().startOf("week").add(i, "days").format("ddd")));
		}
	};

	return [
		mode,
		selectedId,
		showWeekNums,
		onClickDay,
		onClickWeek,
		onHoverDay,
		onContextMenuDay,
		onClickNCMonth,
		onClickNCPhase,
		onClickNCSeason,
		ncInfo,
		days,
		title,
		weekDays,
		monthIndices,
		prevMonth,
		nextMonth,
		goToday,
		prevYear,
		nextYear,
		prevSeason,
		nextSeason,
		displayedMonth,
		app,
		today,
		sources,
		metadataUpdateTrigger,
		onHoverWeek,
		onContextMenuWeek,
		click_handler,
		click_handler_1,
		click_handler_2,
		click_handler_3,
		click_handler_4,
		click_handler_5,
		mouseenter_handler,
		contextmenu_handler
	];
}

class CalendarGrid extends SvelteComponent {
	constructor(options) {
		super();
		if (!document_1.getElementById("svelte-1vcc0d-style")) add_css();

		init(
			this,
			options,
			instance$1,
			create_fragment$1,
			safe_not_equal,
			{
				app: 23,
				mode: 0,
				displayedMonth: 22,
				today: 24,
				sources: 25,
				selectedId: 1,
				showWeekNums: 2,
				metadataUpdateTrigger: 26,
				onClickDay: 3,
				onClickWeek: 4,
				onHoverDay: 5,
				onHoverWeek: 27,
				onContextMenuDay: 6,
				onContextMenuWeek: 28,
				onClickNCMonth: 7,
				onClickNCPhase: 8,
				onClickNCSeason: 9
			},
			[-1, -1]
		);
	}
}

const langToMomentLocale = {
    en: "en-gb",
    zh: "zh-cn",
    "zh-TW": "zh-tw",
    ru: "ru",
    ko: "ko",
    it: "it",
    id: "id",
    ro: "ro",
    "pt-BR": "pt-br",
    cz: "cs",
    da: "da",
    de: "de",
    es: "es",
    fr: "fr",
    no: "nn",
    pl: "pl",
    pt: "pt",
    tr: "tr",
    hi: "hi",
    nl: "nl",
    ar: "ar",
    ja: "ja",
};
const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];
function overrideGlobalMomentWeekStart(weekStart) {
    const { moment } = window;
    const currentLocale = moment.locale();
    // Save the initial locale weekspec so that we can restore
    // it when toggling between the different options in settings.
    if (!window._bundledLocaleWeekSpec) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window._bundledLocaleWeekSpec = moment.localeData()._week;
    }
    if (weekStart === "locale") {
        moment.updateLocale(currentLocale, {
            week: window._bundledLocaleWeekSpec,
        });
    }
    else {
        moment.updateLocale(currentLocale, {
            week: {
                dow: weekdays.indexOf(weekStart) || 0,
            },
        });
    }
}
/**
 * Sets the locale used by the calendar. This allows the calendar to
 * default to the user's locale (e.g. Start Week on Sunday/Monday/Friday)
 *
 * @param localeOverride locale string (e.g. "en-US")
 */
function configureGlobalMomentLocale(localeOverride = "system-default", weekStart = "locale") {
    var _a;
    const obsidianLang = localStorage.getItem("language") || "en";
    const systemLang = (_a = navigator.language) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    let momentLocale = langToMomentLocale[obsidianLang];
    if (localeOverride !== "system-default") {
        momentLocale = localeOverride;
    }
    else if (systemLang.startsWith(obsidianLang)) {
        // If the system locale is more specific (en-gb vs en), use the system locale.
        momentLocale = systemLang;
    }
    const currentLocale = window.moment.locale(momentLocale);
    console.debug(`[Calendar] Trying to switch Moment.js global locale to ${momentLocale}, got ${currentLocale}`);
    overrideGlobalMomentWeekStart(weekStart);
    return currentLocale;
}

/* src/ui/Calendar.svelte generated by Svelte v3.35.0 */

function create_fragment(ctx) {
	let calendargrid;
	let updating_displayedMonth;
	let current;

	function calendargrid_displayedMonth_binding(value) {
		/*calendargrid_displayedMonth_binding*/ ctx[14](value);
	}

	let calendargrid_props = {
		mode: "GC",
		app: /*app*/ ctx[1],
		sources: /*sources*/ ctx[2],
		today: /*today*/ ctx[10],
		onHoverDay: /*onHoverDay*/ ctx[3],
		onHoverWeek: /*onHoverWeek*/ ctx[4],
		onContextMenuDay: /*onContextMenuDay*/ ctx[7],
		onContextMenuWeek: /*onContextMenuWeek*/ ctx[8],
		onClickDay: /*onClickDay*/ ctx[5],
		onClickWeek: /*onClickWeek*/ ctx[6],
		metadataUpdateTrigger: /*metadataUpdateTrigger*/ ctx[11],
		selectedId: /*$activeFile*/ ctx[12],
		showWeekNums: /*$settings*/ ctx[9].showWeeklyNote
	};

	if (/*displayedMonth*/ ctx[0] !== void 0) {
		calendargrid_props.displayedMonth = /*displayedMonth*/ ctx[0];
	}

	calendargrid = new CalendarGrid({ props: calendargrid_props });
	binding_callbacks.push(() => bind(calendargrid, "displayedMonth", calendargrid_displayedMonth_binding));

	return {
		c() {
			create_component(calendargrid.$$.fragment);
		},
		m(target, anchor) {
			mount_component(calendargrid, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const calendargrid_changes = {};
			if (dirty & /*app*/ 2) calendargrid_changes.app = /*app*/ ctx[1];
			if (dirty & /*sources*/ 4) calendargrid_changes.sources = /*sources*/ ctx[2];
			if (dirty & /*today*/ 1024) calendargrid_changes.today = /*today*/ ctx[10];
			if (dirty & /*onHoverDay*/ 8) calendargrid_changes.onHoverDay = /*onHoverDay*/ ctx[3];
			if (dirty & /*onHoverWeek*/ 16) calendargrid_changes.onHoverWeek = /*onHoverWeek*/ ctx[4];
			if (dirty & /*onContextMenuDay*/ 128) calendargrid_changes.onContextMenuDay = /*onContextMenuDay*/ ctx[7];
			if (dirty & /*onContextMenuWeek*/ 256) calendargrid_changes.onContextMenuWeek = /*onContextMenuWeek*/ ctx[8];
			if (dirty & /*onClickDay*/ 32) calendargrid_changes.onClickDay = /*onClickDay*/ ctx[5];
			if (dirty & /*onClickWeek*/ 64) calendargrid_changes.onClickWeek = /*onClickWeek*/ ctx[6];
			if (dirty & /*metadataUpdateTrigger*/ 2048) calendargrid_changes.metadataUpdateTrigger = /*metadataUpdateTrigger*/ ctx[11];
			if (dirty & /*$activeFile*/ 4096) calendargrid_changes.selectedId = /*$activeFile*/ ctx[12];
			if (dirty & /*$settings*/ 512) calendargrid_changes.showWeekNums = /*$settings*/ ctx[9].showWeeklyNote;

			if (!updating_displayedMonth && dirty & /*displayedMonth*/ 1) {
				updating_displayedMonth = true;
				calendargrid_changes.displayedMonth = /*displayedMonth*/ ctx[0];
				add_flush_callback(() => updating_displayedMonth = false);
			}

			calendargrid.$set(calendargrid_changes);
		},
		i(local) {
			if (current) return;
			transition_in(calendargrid.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(calendargrid.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(calendargrid, detaching);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let $settings;
	let $activeFile;
	component_subscribe($$self, settings, $$value => $$invalidate(9, $settings = $$value));
	component_subscribe($$self, activeFile, $$value => $$invalidate(12, $activeFile = $$value));
	
	
	
	let today = window.moment();
	let { app } = $$props;
	let { displayedMonth = window.moment() } = $$props;
	let { sources } = $$props;
	let { onHoverDay } = $$props;
	let { onHoverWeek } = $$props;
	let { onClickDay } = $$props;
	let { onClickWeek } = $$props;
	let { onContextMenuDay } = $$props;
	let { onContextMenuWeek } = $$props;
	let metadataUpdateTrigger = 0;

	function tick() {
		$$invalidate(10, today = window.moment());
		$$invalidate(11, metadataUpdateTrigger += 1);
	}

	function getToday(settings) {
		configureGlobalMomentLocale(settings.localeOverride, settings.weekStart);
		dailyNotes.reindex();
		weeklyNotes.reindex();
		return window.moment();
	}

	// 1 minute heartbeat to keep `today` reflecting the current day
	let lastDayOfMonth = today.date();

	let heartbeat = setInterval(
		() => {
			const now = window.moment();

			// Only update if the day actually changed (avoid 59 wasteful re-renders per hour)
			if (now.date() !== lastDayOfMonth) {
				lastDayOfMonth = now.date();
				tick();
				const isViewingCurrentMonth = displayedMonth.isSame(now, "month");

				if (isViewingCurrentMonth) {
					$$invalidate(0, displayedMonth = now);
				}
			}
		},
		1000 * 60
	);

	onDestroy(() => {
		clearInterval(heartbeat);
	});

	function calendargrid_displayedMonth_binding(value) {
		displayedMonth = value;
		$$invalidate(0, displayedMonth);
	}

	$$self.$$set = $$props => {
		if ("app" in $$props) $$invalidate(1, app = $$props.app);
		if ("displayedMonth" in $$props) $$invalidate(0, displayedMonth = $$props.displayedMonth);
		if ("sources" in $$props) $$invalidate(2, sources = $$props.sources);
		if ("onHoverDay" in $$props) $$invalidate(3, onHoverDay = $$props.onHoverDay);
		if ("onHoverWeek" in $$props) $$invalidate(4, onHoverWeek = $$props.onHoverWeek);
		if ("onClickDay" in $$props) $$invalidate(5, onClickDay = $$props.onClickDay);
		if ("onClickWeek" in $$props) $$invalidate(6, onClickWeek = $$props.onClickWeek);
		if ("onContextMenuDay" in $$props) $$invalidate(7, onContextMenuDay = $$props.onContextMenuDay);
		if ("onContextMenuWeek" in $$props) $$invalidate(8, onContextMenuWeek = $$props.onContextMenuWeek);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*$settings*/ 512) {
			$$invalidate(10, today = getToday($settings));
		}
	};

	return [
		displayedMonth,
		app,
		sources,
		onHoverDay,
		onHoverWeek,
		onClickDay,
		onClickWeek,
		onContextMenuDay,
		onContextMenuWeek,
		$settings,
		today,
		metadataUpdateTrigger,
		$activeFile,
		tick,
		calendargrid_displayedMonth_binding
	];
}

class Calendar extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, not_equal, {
			app: 1,
			displayedMonth: 0,
			sources: 2,
			onHoverDay: 3,
			onHoverWeek: 4,
			onClickDay: 5,
			onClickWeek: 6,
			onContextMenuDay: 7,
			onContextMenuWeek: 8,
			tick: 13
		});
	}

	get tick() {
		return this.$$.ctx[13];
	}
}

function showFileMenu(app, file, position) {
    const fileMenu = new obsidian.Menu(app);
    fileMenu.addItem((item) => item
        .setTitle("Delete")
        .setIcon("trash")
        .onClick(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.fileManager.promptForFileDeletion(file);
    }));
    app.workspace.trigger("file-menu", fileMenu, file, "calendar-context-menu", null);
    fileMenu.showAtPosition(position);
}

const getStreakClasses = (file) => {
    return classList({
        "has-note": !!file,
    });
};
const streakSource = {
    getDailyMetadata: async (date) => {
        const file = getDailyNote_1(date, get_store_value(dailyNotes));
        return {
            classes: getStreakClasses(file),
            dots: [],
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        return {
            classes: getStreakClasses(file),
            dots: [],
        };
    },
};

function getNoteTags(note) {
    var _a;
    if (!note) {
        return [];
    }
    const { metadataCache } = window.app;
    const frontmatter = (_a = metadataCache.getFileCache(note)) === null || _a === void 0 ? void 0 : _a.frontmatter;
    const tags = [];
    if (frontmatter) {
        const frontmatterTags = obsidian.parseFrontMatterTags(frontmatter) || [];
        tags.push(...frontmatterTags);
    }
    // strip the '#' at the beginning
    return tags.map((tag) => tag.substring(1));
}
function getFormattedTagAttributes(note) {
    const attrs = {};
    const tags = getNoteTags(note);
    const [emojiTags, nonEmojiTags] = partition(tags, (tag) => /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/.test(tag));
    if (nonEmojiTags) {
        attrs["data-tags"] = nonEmojiTags.join(" ");
    }
    if (emojiTags) {
        attrs["data-emoji-tag"] = emojiTags[0];
    }
    return attrs;
}
const customTagsSource = {
    getDailyMetadata: async (date) => {
        const file = getDailyNote_1(date, get_store_value(dailyNotes));
        return {
            dataAttributes: getFormattedTagAttributes(file),
            dots: [],
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        return {
            dataAttributes: getFormattedTagAttributes(file),
            dots: [],
        };
    },
};

const NUM_MAX_DOTS = 5;
/**
 * Merged source: reads each daily/weekly note once and returns both
 * task-completion dots and word-count dots together.
 */
async function getDotsForNote(note) {
    if (!note)
        return [];
    const { wordsPerDot = DEFAULT_WORDS_PER_DOT, wordCountOffset = 0 } = get_store_value(settings);
    const fileContents = await window.app.vault.cachedRead(note);
    const dots = [];
    // ── Task dots ──────────────────────────────────────────────
    const remaining = (fileContents.match(/(-|\*) \[ \]/g) || []).length;
    const completed = (fileContents.match(/(-|\*) \[x\]/gi) || []).length;
    if (remaining > 0) {
        dots.push({
            className: completed === 0 ? "task-todo-urgent" : "task-todo",
            color: completed === 0 ? "#F44336" : "#FF9800",
            isFilled: true,
        });
    }
    else if (completed > 0) {
        dots.push({
            className: "task-done",
            color: "#4CAF50",
            isFilled: true,
        });
    }
    // ── Word-count dots ────────────────────────────────────────
    const totalWordCount = getWordCount(fileContents);
    const effectiveWordCount = totalWordCount - wordCountOffset;
    if (effectiveWordCount > 0) {
        const rawDotCount = effectiveWordCount / wordsPerDot;
        if (rawDotCount > NUM_MAX_DOTS) {
            dots.push({ color: "default", isFilled: true, className: "overflow-dot" });
        }
        else {
            const numSolidDots = clamp(Math.floor(rawDotCount), 1, NUM_MAX_DOTS);
            for (let i = 0; i < numSolidDots; i++) {
                dots.push({ color: "default", isFilled: true });
            }
        }
    }
    else if (totalWordCount > 0) {
        dots.push({
            color: "var(--text-normal)",
            isFilled: false,
            className: "template-only-dot",
        });
    }
    return dots;
}
const contentSource = {
    getDailyMetadata: async (date) => {
        const file = getDailyNote_1(date, get_store_value(dailyNotes));
        const dots = await getDotsForNote(file);
        return { dots };
    },
    getWeeklyMetadata: async (date) => {
        const file = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        const dots = await getDotsForNote(file);
        return { dots };
    },
};

function getDailyNote$1(date, all) {
    var _a;
    return (_a = all[getDateUID(date, "day")]) !== null && _a !== void 0 ? _a : null;
}
function getWeeklyNote$1(date, all) {
    var _a;
    return (_a = all[getDateUID(date, "week")]) !== null && _a !== void 0 ? _a : null;
}
class CalendarView extends obsidian.ItemView {
    constructor(leaf) {
        super(leaf);
        this.openOrCreateDailyNote = this.openOrCreateDailyNote.bind(this);
        this.openOrCreateWeeklyNote = this.openOrCreateWeeklyNote.bind(this);
        this.onNoteSettingsUpdate = this.onNoteSettingsUpdate.bind(this);
        this.onFileCreated = this.onFileCreated.bind(this);
        this.onFileDeleted = this.onFileDeleted.bind(this);
        this.onFileModified = this.onFileModified.bind(this);
        this.onFileOpen = this.onFileOpen.bind(this);
        this.onHoverDay = this.onHoverDay.bind(this);
        this.onHoverWeek = this.onHoverWeek.bind(this);
        this.onContextMenuDay = this.onContextMenuDay.bind(this);
        this.onContextMenuWeek = this.onContextMenuWeek.bind(this);
        this.registerEvent(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.app.workspace.on("periodic-notes:settings-updated", this.onNoteSettingsUpdate));
        this.registerEvent(this.app.vault.on("create", this.onFileCreated));
        this.registerEvent(this.app.vault.on("delete", this.onFileDeleted));
        this.registerEvent(this.app.vault.on("modify", this.onFileModified));
        this.registerEvent(this.app.workspace.on("file-open", this.onFileOpen));
        this.settings = null;
        settings.subscribe((val) => {
            this.settings = val;
            // Refresh the calendar if settings change
            if (this.calendar) {
                this.calendar.tick();
            }
        });
    }
    getViewType() {
        return VIEW_TYPE_CALENDAR;
    }
    getDisplayText() {
        return "GC Calendar";
    }
    getIcon() {
        return "calendar-with-checkmark";
    }
    onClose() {
        if (this.calendar) {
            this.calendar.$destroy();
        }
        return Promise.resolve();
    }
    async onOpen() {
        // Index notes before mounting the calendar (so calendar-info etc. resolve)
        dailyNotes.reindex();
        weeklyNotes.reindex();
        // Integration point: external plugins can listen for `calendar:open`
        // to feed in additional sources.
        const sources = [
            contentSource,
            customTagsSource,
            streakSource,
        ];
        this.app.workspace.trigger(TRIGGER_ON_OPEN, sources);
        this.calendar = new Calendar({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: this.contentEl,
            props: {
                app: this.app,
                onClickDay: this.openOrCreateDailyNote,
                onClickWeek: this.openOrCreateWeeklyNote,
                onHoverDay: this.onHoverDay,
                onHoverWeek: this.onHoverWeek,
                onContextMenuDay: this.onContextMenuDay,
                onContextMenuWeek: this.onContextMenuWeek,
                sources,
            },
        });
        this.registerEvent(this.app.metadataCache.on("changed", () => {
            this.calendar.tick();
        }));
    }
    onHoverDay(date, targetEl, isMetaPressed) {
        if (!isMetaPressed) {
            return;
        }
        const { format } = getDailyNoteSettings();
        const note = getDailyNote$1(date, get_store_value(dailyNotes));
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onHoverWeek(date, targetEl, isMetaPressed) {
        if (!isMetaPressed) {
            return;
        }
        const note = getWeeklyNote$1(date, get_store_value(weeklyNotes));
        const { format } = getWeeklyNoteSettings();
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onContextMenuDay(date, event) {
        const note = getDailyNote$1(date, get_store_value(dailyNotes));
        if (!note) {
            // If no file exists for a given day, show nothing.
            return;
        }
        showFileMenu(this.app, note, {
            x: event.pageX,
            y: event.pageY,
        });
    }
    onContextMenuWeek(date, event) {
        const note = getWeeklyNote$1(date, get_store_value(weeklyNotes));
        if (!note) {
            // If no file exists for a given day, show nothing.
            return;
        }
        showFileMenu(this.app, note, {
            x: event.pageX,
            y: event.pageY,
        });
    }
    onNoteSettingsUpdate() {
        dailyNotes.reindex();
        weeklyNotes.reindex();
        this.updateActiveFile();
    }
    async onFileDeleted(file) {
        if (getDateFromFile(file, "day")) {
            dailyNotes.reindex();
            this.updateActiveFile();
        }
        if (getDateFromFile(file, "week")) {
            weeklyNotes.reindex();
            this.updateActiveFile();
        }
    }
    async onFileModified(file) {
        const date = getDateFromFile(file, "day") || getDateFromFile(file, "week");
        if (date && this.calendar) {
            this.calendar.tick();
        }
    }
    onFileCreated(file) {
        if (this.app.workspace.layoutReady && this.calendar) {
            if (getDateFromFile(file, "day")) {
                dailyNotes.reindex();
                this.calendar.tick();
            }
            if (getDateFromFile(file, "week")) {
                weeklyNotes.reindex();
                this.calendar.tick();
            }
        }
    }
    onFileOpen(_file) {
        if (this.app.workspace.layoutReady) {
            this.updateActiveFile();
        }
    }
    updateActiveFile() {
        const { view } = this.app.workspace.activeLeaf;
        let file = null;
        if (view instanceof obsidian.FileView) {
            file = view.file;
        }
        activeFile.setFile(file);
        if (this.calendar) {
            this.calendar.tick();
        }
    }
    revealActiveNote() {
        const { moment } = window;
        const { activeLeaf } = this.app.workspace;
        if (activeLeaf.view instanceof obsidian.FileView) {
            // Check to see if the active note is a daily-note
            let date = getDateFromFile(activeLeaf.view.file, "day");
            if (date) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
            // Check to see if the active note is a weekly-note
            const { format } = getWeeklyNoteSettings();
            date = moment(activeLeaf.view.file.basename, format, true);
            if (date.isValid()) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
        }
    }
    async openOrCreateWeeklyNote(date, inNewSplit) {
        const { workspace } = this.app;
        const startOfWeek = date.clone().startOf("week");
        const existingFile = getWeeklyNote$1(date, get_store_value(weeklyNotes));
        if (existingFile) {
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(existingFile);
            activeFile.setFile(existingFile);
            workspace.setActiveLeaf(leaf, true, true);
            return;
        }
        // Store miss — check filesystem directly before showing "Create?" dialog
        const { format, folder } = getWeeklyNoteSettings();
        const filename = startOfWeek.format(format);
        const diskPath = obsidian.normalizePath(folder ? `${folder}/${filename}.md` : `${filename}.md`);
        const diskFile = this.app.vault.getAbstractFileByPath(diskPath);
        if (diskFile instanceof obsidian.TFile) {
            // File exists on disk but wasn't in store — open it and reindex
            weeklyNotes.reindex();
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(diskFile);
            activeFile.setFile(diskFile);
            workspace.setActiveLeaf(leaf, true, true);
            return;
        }
        // File truly doesn't exist
        tryToCreateWeeklyNote(startOfWeek, inNewSplit, this.settings, (file) => {
            activeFile.setFile(file);
        });
    }
    async openOrCreateDailyNote(date, inNewSplit) {
        const { workspace } = this.app;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mode = this.app.vault.getConfig("defaultViewMode");
        const existingFile = getDailyNote$1(date, get_store_value(dailyNotes));
        if (existingFile) {
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(existingFile, { active: true, mode });
            activeFile.setFile(existingFile);
            return;
        }
        // Store miss — check filesystem directly before showing "Create?" dialog
        const { format, folder } = getDailyNoteSettings();
        const filename = date.format(format);
        const diskPath = obsidian.normalizePath(folder ? `${folder}/${filename}.md` : `${filename}.md`);
        const diskFile = this.app.vault.getAbstractFileByPath(diskPath);
        if (diskFile instanceof obsidian.TFile) {
            // File exists on disk but wasn't in store — open it and reindex
            dailyNotes.reindex();
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(diskFile, { active: true, mode });
            activeFile.setFile(diskFile);
            return;
        }
        // File truly doesn't exist
        tryToCreateDailyNote(date, inNewSplit, this.settings, (dailyNote) => {
            activeFile.setFile(dailyNote);
        });
    }
}

function getDailyNote(date, all) {
    var _a;
    return (_a = all[getDateUID(date, "day")]) !== null && _a !== void 0 ? _a : null;
}
function getWeeklyNote(date, all) {
    var _a;
    return (_a = all[getDateUID(date, "week")]) !== null && _a !== void 0 ? _a : null;
}
class NCView extends obsidian.ItemView {
    constructor(leaf) {
        super(leaf);
        this.displayedMonth = window.moment();
        this.openOrCreateDailyNote = this.openOrCreateDailyNote.bind(this);
        this.openOrCreateWeeklyNote = this.openOrCreateWeeklyNote.bind(this);
        this.onFileCreated = this.onFileCreated.bind(this);
        this.onFileDeleted = this.onFileDeleted.bind(this);
        this.onFileModified = this.onFileModified.bind(this);
        this.onFileOpen = this.onFileOpen.bind(this);
        this.onHoverDay = this.onHoverDay.bind(this);
        this.onHoverWeek = this.onHoverWeek.bind(this);
        this.onContextMenuDay = this.onContextMenuDay.bind(this);
        this.onContextMenuWeek = this.onContextMenuWeek.bind(this);
        this.registerEvent(this.app.vault.on("create", this.onFileCreated));
        this.registerEvent(this.app.vault.on("delete", this.onFileDeleted));
        this.registerEvent(this.app.vault.on("modify", this.onFileModified));
        this.registerEvent(this.app.workspace.on("file-open", this.onFileOpen));
        settings.subscribe((val) => {
            configureGlobalMomentLocale(val.localeOverride, val.weekStart);
            if (this.calendar) {
                this.calendar.$set({
                    today: window.moment(),
                    showWeekNums: val.showWeeklyNote
                });
            }
        });
    }
    getViewType() {
        return VIEW_TYPE_NC_CALENDAR;
    }
    getDisplayText() {
        return "NC Calendar";
    }
    getIcon() {
        return "calendar-with-checkmark";
    }
    onClose() {
        if (this.calendar) {
            this.calendar.$destroy();
        }
        return Promise.resolve();
    }
    async onOpen() {
        // Index notes
        dailyNotes.reindex();
        weeklyNotes.reindex();
        const sources = [
            contentSource,
            customTagsSource,
            streakSource,
        ];
        this.app.workspace.trigger(TRIGGER_ON_OPEN, sources);
        this.calendar = new CalendarGrid({
            target: this.contentEl,
            props: {
                app: this.app,
                mode: "NC",
                displayedMonth: this.displayedMonth,
                today: window.moment(),
                onClickDay: this.openOrCreateDailyNote,
                onClickWeek: this.openOrCreateWeeklyNote,
                onHoverDay: this.onHoverDay,
                onHoverWeek: this.onHoverWeek,
                onContextMenuDay: this.onContextMenuDay,
                onContextMenuWeek: this.onContextMenuWeek,
                onClickNCMonth: this.openOrCreateNCMonthNote.bind(this),
                onClickNCPhase: this.openOrCreateNCPhaseNote.bind(this),
                onClickNCSeason: this.openOrCreateNCSeasonNote.bind(this),
                sources,
                showWeekNums: get_store_value(settings).showWeeklyNote,
            },
        });
        this.calendar.$on("displayedMonthChange", (event) => {
            this.displayedMonth = event.detail;
        });
        this.updateActiveFile();
        this.register(activeFile.subscribe((val) => {
            if (this.calendar) {
                this.calendar.$set({ selectedId: val });
            }
        }));
        this.registerEvent(this.app.metadataCache.on("changed", () => {
            this.tick();
        }));
    }
    tick() {
        if (this.calendar) {
            const current = this.calendar.metadataUpdateTrigger || 0;
            this.calendar.$set({
                metadataUpdateTrigger: current + 1,
                today: window.moment()
            });
        }
    }
    async onFileModified(file) {
        const date = getDateFromFile(file, "day") || getDateFromFile(file, "week");
        if (date && this.calendar) {
            this.tick();
        }
    }
    onFileCreated(file) {
        if (this.app.workspace.layoutReady && this.calendar) {
            if (getDateFromFile(file, "day")) {
                dailyNotes.reindex();
                this.tick();
            }
            if (getDateFromFile(file, "week")) {
                weeklyNotes.reindex();
                this.tick();
            }
        }
    }
    onFileDeleted(file) {
        if (this.app.workspace.layoutReady && this.calendar) {
            if (getDateFromFile(file, "day")) {
                dailyNotes.reindex();
                this.tick();
            }
            if (getDateFromFile(file, "week")) {
                weeklyNotes.reindex();
                this.tick();
            }
        }
    }
    onFileOpen(_file) {
        if (this.app.workspace.layoutReady) {
            this.updateActiveFile();
        }
    }
    updateActiveFile() {
        const { view } = this.app.workspace.activeLeaf;
        let file = null;
        if (view instanceof obsidian.FileView) {
            file = view.file;
        }
        activeFile.setFile(file);
        this.tick();
    }
    onHoverDay(date, targetEl) {
        // hover logic from original view.ts
        const { format } = getDailyNoteSettings();
        const note = getDailyNote(date, get_store_value(dailyNotes));
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onHoverWeek(date, targetEl) {
        const note = getWeeklyNote(date, get_store_value(weeklyNotes));
        const { format } = getWeeklyNoteSettings();
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onContextMenuDay(date, event) {
        const note = getDailyNote(date, get_store_value(dailyNotes));
        if (!note)
            return;
        showFileMenu(this.app, note, {
            x: event.pageX,
            y: event.pageY,
        });
    }
    onContextMenuWeek(date, event) {
        const note = getWeeklyNote(date, get_store_value(weeklyNotes));
        if (!note)
            return;
        showFileMenu(this.app, note, {
            x: event.pageX,
            y: event.pageY,
        });
    }
    revealActiveNote() {
        const { moment } = window;
        const { activeLeaf } = this.app.workspace;
        if (activeLeaf.view instanceof obsidian.FileView) {
            let date = getDateFromFile(activeLeaf.view.file, "day");
            if (date) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
            const { format } = getWeeklyNoteSettings();
            date = moment(activeLeaf.view.file.basename, format, true);
            if (date.isValid()) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
        }
    }
    async openOrCreateWeeklyNote(date, inNewSplit) {
        const { workspace } = this.app;
        const startOfWeek = date.clone().startOf("week");
        const existingFile = getWeeklyNote(date, get_store_value(weeklyNotes));
        if (existingFile) {
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(existingFile);
            activeFile.setFile(existingFile);
            workspace.setActiveLeaf(leaf, true, true);
            return;
        }
        // Store miss — check filesystem directly before showing "Create?" dialog
        const { format, folder } = getWeeklyNoteSettings();
        const filename = startOfWeek.format(format);
        const diskPath = obsidian.normalizePath(folder ? `${folder}/${filename}.md` : `${filename}.md`);
        const diskFile = this.app.vault.getAbstractFileByPath(diskPath);
        if (diskFile instanceof obsidian.TFile) {
            weeklyNotes.reindex();
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(diskFile);
            activeFile.setFile(diskFile);
            workspace.setActiveLeaf(leaf, true, true);
            return;
        }
        tryToCreateWeeklyNote(startOfWeek, inNewSplit, get_store_value(settings), (file) => {
            activeFile.setFile(file);
        });
    }
    async openOrCreateDailyNote(date, inNewSplit) {
        const { workspace } = this.app;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mode = this.app.vault.getConfig("defaultViewMode");
        const existingFile = getDailyNote(date, get_store_value(dailyNotes));
        if (existingFile) {
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(existingFile, { active: true, mode });
            activeFile.setFile(existingFile);
            return;
        }
        // Store miss — check filesystem directly before showing "Create?" dialog
        const { format, folder } = getDailyNoteSettings();
        const filename = date.format(format);
        const diskPath = obsidian.normalizePath(folder ? `${folder}/${filename}.md` : `${filename}.md`);
        const diskFile = this.app.vault.getAbstractFileByPath(diskPath);
        if (diskFile instanceof obsidian.TFile) {
            dailyNotes.reindex();
            const leaf = inNewSplit
                ? workspace.splitActiveLeaf()
                : workspace.getUnpinnedLeaf();
            await leaf.openFile(diskFile, { active: true, mode });
            activeFile.setFile(diskFile);
            return;
        }
        tryToCreateDailyNote(date, inNewSplit, get_store_value(settings), (dailyNote) => {
            activeFile.setFile(dailyNote);
        });
    }
    async openOrCreateNCSeasonNote(ny, season) {
        try {
            const [startNm] = NC.getSeasonMonths(ny, season);
            const start = NC.getNCMonthStart(ny, startNm);
            const note = await createNCNote(start, "nc-season");
            if (note) {
                const leaf = this.app.workspace.getUnpinnedLeaf();
                await leaf.openFile(note, { active: true });
                activeFile.setFile(note);
            }
        }
        catch (e) {
            console.error("[New Calendar Suite] Error opening NC season note:", e);
            new obsidian.Notice(`Error: ${e.message || e}`);
        }
    }
    async openOrCreateNCMonthNote(ny, nm) {
        try {
            const monthStart = NC.getNCMonthStart(ny, nm);
            const note = await createNCNote(monthStart, "nc-month");
            if (note) {
                const leaf = this.app.workspace.getUnpinnedLeaf();
                await leaf.openFile(note, { active: true });
                activeFile.setFile(note);
            }
        }
        catch (e) {
            console.error("[New Calendar Suite] Error opening NC month note:", e);
            new obsidian.Notice(`Error: ${e.message || e}`);
        }
    }
    async openOrCreateNCPhaseNote(ny, nm, phase) {
        try {
            const [start] = NC.getPhaseRange(ny, nm, phase);
            const note = await createNCNote(start, "nc-phase");
            if (note) {
                const leaf = this.app.workspace.getUnpinnedLeaf();
                await leaf.openFile(note, { active: true });
                activeFile.setFile(note);
            }
        }
        catch (e) {
            console.error("[New Calendar Suite] Error opening NC phase note:", e);
            new obsidian.Notice(`Error: ${e.message || e}`);
        }
    }
}

/**
 * Public API for DataviewJS, Templater, and other plugins.
 * Access via `window.NCDates`.
 *
 * Usage examples:
 *   // Today's NC date
 *   const today = window.NCDates.today();
 *
 *   // Navigate to next NC month's start
 *   const next = window.NCDates.nextPeriod(today, "nc-month");
 *
 *   // Get GC moments for a Dataview WHERE clause
 *   const [start, end] = window.NCDates.getPeriodRange("nc-month", 4, 6);
 *   dv.pages().where(p => p.file.day >= start && p.file.day < end);
 *
 *   // Parse an NC filename
 *   const parsed = window.NCDates.parseFilename("NC-04-06-P2", "NC-YY-MM-[P]P", "nc-phase");
 *
 *   // Compare two NC dates
 *   window.NCDates.compare({ny:4,nm:6,nd:1}, {ny:4,nm:6,nd:15}); // -1
 */
const NCDatesAPI = {
    // ── NC date info ──────────────────────────────────
    today: NC.today,
    yesterday: NC.yesterday,
    tomorrow: NC.tomorrow,
    /** Get full NC info for any GC moment or date string */
    get: NC.getNCDate,
    /** Convert GC (gy, gm, gd) to NC */
    convert: NC.toNewCalendar,
    // ── Navigation ────────────────────────────────────
    nextPeriod: NC.nextPeriod,
    prevPeriod: NC.prevPeriod,
    addDays: NC.addDays,
    // ── Comparison ────────────────────────────────────
    compare: NC.compare,
    // ── Ranges (for Dataview WHERE clauses) ───────────
    /** Get [startMoment, endMoment] for any NC period */
    getPeriodRange: NC.getPeriodRange,
    // ── String helpers ────────────────────────────────
    /** Format NC {ny,nm,nd} as "YY-MM-DD" */
    toDateString: NC.toDateString,
    /** Parse "YY-MM-DD" → {ny,nm,nd,phase,season,color} */
    parseDateString: NC.parseDateString,
    /** Format any GC date using NC.format(pattern) */
    format: NC.format,
    /** Smart format from filename or now */
    smartFormat: NC.smartFormat,
    // ── NC calendar structure ─────────────────────────
    getPhase: NC.getPhase,
    getSeason: NC.getSeason,
    getPhaseRange: NC.getPhaseRange,
    getSeasonMonths: NC.getSeasonMonths,
    getMonthRange: NC.getMonthRange,
    getNCMonthStart: NC.getNCMonthStart,
    getNCWeekOfMonth: NC.getNCWeekOfMonth,
    // ── Filename parsing ──────────────────────────────
    parseFilename: parseNCFilename,
    buildKey: buildNCKey,
    buildFormatRegex: buildNCFormatRegex,
    // ── Cross-calendar mapping ────────────────────────
    /** Rough GC year for an NC year / month / season (use start boundary) */
    approxGCYear: NC.approxGCYear,
    // ── i18n ──────────────────────────────────────────
    numToChinese: NC.numToChinese,
};
class CalendarPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.ribbonEl = null;
    }
    onunload() {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).forEach((leaf) => leaf.detach());
        this.app.workspace.getLeavesOfType(VIEW_TYPE_NC_CALENDAR).forEach((leaf) => leaf.detach());
    }
    async onload() {
        window.NCEngine = NC;
        window.NCNotes = NCNotesAPI;
        window.NCDates = NCDatesAPI;
        this.options = defaultSettings;
        this.register(settings.subscribe((value) => {
            this.options = value;
            this.loadHolidays();
            this.onSettingsUpdate();
        }));
        await this.loadOptions();
        await migrateIfNeeded(this);
        this.registerView(VIEW_TYPE_CALENDAR, (leaf) => (this.view = new CalendarView(leaf)));
        this.registerView(VIEW_TYPE_NC_CALENDAR, (leaf) => (this.ncView = new NCView(leaf)));
        this.addCommand({
            id: "show-gc-calendar-view",
            name: "Open GC view",
            checkCallback: (checking) => {
                if (checking)
                    return this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0;
                this.initLeaf(VIEW_TYPE_CALENDAR);
            },
        });
        this.addCommand({
            id: "show-nc-calendar-view",
            name: "Open NC view",
            checkCallback: (checking) => {
                if (checking)
                    return this.app.workspace.getLeavesOfType(VIEW_TYPE_NC_CALENDAR).length === 0;
                this.initLeaf(VIEW_TYPE_NC_CALENDAR);
            },
        });
        this.addCommand({
            id: "reveal-active-note",
            name: "Reveal active note",
            callback: () => { var _a; (_a = this.view) === null || _a === void 0 ? void 0 : _a.revealActiveNote(); if (this.ncView)
                this.ncView.revealActiveNote(); },
        });
        this.addSettingTab(new CalendarSettingsTab(this.app, this));
        this.app.workspace.onLayoutReady(() => this.onLayoutReady());
        if (this.app.workspace.layoutReady)
            this.onLayoutReady();
    }
    onLayoutReady() {
        this.configureCommands();
        this.configureRibbonIcons();
        this.initLeaf(VIEW_TYPE_CALENDAR);
    }
    // ── Commands ─────────────────────────────────────────────────
    isEnabled(key) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
        const o = this.options;
        switch (key) {
            case "daily": return (_b = (_a = o.daily) === null || _a === void 0 ? void 0 : _a.enabled) !== null && _b !== void 0 ? _b : true;
            case "weekly": return (_d = (_c = o.weekly) === null || _c === void 0 ? void 0 : _c.enabled) !== null && _d !== void 0 ? _d : false;
            case "monthly": return (_f = (_e = o.monthly) === null || _e === void 0 ? void 0 : _e.enabled) !== null && _f !== void 0 ? _f : false;
            case "quarterly": return (_h = (_g = o.quarterly) === null || _g === void 0 ? void 0 : _g.enabled) !== null && _h !== void 0 ? _h : false;
            case "yearly": return (_k = (_j = o.yearly) === null || _j === void 0 ? void 0 : _j.enabled) !== null && _k !== void 0 ? _k : false;
            case "nc-phase": return (_m = (_l = o.ncPhase) === null || _l === void 0 ? void 0 : _l.enabled) !== null && _m !== void 0 ? _m : false;
            case "nc-month": return (_p = (_o = o.ncMonth) === null || _o === void 0 ? void 0 : _o.enabled) !== null && _p !== void 0 ? _p : true;
            case "nc-season": return (_r = (_q = o.ncSeason) === null || _q === void 0 ? void 0 : _q.enabled) !== null && _r !== void 0 ? _r : false;
            case "nc-year": return (_t = (_s = o.ncYear) === null || _s === void 0 ? void 0 : _s.enabled) !== null && _t !== void 0 ? _t : false;
            default: return false;
        }
    }
    configureCommands() {
        const app = this.app;
        const all = ["daily", "weekly", "monthly", "quarterly", "yearly", "nc-phase", "nc-month", "nc-season", "nc-year"];
        for (const p of all) {
            if (!this.isEnabled(p)) {
                ["open", "next", "prev"].forEach((a) => this.app.commands.removeCommand(`new-calendar-suite:${a}-${p}-note`));
                continue;
            }
            const openFn = async (date, split) => {
                var _a, _b;
                let note;
                if (["monthly", "quarterly", "yearly"].includes(p)) {
                    const creators = { monthly: createMonthlyNote, quarterly: createQuarterlyNote, yearly: createYearlyNote };
                    note = await creators[p](date.clone().startOf(p === "yearly" ? "year" : p === "quarterly" ? "quarter" : "month"));
                }
                else if (p.startsWith("nc-")) {
                    note = await createNCNote(date, p);
                }
                else if (p === "daily") {
                    (_a = this.view) === null || _a === void 0 ? void 0 : _a.openOrCreateDailyNote(date, split);
                    return;
                }
                else if (p === "weekly") {
                    (_b = this.view) === null || _b === void 0 ? void 0 : _b.openOrCreateWeeklyNote(date, split);
                    return;
                }
                if (note) {
                    const leaf = split ? app.workspace.splitActiveLeaf() : app.workspace.getUnpinnedLeaf();
                    await leaf.openFile(note, { active: true });
                }
            };
            this.addCommand({ id: `open-${p}-note`, name: `Open ${p} note`, callback: () => openFn(window.moment(), false) });
        }
    }
    // ── Ribbon ───────────────────────────────────────────────────
    configureRibbonIcons() {
        if (this.ribbonEl) {
            this.ribbonEl.detach();
            this.ribbonEl = null;
        }
        const first = ["daily", "weekly", "monthly", "quarterly", "yearly", "nc-phase", "nc-month", "nc-season", "nc-year"].find((p) => this.isEnabled(p));
        if (!first)
            return;
        this.ribbonEl = this.addRibbonIcon("calendar-with-checkmark", `Open ${first} note`, (ev) => {
            const app = this.app;
            (async () => {
                let note;
                if (["monthly", "quarterly", "yearly"].includes(first)) {
                    const creators = { monthly: createMonthlyNote, quarterly: createQuarterlyNote, yearly: createYearlyNote };
                    note = await creators[first](window.moment().clone().startOf(first === "yearly" ? "year" : first === "quarterly" ? "quarter" : "month"));
                }
                else if (first.startsWith("nc-")) {
                    note = await createNCNote(window.moment(), first);
                }
                if (note) {
                    const leaf = app.workspace.getUnpinnedLeaf();
                    await leaf.openFile(note, { active: true });
                }
            })();
        });
    }
    onSettingsUpdate() {
        this.configureCommands();
        this.configureRibbonIcons();
        dailyNotes.reindex();
        weeklyNotes.reindex();
        monthlyNotes.reindex();
        quarterlyNotes.reindex();
        yearlyNotes.reindex();
        ncPhaseNotes.reindex();
        ncMonthNotes.reindex();
        ncSeasonNotes.reindex();
        ncYearNotes.reindex();
        this.app.workspace.trigger(SETTINGS_UPDATED);
    }
    // ── View init ────────────────────────────────────────────────
    initLeaf(type) {
        if (this.app.workspace.getLeavesOfType(type).length)
            return;
        this.app.workspace.getRightLeaf(false).setViewState({ type });
    }
    async loadOptions() {
        const options = await this.loadData();
        settings.update((old) => (Object.assign(Object.assign({}, old), (options || {}))));
        await this.saveData(this.options);
    }
    async writeOptions(changeOpts) {
        settings.update((old) => (Object.assign(Object.assign({}, old), changeOpts(old))));
        await this.saveData(this.options);
    }
    async loadHolidays() {
        const region = this.options.holidayRegion;
        if (!region || region === "None") {
            holidays.set({});
            return;
        }
        const holidayPath = `${this.manifest.dir}/holidays/${region}`;
        const adapter = this.app.vault.adapter;
        const holidayMap = {};
        try {
            if (await adapter.exists(holidayPath)) {
                const result = await adapter.list(holidayPath);
                for (const file of result.files) {
                    if (file.endsWith(".json")) {
                        const content = await adapter.read(file);
                        const data = JSON.parse(content);
                        if (data.dates && Array.isArray(data.dates)) {
                            data.dates.forEach((d) => { if (d.date && d.type)
                                holidayMap[d.date] = { type: d.type, name: d.name || "" }; });
                        }
                    }
                }
            }
        }
        catch (e) {
            console.error("Failed to load holidays", e);
        }
        holidays.set(holidayMap);
    }
}

module.exports = CalendarPlugin;
