'use strict';

var obsidian = require('obsidian');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var obsidian__default = /*#__PURE__*/_interopDefaultLegacy(obsidian);

const DEFAULT_WEEK_FORMAT = "gggg-[W]ww";
const DEFAULT_WORDS_PER_DOT = 250;
const VIEW_TYPE_CALENDAR = "gc-calendar";
const VIEW_TYPE_NC_CALENDAR = "nc-calendar";
const TRIGGER_ON_OPEN = "calendar:open";

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
function getDailyNoteSettings() {
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
function getWeeklyNoteSettings() {
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
function getMonthlyNoteSettings() {
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
function getDateUID(date, granularity = "day") {
    const ts = date.clone().startOf(granularity).format();
    return `${granularity}-${ts}`;
}
function removeEscapedCharacters(format) {
    return format.replace(/\[[^\]]*\]/g, ""); // remove everything within brackets
}
/**
 * XXX: When parsing dates that contain both week numbers and months,
 * Moment choses to ignore the week numbers. For the week dateUID, we
 * want the opposite behavior. Strip the MMM from the format to patch.
 */
function isFormatAmbiguous(format, granularity) {
    if (granularity === "week") {
        const cleanFormat = removeEscapedCharacters(format);
        return (/w{1,2}/i.test(cleanFormat) &&
            (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat)));
    }
    return false;
}
function getDateFromFile(file, granularity) {
    const getSettings = {
        day: getDailyNoteSettings,
        week: getWeeklyNoteSettings,
        month: getMonthlyNoteSettings,
    };
    const format = getSettings[granularity]().format.split("/").pop();
    const noteDate = window.moment(file.basename, format, true);
    if (!noteDate.isValid()) {
        return null;
    }
    if (isFormatAmbiguous(format, granularity)) {
        if (granularity === "week") {
            const cleanFormat = removeEscapedCharacters(format);
            if (/w{1,2}/i.test(cleanFormat)) {
                return window.moment(file.basename, 
                // If format contains week, remove day & month formatting
                format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""), false);
            }
        }
    }
    return noteDate;
}

// Credit: @creationix/path.js
function join(...partSegments) {
    // Split the inputs into a list of path commands.
    let parts = [];
    for (let i = 0, l = partSegments.length; i < l; i++) {
        parts = parts.concat(partSegments[i].split("/"));
    }
    // Interpret the path commands to get the new resolved path.
    const newParts = [];
    for (let i = 0, l = parts.length; i < l; i++) {
        const part = parts[i];
        // Remove leading and trailing slashes
        // Also remove "." segments
        if (!part || part === ".")
            continue;
        // Push new path segments.
        else
            newParts.push(part);
    }
    // Preserve the initial slash if there was one.
    if (parts[0] === "")
        newParts.unshift("");
    // Turn back into a single string path.
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
    const path = obsidian__default['default'].normalizePath(join(directory, filename));
    await ensureFolderExists(path);
    return path;
}
async function getTemplateInfo(template) {
    const { metadataCache, vault } = window.app;
    const templatePath = obsidian__default['default'].normalizePath(template);
    if (templatePath === "/") {
        return Promise.resolve(["", null]);
    }
    try {
        const templateFile = metadataCache.getFirstLinkpathDest(templatePath, "");
        const contents = await vault.cachedRead(templateFile);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IFoldInfo = window.app.foldManager.load(templateFile);
        return [contents, IFoldInfo];
    }
    catch (err) {
        console.error(`Failed to read the daily note template '${templatePath}'`, err);
        new obsidian__default['default'].Notice("Failed to read the daily note template");
        return ["", null];
    }
}

class DailyNotesFolderMissingError extends Error {
}
/**
 * This function mimics the behavior of the daily-notes plugin
 * so it will replace {{date}}, {{title}}, and {{time}} with the
 * formatted timestamp.
 *
 * Note: it has an added bonus that it's not 'today' specific.
 */
async function createDailyNote(date) {
    const app = window.app;
    const { vault } = app;
    const moment = window.moment;
    const { template, format, folder } = getDailyNoteSettings();
    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
    const filename = date.format(format);
    const normalizedPath = await getNotePath(folder, filename);
    try {
        const createdFile = await vault.create(normalizedPath, templateContents
            .replace(/{{\s*date\s*}}/gi, filename)
            .replace(/{{\s*time\s*}}/gi, moment().format("HH:mm"))
            .replace(/{{\s*title\s*}}/gi, filename)
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
        })
            .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(format))
            .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "d").format(format)));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.foldManager.save(createdFile, IFoldInfo);
        return createdFile;
    }
    catch (err) {
        console.error(`Failed to create file: '${normalizedPath}'`, err);
        new obsidian__default['default'].Notice("Unable to create new file.");
    }
}
function getDailyNote(date, dailyNotes) {
    return dailyNotes[getDateUID(date, "day")] ?? null;
}
function getAllDailyNotes() {
    /**
     * Find all daily notes in the daily note folder
     */
    const { vault } = window.app;
    const { folder } = getDailyNoteSettings();
    const dailyNotesFolder = vault.getAbstractFileByPath(obsidian__default['default'].normalizePath(folder));
    if (!dailyNotesFolder) {
        throw new DailyNotesFolderMissingError("Failed to find daily notes folder");
    }
    const dailyNotes = {};
    obsidian__default['default'].Vault.recurseChildren(dailyNotesFolder, (note) => {
        if (note instanceof obsidian__default['default'].TFile) {
            const date = getDateFromFile(note, "day");
            if (date) {
                const dateString = getDateUID(date, "day");
                dailyNotes[dateString] = note;
            }
        }
    });
    return dailyNotes;
}

