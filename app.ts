// GJS import system
declare var imports: any;
declare var global: any;

import { log, setLoggingEnabled } from './logging';
import { ShellVersion } from './shellversion';
import { bind as bindHotkeys, unbind as unbindHotkeys, Bindings } from './hotkeys';
import { snapToNeighbors } from './snaptoneighbors';
import * as tilespec from "./tilespec";
import { BoxLayout, ClutterActor, MetaWindow, ShellApp, ShellWindowTracker, StBin, StButton, StWidget, Window, WindowType, WorkspaceManager as WorkspaceManagerInterface } from "./gnometypes";

/*****************************************************************

  This extension has been developed by vibou

  With the help of the gnome-shell community

  Edited by Kvis for gnome 3.8
  Edited by Lundal for gnome 3.18
  Edited by Sergey to add keyboard shortcuts and prefs dialog

 ******************************************************************/

/*****************************************************************
  CONST & VARS
 *****************************************************************/
// Library imports
const St = imports.gi.St;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const WindowManager = imports.ui.windowManager;
const MessageTray = imports.ui.messageTray;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const Signals = imports.signals;
const Workspace = imports.ui.workspace;
// Getter for accesing "get_active_workspace" on GNOME <=2.28 and >= 2.30
const WorkspaceManager: WorkspaceManagerInterface = (
    global.screen || global.workspace_manager);

// Extension imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

interface WorkArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Globals
const SETTINGS_GRID_SIZES = 'grid-sizes';
const SETTINGS_AUTO_CLOSE = 'auto-close';
const SETTINGS_ANIMATION = 'animation';
const SETTINGS_SHOW_ICON = 'show-icon';
const SETTINGS_GLOBAL_PRESETS = 'global-presets';
const SETTINGS_MOVERESIZE_ENABLED = 'moveresize-enabled';
const SETTINGS_WINDOW_MARGIN = 'window-margin';
const SETTINGS_WINDOW_MARGIN_FULLSCREEN_ENABLED = 'window-margin-fullscreen-enabled';
const SETTINGS_MAX_TIMEOUT = 'max-timeout';

const SETTINGS_INSETS_PRIMARY = 'insets-primary';
const SETTINGS_INSETS_PRIMARY_LEFT = 'insets-primary-left';
const SETTINGS_INSETS_PRIMARY_RIGHT = 'insets-primary-right';
const SETTINGS_INSETS_PRIMARY_TOP = 'insets-primary-top';
const SETTINGS_INSETS_PRIMARY_BOTTOM = 'insets-primary-bottom';
const SETTINGS_INSETS_SECONDARY = 'insets-secondary';
const SETTINGS_INSETS_SECONDARY_LEFT = 'insets-secondary-left';
const SETTINGS_INSETS_SECONDARY_RIGHT = 'insets-secondary-right';
const SETTINGS_INSETS_SECONDARY_TOP = 'insets-secondary-top';
const SETTINGS_INSETS_SECONDARY_BOTTOM = 'insets-secondary-bottom';
const SETTINGS_DEBUG = 'debug';

interface SettingsObject {
    get_boolean(name: string): boolean | undefined;
    get_string(name: string): string | undefined;
    get_int(name: string): number | undefined;
    connect(eventName: string, callback: () => void): void;
};

let launcher;
let tracker: ShellWindowTracker;
let nbCols = 0;
let nbRows = 0;
let focusMetaWindow: any = false;
let focusWindowActor: any = false;
let focusConnect: any = false;
let gridSettings = new Object();
let settings: SettingsObject = Settings.get();
settings.connect('changed', changed_settings);
let toggleSettingListener;
let keyControlBound: any = false;
let enabled = false;
let monitorsChangedConnect: any = false;

const SHELL_VERSION = ShellVersion.defaultVersion();

let presetState = new Array();
presetState["current_variant"] = 0;
presetState["last_call"] = '';
presetState["last_grid_format"] = '';
presetState["last_preset"] = '';
presetState["last_window_title"] = '';

// Hangouts workaround
let excludedApplications = new Array(
    "Unknown"
);

const keyBindings: Bindings = {
    'show-toggle-tiling': function () { globalApp.toggleTiling(); },
    'show-toggle-tiling-alt': function () { globalApp.toggleTiling(); }
};

const key_bindings_tiling: Bindings = {
    'move-left': function () { keyMoveResizeEvent('move', 'left'); },
    'move-right': function () { keyMoveResizeEvent('move', 'right'); },
    'move-up': function () { keyMoveResizeEvent('move', 'up'); },
    'move-down': function () { keyMoveResizeEvent('move', 'down'); },
    'resize-left': function () { keyMoveResizeEvent('resize', 'left'); },
    'resize-right': function () { keyMoveResizeEvent('resize', 'right'); },
    'resize-up': function () { keyMoveResizeEvent('resize', 'up'); },
    'resize-down': function () { keyMoveResizeEvent('resize', 'down'); },
    'move-left-vi': function () { keyMoveResizeEvent('move', 'left'); },
    'move-right-vi': function () { keyMoveResizeEvent('move', 'right'); },
    'move-up-vi': function () { keyMoveResizeEvent('move', 'up'); },
    'move-down-vi': function () { keyMoveResizeEvent('move', 'down'); },
    'resize-left-vi': function () { keyMoveResizeEvent('resize', 'left'); },
    'resize-right-vi': function () { keyMoveResizeEvent('resize', 'right'); },
    'resize-up-vi': function () { keyMoveResizeEvent('resize', 'up'); },
    'resize-down-vi': function () { keyMoveResizeEvent('resize', 'down'); },
    'cancel-tiling': function () { keyCancelTiling(); },
    'set-tiling': function () { keySetTiling(); },
    'change-grid-size': function () { keyChangeTiling(); },
    'autotile-main': function () { AutoTileMain(); },
    'autotile-1': function () { AutoTileNCols(1); },
    'autotile-2': function () { AutoTileNCols(2); },
    'autotile-3': function () { AutoTileNCols(3); },
    'autotile-4': function () { AutoTileNCols(4); },
    'autotile-5': function () { AutoTileNCols(5); },
    'autotile-6': function () { AutoTileNCols(6); },
    'autotile-7': function () { AutoTileNCols(7); },
    'autotile-8': function () { AutoTileNCols(8); },
    'autotile-9': function () { AutoTileNCols(9); },
    'autotile-10': function () { AutoTileNCols(10); },
    'snap-to-neighbors': function () { SnapToNeighborsBind(); }
}

const key_bindings_presets: Bindings = {
    'preset-resize-1': function () { presetResize(1); },
    'preset-resize-2': function () { presetResize(2); },
    'preset-resize-3': function () { presetResize(3); },
    'preset-resize-4': function () { presetResize(4); },
    'preset-resize-5': function () { presetResize(5); },
    'preset-resize-6': function () { presetResize(6); },
    'preset-resize-7': function () { presetResize(7); },
    'preset-resize-8': function () { presetResize(8); },
    'preset-resize-9': function () { presetResize(9); },
    'preset-resize-10': function () { presetResize(10); },
    'preset-resize-11': function () { presetResize(11); },
    'preset-resize-12': function () { presetResize(12); },
    'preset-resize-13': function () { presetResize(13); },
    'preset-resize-14': function () { presetResize(14); },
    'preset-resize-15': function () { presetResize(15); },
    'preset-resize-16': function () { presetResize(16); },
    'preset-resize-17': function () { presetResize(17); },
    'preset-resize-18': function () { presetResize(18); },
    'preset-resize-19': function () { presetResize(19); },
    'preset-resize-20': function () { presetResize(20); },
    'preset-resize-21': function () { presetResize(21); },
    'preset-resize-22': function () { presetResize(22); },
    'preset-resize-23': function () { presetResize(23); },
    'preset-resize-24': function () { presetResize(24); },
    'preset-resize-25': function () { presetResize(25); },
    'preset-resize-26': function () { presetResize(26); },
    'preset-resize-27': function () { presetResize(27); },
    'preset-resize-28': function () { presetResize(28); },
    'preset-resize-29': function () { presetResize(29); },
    'preset-resize-30': function () { presetResize(30); }
}
const keyBindingGlobalResizes: Bindings = {
    'action-change-tiling': () => { keyChangeTiling(); },
    'action-contract-bottom': () => { keyMoveResizeEvent('contract', 'bottom', true); },
    'action-contract-left': () => { keyMoveResizeEvent('contract', 'left', true); },
    'action-contract-right': () => { keyMoveResizeEvent('contract', 'right', true); },
    'action-contract-top': () => { keyMoveResizeEvent('contract', 'top', true); },
    'action-expand-bottom': () => { keyMoveResizeEvent('expand', 'bottom', true); },
    'action-expand-left': () => { keyMoveResizeEvent('expand', 'left', true); },
    'action-expand-right': () => { keyMoveResizeEvent('expand', 'right', true); },
    'action-expand-top': () => { keyMoveResizeEvent('expand', 'top', true); },
    'action-move-down': () => { keyMoveResizeEvent('move', 'down', true); },
    'action-move-left': () => { keyMoveResizeEvent('move', 'left', true); },
    'action-move-right': () => { keyMoveResizeEvent('move', 'right', true); },
    'action-move-up': () => { keyMoveResizeEvent('move', 'up', true); },
    'action-move-next-monitor': () => { moveWindowToNextMonitor(); },
}

class App {
    private readonly gridsByMonitorKey: Record<string, Grid> = {};
    private gridShowing: boolean = false;
    private gridWidget: BoxLayout|null = null;

