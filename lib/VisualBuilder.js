"use strict";

let fs = require('fs');
let path = require('path');
let EventEmitter = require('events');
let _ = require('lodash');
let TypescriptCompiler = require('../lib/TypescriptCompiler');
let LessCompiler = require('../lib/LessCompiler');

/**
 * Builds visual from a visual package instance
 * @extends EventEmitter
 * @emits watch_change - when a file change is detected
 * @emits watch_complete - when the build triggered by a watcher is completed
 * @emits watch_error - when a watcher or triggered build task throws an error
 */
class VisualBuilder extends EventEmitter {
    /**
     * Creates a VisualBuilder
     * @param {string} path - file path to root of visual
     */
    constructor (visualPackage) {
        super();
        this.package = visualPackage;
        this.watchStates = {
            '.ts': {
                changed: false,
                building: false,
                name: 'Typescript',
                handler: TypescriptCompiler.build
            },
            '.less': {
                changed: false,
                building: false,
                name: 'Less',
                handler: LessCompiler.build
            }
        };
    }

    /**
     * Compiles visual sources & styles
     */
    build() {
        return Promise.all([
            LessCompiler.build(this.package),
            TypescriptCompiler.build(this.package)
        ]);
    };

    /**
     * Starts watching for file changes
     */
    startWatcher() {
        this.stopWatcher();
        this.watcher = fs.watch(this.package.basePath, {
            recursive: false
        }, this._fileChangeHandler.bind(this));
        this.watcherInterval = setInterval(this._watchIntervalHandler.bind(this), 500);
    };

    /**
     * Stops watching for file changes
     */
    stopWatcher() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        if (this.watcherInterval) {
            clearInterval(this.watcherInterval);
            this.watcherInterval = null;
        }
    };

    /**
     * Checks the state of all file watchers
     * @private
     */
    _watchIntervalHandler() {
        for (let key in this.watchStates) {
            this._handleWatch(this.watchStates[key]);
        }
    };

    /**
     * Checks state of a watcher. Triggers build if needed
     * @private
     */
    _handleWatch(watchState) {
        if (watchState.changed && !watchState.building) {
            watchState.building = true;
            watchState.changed = false;
            this.emit('watch_change', watchState.name);

            watchState.handler(this.package).then(() => {
                this.emit('watch_complete', watchState.name);
                watchState.building = false;
            }).catch((e) => {
                this.emit('watch_error', e);
                watchState.building = false;
            });
        }    
    }

    /**
     * Handles file change events and sets state so the interval will update files
     * @private
     */
    _fileChangeHandler(event, filename) {
        let ext = path.extname(filename);
        if (this.watchStates.hasOwnProperty(ext)) {
            this.watchStates[ext].changed = true;
        }
    };
}

module.exports = VisualBuilder;