class WeeklyNotesFolderMissingError extends Error {
}
function getDaysOfWeek() {
    const { moment } = window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
async function createWeeklyNote(date) {
    const { vault } = window.app;
    const { template, format, folder } = getWeeklyNoteSettings();
    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
    const filename = date.format(format);
    const normalizedPath = await getNotePath(folder, filename);
    try {
        const createdFile = await vault.create(normalizedPath, templateContents
            .replace(/{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi, (_, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
            const now = window.moment();
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
        })
            .replace(/{{\s*title\s*}}/gi, filename)
            .replace(/{{\s*time\s*}}/gi, window.moment().format("HH:mm"))
            .replace(/{{\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:(.*?)}}/gi, (_, dayOfWeek, momentFormat) => {
            const day = getDayOfWeekNumericalValue(dayOfWeek);
            return date.weekday(day).format(momentFormat.trim());
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.app.foldManager.save(createdFile, IFoldInfo);
        return createdFile;
    }
    catch (err) {
        console.error(`Failed to create file: '${normalizedPath}'`, err);
        new obsidian__default['default'].Notice("Unable to create new file.");
    }
}
function getWeeklyNote(date, weeklyNotes) {
    return weeklyNotes[getDateUID(date, "week")] ?? null;
}
function getAllWeeklyNotes() {
    const { vault } = window.app;
    const { folder } = getWeeklyNoteSettings();
    const weeklyNotesFolder = vault.getAbstractFileByPath(obsidian__default['default'].normalizePath(folder));
    if (!weeklyNotesFolder) {
        throw new WeeklyNotesFolderMissingError("Failed to find weekly notes folder");
    }
    const weeklyNotes = {};
    obsidian__default['default'].Vault.recurseChildren(weeklyNotesFolder, (note) => {
        if (note instanceof obsidian__default['default'].TFile) {
            const date = getDateFromFile(note, "week");
            if (date) {
                const dateString = getDateUID(date, "week");
                weeklyNotes[dateString] = note;
            }
        }
    });
    return weeklyNotes;
}

function appHasDailyNotesPluginLoaded() {
    const { app } = window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dailyNotesPlugin = app.internalPlugins.plugins["daily-notes"];
    if (dailyNotesPlugin && dailyNotesPlugin.enabled) {
        return true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodicNotes = app.plugins.getPlugin("periodic-notes");
    return periodicNotes && periodicNotes.settings?.daily?.enabled;
}
var appHasDailyNotesPluginLoaded_1 = appHasDailyNotesPluginLoaded;
var createDailyNote_1 = createDailyNote;
var createWeeklyNote_1 = createWeeklyNote;
var getAllDailyNotes_1 = getAllDailyNotes;
var getAllWeeklyNotes_1 = getAllWeeklyNotes;
var getDailyNote_1 = getDailyNote;
var getDailyNoteSettings_1 = getDailyNoteSettings;
var getDateFromFile_1 = getDateFromFile;
var getDateUID_1 = getDateUID;
var getWeeklyNote_1 = getWeeklyNote;
var getWeeklyNoteSettings_1 = getWeeklyNoteSettings;

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
const defaultSettings = Object.freeze({
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
});
function appHasPeriodicNotesPluginLoaded() {
    var _a, _b;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodicNotes = window.app.plugins.getPlugin("periodic-notes");
    return periodicNotes && ((_b = (_a = periodicNotes.settings) === null || _a === void 0 ? void 0 : _a.weekly) === null || _b === void 0 ? void 0 : _b.enabled);
}
class CalendarSettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        this.containerEl.empty();
        if (!appHasDailyNotesPluginLoaded_1()) {
            this.containerEl.createDiv("settings-banner", (banner) => {
                banner.createEl("h3", {
                    text: "⚠️ Daily Notes plugin not enabled",
                });
                banner.createEl("p", {
                    cls: "setting-item-description",
                    text: "The calendar is best used in conjunction with either the Daily Notes plugin or the Periodic Notes plugin (available in the Community Plugins catalog).",
                });
            });
        }
        this.containerEl.createEl("h3", {
            text: "General Settings",
        });
        this.addDotThresholdSetting();
        this.addWordCountOffsetSetting();
        this.addWeekStartSetting();
        this.addConfirmCreateSetting();
        this.addShowWeeklyNoteSetting();
        if (this.plugin.options.showWeeklyNote &&
            !appHasPeriodicNotesPluginLoaded()) {
            this.containerEl.createEl("h3", {
                text: "Weekly Note Settings",
            });
            this.containerEl.createEl("p", {
                cls: "setting-item-description",
                text: "Note: Weekly Note settings are moving. You are encouraged to install the 'Periodic Notes' plugin to keep the functionality in the future.",
            });
            this.addWeeklyNoteFormatSetting();
            this.addWeeklyNoteTemplateSetting();
            this.addWeeklyNoteFolderSetting();
        }
        this.containerEl.createEl("h3", {
            text: "Advanced Settings",
        });
        this.addLocaleOverrideSetting();
        this.containerEl.createEl("h3", {
            text: "Holiday System",
        });
        this.addHolidayRegionSetting();
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
    if (!file) {
        return null;
    }
    // TODO: I'm not checking the path!
    let date = getDateFromFile_1(file, "day");
    if (date) {
        return getDateUID_1(date, "day");
    }
    date = getDateFromFile_1(file, "week");
    if (date) {
        return getDateUID_1(date, "week");
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

function createDailyNotesStore() {
    let hasError = false;
    const store = writable(null);
    return Object.assign({ reindex: () => {
            try {
                const dailyNotes = getAllDailyNotes_1();
                store.set(dailyNotes);
                hasError = false;
            }
            catch (err) {
                if (!hasError) {
                    // Avoid error being shown multiple times
                    console.log("[Calendar] Failed to find daily notes folder", err);
                }
                store.set({});
                hasError = true;
            }
        } }, store);
}
function createWeeklyNotesStore() {
    let hasError = false;
    const store = writable(null);
    return Object.assign({ reindex: () => {
            try {
                const weeklyNotes = getAllWeeklyNotes_1();
                store.set(weeklyNotes);
                hasError = false;
            }
            catch (err) {
                if (!hasError) {
                    // Avoid error being shown multiple times
                    console.log("[Calendar] Failed to find weekly notes folder", err);
                }
                store.set({});
                hasError = true;
            }
        } }, store);
}
const settings = writable(defaultSettings);
const dailyNotes = createDailyNotesStore();
const weeklyNotes = createWeeklyNotesStore();
function createSelectedFileStore() {
    const store = writable(null);
    return Object.assign({ setFile: (file) => {
            const id = getDateUIDFromFile(file);
            store.set(id);
        } }, store);
}
const activeFile = createSelectedFileStore();
const holidays = writable({});

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
 */
async function tryToCreateDailyNote(date, inNewSplit, settings, cb) {
    const { workspace } = window.app;
    const { format } = getDailyNoteSettings_1();
    const filename = date.format(format);
    const createFile = async () => {
        const dailyNote = await createDailyNote_1(date);
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(dailyNote, { active: true });
        cb === null || cb === void 0 ? void 0 : cb(dailyNote);
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
 */
async function tryToCreateWeeklyNote(date, inNewSplit, settings, cb) {
    const { workspace } = window.app;
    const { format } = getWeeklyNoteSettings_1();
    const filename = date.format(format);
    const createFile = async () => {
        const dailyNote = await createWeeklyNote_1(date);
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(dailyNote, { active: true });
        cb === null || cb === void 0 ? void 0 : cb(dailyNote);
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
 * 获取公历对应的“检查点” (用于切分新历月份)
 */
const getGCheckPoint = (y, tgt) => {
    const key = `${y}-${tgt}`;
    if (OVERRIDES[key])
        return new Date(OVERRIDES[key] + 'T00:00:00Z');
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
    let d = getSolarTermDate(y, m % 24);
    if (useSunday)
        d = getNearestSunday(d);
    return d;
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
     */
    toNewCalendar: (gy, gm, gd) => {
        const targetDate = new Date(Date.UTC(gy, gm - 1, gd));
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
                    return { ny: res.ny, nm: res.nm, nd: nd, pNy, pNm, pNd, color: ncMonthColour[pNm] };
                }
            }
        }
        return { ny: 0, nm: 0, nd: 0, pNy: '00', pNm: '00', pNd: '00', color: '#333' };
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
     * 支持 CY: 汉字年, CM: 汉字月
     * 支持 [text]: 原样保留文本
     */
    format: (date, pattern) => {
        const m = window.moment(date);
        if (!m.isValid())
            return "";
        const nc = NC.toNewCalendar(m.year(), m.month() + 1, m.date());
        const weekNum = NC.getNCWeekOfMonth(m, nc.ny, nc.nm);
        const pWw = weekNum.toString().padStart(2, "0");
        let res = pattern;
        // 处理转义 [text] -> text (支持多组)
        res = res.replace(/\[(.*?)\]/g, "$1");
        // 注意替换顺序，先替换长的 YY 再替换 Y
        res = res.replace("YY", nc.pNy);
        res = res.replace("Y", nc.ny.toString());
        res = res.replace("MM", nc.pNm);
        res = res.replace("M", nc.nm.toString());
        res = res.replace("DD", nc.pNd);
        res = res.replace("D", nc.nd.toString());
        res = res.replace("ww", pWw);
        res = res.replace("w", weekNum.toString());
        res = res.replace("CY", nc.ny === 1 ? "元年" : numToChinese(nc.ny) + "年");
        res = res.replace("CM", numToChinese(nc.nm) + "月");
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
    }
};

/* src/ui/CalendarGrid.svelte generated by Svelte v3.35.0 */

const { document: document_1 } = globals;

function add_css() {
	var style = element("style");
	style.id = "svelte-wqq4jr-style";
	style.textContent = ".calendar-container.svelte-wqq4jr.svelte-wqq4jr{padding:10px;user-select:none;background-color:var(--background-primary);color:var(--text-normal)}.calendar-header.svelte-wqq4jr.svelte-wqq4jr{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;position:sticky;top:0;background-color:var(--background-primary);z-index:10;padding-top:5px;padding-bottom:10px}.calendar-title.svelte-wqq4jr.svelte-wqq4jr{font-weight:bold;font-size:1.1em;color:var(--text-accent);display:flex;align-items:center;gap:8px;flex:1}.nc-title-text.svelte-wqq4jr.svelte-wqq4jr{white-space:nowrap}.month-matrix.svelte-wqq4jr.svelte-wqq4jr{display:grid;grid-template-rows:repeat(2, 1fr);grid-template-columns:repeat(8, 1fr);gap:3px;margin-left:8px}.month-dot.svelte-wqq4jr.svelte-wqq4jr{width:5px;height:5px;border-radius:50%;background-color:var(--dot-color);opacity:0.25;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1)}.month-dot.active.svelte-wqq4jr.svelte-wqq4jr{opacity:1;transform:scale(1.4);box-shadow:0 0 5px var(--dot-color)}.nav-btn.svelte-wqq4jr.svelte-wqq4jr{cursor:pointer;background:none;border:1px solid var(--background-modifier-border);padding:2px 10px;margin-left:4px;border-radius:4px;color:var(--text-muted);font-size:0.9em}.nav-btn.svelte-wqq4jr.svelte-wqq4jr:hover{background-color:var(--background-modifier-hover);color:var(--text-normal)}.calendar-grid.svelte-wqq4jr.svelte-wqq4jr{width:100%;border-collapse:collapse;table-layout:fixed}.calendar-grid.svelte-wqq4jr th.svelte-wqq4jr{font-size:0.75em;color:var(--text-faint);text-transform:uppercase;font-weight:normal;padding-bottom:8px;width:13.1%;position:sticky;top:52px;background-color:var(--background-primary);z-index:9}.week-num-header.svelte-wqq4jr.svelte-wqq4jr{width:8% !important}.calendar-grid.svelte-wqq4jr td.svelte-wqq4jr{cursor:pointer;vertical-align:top;height:92px;border:1px solid transparent;transition:background-color 0.1s;overflow:hidden}.calendar-grid.svelte-wqq4jr td.svelte-wqq4jr:hover{background-color:var(--background-modifier-hover);border-radius:4px}.day-content.svelte-wqq4jr.svelte-wqq4jr{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;height:100%;padding:4px 2px}.primary-date.svelte-wqq4jr.svelte-wqq4jr{font-size:1em;line-height:1.2}.secondary-date.svelte-wqq4jr.svelte-wqq4jr{font-size:0.7em;line-height:1.2;margin-top:1px;white-space:nowrap}.not-current-month.svelte-wqq4jr.svelte-wqq4jr{opacity:0.3}.is-holiday.svelte-wqq4jr.svelte-wqq4jr{background-color:rgba(255, 0, 0, 0.05)}.is-transfer-workday.svelte-wqq4jr.svelte-wqq4jr{background-color:rgba(var(--text-muted-rgb), 0.1)}.is-selected.svelte-wqq4jr.svelte-wqq4jr{box-shadow:inset 0 0 0 1px var(--text-accent) !important;border-radius:4px;position:relative;z-index:0}.is-today.svelte-wqq4jr.svelte-wqq4jr{box-shadow:inset 0 0 0 2px var(--text-accent) !important;border-radius:4px;z-index:1;position:relative}.is-today.svelte-wqq4jr .primary-date.svelte-wqq4jr{color:var(--text-accent);font-weight:bold}.dots.svelte-wqq4jr.svelte-wqq4jr{display:flex;justify-content:center;gap:2px;margin-top:2px;min-height:6px}.dot.svelte-wqq4jr.svelte-wqq4jr{width:4px;height:4px;border-radius:50%;background-color:var(--dot-color);border:1px solid var(--dot-color)}.dot.hollow.svelte-wqq4jr.svelte-wqq4jr{background-color:transparent !important}.dot.overflow-dot.svelte-wqq4jr.svelte-wqq4jr{width:6px;height:6px;border-radius:1px;background-color:var(--text-accent);border-color:var(--text-accent);transform:rotate(45deg)}.day-info.svelte-wqq4jr.svelte-wqq4jr{font-size:0.65em;line-height:1.1;margin-top:2px;color:var(--text-muted);text-align:center;word-break:break-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.holiday-name.svelte-wqq4jr.svelte-wqq4jr{font-size:0.65em;line-height:1.1;color:var(--text-accent);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;font-weight:500}.week-num.svelte-wqq4jr.svelte-wqq4jr{font-size:0.7em;color:var(--text-faint);vertical-align:middle !important}.week-num-stack.svelte-wqq4jr.svelte-wqq4jr{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.2}.nc-week.svelte-wqq4jr.svelte-wqq4jr{font-size:1.3em;font-weight:bold}.gc-week.svelte-wqq4jr.svelte-wqq4jr{font-size:0.85em;color:var(--text-faint)}";
	append(document_1.head, style);
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[30] = list[i];
	child_ctx[32] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[33] = list[i];
	child_ctx[35] = i;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[36] = list[i];
	return child_ctx;
}

function get_each_context_3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[33] = list[i];
	return child_ctx;
}

function get_each_context_4(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[41] = list[i];
	return child_ctx;
}

// (222:23) 
function create_if_block_6(ctx) {
	let div0;
	let t0;

	let t1_value = (/*ncInfo*/ ctx[7].ny === 1
	? "元年"
	: `${numToChinese(/*ncInfo*/ ctx[7].ny)}年`) + "";

	let t1;
	let t2;
	let span;
	let t3_value = numToChinese(/*ncInfo*/ ctx[7].nm) + "";
	let t3;
	let t4;
	let t5;
	let div1;
	let each_value_4 = /*monthIndices*/ ctx[11];
	let each_blocks = [];

	for (let i = 0; i < each_value_4.length; i += 1) {
		each_blocks[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
	}

	return {
		c() {
			div0 = element("div");
			t0 = text("新历");
			t1 = text(t1_value);
			t2 = space();
			span = element("span");
			t3 = text(t3_value);
			t4 = text("月");
			t5 = space();
			div1 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			set_style(span, "color", /*ncInfo*/ ctx[7].color);
			attr(div0, "class", "nc-title-text svelte-wqq4jr");
			attr(div1, "class", "month-matrix svelte-wqq4jr");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			append(div0, t0);
			append(div0, t1);
			append(div0, t2);
			append(div0, span);
			append(span, t3);
			append(span, t4);
			insert(target, t5, anchor);
			insert(target, div1, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div1, null);
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*ncInfo*/ 128 && t1_value !== (t1_value = (/*ncInfo*/ ctx[7].ny === 1
			? "元年"
			: `${numToChinese(/*ncInfo*/ ctx[7].ny)}年`) + "")) set_data(t1, t1_value);

			if (dirty[0] & /*ncInfo*/ 128 && t3_value !== (t3_value = numToChinese(/*ncInfo*/ ctx[7].nm) + "")) set_data(t3, t3_value);

			if (dirty[0] & /*ncInfo*/ 128) {
				set_style(span, "color", /*ncInfo*/ ctx[7].color);
			}

			if (dirty[0] & /*monthIndices, ncInfo*/ 2176) {
				each_value_4 = /*monthIndices*/ ctx[11];
				let i;

				for (i = 0; i < each_value_4.length; i += 1) {
					const child_ctx = get_each_context_4(ctx, each_value_4, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_4(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div1, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_4.length;
			}
		},
		d(detaching) {
			if (detaching) detach(div0);
			if (detaching) detach(t5);
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (220:6) {#if mode === "GC"}
function create_if_block_5(ctx) {
	let t;

	return {
		c() {
			t = text(/*title*/ ctx[9]);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*title*/ 512) set_data(t, /*title*/ ctx[9]);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (229:10) {#each monthIndices as mIdx}
function create_each_block_4(ctx) {
	let div;

	return {
		c() {
			div = element("div");
			attr(div, "class", "month-dot svelte-wqq4jr");
			set_style(div, "--dot-color", ncMonthColour[/*mIdx*/ ctx[41]]);
			attr(div, "title", "" + (parseInt(/*mIdx*/ ctx[41]) + "月"));
			toggle_class(div, "active", /*ncInfo*/ ctx[7].nm === parseInt(/*mIdx*/ ctx[41]));
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*ncInfo, monthIndices*/ 2176) {
				toggle_class(div, "active", /*ncInfo*/ ctx[7].nm === parseInt(/*mIdx*/ ctx[41]));
			}
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (250:8) {#if showWeekNums}
function create_if_block_4(ctx) {
	let th;

	return {
		c() {
			th = element("th");
			attr(th, "class", "week-num-header svelte-wqq4jr");
		},
		m(target, anchor) {
			insert(target, th, anchor);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (253:8) {#each weekDays as day}
function create_each_block_3(ctx) {
	let th;
	let t_value = /*day*/ ctx[33] + "";
	let t;

	return {
		c() {
			th = element("th");
			t = text(t_value);
			attr(th, "class", "svelte-wqq4jr");
		},
		m(target, anchor) {
			insert(target, th, anchor);
			append(th, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*weekDays*/ 1024 && t_value !== (t_value = /*day*/ ctx[33] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (261:10) {#if showWeekNums}
function create_if_block_2(ctx) {
	let td;
	let mounted;
	let dispose;

	function select_block_type_1(ctx, dirty) {
		if (/*mode*/ ctx[0] === "NC" && /*ncInfo*/ ctx[7]) return create_if_block_3;
		return create_else_block;
	}

	let current_block_type = select_block_type_1(ctx);
	let if_block = current_block_type(ctx);

	function click_handler() {
		return /*click_handler*/ ctx[22](/*week*/ ctx[30]);
	}

	return {
		c() {
			td = element("td");
			if_block.c();
			attr(td, "class", "week-num svelte-wqq4jr");
			toggle_class(td, "is-selected", /*selectedId*/ ctx[1] === getDateUID_1(/*week*/ ctx[30][0].date, "week"));
		},
		m(target, anchor) {
			insert(target, td, anchor);
			if_block.m(td, null);

			if (!mounted) {
				dispose = listen(td, "click", click_handler);
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

			if (dirty[0] & /*selectedId, days*/ 258) {
				toggle_class(td, "is-selected", /*selectedId*/ ctx[1] === getDateUID_1(/*week*/ ctx[30][0].date, "week"));
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

// (276:14) {:else}
function create_else_block(ctx) {
	let t_value = /*week*/ ctx[30][0].date.format("ww") + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days*/ 256 && t_value !== (t_value = /*week*/ ctx[30][0].date.format("ww") + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (267:14) {#if mode === "NC" && ncInfo}
function create_if_block_3(ctx) {
	let div2;
	let div0;
	let t0_value = NC.getNCWeekOfMonth(/*week*/ ctx[30][0].date, /*ncInfo*/ ctx[7].ny, /*ncInfo*/ ctx[7].nm) + "";
	let t0;
	let t1;
	let div1;
	let t2_value = /*week*/ ctx[30][0].date.format("ww") + "";
	let t2;

	return {
		c() {
			div2 = element("div");
			div0 = element("div");
			t0 = text(t0_value);
			t1 = space();
			div1 = element("div");
			t2 = text(t2_value);
			attr(div0, "class", "nc-week svelte-wqq4jr");
			set_style(div0, "color", /*ncInfo*/ ctx[7].color);
			attr(div1, "class", "gc-week svelte-wqq4jr");
			attr(div2, "class", "week-num-stack svelte-wqq4jr");
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
			if (dirty[0] & /*days, ncInfo*/ 384 && t0_value !== (t0_value = NC.getNCWeekOfMonth(/*week*/ ctx[30][0].date, /*ncInfo*/ ctx[7].ny, /*ncInfo*/ ctx[7].nm) + "")) set_data(t0, t0_value);

			if (dirty[0] & /*ncInfo*/ 128) {
				set_style(div0, "color", /*ncInfo*/ ctx[7].color);
			}

			if (dirty[0] & /*days*/ 256 && t2_value !== (t2_value = /*week*/ ctx[30][0].date.format("ww") + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(div2);
		}
	};
}

// (299:16) {#if day.metadata.holidayName}
function create_if_block_1(ctx) {
	let div;
	let t_value = /*day*/ ctx[33].metadata.holidayName + "";
	let t;

	return {
		c() {
			div = element("div");
			t = text(t_value);
			attr(div, "class", "holiday-name svelte-wqq4jr");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days*/ 256 && t_value !== (t_value = /*day*/ ctx[33].metadata.holidayName + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (303:18) {#each day.metadata.dots as dot}
function create_each_block_2(ctx) {
	let span;
	let span_class_value;

	return {
		c() {
			span = element("span");
			attr(span, "class", span_class_value = "dot " + (/*dot*/ ctx[36].className || "") + " svelte-wqq4jr");

			set_style(span, "--dot-color", /*dot*/ ctx[36].color === "default"
			? "var(--text-muted)"
			: /*dot*/ ctx[36].color);

			toggle_class(span, "hollow", !/*dot*/ ctx[36].isFilled);
		},
		m(target, anchor) {
			insert(target, span, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days*/ 256 && span_class_value !== (span_class_value = "dot " + (/*dot*/ ctx[36].className || "") + " svelte-wqq4jr")) {
				attr(span, "class", span_class_value);
			}

			if (dirty[0] & /*days*/ 256) {
				set_style(span, "--dot-color", /*dot*/ ctx[36].color === "default"
				? "var(--text-muted)"
				: /*dot*/ ctx[36].color);
			}

			if (dirty[0] & /*days, days*/ 256) {
				toggle_class(span, "hollow", !/*dot*/ ctx[36].isFilled);
			}
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (311:16) {#if day.metadata.info}
function create_if_block(ctx) {
	let div;
	let t_value = /*day*/ ctx[33].metadata.info + "";
	let t;

	return {
		c() {
			div = element("div");
			t = text(t_value);
			attr(div, "class", "day-info svelte-wqq4jr");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*days*/ 256 && t_value !== (t_value = /*day*/ ctx[33].metadata.info + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (281:10) {#each week as day, j}
function create_each_block_1(ctx) {
	let td;
	let div3;
	let div0;

	let t0_value = (/*mode*/ ctx[0] === "GC"
	? /*day*/ ctx[33].date.date()
	: /*day*/ ctx[33].nc.pNd) + "";

	let t0;
	let t1;
	let div1;

	let t2_value = getSecondaryText(
		/*day*/ ctx[33],
		/*j*/ ctx[35] > 0
		? /*week*/ ctx[30][/*j*/ ctx[35] - 1]
		: /*i*/ ctx[32] > 0
			? /*days*/ ctx[8][/*i*/ ctx[32] - 1][6]
			: null,
		/*mode*/ ctx[0]
	) + "";

	let t2;
	let t3;
	let t4;
	let div2;
	let t5;
	let mounted;
	let dispose;
	let if_block0 = /*day*/ ctx[33].metadata.holidayName && create_if_block_1(ctx);
	let each_value_2 = /*day*/ ctx[33].metadata.dots;
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	let if_block1 = /*day*/ ctx[33].metadata.info && create_if_block(ctx);

	function click_handler_1(...args) {
		return /*click_handler_1*/ ctx[23](/*day*/ ctx[33], ...args);
	}

	function mouseenter_handler(...args) {
		return /*mouseenter_handler*/ ctx[24](/*day*/ ctx[33], ...args);
	}

	function contextmenu_handler(...args) {
		return /*contextmenu_handler*/ ctx[25](/*day*/ ctx[33], ...args);
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
			div2 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t5 = space();
			if (if_block1) if_block1.c();
			attr(div0, "class", "primary-date svelte-wqq4jr");

			set_style(div0, "color", /*mode*/ ctx[0] === "NC"
			? /*day*/ ctx[33].nc.color
			: "inherit");

			attr(div1, "class", "secondary-date svelte-wqq4jr");

			set_style(div1, "color", /*mode*/ ctx[0] === "GC"
			? /*day*/ ctx[33].nc.color
			: "inherit");

			attr(div2, "class", "dots svelte-wqq4jr");
			attr(div3, "class", "day-content svelte-wqq4jr");
			attr(td, "class", "svelte-wqq4jr");
			toggle_class(td, "is-today", /*day*/ ctx[33].isToday);
			toggle_class(td, "is-selected", /*selectedId*/ ctx[1] === getDateUID_1(/*day*/ ctx[33].date, "day"));
			toggle_class(td, "not-current-month", !/*day*/ ctx[33].isCurrentMonth);
			toggle_class(td, "is-holiday", /*day*/ ctx[33].dayType === "public_holiday");
			toggle_class(td, "is-transfer-workday", /*day*/ ctx[33].dayType === "transfer_workday");
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
			append(div3, div2);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div2, null);
			}

			append(div3, t5);
			if (if_block1) if_block1.m(div3, null);

			if (!mounted) {
				dispose = [
					listen(td, "click", click_handler_1),
					listen(td, "mouseenter", mouseenter_handler),
					listen(td, "contextmenu", contextmenu_handler)
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*mode, days*/ 257 && t0_value !== (t0_value = (/*mode*/ ctx[0] === "GC"
			? /*day*/ ctx[33].date.date()
			: /*day*/ ctx[33].nc.pNd) + "")) set_data(t0, t0_value);

			if (dirty[0] & /*mode, days*/ 257) {
				set_style(div0, "color", /*mode*/ ctx[0] === "NC"
				? /*day*/ ctx[33].nc.color
				: "inherit");
			}

			if (dirty[0] & /*days, mode*/ 257 && t2_value !== (t2_value = getSecondaryText(
				/*day*/ ctx[33],
				/*j*/ ctx[35] > 0
				? /*week*/ ctx[30][/*j*/ ctx[35] - 1]
				: /*i*/ ctx[32] > 0
					? /*days*/ ctx[8][/*i*/ ctx[32] - 1][6]
					: null,
				/*mode*/ ctx[0]
			) + "")) set_data(t2, t2_value);

			if (dirty[0] & /*mode, days*/ 257) {
				set_style(div1, "color", /*mode*/ ctx[0] === "GC"
				? /*day*/ ctx[33].nc.color
				: "inherit");
			}

			if (/*day*/ ctx[33].metadata.holidayName) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_1(ctx);
					if_block0.c();
					if_block0.m(div3, t4);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (dirty[0] & /*days*/ 256) {
				each_value_2 = /*day*/ ctx[33].metadata.dots;
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

			if (/*day*/ ctx[33].metadata.info) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block(ctx);
					if_block1.c();
					if_block1.m(div3, null);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (dirty[0] & /*days*/ 256) {
				toggle_class(td, "is-today", /*day*/ ctx[33].isToday);
			}

			if (dirty[0] & /*selectedId, days*/ 258) {
				toggle_class(td, "is-selected", /*selectedId*/ ctx[1] === getDateUID_1(/*day*/ ctx[33].date, "day"));
			}

			if (dirty[0] & /*days*/ 256) {
				toggle_class(td, "not-current-month", !/*day*/ ctx[33].isCurrentMonth);
			}

			if (dirty[0] & /*days*/ 256) {
				toggle_class(td, "is-holiday", /*day*/ ctx[33].dayType === "public_holiday");
			}

			if (dirty[0] & /*days*/ 256) {
				toggle_class(td, "is-transfer-workday", /*day*/ ctx[33].dayType === "transfer_workday");
			}
		},
		d(detaching) {
			if (detaching) detach(td);
			if (if_block0) if_block0.d();
			destroy_each(each_blocks, detaching);
			if (if_block1) if_block1.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (259:6) {#each days as week, i}
function create_each_block(ctx) {
	let tr;
	let t0;
	let t1;
	let if_block = /*showWeekNums*/ ctx[2] && create_if_block_2(ctx);
	let each_value_1 = /*week*/ ctx[30];
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
					if_block = create_if_block_2(ctx);
					if_block.c();
					if_block.m(tr, t0);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty[0] & /*days, selectedId, onClickDay, onHoverDay, onContextMenuDay, mode*/ 363) {
				each_value_1 = /*week*/ ctx[30];
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
		},
		d(detaching) {
			if (detaching) detach(tr);
			if (if_block) if_block.d();
			destroy_each(each_blocks, detaching);
		}
	};
}

function create_fragment$1(ctx) {
	let div3;
	let div2;
	let div0;
	let t0;
	let div1;
	let button0;
	let t2;
	let button1;
	let t4;
	let button2;
	let t6;
	let table;
	let thead;
	let tr;
	let t7;
	let t8;
	let tbody;
	let mounted;
	let dispose;

	function select_block_type(ctx, dirty) {
		if (/*mode*/ ctx[0] === "GC") return create_if_block_5;
		if (/*ncInfo*/ ctx[7]) return create_if_block_6;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type && current_block_type(ctx);
	let if_block1 = /*showWeekNums*/ ctx[2] && create_if_block_4();
	let each_value_3 = /*weekDays*/ ctx[10];
	let each_blocks_1 = [];

	for (let i = 0; i < each_value_3.length; i += 1) {
		each_blocks_1[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
	}

	let each_value = /*days*/ ctx[8];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div3 = element("div");
			div2 = element("div");
			div0 = element("div");
			if (if_block0) if_block0.c();
			t0 = space();
			div1 = element("div");
			button0 = element("button");
			button0.textContent = "<";
			t2 = space();
			button1 = element("button");
			button1.textContent = "Today";
			t4 = space();
			button2 = element("button");
			button2.textContent = ">";
			t6 = space();
			table = element("table");
			thead = element("thead");
			tr = element("tr");
			if (if_block1) if_block1.c();
			t7 = space();

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t8 = space();
			tbody = element("tbody");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div0, "class", "calendar-title svelte-wqq4jr");
			attr(button0, "class", "nav-btn svelte-wqq4jr");
			attr(button1, "class", "nav-btn svelte-wqq4jr");
			attr(button2, "class", "nav-btn svelte-wqq4jr");
			attr(div1, "class", "calendar-nav");
			attr(div2, "class", "calendar-header svelte-wqq4jr");
			attr(table, "class", "calendar-grid svelte-wqq4jr");
			attr(div3, "class", "calendar-container svelte-wqq4jr");
		},
		m(target, anchor) {
			insert(target, div3, anchor);
			append(div3, div2);
			append(div2, div0);
			if (if_block0) if_block0.m(div0, null);
			append(div2, t0);
			append(div2, div1);
			append(div1, button0);
			append(div1, t2);
			append(div1, button1);
			append(div1, t4);
			append(div1, button2);
			append(div3, t6);
			append(div3, table);
			append(table, thead);
			append(thead, tr);
			if (if_block1) if_block1.m(tr, null);
			append(tr, t7);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(tr, null);
			}

			append(table, t8);
			append(table, tbody);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tbody, null);
			}

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*prevMonth*/ ctx[12]),
					listen(button1, "click", /*goToday*/ ctx[14]),
					listen(button2, "click", /*nextMonth*/ ctx[13])
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

			if (/*showWeekNums*/ ctx[2]) {
				if (if_block1) ; else {
					if_block1 = create_if_block_4();
					if_block1.c();
					if_block1.m(tr, t7);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (dirty[0] & /*weekDays*/ 1024) {
				each_value_3 = /*weekDays*/ ctx[10];
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

			if (dirty[0] & /*days, selectedId, onClickDay, onHoverDay, onContextMenuDay, mode, onClickWeek, ncInfo, showWeekNums*/ 511) {
				each_value = /*days*/ ctx[8];
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
			if (detaching) detach(div3);

			if (if_block0) {
				if_block0.d();
			}

			if (if_block1) if_block1.d();
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
			const allNotes = get_store_value(dailyNotes);
			const holidayData = get_store_value(holidays);

			while (curr.isBefore(end) || curr.isSame(end, "day")) {
				const week = [];

				for (let i = 0; i < 7; i++) {
					const date = curr.clone();
					const dateStr = date.format("YYYY-MM-DD");
					const nc = NC.toNewCalendar(date.year(), date.month() + 1, date.date());
					let isCurrentMonth = false;

					if (m === "GC") {
						isCurrentMonth = date.isSame(display, "month");
					} else {
						isCurrentMonth = ncInfo && nc.ny === ncInfo.ny && nc.nm === ncInfo.nm;
					}

					// Fetch calendar-info from frontmatter
					let infoText = "";

					const note = getDailyNote_1(date, allNotes);

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

					week.push({
						date,
						isCurrentMonth,
						isToday: date.isSame(td, "day"),
						nc,
						dayType,
						metadata: { dots: [], info: infoText, holidayName }
					});

					curr.add(1, "day");
				}

				newDays.push(week);
			}

			$$invalidate(8, days = newDays);

			// Fetch other metadata
			for (const week of days) {
				for (const day of week) {
					const metaResults = yield Promise.all(srcs.map(s => s.getDailyMetadata(day.date)));
					day.metadata.dots = metaResults.flatMap(m => m.dots || []);
				}
			}

			$$invalidate(8, days = [...days]);
		});
	}

	function prevMonth() {
		if (mode === "GC") {
			$$invalidate(15, displayedMonth = displayedMonth.clone().subtract(1, "month"));
		} else {
			let ny = ncInfo.ny;
			let nm = ncInfo.nm - 1;

			if (nm < 1) {
				ny--;
				nm = ny === 2 ? 15 : 16;
			}

			if (ny < 1) return;
			$$invalidate(15, displayedMonth = NC.getNCMonthStart(ny, nm));
		}
	}

	function nextMonth() {
		if (mode === "GC") {
			$$invalidate(15, displayedMonth = displayedMonth.clone().add(1, "month"));
		} else {
			let ny = ncInfo.ny;
			let nm = ncInfo.nm + 1;
			const maxMonths = ny === 2 ? 15 : 16;

			if (nm > maxMonths) {
				ny++;
				nm = 1;
			}

			$$invalidate(15, displayedMonth = NC.getNCMonthStart(ny, nm));
		}
	}

	function goToday() {
		$$invalidate(15, displayedMonth = today.clone());
	}

	const click_handler = week => onClickWeek(week[0].date, false);
	const click_handler_1 = (day, e) => onClickDay(day.date, e.metaKey || e.ctrlKey);
	const mouseenter_handler = (day, e) => onHoverDay(day.date, e.target);
	const contextmenu_handler = (day, e) => onContextMenuDay(day.date, e);

	$$self.$$set = $$props => {
		if ("app" in $$props) $$invalidate(16, app = $$props.app);
		if ("mode" in $$props) $$invalidate(0, mode = $$props.mode);
		if ("displayedMonth" in $$props) $$invalidate(15, displayedMonth = $$props.displayedMonth);
		if ("today" in $$props) $$invalidate(17, today = $$props.today);
		if ("sources" in $$props) $$invalidate(18, sources = $$props.sources);
		if ("selectedId" in $$props) $$invalidate(1, selectedId = $$props.selectedId);
		if ("showWeekNums" in $$props) $$invalidate(2, showWeekNums = $$props.showWeekNums);
		if ("metadataUpdateTrigger" in $$props) $$invalidate(19, metadataUpdateTrigger = $$props.metadataUpdateTrigger);
		if ("onClickDay" in $$props) $$invalidate(3, onClickDay = $$props.onClickDay);
		if ("onClickWeek" in $$props) $$invalidate(4, onClickWeek = $$props.onClickWeek);
		if ("onHoverDay" in $$props) $$invalidate(5, onHoverDay = $$props.onHoverDay);
		if ("onHoverWeek" in $$props) $$invalidate(20, onHoverWeek = $$props.onHoverWeek);
		if ("onContextMenuDay" in $$props) $$invalidate(6, onContextMenuDay = $$props.onContextMenuDay);
		if ("onContextMenuWeek" in $$props) $$invalidate(21, onContextMenuWeek = $$props.onContextMenuWeek);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty[0] & /*displayedMonth*/ 32768) {
			dispatch("displayedMonthChange", displayedMonth);
		}

		if ($$self.$$.dirty[0] & /*mode, displayedMonth*/ 32769) {
			if (mode === "NC") {
				const info = NC.toNewCalendar(displayedMonth.year(), displayedMonth.month() + 1, displayedMonth.date());

				$$invalidate(7, ncInfo = {
					ny: info.ny,
					nm: info.nm,
					color: info.color
				});
			} else {
				$$invalidate(7, ncInfo = null);
			}
		}

		if ($$self.$$.dirty[0] & /*mode, displayedMonth, ncInfo*/ 32897) {
			$$invalidate(9, title = mode === "GC" && displayedMonth
			? displayedMonth.format("MMMM YYYY")
			: ncInfo ? toChineseYearMonth(ncInfo.ny, ncInfo.nm) : "");
		}

		if ($$self.$$.dirty[0] & /*displayedMonth, today, metadataUpdateTrigger, mode, sources*/ 950273) {
			if (displayedMonth && today && (metadataUpdateTrigger || true)) {
				updateGrid(displayedMonth, mode, sources, today);
			}
		}

		if ($$self.$$.dirty[0] & /*today*/ 131072) {
			$$invalidate(10, weekDays = Array.from({ length: 7 }, (_, i) => today.clone().startOf("week").add(i, "days").format("ddd")));
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
		ncInfo,
		days,
		title,
		weekDays,
		monthIndices,
		prevMonth,
		nextMonth,
		goToday,
		displayedMonth,
		app,
		today,
		sources,
		metadataUpdateTrigger,
		onHoverWeek,
		onContextMenuWeek,
		click_handler,
		click_handler_1,
		mouseenter_handler,
		contextmenu_handler
	];
}

class CalendarGrid extends SvelteComponent {
	constructor(options) {
		super();
		if (!document_1.getElementById("svelte-wqq4jr-style")) add_css();

		init(
			this,
			options,
			instance$1,
			create_fragment$1,
			safe_not_equal,
			{
				app: 16,
				mode: 0,
				displayedMonth: 15,
				today: 17,
				sources: 18,
				selectedId: 1,
				showWeekNums: 2,
				metadataUpdateTrigger: 19,
				onClickDay: 3,
				onClickWeek: 4,
				onHoverDay: 5,
				onHoverWeek: 20,
				onContextMenuDay: 6,
				onContextMenuWeek: 21
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
	let heartbeat = setInterval(
		() => {
			tick();
			const isViewingCurrentMonth = displayedMonth.isSame(today, "day");

			if (isViewingCurrentMonth) {
				$$invalidate(0, displayedMonth = today);
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

async function getTaskCounts(note) {
    if (!note) {
        return { remaining: 0, completed: 0 };
    }
    const { vault } = window.app;
    const fileContents = await vault.cachedRead(note);
    const remaining = (fileContents.match(/(-|\*) \[ \]/g) || []).length;
    const completed = (fileContents.match(/(-|\*) \[x\]/g) || []).length;
    return { remaining, completed };
}
async function getDotsForDailyNote$1(dailyNote) {
    if (!dailyNote) {
        return [];
    }
    const { remaining, completed } = await getTaskCounts(dailyNote);
    const dots = [];
    if (remaining > 0) {
        if (completed === 0) {
            // 有待办且全未完成：红色实心
            dots.push({
                className: "task-todo-urgent",
                color: "#F44336",
                isFilled: true,
            });
        }
        else {
            // 橙色不变 (有待办但也有已完成的)：橙色实心
            dots.push({
                className: "task-todo",
                color: "#FF9800",
                isFilled: true,
            });
        }
    }
    else if (completed > 0) {
        // 所有任务都完成了：绿色实心
        dots.push({
            className: "task-done",
            color: "#4CAF50",
            isFilled: true,
        });
    }
    return dots;
}
const tasksSource = {
    getDailyMetadata: async (date) => {
        const file = getDailyNote_1(date, get_store_value(dailyNotes));
        const dots = await getDotsForDailyNote$1(file);
        return {
            dots,
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        const dots = await getDotsForDailyNote$1(file);
        return {
            dots,
        };
    },
};

const NUM_MAX_DOTS = 5;
async function getDotsForDailyNote(dailyNote) {
    if (!dailyNote) {
        return [];
    }
    const { wordsPerDot = DEFAULT_WORDS_PER_DOT, wordCountOffset = 0 } = get_store_value(settings);
    const fileContents = await window.app.vault.cachedRead(dailyNote);
    const totalWordCount = getWordCount(fileContents);
    const effectiveWordCount = totalWordCount - wordCountOffset;
    const dots = [];
    if (effectiveWordCount > 0) {
        const rawDotCount = effectiveWordCount / wordsPerDot;
        if (rawDotCount > NUM_MAX_DOTS) {
            // Too many dots — replace with a single overflow indicator
            dots.push({
                color: "default",
                isFilled: true,
                className: "overflow-dot",
            });
        }
        else {
            const numSolidDots = clamp(Math.floor(rawDotCount), 1, NUM_MAX_DOTS);
            for (let i = 0; i < numSolidDots; i++) {
                dots.push({
                    color: "default",
                    isFilled: true,
                });
            }
        }
    }
    else if (totalWordCount > 0) {
        // 未超过偏置项但有内容：显示一个空心黑点 (表示仅有模板)
        dots.push({
            color: "var(--text-normal)",
            isFilled: false,
            className: "template-only-dot"
        });
    }
    return dots;
}
const wordCountSource = {
    getDailyMetadata: async (date) => {
        const file = getDailyNote_1(date, get_store_value(dailyNotes));
        const dots = await getDotsForDailyNote(file);
        return {
            dots,
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        const dots = await getDotsForDailyNote(file);
        return {
            dots,
        };
    },
};

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
        // Integration point: external plugins can listen for `calendar:open`
        // to feed in additional sources.
        const sources = [
            customTagsSource,
            streakSource,
            wordCountSource,
            tasksSource,
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
        const { format } = getDailyNoteSettings_1();
        const note = getDailyNote_1(date, get_store_value(dailyNotes));
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onHoverWeek(date, targetEl, isMetaPressed) {
        if (!isMetaPressed) {
            return;
        }
        const note = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        const { format } = getWeeklyNoteSettings_1();
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onContextMenuDay(date, event) {
        const note = getDailyNote_1(date, get_store_value(dailyNotes));
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
        const note = getWeeklyNote_1(date, get_store_value(weeklyNotes));
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
        if (getDateFromFile_1(file, "day")) {
            dailyNotes.reindex();
            this.updateActiveFile();
        }
        if (getDateFromFile_1(file, "week")) {
            weeklyNotes.reindex();
            this.updateActiveFile();
        }
    }
    async onFileModified(file) {
        const date = getDateFromFile_1(file, "day") || getDateFromFile_1(file, "week");
        if (date && this.calendar) {
            this.calendar.tick();
        }
    }
    onFileCreated(file) {
        if (this.app.workspace.layoutReady && this.calendar) {
            if (getDateFromFile_1(file, "day")) {
                dailyNotes.reindex();
                this.calendar.tick();
            }
            if (getDateFromFile_1(file, "week")) {
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
            let date = getDateFromFile_1(activeLeaf.view.file, "day");
            if (date) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
            // Check to see if the active note is a weekly-note
            const { format } = getWeeklyNoteSettings_1();
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
        const existingFile = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        if (!existingFile) {
            // File doesn't exist
            tryToCreateWeeklyNote(startOfWeek, inNewSplit, this.settings, (file) => {
                activeFile.setFile(file);
            });
            return;
        }
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile);
        activeFile.setFile(existingFile);
        workspace.setActiveLeaf(leaf, true, true);
    }
    async openOrCreateDailyNote(date, inNewSplit) {
        const { workspace } = this.app;
        const existingFile = getDailyNote_1(date, get_store_value(dailyNotes));
        if (!existingFile) {
            // File doesn't exist
            tryToCreateDailyNote(date, inNewSplit, this.settings, (dailyNote) => {
                activeFile.setFile(dailyNote);
            });
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mode = this.app.vault.getConfig("defaultViewMode");
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile, { active: true, mode });
        activeFile.setFile(existingFile);
    }
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
            customTagsSource,
            streakSource,
            wordCountSource,
            tasksSource,
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
        const date = getDateFromFile_1(file, "day") || getDateFromFile_1(file, "week");
        if (date && this.calendar) {
            this.tick();
        }
    }
    onFileCreated(file) {
        if (this.app.workspace.layoutReady && this.calendar) {
            if (getDateFromFile_1(file, "day")) {
                dailyNotes.reindex();
                this.tick();
            }
            if (getDateFromFile_1(file, "week")) {
                weeklyNotes.reindex();
                this.tick();
            }
        }
    }
    onFileDeleted(file) {
        if (this.app.workspace.layoutReady && this.calendar) {
            if (getDateFromFile_1(file, "day")) {
                dailyNotes.reindex();
                this.tick();
            }
            if (getDateFromFile_1(file, "week")) {
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
        const { format } = getDailyNoteSettings_1();
        const note = getDailyNote_1(date, get_store_value(dailyNotes));
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onHoverWeek(date, targetEl) {
        const note = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        const { format } = getWeeklyNoteSettings_1();
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onContextMenuDay(date, event) {
        const note = getDailyNote_1(date, get_store_value(dailyNotes));
        if (!note)
            return;
        showFileMenu(this.app, note, {
            x: event.pageX,
            y: event.pageY,
        });
    }
    onContextMenuWeek(date, event) {
        const note = getWeeklyNote_1(date, get_store_value(weeklyNotes));
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
            let date = getDateFromFile_1(activeLeaf.view.file, "day");
            if (date) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
            const { format } = getWeeklyNoteSettings_1();
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
        const existingFile = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        if (!existingFile) {
            tryToCreateWeeklyNote(startOfWeek, inNewSplit, get_store_value(settings), (file) => {
                activeFile.setFile(file);
            });
            return;
        }
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile);
        activeFile.setFile(existingFile);
        workspace.setActiveLeaf(leaf, true, true);
    }
    async openOrCreateDailyNote(date, inNewSplit) {
        const { workspace } = this.app;
        const existingFile = getDailyNote_1(date, get_store_value(dailyNotes));
        if (!existingFile) {
            tryToCreateDailyNote(date, inNewSplit, get_store_value(settings), (dailyNote) => {
                activeFile.setFile(dailyNote);
            });
            return;
        }
        const mode = this.app.vault.getConfig("defaultViewMode");
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile, { active: true, mode });
        activeFile.setFile(existingFile);
    }
}

class CalendarPlugin extends obsidian.Plugin {
    onunload() {
        this.app.workspace
            .getLeavesOfType(VIEW_TYPE_CALENDAR)
            .forEach((leaf) => leaf.detach());
        this.app.workspace
            .getLeavesOfType(VIEW_TYPE_NC_CALENDAR)
            .forEach((leaf) => leaf.detach());
    }
    async onload() {
        window.NCEngine = NC;
        this.register(settings.subscribe((value) => {
            this.options = value;
            this.loadHolidays();
        }));
        this.registerView(VIEW_TYPE_CALENDAR, (leaf) => (this.view = new CalendarView(leaf)));
        this.registerView(VIEW_TYPE_NC_CALENDAR, (leaf) => (this.ncView = new NCView(leaf)));
        this.addCommand({
            id: "show-gc-calendar-view",
            name: "Open GC view",
            checkCallback: (checking) => {
                if (checking) {
                    return (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0);
                }
                this.initLeaf(VIEW_TYPE_CALENDAR);
            },
        });
        this.addCommand({
            id: "show-nc-calendar-view",
            name: "Open NC view",
            checkCallback: (checking) => {
                if (checking) {
                    return (this.app.workspace.getLeavesOfType(VIEW_TYPE_NC_CALENDAR).length === 0);
                }
                this.initLeaf(VIEW_TYPE_NC_CALENDAR);
            },
        });
        this.addCommand({
            id: "open-weekly-note",
            name: "Open Weekly Note",
            checkCallback: (checking) => {
                if (checking) {
                    return !appHasPeriodicNotesPluginLoaded();
                }
                this.view.openOrCreateWeeklyNote(window.moment(), false);
            },
        });
        this.addCommand({
            id: "reveal-active-note",
            name: "Reveal active note",
            callback: () => {
                this.view.revealActiveNote();
                if (this.ncView)
                    this.ncView.revealActiveNote();
            },
        });
        await this.loadOptions();
        this.addSettingTab(new CalendarSettingsTab(this.app, this));
        if (this.app.workspace.layoutReady) {
            this.initLeaf(VIEW_TYPE_CALENDAR);
        }
        else {
            this.registerEvent(this.app.workspace.on("layout-ready", () => {
                this.initLeaf(VIEW_TYPE_CALENDAR);
            }));
        }
    }
    initLeaf(type) {
        if (this.app.workspace.getLeavesOfType(type).length) {
            return;
        }
        this.app.workspace.getRightLeaf(false).setViewState({
            type: type,
        });
    }
    async loadOptions() {
        const options = await this.loadData();
        settings.update((old) => {
            return Object.assign(Object.assign({}, old), (options || {}));
        });
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
                            data.dates.forEach((d) => {
                                if (d.date && d.type) {
                                    holidayMap[d.date] = { type: d.type, name: d.name || "" };
                                }
                            });
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