    enable() {
        this.gridShowing = false;
        tracker = Shell.WindowTracker.get_default();

        initSettings();

        const gridWidget: BoxLayout = (new St.BoxLayout({ style_class: 'grid-preview' }));
        this.gridWidget = gridWidget;
        Main.uiGroup.add_actor(gridWidget);
        this.initGrids(gridWidget);

        log("Create Button on Panel");
        launcher = new GTileStatusButton('tiling-icon');

        if (gridSettings[SETTINGS_SHOW_ICON]) {
            Main.panel.addToStatusArea("GTileStatusButton", launcher);
        }

        bindHotkeys(keyBindings);
        if (gridSettings[SETTINGS_GLOBAL_PRESETS]) {
            bindHotkeys(key_bindings_presets);
        }
        if (gridSettings[SETTINGS_MOVERESIZE_ENABLED]) {
            bindHotkeys(keyBindingGlobalResizes);
        }

        if (monitorsChangedConnect) {
            Main.layoutManager.disconnect(monitorsChangedConnect);
        }

        log("Connecting monitors-changed");
        monitorsChangedConnect = Main.layoutManager.connect('monitors-changed', () => {
            log("Reinitializing grids on monitors-changed");
            this.destroyGrids();
            this.initGrids(gridWidget);
        });

        enabled = true;
        log("Extention enable completed");
    }

    getGrid(monitor: Monitor): Grid|null {
        return this.gridsByMonitorKey[getMonitorKey(monitor)];
    }

    initGrids(gridWidget: BoxLayout) {
        log("initGrids");
        log("initGrids nobCols " + nbCols + " nbRows " + nbRows);
        const monitors = activeMonitors();
        for (let monitorIdx = 0; monitorIdx < monitors.length; monitorIdx++) {
            log("New Grid for monitor " + monitorIdx);
    
            let monitor = monitors[monitorIdx];
    
            let grid = new Grid(gridWidget, monitorIdx, monitor, "gTile", nbCols, nbRows);
    
            const key = getMonitorKey(monitor);
            this.gridsByMonitorKey[key] = grid;
            log("initGrids adding grid key " + key);
    
            Main.layoutManager.addChrome(grid.actor, { trackFullscreen: true });
            grid.actor.set_opacity(0);
            grid.hide(true);
            log("Connect hide-tiling for monitor " + monitorIdx);
            grid.connectHideTiling = grid.connect('hide-tiling', () => this.hideTiling());
        }
        log("Init grid done");
    }
    
    destroyGrids() {
        log("destroyGrids");
        for (let gridKey in this.gridsByMonitorKey) {
            const grid = this.gridsByMonitorKey[gridKey];
            grid.hide(true);
            Main.layoutManager.removeChrome(grid.actor);
            log("Disconnect hide-tiling for monitor " + grid.monitor_idx);
            grid.disconnect(grid.connectHideTiling);
        }
        log("destroyGrids done");
    }
    
    refreshGrids() {
        log("refreshGrids");
        for (let gridIdx in this.gridsByMonitorKey) {
            const grid = this.gridsByMonitorKey[gridIdx];
            log("refreshGrids calling refresh on " + gridIdx);
            grid.refresh();
        }
        log("refreshGrids done");
    }
    
    moveGrids() {
        log("moveGrids");
        if (!this.gridShowing) {
            return;
        }
    
        let window = focusMetaWindow;
        if (window) {
            for (let gridKey in this.gridsByMonitorKey) {
                let grid = this.gridsByMonitorKey[gridKey];
                let pos_x;
                let pos_y;
    
                const monitor = grid.monitor;
                if (!monitor) {
                    return;
                }
                if (window.get_monitor() == grid.monitor_idx) {
                    pos_x = window.get_frame_rect().width / 2 + window.get_frame_rect().x;
                    pos_y = window.get_frame_rect().height / 2 + window.get_frame_rect().y;
    
                    let [mouse_x, mouse_y, mask] = global.get_pointer();
                    let act_x = pos_x - grid.actor.width / 2;
                    let act_y = pos_y - grid.actor.height / 2;
                    if (mouse_x >= act_x
                        && mouse_x <= act_x + grid.actor.width
                        && mouse_y >= act_y
                        && mouse_y <= act_y + grid.actor.height) {
                        log("Mouse x " + mouse_x + " y " + mouse_y +
                            " is inside grid actor rectangle, changing actor X from " + pos_x + " to " + (mouse_x + grid.actor.width / 2) +
                            ", Y from " + pos_y + " to " + (mouse_y + grid.actor.height / 2));
                        pos_x = mouse_x + grid.actor.width / 2;
                        pos_y = mouse_y + grid.actor.height / 2;
                    }
                }
                else {
                    pos_x = monitor.x + monitor.width / 2;
                    pos_y = monitor.y + monitor.height / 2;
                }
    
                pos_x = Math.floor(pos_x - grid.actor.width / 2);
                pos_y = Math.floor(pos_y - grid.actor.height / 2);
    
                if (window.get_monitor() == grid.monitor_idx) {
                    pos_x = (pos_x < monitor.x) ? monitor.x : pos_x;
                    pos_x = ((pos_x + grid.actor.width) > (monitor.width + monitor.x)) ? monitor.x + monitor.width - grid.actor.width : pos_x;
                    pos_y = (pos_y < monitor.y) ? monitor.y : pos_y;
                    pos_y = ((pos_y + grid.actor.height) > (monitor.height + monitor.y)) ? monitor.y + monitor.height - grid.actor.height : pos_y;
                }
    
                let time = (gridSettings[SETTINGS_ANIMATION]) ? 0.3 : 0.1;
    
                (grid.actor as any).ease({
                    time: time,
                    x: pos_x,
                    y: pos_y,
                    transition: Clutter.AnimationMode.EASE_OUT_QUAD,
                    /*onComplete:updateRegions*/
                });
            }
        }
    }
    
    updateRegions() {
        /*Main.layoutManager._chrome.updateRegions();*/
        log("updateRegions");
        this.refreshGrids();
        for (let idx in this.gridsByMonitorKey) {
            this.gridsByMonitorKey[idx].elementsDelegate?.reset();
        }
    }

    showTiling() {
        // TODO(#168): See https://github.com/gTile/gTile/issues/168. Without
        // these two lines, the grid UI does not properly respond to mouseover
        // and other events except for the first time it is shown.
        this.destroyGrids();
        this.initGrids(this.gridWidget!);

        log("issue#168/showTiling");
        focusMetaWindow = getFocusApp();
        if (!focusMetaWindow) {
            log("No focus window");
            return;
        }
        const wmType = focusMetaWindow.get_window_type();
        const layer = focusMetaWindow.get_layer();

        if (!this.gridWidget) {
            return;
        }

        this.gridWidget.visible = true;
        if (focusMetaWindow && wmType != WindowType.DESKTOP && layer > 0) {
            log("issue#168/focusMetaWindow");
            const monitors = activeMonitors();
            for (let monitorIdx = 0; monitorIdx < monitors.length; monitorIdx++) {
                let monitor = monitors[monitorIdx];
                const grid = this.getGrid(monitor);

                if (grid === null) {
                    log(`issue#168/showTiling ERROR: did not find grid for monitor ${getMonitorKey(monitor)}`);
                    continue;
                }

                let window = getFocusApp();
                let pos_x;
                let pos_y;
                if (window && window.get_monitor() == monitorIdx) {
                    log("issue#168/matched monitor");
                    pos_x = window.get_frame_rect().width / 2 + window.get_frame_rect().x;
                    pos_y = window.get_frame_rect().height / 2 + window.get_frame_rect().y;
                    let [mouse_x, mouse_y, mask] = global.get_pointer();
                    let act_x = pos_x - grid.actor.width / 2;
                    let act_y = pos_y - grid.actor.height / 2;
                    if (mouse_x >= act_x
                        && mouse_x <= act_x + grid.actor.width
                        && mouse_y >= act_y
                        && mouse_y <= act_y + grid.actor.height) {
                        log("Mouse x " + mouse_x + " y " + mouse_y +
                            " is inside grid actor rectangle, changing actor X from " + pos_x + " to " + (mouse_x + grid.actor.width / 2) +
                            ", Y from " + pos_y + " to " + (mouse_y + grid.actor.height / 2));
                        pos_x = mouse_x + grid.actor.width / 2;
                        pos_y = mouse_y + grid.actor.height / 2;
                    }
                }
                else {
                    pos_x = monitor.x + monitor.width / 2;
                    pos_y = monitor.y + monitor.height / 2;
                }

                grid.set_position(
                    Math.floor(pos_x - grid.actor.width / 2),
                    Math.floor(pos_y - grid.actor.height / 2)
                );

                grid.show();
            }

            this.gridShowing = true;
            this.onFocus();
            launcher.activate();
            bindKeyControls();
        } else {
            log("issue#168/no focus window");
        }

        this.moveGrids();
    }

    disable() {
        log("Extension disable begin");
        enabled = false;

        if (monitorsChangedConnect) {
            log("Disconnecting monitors-changed");
            Main.layoutManager.disconnect(monitorsChangedConnect);
            monitorsChangedConnect = false;
        }

        unbindHotkeys(keyBindings);
        unbindHotkeys(key_bindings_presets);
        unbindHotkeys(keyBindingGlobalResizes);
        if (keyControlBound) {
            unbindHotkeys(key_bindings_tiling);
            keyControlBound = false;
        }
        launcher.destroy();
        launcher = null;
        Main.uiGroup.remove_actor(this.gridWidget);
        this.destroyGrids();
        resetFocusMetaWindow();
        log("Extention disable completed");
    }

    hideTiling() {
        log("hideTiling");
        for (let key in this.gridsByMonitorKey) {
            const grid = this.gridsByMonitorKey[key];
            grid.elementsDelegate?.reset();
            grid.hide(false);
        }
        this.gridWidget.visible = false;

        resetFocusMetaWindow();

        launcher.deactivate();
        this.gridShowing = false;
        unbindKeyControls();
    }

    toggleTiling(): boolean {
        if (this.gridShowing) {
            this.hideTiling();
        }
        else {
            this.showTiling();
        }
        return this.gridShowing;
    }

