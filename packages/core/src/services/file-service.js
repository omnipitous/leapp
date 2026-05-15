"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = void 0;
const cryptoJS = __importStar(require("crypto-js"));
class FileService {
    constructor(nativeService) {
        this.nativeService = nativeService;
        this.aesKey = this.nativeService.machineId;
    }
    get aesKey() {
        return this._aesKey;
    }
    set aesKey(value) {
        this._aesKey = value;
    }
    /* ====================================================
     * === Wrapper functions over the fs native library ===
     * ==================================================== */
    /**
     * Get the home directory
     *
     * @returns - {string} - path of the home directory
     */
    homeDir() {
        return this.nativeService.os.homedir();
    }
    /**
     * Check if a file or directory exists by passing a path
     *
     * @returns - {boolean} - exists or not
     * @param path - the path of the directory
     */
    existsSync(path) {
        return this.nativeService.fs.existsSync(path);
    }
    renameSync(oldPath, newPath) {
        this.nativeService.fs.renameSync(oldPath, newPath);
    }
    /**
     * Get directory name
     *
     * @returns - {string} - the directory name
     * @param path - the directory path
     */
    dirname(path) {
        return this.nativeService.path.dirname(path);
    }
    /**
     * Copy the directory
     *
     * @param source - source directory
     * @param target - target directory
     */
    copyDir(source, target) {
        this.nativeService.copydir.sync(source, target, { mode: true });
    }
    /**
     * Read file sync
     *
     * @returns - {string} - return the file directly as string
     * @param filePath - Path to read the file
     */
    readFileSync(filePath) {
        return this.nativeService.fs.readFileSync(filePath, { encoding: "utf-8" });
    }
    /**
     * Read the directories in a recursive manner
     *
     * @returns - {any} - data
     * @param source - source of the directory
     */
    getSubDirs(source) {
        return this.nativeService.fs
            .readdirSync(source, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);
    }
    /**
     * Creates a new directory
     *
     * @param path - the new directory path
     * @param options - some options if needed - optional
     */
    newDir(path, options) {
        this.nativeService.fs.mkdirSync(path, options);
    }
    /**
     * Write a generic file in a synchronous way
     *
     * @returns - {any}
     * @param filePath - the filepath to write to
     * @param content - the content to write
     */
    writeFileSync(filePath, content) {
        return this.nativeService.fs.writeFileSync(filePath, content);
    }
    writeFileSyncWithOptions(filePath, content, options) {
        return this.nativeService.fs.writeFileSync(filePath, content, options);
    }
    /**
     * Remove a file in a synchronous way
     *
     * @returns - {void}
     * @param filePath - the filepath to remove
     */
    removeFileSync(filePath) {
        this.nativeService.fs.removeSync(filePath);
    }
    /**
     * Write the ini file passing each key to the writer avoinding the empty key/value couple
     *
     * @returns - {any} - the result of the operation
     * @param filePath - the filepath to write to
     * @param content - the content to write
     */
    iniWriteSync(filePath, content) {
        Object.keys(content).forEach((key) => {
            Object.keys(content[key]).forEach((subKey) => {
                if (content[key][subKey] === null || content[key][subKey] === undefined || content[key][subKey] === "null" || content[key][subKey] === "") {
                    delete content[key][subKey];
                }
            });
        });
        const old = this.iniParseSync(filePath);
        const result = Object.assign(old, content);
        return this.writeFileSync(filePath, this.nativeService.ini.stringify(result));
    }
    replaceWriteSync(filePath, content) {
        Object.keys(content).forEach((key) => {
            Object.keys(content[key]).forEach((subKey) => {
                if (content[key][subKey] === null || content[key][subKey] === undefined || content[key][subKey] === "null" || content[key][subKey] === "") {
                    delete content[key][subKey];
                }
            });
        });
        return this.writeFileSync(filePath, this.nativeService.ini.stringify(content));
    }
    /**
     * Parse the ini file in a synch way
     *
     * @returns - {any} - returns the parsed string
     * @param filePath - the filepath to read from
     */
    iniParseSync(filePath) {
        return this.nativeService.ini.parse(this.readFileSync(filePath));
    }
    // TODO: move these methods under another service, or try to replace them with encryptionService stuff from leapp-basement
    /**
     * Encrypt Text
     */
    encryptText(text) {
        return cryptoJS.AES.encrypt(text.trim(), this.aesKey).toString();
    }
    /**
     * Decrypt Text
     */
    decryptText(text) {
        return cryptoJS.AES.decrypt(text.trim(), this.aesKey).toString(cryptoJS.enc.Utf8);
    }
}
exports.FileService = FileService;