    /**
     * onFocus is called when the global focus changes.
     */
    onFocus() {
        log("_onFocus ");
        resetFocusMetaWindow();
        const window = getFocusApp();
    
        if (window && this.gridShowing) {
            log("_onFocus " + window.get_title());
            focusMetaWindow = window;
    
            let app = tracker.get_window_app(focusMetaWindow);
            let title = focusMetaWindow.get_title();
    
            const monitors = activeMonitors();
            for (let monitorIdx = 0; monitorIdx < monitors.length; monitorIdx++) {
                let monitor = monitors[monitorIdx];
                let grid = this.getGrid(monitor);
                if (app) {
                    grid?.topbar._set_app(app, title);
                }
                else {
                    grid?.topbar._set_title(title);
                }
            }
    
            this.moveGrids();
        } else {
            if (this.gridShowing) {
                log("No focus window, hide tiling");
                this.hideTiling();
            } else {
                log("tiling window not active");
            }
        }
    }
}

const globalApp = new App();

function changed_settings() {
    log("changed_settings");
    if (enabled) {
        disable();
        enable();
    }
    log("changed_settings complete");
}

const GTileStatusButton = new Lang.Class({
    Name: 'GTileStatusButton',
    Extends: PanelMenu.Button,

    _init: function (classname: string) {
        this.parent(0.0, "gTile", false);
        //Done by default in PanelMenuButton - Just need to override the method
        if (SHELL_VERSION.version_at_least_34()) {
            this.add_style_class_name(classname);
            this.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        } else {
            this.actor.add_style_class_name(classname);
            this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        }
        log("GTileStatusButton _init done");
    },

    reset: function () {
        this.activated = false;
        if (SHELL_VERSION.version_at_least_34()) {
            this.remove_style_pseudo_class('activate');
        } else {
            this.actor.remove_style_pseudo_class('activate');
        }
    },

    activate: function () {
        if (SHELL_VERSION.version_at_least_34()) {
            this.add_style_pseudo_class('activate');
        } else {
            this.actor.add_style_pseudo_class('activate');
        }
    },

    deactivate: function () {
        if (SHELL_VERSION.version_at_least_34()) {
            this.remove_style_pseudo_class('activate');
        } else {
            this.actor.remove_style_pseudo_class('activate');
        }
    },

    _onButtonPress: function (actor, event) {
        log("_onButtonPress Click Toggle Status on system panel");
        this.toggleTiling();
    },

    _destroy: function () {
        this.activated = null;
    }

});

/*****************************************************************
  SETTINGS
 *****************************************************************/

function parseTuple(format, delimiter) {
    // parsing grid size in format XdelimY, like 6x4 or 1:2
    let gssk = format.trim().split(delimiter);
    if (gssk.length != 2
        || isNaN(gssk[0]) || gssk[0] < 0 || gssk[0] > 99
        || isNaN(gssk[1]) || gssk[1] < 0 || gssk[1] > 99) {
        log("Bad format " + format + ", delimiter " + delimiter);
        return { X: Number(-1), Y: Number(-1) };
    }
    return { X: Number(gssk[0]), Y: Number(gssk[1]) };
}

function initGridSizes(grid_sizes) {
    gridSettings[SETTINGS_GRID_SIZES] = []
    let gss = grid_sizes.split(",");
    let no_grids = true;
    for (var key in gss) {
        let grid_format = parseTuple(gss[key], "x");
        if (grid_format.X == -1) {
            continue;
        }
        no_grids = false;
        gridSettings[SETTINGS_GRID_SIZES].push(new GridSettingsButton(grid_format.X + "x" + grid_format.Y, grid_format.X, grid_format.Y));
    }
    if (no_grids) {
        gridSettings[SETTINGS_GRID_SIZES] = [
            new GridSettingsButton('8x6', 8, 6),
            new GridSettingsButton('6x4', 6, 4),
            new GridSettingsButton('4x4', 4, 4),
        ];
    }
}

function getBoolSetting(settingName: string): boolean {
    const value = settings.get_boolean(settingName);
    if (value === undefined) {
        log("Undefined settings " + settingName);
        gridSettings[settingName] = false;
        return false;
    } else {
        gridSettings[settingName] = value;
    }
    return value;
}

function getIntSetting(settings_string) {
    let iss = settings.get_int(settings_string);
    if (iss === undefined) {
        log("Undefined settings " + settings_string);
        return 0;
    } else {
        return iss;
    }
}

function initSettings() {
    log("Init settings");
    let gridSizes = settings.get_string(SETTINGS_GRID_SIZES);
    log(SETTINGS_GRID_SIZES + " set to " + gridSizes);
    initGridSizes(gridSizes);

    getBoolSetting(SETTINGS_AUTO_CLOSE);
    getBoolSetting(SETTINGS_ANIMATION);
    getBoolSetting(SETTINGS_SHOW_ICON);
    getBoolSetting(SETTINGS_GLOBAL_PRESETS);
    getBoolSetting(SETTINGS_MOVERESIZE_ENABLED);

    gridSettings[SETTINGS_WINDOW_MARGIN] = getIntSetting(SETTINGS_WINDOW_MARGIN);
    gridSettings[SETTINGS_WINDOW_MARGIN_FULLSCREEN_ENABLED] = getBoolSetting(SETTINGS_WINDOW_MARGIN_FULLSCREEN_ENABLED);
    gridSettings[SETTINGS_INSETS_PRIMARY] =
    {
        top: getIntSetting(SETTINGS_INSETS_PRIMARY_TOP),
        bottom: getIntSetting(SETTINGS_INSETS_PRIMARY_BOTTOM),
        left: getIntSetting(SETTINGS_INSETS_PRIMARY_LEFT),
        right: getIntSetting(SETTINGS_INSETS_PRIMARY_RIGHT)
    }; // Insets on primary monitor
    gridSettings[SETTINGS_INSETS_SECONDARY] =
    {
        top: getIntSetting(SETTINGS_INSETS_SECONDARY_TOP),
        bottom: getIntSetting(SETTINGS_INSETS_SECONDARY_BOTTOM),
        left: getIntSetting(SETTINGS_INSETS_SECONDARY_LEFT),
        right: getIntSetting(SETTINGS_INSETS_SECONDARY_RIGHT)
    };

    gridSettings[SETTINGS_MAX_TIMEOUT] = getIntSetting(SETTINGS_MAX_TIMEOUT);

    // initialize these from settings, the first set of sizes
    if (nbCols == 0 || nbRows == 0) {
        nbCols = gridSettings[SETTINGS_GRID_SIZES][0].cols;
        nbRows = gridSettings[SETTINGS_GRID_SIZES][0].rows;
    }
    log("Init complete, nbCols " + nbCols + " nbRows " + nbRows);

}


/*****************************************************************
  FUNCTIONS
 *****************************************************************/
function init() {
}

export function enable() {
    setLoggingEnabled(getBoolSetting(SETTINGS_DEBUG));
    log("Extension enable begin");
    SHELL_VERSION.print_version();

    globalApp.enable();
}

export function disable() {
    globalApp.disable();
}

function resetFocusMetaWindow() {
    log("resetFocusMetaWindow");
    focusMetaWindow = false;
}

function reset_window(metaWindow: Window) {
    metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL);
    metaWindow.unmaximize(Meta.MaximizeFlags.VERTICAL);
    metaWindow.unmaximize(Meta.MaximizeFlags.BOTH);
}

function _getInvisibleBorderPadding(metaWindow: Window) {
    let outerRect = metaWindow.get_frame_rect();
    let inputRect = metaWindow.get_buffer_rect();
    let borderX = outerRect.x - inputRect.x;
    let borderY = outerRect.y - inputRect.y;

    return [borderX, borderY];
}

function _getVisibleBorderPadding(metaWindow: Window) {
    let clientRect = metaWindow.get_frame_rect();
    let outerRect = metaWindow.get_frame_rect();

    let borderX = outerRect.width - clientRect.width
    let borderY = outerRect.height - clientRect.height;

    return [borderX, borderY];
}

function move_maximize_window(metaWindow, x, y) {
    let borderX, borderY, vBorderX, vBorderY;
    [borderX, borderY] = _getInvisibleBorderPadding(metaWindow);

    x = x - borderX;
    y = y - borderY;


    metaWindow.move_frame(true, x, y);
    metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
}

/**
 * Resizes window considering margin settings
 * @param metaWindow
 * @param x
 * @param y
 * @param width
 * @param height
 */
function move_resize_window_with_margins(metaWindow, x, y, width, height) {

    let [borderX, borderY] = _getInvisibleBorderPadding(metaWindow);
    let [vBorderX, vBorderY] = _getVisibleBorderPadding(metaWindow);

    log("move_resize_window_with_margins " + metaWindow.get_title() + " " + x + ":" + y + " - " + width
        + ":" + height + " margin " + gridSettings[SETTINGS_WINDOW_MARGIN] + " borders invisible " +
        borderX + ":" + borderY + " visible " + vBorderX + ":" + vBorderY);

    x = x + gridSettings[SETTINGS_WINDOW_MARGIN];
    y = y + gridSettings[SETTINGS_WINDOW_MARGIN];
    width = width - gridSettings[SETTINGS_WINDOW_MARGIN] * 2;
    height = height - gridSettings[SETTINGS_WINDOW_MARGIN] * 2;

    x = x + vBorderX;
    y = y + vBorderY;
    width = width - 2 * vBorderX;
    height = height - 2 * vBorderY;
    log("After margins and visible border window is " + x + ":" + y + " - " + width + ":" + height);

    metaWindow.move_frame(true, x, y);
    metaWindow.move_resize_frame(true, x, y, width, height);
}

function _isMyWindow(win) {
    return (this.focusMetaWindow == win.meta_window);
}

function getWindowActor() {
    let windows = global.get_window_actors().filter(this._isMyWindow, this);
    focusWindowActor = windows[0];

}

function getNotFocusedWindowsOfMonitor(monitor: Monitor) {
    const monitors = activeMonitors();
    let windows = global.get_window_actors().filter(function (w) {
        let app = tracker.get_window_app(w.meta_window);

        if (app == null) {
            return false;
        }

        let appName = app.get_name();


        return !contains(excludedApplications, appName)
            && w.meta_window.get_window_type() == Meta.WindowType.NORMAL
            && w.meta_window.get_workspace() == WorkspaceManager.get_active_workspace()
            && w.meta_window.showing_on_its_workspace()
            && monitors[w.meta_window.get_monitor()] == monitor
            && focusMetaWindow != w.meta_window;
    });

    return windows;
}

function getWindowsOfMonitor(monitor: Monitor) {
    const monitors = activeMonitors();
    let windows = global.get_window_actors().filter(function (w) {
        return w.meta_window.get_window_type() != Meta.WindowType.DESKTOP
            && w.meta_window.get_workspace() == WorkspaceManager.get_active_workspace()
            && w.meta_window.showing_on_its_workspace()
            && monitors[w.meta_window.get_monitor()] == monitor;
    });

    return windows;
}

function getMonitorKey(monitor: Monitor): string {
    return monitor.x + ":" + monitor.width + ":" + monitor.y + ":" + monitor.height;
}

function contains<T>(a: Array<T>, obj: T) {
    var i = a.length;
    while (i--) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}

/**
 * Get focused window by iterating though the windows on the active workspace.
 * @returns {Object} The focussed window object. False if no focussed window was found.
 */
function getFocusApp(): Window|null {
    if (tracker.focus_app == null) {
        return null;
    }

    let focusedAppName = tracker.focus_app.get_name();

    if (contains(excludedApplications, focusedAppName)) {
        return null;
    }

    let windows = WorkspaceManager.get_active_workspace().list_windows();
    let focusedWindow = false;
    for (let i = 0; i < windows.length; ++i) {
        let metaWindow = windows[i];
        if (metaWindow.has_focus()) {
            return metaWindow;
        }
    }

    return null;
}

function getFocusWindow(): any {
    const focus_app = tracker.focus_app;
    if (!focus_app || excludedApplications[focus_app.get_name()]) {
        return null;
    }

    return WorkspaceManager.get_active_workspace().list_windows()
        .find(w => w.has_focus());
}

function workAreaRectByMonitorIndex(monitorIndex: number) {
    const monitor = activeMonitors()[monitorIndex];
    const waLegacy = getWorkArea(monitor, monitorIndex);
    return new tilespec.Rect(
        new tilespec.XY(waLegacy.x, waLegacy.y),
        new tilespec.Size(waLegacy.width, waLegacy.height));
}


// TODO: This type is incomplete. Its definition is based purely on usage in
// this file and may be missing methods from the Gnome object.
interface Monitor {
    x: number;
    y: number;
    height: number;
    width: number;
};

function activeMonitors(): Monitor[] {
    return Main.layoutManager.monitors;
}

/**
 * Determine if the given monitor is the primary monitor.
 * @param {Object} monitor The given monitor to evaluate.
 * @returns {boolean} True if the given monitor is the primary monitor.
 * */
function isPrimaryMonitor(monitor: Monitor): boolean {
    return Main.layoutManager.primaryMonitor.x == monitor.x && Main.layoutManager.primaryMonitor.y == monitor.y;
}

function getWorkAreaByMonitor(monitor: Monitor): WorkArea | null {
    const monitors = activeMonitors();
    for (let monitor_idx = 0; monitor_idx < monitors.length; monitor_idx++) {
        let mon = monitors[monitor_idx];
        if (mon.x == monitor.x && mon.y == monitor.y) {
            return getWorkArea(monitor, monitor_idx);
        }
    }
    return null;
}

function getWorkAreaByMonitorIdx(monitor_idx: number) {
    const monitors = activeMonitors();
    let monitor = monitors[monitor_idx];
    return getWorkArea(monitor, monitor_idx);
}

function getWorkArea(monitor: Monitor, monitor_idx: number): WorkArea {
    const wkspace = WorkspaceManager.get_active_workspace();
    const work_area = wkspace.get_work_area_for_monitor(monitor_idx);
    const insets = (isPrimaryMonitor(monitor)) ? gridSettings[SETTINGS_INSETS_PRIMARY] : gridSettings[SETTINGS_INSETS_SECONDARY];
    return {
        x: work_area.x + insets.left,
        y: work_area.y + insets.top,
        width: work_area.width - insets.left - insets.right,
        height: work_area.height - insets.top - insets.bottom
    };
}

function bindKeyControls() {
    if (!keyControlBound) {
        bindHotkeys(key_bindings_tiling);
        if (focusConnect) {
            global.display.disconnect(focusConnect);
        }
        focusConnect = global.display.connect('notify::focus-window', () => globalApp.onFocus());
        if (!gridSettings[SETTINGS_GLOBAL_PRESETS]) {
            bindHotkeys(key_bindings_presets);
        }
        keyControlBound = true;
    }
}

function unbindKeyControls() {
    if (keyControlBound) {
        unbindHotkeys(key_bindings_tiling);
        if (focusConnect) {
            log("Disconnect notify:focus-window");
            global.display.disconnect(focusConnect);
            focusConnect = false;
        }
        if (!gridSettings[SETTINGS_GLOBAL_PRESETS]) {
            unbindHotkeys(key_bindings_presets);
        }
        if (!gridSettings[SETTINGS_MOVERESIZE_ENABLED]) {
            unbindHotkeys(keyBindingGlobalResizes);
        }
        keyControlBound = false;
    }
}

function keyCancelTiling() {
    log("Cancel key event");
    globalApp.hideTiling();
}

function keySetTiling() {
    log("keySetTiling");
    if (focusMetaWindow) {
        const monitors = activeMonitors();
        let mind = focusMetaWindow.get_monitor() as number;
        let monitor = monitors[mind];
        let mkey = getMonitorKey(monitor);
        const grid = globalApp.getGrid(monitor);
        log("In grid " + grid);
        grid?.elementsDelegate?.currentElement?._onButtonPress();
    }
}

function keyChangeTiling() {
    log("keyChangeTiling. Current nbCols " + nbCols + " nbRos " + nbRows);
    let grid_settings_sizes = gridSettings[SETTINGS_GRID_SIZES];
    let next_key: number | string = 0;
    let found = false;
    for (let key in grid_settings_sizes) {
        if (found) {
            next_key = key;
            break;
        }
        log("Checking grid settings ind " + key + " have cols " + grid_settings_sizes[key].cols + " and rows " + grid_settings_sizes[key].rows);
        if (grid_settings_sizes[key].cols == nbCols && grid_settings_sizes[key].rows == nbRows) {
            found = true;
        }
    }
    log("found matching grid nbCols " + nbCols + " nbRows " + nbRows + " next key is " + next_key);
    log("New settings will be nbCols " + grid_settings_sizes[next_key].cols + " nbRows " + grid_settings_sizes[next_key].rows);
    grid_settings_sizes[next_key]._onButtonPress();
    log("New settings are nbCols " + nbCols + " nbRows " + nbRows);
    setInitialSelection();
}

function setInitialSelection() {
    if (!focusMetaWindow) {
        return;
    }
    let mind = focusMetaWindow.get_monitor();
    const monitors = activeMonitors();
    let monitor = monitors[mind];
    let workArea = getWorkArea(monitor, mind);

    let wx = focusMetaWindow.get_frame_rect().x;
    let wy = focusMetaWindow.get_frame_rect().y;
    let wwidth = focusMetaWindow.get_frame_rect().width;
    let wheight = focusMetaWindow.get_frame_rect().height;
    const grid = globalApp.getGrid(monitor);
    if (!grid) {
        log("no grid ");
        return;
    }
    const delegate = grid.elementsDelegate;

    log("Set initial selection");
    log("Focus window position x " + wx + " y " + wy + " width " + wwidth + " height " + wheight);
    log("Focus monitor position x " + monitor.x + " y " + monitor.y + " width " + monitor.width + " height " + monitor.height);
    log("Workarea position x " + workArea.x + " y " + workArea.y + " width " + workArea.width + " height " + workArea.height);
    let wax = Math.max(wx - workArea.x, 0);
    let way = Math.max(wy - workArea.y, 0);
    let grid_element_width = workArea.width / nbCols;
    let grid_element_height = workArea.height / nbRows;
    log("width " + grid_element_width + " height " + grid_element_height);
    let lux = Math.min(Math.max(Math.round(wax / grid_element_width), 0), nbCols - 1);
    log("wx " + (wx - workArea.x) + " el_width " + grid_element_width + " max " + (nbCols - 1) + " res " + lux);
    let luy = Math.min(Math.max(Math.round(way / grid_element_height), 0), grid.rows - 1);
    log("wy " + (wy - workArea.y) + " el_height " + grid_element_height + " max " + (nbRows - 1) + " res " + luy);
    let rdx = Math.min(Math.max(Math.round((wax + wwidth) / grid_element_width) - 1, lux), grid.cols - 1);
    log("wx + wwidth " + (wx + wwidth - workArea.x - 1) + " el_width " + grid_element_width + " max " + (nbCols - 1) + " res " + rdx);
    let rdy = Math.min(Math.max(Math.round((way + wheight) / grid_element_height) - 1, luy), grid.rows - 1);
    log("wy + wheight " + (wy + wheight - workArea.y - 1) + " el_height " + grid_element_height + " max " + (nbRows - 1) + " res " + rdy);
    log("Initial tile selection is " + lux + ":" + luy + " - " + rdx + ":" + rdy);

    grid.forceGridElementDelegate(lux, luy, rdx, rdy);

    grid.elements[luy][lux]._onButtonPress();
    grid.elements[rdy][rdx]._onHoverChanged();

    const cX = delegate?.currentElement?.coordx;
    const cY = delegate?.currentElement?.coordy;
    const fX = delegate?.first?.coordx;
    const fY = delegate?.first?.coordy;

    log("After initial selection first fX " + fX + " fY " + fY + " current cX " + cX + " cY " + cY);
}

function keyMoveResizeEvent(type: string, key: string, is_global = false) {
    if (is_global) {
        focusMetaWindow = getFocusApp();
    }
    log("Got key event " + type + " " + key);
    if (!focusMetaWindow) {
        return;
    }
    log("Going on..");
    let mind = focusMetaWindow.get_monitor();
    const monitors = activeMonitors();
    let monitor = monitors[mind];
    const grid = globalApp.getGrid(monitor);
    if (!grid) {
        return;
    }
    const delegate = grid.elementsDelegate;

    if (!delegate?.currentElement) {
        log("Key event while no mouse activation - set current and second element");
        setInitialSelection();
    } else {
        if (!delegate.first) {
            log("currentElement is there but no first yet");
            delegate.currentElement._onButtonPress();
        }
    }
    if (!delegate?.currentElement) {
        log("gTime currentElement is not set!");
    }
    if (!delegate) {
        return;
    }
    let cX = delegate.currentElement?.coordx;
    let cY = delegate.currentElement?.coordy;
    let fX = delegate.first?.coordx;
    let fY = delegate.first?.coordy;

    log("Before move/resize first fX " + fX + " fY " + fY + " current cX " + cX + " cY " + cY);
    log("Grid cols " + nbCols + " rows " + nbRows);
    if (type == 'move') {
        switch (key) {
            case 'right':
                if (fX < nbCols - 1 && cX < nbCols - 1) {
                    delegate.first = grid.elements[fY][fX + 1];
                    grid.elements[cY][cX + 1]._onHoverChanged();
                }
                break;
            case 'left':
                if (fX > 0 && cX > 0) {
                    delegate.first = grid.elements[fY][fX - 1];
                    grid.elements[cY][cX - 1]._onHoverChanged();
                }
                break;
            case 'up':
                if (fY > 0 && cY > 0) {
                    delegate.first = grid.elements[fY - 1][fX];
                    grid.elements[cY - 1][cX]._onHoverChanged();
                }
                break;
            case 'down':
                if (fY < nbRows - 1 && cY < nbRows - 1) {
                    delegate.first = grid.elements[fY + 1][fX];
                    grid.elements[cY + 1][cX]._onHoverChanged();
                }
                break;
        }
    } else if (type == "resize") {
        switch (key) {
            case 'right':
                if (cX < nbCols - 1) {
                    grid.elements[cY][cX + 1]._onHoverChanged();
                }
                break;
            case 'left':
                if (cX > 0) {
                    grid.elements[cY][cX - 1]._onHoverChanged();
                }
                break;
            case 'up':
                if (cY > 0) {
                    grid.elements[cY - 1][cX]._onHoverChanged();
                }
                break;
            case 'down':
                if (cY < nbRows - 1) {
                    grid.elements[cY + 1][cX]._onHoverChanged();
                }
                break;
        }
    } else if (type == "contract") {
        switch (key) {
            case 'left':
                // Contract left edge of current window right one column
                if (cX > fX) {
                    delegate.first = grid.elements[fY][fX + 1];
                }
                break;
            case 'right':
                // Contract right edge of current window left one column
                if (cX > fX) {
                    grid.elements[cY][cX - 1]._onHoverChanged();
                }
                break;
            case 'top':
                // Contract top edge of current window down one row
                if (cY > fY) {
                    delegate.first = grid.elements[fY + 1][fX];
                }
                break;
            case 'bottom':
                // Contract bottom edge of current window up one row
                if (cY > fY) {
                    grid.elements[cY - 1][cX]._onHoverChanged();
                }
                break;
        }

    } else if (type == "expand") {

        switch (key) {
            case 'right':
                if (cX < nbCols) {
                    grid.elements[cY][cX + 1]._onHoverChanged();
                }
                break;
            case 'left':
                if (fX > 0) {
                    delegate.first = grid.elements[fY][fX - 1];
                }
                break;
            case 'top':
                if (fY > 0) {
                    delegate.first = grid.elements[fY - 1][fX];
                }
                break;
            case 'bottom':
                if (cY < nbRows - 1) {
                    grid.elements[cY + 1][cX]._onHoverChanged();
                }
                break;
        }
    }

    cX = delegate.currentElement.coordx;
    cY = delegate.currentElement.coordy;
    fX = delegate.first.coordx;
    fY = delegate.first.coordy;

    log("After move/resize first fX " + fX + " fY " + fY + " current cX " + cX + " cY " + cY);
    if (is_global) {
        keySetTiling();
    }
}
/**
 * Resize window to the given preset.
 * @param  {number}  Identifier of the resize preset (1 - 30)
 */
function presetResize(preset) {

    // Check if there's a focusable window
    let window = getFocusApp();
    if (!window) {
        log("No focused window - ignoring keyboard shortcut");
        return;
    }

    // Lets assume window titles are always unique.
    // Note: window roles 'window.get_role()' would offer a unique identifier.
    // Unfortunately role is often set to NULL.
    log("presetResize window title: " + window.get_title());

    // Ensure that the window is not maximized
    reset_window(window);

    // Fetch, parse and validate the given preset.
    // Expected preset format is "XxY x1:y1 x2:y2[,x1:y1 x2:y2]":
    //  - XxY is grid size like 6x8
    //  - x1:y1 is left upper corner tile coordinates in grid tiles, starting from 0
    //  - x2:y2 is right down corner tile coordinates in grid tiles
    //  - a preset can define multiple variants (e.g. "3x2 0:0 0:1,0:0 1:1,0:0 2:1")
    //  - variants can be activated using the same shortcut consecutively
    let preset_string = settings.get_string("resize" + preset);
    log("Preset resize " + preset + "  is " + preset_string);
    let ps_variants = preset_string.split(",");

    // retrieve and validate preset string / first preset variant
    let ps = ps_variants[0].trim().split(" ");
    if (ps.length != 3) {
        log("Bad preset " + preset + " settings " + preset_string);
        return;
    }

    // parse the preset string (grid size, left-upper-corner, right-down-corner)
    let grid_format = parseTuple(ps[0], "x");
    let luc = parseTuple(ps[1], ":");
    let rdc = parseTuple(ps[2], ":");

    // handle preset variants (if there are any)
    let ps_variant_count = ps_variants.length;
    if (ps_variant_count > 1) {
        if (presetState["last_call"] + gridSettings[SETTINGS_MAX_TIMEOUT] > new Date().getTime() &&
            presetState["last_preset"] == preset &&
            presetState["last_window_title"] == window.get_title()) {
            // within timeout (default: 2s), same preset & same window:
            // increase variant counter, but consider upper boundary
            presetState["current_variant"] = (presetState["current_variant"] + 1) % ps_variant_count;
        } else {
            // timeout, new preset or new window:
            // update presetState["last_preset"] and reset variant counter
            presetState["current_variant"] = 0;
        }
    } else {
        presetState["current_variant"] = 0;
    }

    // retrieve current preset variant
    if (presetState["current_variant"] > 0) {
        ps = ps_variants[presetState["current_variant"]].trim().split(" ");

        if (ps.length == 3) {
            // handle complete variant definitions
            grid_format = parseTuple(ps[0], "x");
            luc = parseTuple(ps[1], ":");
            rdc = parseTuple(ps[2], ":");
        } else if (ps.length == 2) {
            // handle short variant definitions - grid format is taken from
            // a previous variant
            grid_format = presetState["last_grid_format"];
            luc = parseTuple(ps[0], ":");
            rdc = parseTuple(ps[1], ":");
        } else {
            log("Bad preset " + preset + " settings " + preset_string);
            return;
        }
    }

    log("Parsed " + grid_format.X + "x" + grid_format.Y + " "
        + luc.X + ":" + luc.Y + " " + rdc.X + ":" + rdc.Y);
    if (grid_format.X < 1 || luc.X < 0 || rdc.X < 0 ||
        grid_format.Y < 1 || luc.Y < 0 || rdc.Y < 0 ||
        grid_format.X <= luc.X || grid_format.X <= rdc.X ||
        grid_format.Y <= luc.Y || grid_format.Y <= rdc.Y ||
        luc.X > rdc.X || luc.Y > rdc.Y) {
        log("Bad preset " + preset + " settings " + preset_string);
        return;
    }
    log("Parsed preset " + preset + " " + grid_format.X + "x" + grid_format.Y +
        " " + luc.X + ":" + luc.Y + " " + rdc.X + ":" + rdc.Y);

    // do the maths to resize the window
    let mind = window.get_monitor();
    let work_area = getWorkAreaByMonitorIdx(mind);
    let grid_element_width = work_area.width / grid_format.X;
    let grid_element_height = work_area.height / grid_format.Y;

    let wx = Math.round(work_area.x + luc.X * grid_element_width);
    let wy = Math.round(work_area.y + luc.Y * grid_element_height);
    let ww = Math.round((rdc.X + 1 - luc.X) * grid_element_width);
    let wh = Math.round((rdc.Y + 1 - luc.Y) * grid_element_height);

    log("Resize preset " + preset + " resizing to wx " + wx + " wy " + wy + " ww " + ww + " wh " + wh);
    move_resize_window_with_margins(window, wx, wy, ww, wh);

    presetState["last_preset"] = preset;
    presetState["last_grid_format"] = grid_format;
    presetState["last_window_title"] = window.get_title();
    presetState["last_call"] = new Date().getTime();

    log("Resize preset last call: " + presetState["last_call"])
}

// Move the window to the next monitor.
function moveWindowToNextMonitor() {
    log("moveWindowToNextMonitor");
    let window = getFocusWindow();
    if (!window) {
        log("No focused window - ignoring keyboard shortcut to move window");
        return;
    }

    reset_window(window);

    const numMonitors = activeMonitors().length;
    if (numMonitors == 0) {
        return;
    }

    const ts = tilespec.parsePreset("5x5 1:1 3:3")[0];

    const srcMonitorIndex = window.get_monitor();
    const dstMonitorIndex = (srcMonitorIndex + 1) % numMonitors;

    const margin = new tilespec.Size(
        gridSettings[SETTINGS_WINDOW_MARGIN],
        gridSettings[SETTINGS_WINDOW_MARGIN]);
    const workArea = workAreaRectByMonitorIndex(dstMonitorIndex).inset(margin);
    const rect = ts.toFrameRect(workArea);
    moveWindowToRect(window, rect);
}

/**
 * Moves a window to the specified region. This may resize the window as well as
 * move its origin.
 */
function moveWindowToRect(window: any, rect: tilespec.Rect) {
    window.move_resize_frame(
        true,
        rect.origin.x,
        rect.origin.y,
        rect.size.width,
        rect.size.height);
}

/*****************************************************************
  PROTOTYPES
 *****************************************************************/

function TopBar(title) {
    this._init(title);
}

TopBar.prototype = {

    _init: function (title) {
        this.actor = new St.BoxLayout({ style_class: 'top-box' });
        this._title = title;

        this._stlabel = new St.Label({ style_class: 'grid-title', text: this._title });

        this._closebutton = new St.Button({ style_class: 'close-button' })
        this._closebutton.add_style_class_name('close-button-container');
        this._connect_id = this._closebutton.connect('button-press-event', Lang.bind(this, this._onButtonPress));

        this.actor.add_actor(this._closebutton);
        this.actor.add_actor(this._stlabel);

    },

    _set_title: function (title) {
        this._title = title;
        this._stlabel.text = this._title;
    },

    _set_app: function (app, title) {
        this._title = app.get_name() + " - " + title;
        log("title: " + this._title);
        this._stlabel.text = this._title;

    },

    _onButtonPress() {
        log("Close button");
        globalApp.toggleTiling();
    },

    destroy() {
        this._closebutton.disconnect(this._connect_id);
        super.destroy();
    },
};

function ToggleSettingsButtonListener() {
    this._init();
};

ToggleSettingsButtonListener.prototype = {
    _init: function () {
        this.actors = new Array();
    },

    addActor: function (actor) {
        log("ToggleSettingsButtonListener Connect update-toggle");
        actor.connect('update-toggle', Lang.bind(this, this._updateToggle));
        this.actors.push(actor);
    },

    _updateToggle: function () {
        log("ToggleSettingsButtonListener _updateToggle");
        for (let actorIdx in this.actors) {
            let actor = this.actors[actorIdx];
            actor._update();
        }
    }
};

function ToggleSettingsButton(text, property) {
    this._init(text, property);
};

ToggleSettingsButton.prototype = {
    _init: function (text, property) {
        this.text = text;
        this.actor = new St.Button({
            style_class: 'settings-button',
            reactive: true,
            can_focus: true,
            track_hover: true
        });
        this.label = new St.Label({ style_class: 'settings-label', reactive: true, can_focus: true, track_hover: true, text: this.text });
        this.icon = new St.BoxLayout({ style_class: this.text + "-icon", reactive: true, can_focus: true, track_hover: true });
        this.actor.add_actor(this.icon);
        this.property = property;
        this._update();
        log("ToggleSettingsButton Connect button-press-event");
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        log("ToggleSettingsButton Connect update-toggle");
        this.connect('update-toggle', Lang.bind(this, this._update))
    },

    _update: function () {
        log("ToggleSettingsButton _update event " + this.property);
        if (gridSettings[this.property]) {
            this.actor.add_style_pseudo_class('activate');
        } else {
            this.actor.remove_style_pseudo_class('activate');
        }
    },

    _onButtonPress: function () {
        gridSettings[this.property] = !gridSettings[this.property];
        log("ToggleSettingsButton _onButtonPress " + this.property + ": " + gridSettings[this.property] + ", emitting signal update-toggle");
        this.emit('update-toggle');
    }
};

Signals.addSignalMethods(ToggleSettingsButton.prototype);

class ActionButton {
    readonly actor: StButton;
    readonly icon: BoxLayout;

    constructor(readonly grid: Grid, classname: string) {
        this.grid = grid;
        this.actor = new St.Button({
            style_class: 'settings-button',
            reactive: true,
            can_focus: true,
            track_hover: true
        });

        this.icon = new St.BoxLayout({ style_class: classname, reactive: true, can_focus: true, track_hover: true });
        this.actor.add_actor(this.icon);

        log("ActionButton Connect button-press-event");
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
    }

    _onButtonPress() {
        log("ActionButton _onButtonPress Emitting signal button-press-event");
        this.emit('button-press-event');
    }

    /** Functions replaced by Signals.addSignalMethods. */
    connect(eventName: string, handler: Function): number {return 0; }
    disconnect(id: number): void {}
    emit(name: string, ...args: any): void {}
};

Signals.addSignalMethods(ActionButton.prototype);

const AUTO_TILE_MAIN_AND_LIST_CLASS_NAME = "action-main-list";

class AutoTileMainAndList extends ActionButton {
    readonly classname: string;

    constructor(grid: Grid) {
        super(grid, AUTO_TILE_MAIN_AND_LIST_CLASS_NAME);
        this.classname = AUTO_TILE_MAIN_AND_LIST_CLASS_NAME;
        log("AutoTileMainAndList connect button-press-event");
        this.connect('button-press-event', () => this._onButtonPress());
    }

    _onButtonPress() {
        AutoTileMain();
        log("AutoTileMainAndList _onButtonPress Emitting signal resize-done");
        this.emit('resize-done');
    }
}

Signals.addSignalMethods(AutoTileMainAndList.prototype);

function AutoTileMain() {
    log("AutoTileMain");
    let window = getFocusApp();
    if (!window) {
        log("No focused window - ignoring keyboard shortcut AutoTileMain");
        return;
    }

    reset_window(window);
    let mind = window.get_monitor();
    let work_area = getWorkAreaByMonitorIdx(mind);

    const monitors = activeMonitors();
    let monitor = monitors[mind];
    let workArea = getWorkAreaByMonitor(monitor);
    let notFocusedwindows = getNotFocusedWindowsOfMonitor(monitor);

    if (Object.keys(notFocusedwindows).length === 0) {
        move_resize_window_with_margins(
            focusMetaWindow,
            workArea.x,
            workArea.y,
            workArea.width,
            workArea.height);
        return;
    }

    move_resize_window_with_margins(
        focusMetaWindow,
        workArea.x,
        workArea.y,
        workArea.width / 2,
        workArea.height);


    let winHeight = workArea.height / notFocusedwindows.length;
    let countWin = 0;

    log("AutoTileMain MonitorHeight: " + monitor.height + ":" + notFocusedwindows.length);

    for (let windowIdx in notFocusedwindows) {
        let metaWindow = notFocusedwindows[windowIdx].meta_window;

        let newOffset = workArea.y + (countWin * winHeight);
        reset_window(metaWindow);

        move_resize_window_with_margins(
            metaWindow,
            workArea.x + workArea.width / 2,
            newOffset,
            workArea.width / 2,
            winHeight
        );
        countWin++;
    }
    log("AutoTileMain done");
}

class AutoTileTwoList extends ActionButton {
    // __proto__: ActionButton.prototype,

    readonly classname: string;

    constructor(grid: Grid) {
        super(grid, "action-two-list");
        this.classname = "action-two-list";
        log("AutoTileTwoList connect button-press-event");
        this.connect('button-press-event', () => this._onButtonPress());
    }

    _onButtonPress() {
        log("AutotileTwoList");
        AutoTileNCols(2);
        log("AutoTileTwoList _onButtonPress Emitting signal resize-done");
        this.emit('resize-done');
        log("Autotile2 done");
    }
}

Signals.addSignalMethods(AutoTileTwoList.prototype);

function AutoTileNCols(cols) {
    log("AutoTileNCols " + cols);
    let window = getFocusApp();
    if (!window) {
        log("No focused window - ignoring keyboard shortcut AutoTileNCols");
        return;
    }

    reset_window(window);
    let mind = window.get_monitor();
    let work_area = getWorkAreaByMonitorIdx(mind);

    const monitors = activeMonitors();
    let monitor = monitors[mind];
    let workArea = getWorkAreaByMonitor(monitor);
    let windows = getNotFocusedWindowsOfMonitor(monitor);

    let nbWindowOnEachSide = Math.ceil((windows.length + 1) / cols);
    let winHeight = workArea.height / nbWindowOnEachSide;

    let countWin = 0;

    move_resize_window_with_margins(
        focusMetaWindow,
        workArea.x + countWin % cols * workArea.width / cols,
        workArea.y + (Math.floor(countWin / cols) * winHeight),
        workArea.width / cols,
        winHeight
    );

    countWin++;

    // todo make function
    for (let windowIdx in windows) {
        let metaWindow = windows[windowIdx].meta_window;

        reset_window(metaWindow);

        move_resize_window_with_margins(
            metaWindow,
            workArea.x + countWin % cols * workArea.width / cols,
            workArea.y + (Math.floor(countWin / cols) * winHeight),
            workArea.width / cols,
            winHeight
        );
        countWin++;
    }

    log("AutoTileNCols done");
}

function SnapToNeighborsBind() {
    log("SnapToNeighbors keybind invoked");
    let window = getFocusApp();
    if (!window) {
        log("No focused window - ignoring keyboard shortcut SnapToNeighbors");
        return;
    }

    snapToNeighbors(window);
}

function GridSettingsButton(text, cols, rows) {
    this._init(text, cols, rows);
}

GridSettingsButton.prototype = {
    _init: function (text, cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.text = text;

        this.actor = new St.Button({
            style_class: 'settings-button',
            reactive: true,
            can_focus: true,
            track_hover: true
        });

        this.label = new St.Label({ style_class: 'settings-label', reactive: true, can_focus: true, track_hover: true, text: this.text });

        this.actor.add_actor(this.label);

        log("Connecting button-press-event to GridSettingsButton " + text);
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
    },

    _onButtonPress: function () {
        log("GridSettingsButton " + this.text + " _OnButtonPress");
        nbCols = this.cols;
        nbRows = this.rows;

        globalApp.refreshGrids();
    }

};

class Grid {
    connectHideTiling: any;

    readonly tableWidth = 320;
    readonly tableHeight: number;
    readonly borderwidth = 2;
    readonly actor: BoxLayout;
    readonly bottombar_table_layout: any;
    readonly animation_time: number;
    readonly topbar: any; //TopBar;
    readonly bottombarContainer: StBin;
    readonly bottombar: StWidget;
    readonly veryBottomBar: StWidget;
    readonly veryBottomBarContainer: any;
    readonly veryBottomBar_table_layout: any;

    readonly tableContainer: any;
    readonly table: StWidget;
    readonly table_table_layout: any;
    monitor: Monitor|null;
    readonly monitor_idx: number;
    x: number;
    y: number;
    rows: number;
    cols: number;
    title: string;
    readonly normalScaleX: number;
    readonly normalScaleY: number;
    interceptHide: boolean;
    isEntered: boolean;
    elementsDelegate: GridElementDelegate|null = null;
    elements: GridElement[][] = [];


    constructor(private readonly gridWidget: BoxLayout, monitor_idx: number, monitor: Monitor, title: string, cols: number, rows: number) {
        let workArea = getWorkArea(monitor, monitor_idx);

        this.tableHeight = (this.tableWidth / workArea.width) * workArea.height;
        
        this.actor = new St.BoxLayout({
            vertical: true,
            style_class: 'grid-panel',
            reactive: true,
            can_focus: true,
            track_hover: true
        });

        log("Grid connect enter-event leave-envent ");
        this.actor.connect('enter-event', Lang.bind(this, this._onMouseEnter));
        this.actor.connect('leave-event', Lang.bind(this, this._onMouseLeave));

        this.animation_time = gridSettings[SETTINGS_ANIMATION] ? 0.3 : 0;

        this.topbar = new TopBar(title);

        this.bottombarContainer = new St.Bin({
            style_class: 'bottom-box-container',
            reactive: true,
            can_focus: true,
            track_hover: true
        });

        this.bottombar = new St.Widget({
            style_class: 'bottom-box',
            can_focus: true,
            track_hover: true,
            reactive: true,
            width: this.tableWidth - 20,
            height: 36,
            layout_manager: new Clutter.GridLayout()
        });
        this.bottombar_table_layout = this.bottombar.layout_manager;
        this.bottombar_table_layout.set_row_homogeneous(true);
        this.bottombar_table_layout.set_column_homogeneous(true);

        this.bottombarContainer.add_actor(this.bottombar);

        this.veryBottomBarContainer = new St.Bin({
            style_class: 'very-bottom-box-container',
            reactive: true,
            can_focus: true,
            track_hover: true
        });

        this.veryBottomBar = new St.Widget({
            style_class: 'very-bottom-box',
            can_focus: true,
            track_hover: true,
            reactive: true,
            width: this.tableWidth - 20,
            height: 36,
            layout_manager: new Clutter.GridLayout()
        });
        this.veryBottomBar_table_layout = this.veryBottomBar.layout_manager;
        this.bottombar_table_layout.set_row_homogeneous(true);
        this.veryBottomBar_table_layout.set_column_homogeneous(true);

        this.veryBottomBarContainer.add_actor(this.veryBottomBar);

        let rowNum = 0;
        let colNum = 0;
        let maxPerRow = 4;

        var gridSettingsButtons = gridSettings[SETTINGS_GRID_SIZES];
        for (var index = 0; index < gridSettingsButtons.length; index++) {
            if (colNum >= maxPerRow) {
                colNum = 0;
                rowNum += 2;
            }

            var button = gridSettingsButtons[index];
            //button = new GridSettingsButton(button.text,button.cols,button.rows);
            this.bottombar_table_layout.attach(button.actor, colNum, rowNum, 1, 1);
            log("Connecting grid settings button " + index + " : " + button.text);
            button.actor.connect('notify::hover', Lang.bind(this, this._onSettingsButton));
            colNum++;
        }

        this.tableContainer = new St.Bin({
            style_class: 'table-container',
            reactive: true,
            can_focus: true,
            track_hover: true
        });

        this.table = new St.Widget({
            style_class: 'table',
            can_focus: true,
            track_hover: true,
            reactive: true,
            height: this.tableHeight,
            width: this.tableWidth - 2,
            layout_manager: new Clutter.GridLayout()
        });
        this.table_table_layout = this.table.layout_manager;
        this.table_table_layout.set_row_homogeneous(true);
        this.table_table_layout.set_column_homogeneous(true);
        this.tableContainer.add_actor(this.table);

        this.actor.add_child(this.topbar.actor);
        this.actor.add_child(this.tableContainer);
        this.actor.add_child(this.bottombarContainer);
        this.actor.add_child(this.veryBottomBarContainer);

        this.monitor = monitor;
        this.monitor_idx = monitor_idx;
        this.rows = rows;
        this.title = title;
        this.cols = cols;

        this.isEntered = false;

        let nbTotalSettings = 4;

        if (!toggleSettingListener) {
            toggleSettingListener = new ToggleSettingsButtonListener();
        }

        let toggle = new ToggleSettingsButton("animation", SETTINGS_ANIMATION);
        this.veryBottomBar_table_layout.attach(toggle.actor, 0, 0, 1, 1);
        toggleSettingListener.addActor(toggle);

        toggle = new ToggleSettingsButton("auto-close", SETTINGS_AUTO_CLOSE);
        this.veryBottomBar_table_layout.attach(toggle.actor, 1, 0, 1, 1);
        toggleSettingListener.addActor(toggle);

        let action = new AutoTileMainAndList(this);
        this.veryBottomBar_table_layout.attach(action.actor, 2, 0, 1, 1);
        action.connect('resize-done', Lang.bind(this, this._onResize));

        action = new AutoTileTwoList(this);
        this.veryBottomBar_table_layout.attach(action.actor, 3, 0, 1, 1);
        action.connect('resize-done', Lang.bind(this, this._onResize));

        this.x = 0;
        this.y = 0;

        this.interceptHide = false;
        this._displayElements();

        this.normalScaleY = this.actor.scale_y;
        this.normalScaleX = this.actor.scale_x;
    }

    _displayElements() {
        if (this.monitor === null)  {
            return;
        }
        log("Grid _displayElements " + this.cols + ":" + this.rows);
        this.elements = new Array();

        let width = (this.tableWidth / this.cols);// - 2*this.borderwidth;
        let height = (this.tableHeight / this.rows);// - 2*this.borderwidth;

        this.elementsDelegate = new GridElementDelegate(this.gridWidget);
        this.elementsDelegate.connect('resize-done', Lang.bind(this, this._onResize));
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (c == 0) {
                    this.elements[r] = new Array();
                }

                let element = new GridElement(this.monitor, width, height, c, r);

                this.elements[r][c] = element;
                log("hack: undocument property element.actor._delegate property accesseed in _displayElements");
                (element.actor as any)._delegate = this.elementsDelegate;
                this.table_table_layout.attach(element.actor, c, r, 1, 1);
                element.show();
            }
        }
    }

    forceGridElementDelegate(x, y, w, h) {
        this.elementsDelegate.forceArea(this.elements[y][x], this.elements[h][w]);
    }

    refresh() {
        log("Grid.refresh from " + this.cols + ":" + this.rows + " to " + nbCols + ":" + nbRows);
        //this.elementsDelegate._logActiveActors("Grid refresh active actors");
        this.elementsDelegate._resetGrid();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                this.elements[r][c]._disconnect();
            }
        }
        this.table.destroy_all_children();
        this.cols = nbCols;
        this.rows = nbRows;
        this._displayElements();
    }

    set_position(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.actor.set_position(x, y);
    }

    show() {
        this.interceptHide = true;
        this.elementsDelegate.reset();
        let time = (gridSettings[SETTINGS_ANIMATION]) ? 0.3 : 0;

        Main.uiGroup.set_child_above_sibling(this.actor, null);

        Main.layoutManager.removeChrome(this.actor);
        Main.layoutManager.addChrome(this.actor);
        //this.actor.y = 0 ;
        if (time > 0) {
            this.actor.scale_y = 0;
            this.actor.scale_x = 0;
            (this.actor as any).ease({
                time: this.animation_time,
                opacity: 255,
                visible: true,
                transition: Clutter.AnimationMode.EASE_OUT_QUAD,
                scale_x: this.normalScaleX,
                scale_y: this.normalScaleY,
                onComplete: this._onShowComplete
            });
        }
        else {
            this.actor.scale_x = this.normalScaleX;
            this.actor.scale_y = this.normalScaleY;
            this.actor.opacity = 255;
            this.actor.visible = true;
        }

        this.interceptHide = false;
    }

    hide(immediate) {
        log("hide " + immediate);
        this.elementsDelegate.reset();
        let time = (gridSettings[SETTINGS_ANIMATION]) ? 0.3 : 0;
        if (!immediate && time > 0) {
            (this.actor as any).ease({
                time: this.animation_time,
                opacity: 0,
                visible: false,
                scale_x: 0,
                scale_y: 0,
                transition: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: this._onHideComplete
            });
        }
        else {
            this.actor.opacity = 0;
            this.actor.visible = false;
            //this.actor.y = 0;
            this.actor.scale_x = 0;
            this.actor.scale_y = 0;
        }
    }

    _onHideComplete() {
    }

    _onShowComplete() {
    }

    _onResize(actor, event) {
        log("resize-done: " + actor);
        globalApp.updateRegions();
        if (gridSettings[SETTINGS_AUTO_CLOSE]) {
            log("Emitting hide-tiling");
            this.emit('hide-tiling');
        }
    }

    _onMouseEnter() {
        log("onMouseEnter");
        if (!this.isEntered) {
            this.elementsDelegate?.reset();
            this.isEntered = true;
        }
    }

    _onMouseLeave() {
        log("onMouseLeave");
        let [x, y, mask] = global.get_pointer();
        if (this.elementsDelegate && (x <= this.actor.x || x >= (this.actor.x + this.actor.width)) || (y <= this.actor.y || y >= (this.actor.y + this.actor.height))) {
            this.isEntered = false;
            this.elementsDelegate?.reset();
            globalApp.refreshGrids();
        }
    }

    _onSettingsButton() {
        this.elementsDelegate?.reset();
    }

    _destroy() {
        log("Grid _destroy");
        for (let r in this.elements) {
            for (let c in this.elements[r]) {
                this.elements[r][c]._destroy();
            }
        }

        this.elementsDelegate._destroy();
        this.topbar._destroy();

        this.monitor = null;
        this.rows = 0;
        this.title = "";
        this.cols = 0;
        log("Disconnect hide-tiling");
        this.disconnect(this.connectHideTiling);
    }

    // Methods replaced by Signals.addSignalMethods.
    connect(name: string, callback: Function): number{ return -1 }
    disconnect(id: number): void{}
    emit(name: string, ...args: any): void{}
};

Signals.addSignalMethods(Grid.prototype);
class GridElementDelegate {
    activated: boolean = false;
    first: GridElement|null = null;
    currentElement: GridElement|null = null;
    activatedActors: GridElement[] = [];

    constructor(private readonly gridWidget: BoxLayout) {}

    _allSelected() {
        return (this.activatedActors.length === (nbCols * nbRows));
    }

    _onButtonPress(gridElement: GridElement) {
        log("GridElementDelegate _onButtonPress " + gridElement.coordx + ":" + gridElement.coordy);
        //this._logActiveActors("GridElementDelegate _onButtonPress active actors");
        if (!this.currentElement) {
            this.currentElement = gridElement;
        }
        if (this.activated == false) {
            log("GridElementDelegate first activation");
            this.activated = true;
            gridElement.active = true;
            this.activatedActors = new Array();
            this.activatedActors.push(gridElement);
            this.first = gridElement;
        }
        else {
            log("GridElementDelegate resize");
            //Check this.activatedActors if equals to nbCols * nbRows
            //before doing anything with the window it must be unmaximized
            //if so move the window then maximize instead of change size
            //if not move the window and change size

            reset_window(focusMetaWindow);

            let areaWidth, areaHeight, areaX, areaY;
            [areaX, areaY, areaWidth, areaHeight] = this._computeAreaPositionSize(this.first, gridElement);

            if (this._allSelected() && gridSettings[SETTINGS_WINDOW_MARGIN_FULLSCREEN_ENABLED] === false) {
                move_maximize_window(focusMetaWindow, areaX, areaY);
            }
            else {
                move_resize_window_with_margins(focusMetaWindow, areaX, areaY, areaWidth, areaHeight);
            }
            //this._logActiveActors("GridElementDelegate _onButtonPress end active actors");

            this._resizeDone();
        }
    }

    _resizeDone() {
        log("resizeDone, emitting signal resize-done");
        this.emit('resize-done');
    }

    reset() {
        this._resetGrid();

        this.activated = false;
        this.first = null;
        this.currentElement = null;
    }

    _resetGrid() {
        this._hideArea();
        if (this.currentElement) {
            this.currentElement._deactivate();
        }

        for (var act in this.activatedActors) {
            this.activatedActors[act]._deactivate();
        }
        this.activatedActors = new Array();
    }

    _getVarFromGridElement(fromGridElement: GridElement, toGridElement: GridElement) {
        let minX = Math.min(fromGridElement.coordx, toGridElement.coordx);
        let maxX = Math.max(fromGridElement.coordx, toGridElement.coordx);

        let minY = Math.min(fromGridElement.coordy, toGridElement.coordy);
        let maxY = Math.max(fromGridElement.coordy, toGridElement.coordy);

        return [minX, maxX, minY, maxY];
    }

    refreshGrid(fromGridElement: GridElement, toGridElement: GridElement) {
        this._resetGrid();
        let [minX, maxX, minY, maxY] = this._getVarFromGridElement(fromGridElement, toGridElement);

        if (!fromGridElement.monitor) {
            return;
        }
        const grid = globalApp.getGrid(fromGridElement.monitor);
        if (!grid) {
            return;
        }
        for (let r = minY; r <= maxY; r++) {
            for (let c = minX; c <= maxX; c++) {
                let element = grid.elements[r][c];
                element._activate();
                this.activatedActors.push(element);
            }
        }

        this._displayArea(fromGridElement, toGridElement);
    }

    _computeAreaPositionSize(fromGridElement: GridElement, toGridElement: GridElement) {
        let [minX, maxX, minY, maxY] = this._getVarFromGridElement(fromGridElement, toGridElement);

        let monitor = fromGridElement.monitor;
        const workArea = getWorkAreaByMonitor(monitor);
        if (!workArea) {
            return;
        }

        let areaWidth = Math.round((workArea.width / nbCols) * ((maxX - minX) + 1));
        let areaHeight = Math.round((workArea.height / nbRows) * ((maxY - minY) + 1));

        let areaX = workArea.x + Math.round((minX * (workArea.width / nbCols)));
        let areaY = workArea.y + Math.round((minY * (workArea.height / nbRows)));

        return [areaX, areaY, areaWidth, areaHeight];
    }

    forceArea(fromGridElement: GridElement, toGridElement: GridElement) {
        let areaWidth, areaHeight, areaX, areaY;
        [areaX, areaY, areaWidth, areaHeight] = this._computeAreaPositionSize(fromGridElement, toGridElement);
        this.gridWidget.width = areaWidth;
        this.gridWidget.height = areaHeight;
        this.gridWidget.x = areaX;
        this.gridWidget.y = areaY;
    }

    _displayArea(fromGridElement: GridElement, toGridElement: GridElement) {
        const [areaX, areaY, areaWidth, areaHeight] = this._computeAreaPositionSize(fromGridElement, toGridElement);

        this.gridWidget.add_style_pseudo_class('activate');

        if (gridSettings[SETTINGS_ANIMATION]) {
            (this.gridWidget as any).ease({
                time: 0.2,
                x: areaX,
                y: areaY,
                width: areaWidth,
                height: areaHeight,
                transition: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        }
        else {
            this.gridWidget.width = areaWidth;
            this.gridWidget.height = areaHeight;
            this.gridWidget.x = areaX;
            this.gridWidget.y = areaY;
        }
    }

    _hideArea() {
        this.gridWidget.remove_style_pseudo_class('activate');
    }

    _onHoverChanged(gridElement: GridElement) {
        log("GridElementDelegate _onHoverChange " + gridElement.coordx + ":" + gridElement.coordy);
        if (this.activated) {
            log("GridElementDelegate _onHoverChange/not active: " + gridElement.coordx + ":" + gridElement.coordy);
            this.refreshGrid(this.first, gridElement);
            this.currentElement = gridElement;
        }
        else if (!this.currentElement || gridElement.id != this.currentElement.id) {
            log("GridElementDelegate _onHoverChange/active: " + gridElement.coordx + ":" + gridElement.coordy);
            if (this.currentElement) {
                this.currentElement._deactivate();
            }

            this.currentElement = gridElement;
            this.currentElement._activate();
            this._displayArea(gridElement, gridElement);
        } else {
            log("GridElementDelegate _onHoverChange/else: " + gridElement.coordx + ":" + gridElement.coordy);
            
        }
    }

    _destroy() {
        this.activated = null;
        this.first = null;
        this.currentElement = null;
        this.activatedActors = null;
    }

    // Methods replaced by Signals.addSignalMethods.
    connect(name: string, callback: Function): number{ return -1 }
    disconnect(id: number): void{}
    emit(name: string, ...args: any): void{}
};

Signals.addSignalMethods(GridElementDelegate.prototype);

class GridElement{
    readonly actor: StButton;
    readonly id: string;
    readonly hoverConnect: number;
    active: boolean;

    constructor(readonly monitor: Monitor, readonly width: number, readonly height: number, readonly coordx: number, readonly coordy: number) {
        this.actor = new St.Button({ style_class: 'table-element', reactive: true, can_focus: true, track_hover: true });

        this.actor.visible = false;
        this.actor.opacity = 0;

        this.id = getMonitorKey(monitor) + "-" + coordx + ":" + coordy;

        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.hoverConnect = this.actor.connect('notify::hover', Lang.bind(this, this._onHoverChanged));

        this.active = false;
    }

    show() {
        this.actor.opacity = 255;
        this.actor.visible = true;
    }

    hide() {
        this.actor.opacity = 0;
        this.actor.visible = false;
    }

    _onButtonPress() {
        log("hack - accessing undocumented _delegate property in _onButtonPress");
        (this.actor as any)._delegate._onButtonPress(this);
    }

    _onHoverChanged() {
        log("hack - accessing undocumented _delegate property in _onHoverChanged");
        (this.actor as any)._delegate._onHoverChanged(this);
    }

    _activate() {
        if (!this.active) {
            this.actor.add_style_pseudo_class('activate');
            this.active = true;
        }
    }

    _deactivate() {
        if (this.active) {
            this.actor.remove_style_pseudo_class('activate');
            this.active = false;
        }
    }

    // This logic should probably go into disable().
    // _clean() {
    //     Main.uiGroup.remove_actor(this.gridWidget);
    // }

    _disconnect() {
        this.actor.disconnect(this.hoverConnect);
    }

    _destroy() {
        this.active = false;
    }
};
