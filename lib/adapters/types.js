/**
 * @typedef {Object} AuthResult
 * @property {string} uid
 * @property {string} email
 * @property {string} name
 * @property {'superadmin'|'editor'} role
 * @property {string} accessToken   - JWT (server mode) or Firebase ID token (firebase mode)
 * @property {string} [refreshToken] - Only present in server mode
 */

/**
 * @typedef {Object} AdminUser
 * @property {string} uid
 * @property {string} email
 * @property {string} name
 * @property {'superadmin'|'editor'} role
 */

/**
 * @typedef {Object} ContentItem
 * @property {string} id
 * @property {Object} [data]   - All other fields as returned by the backend
 */

/**
 * @typedef {Object} UploadResult
 * @property {string} url        - Cloudinary secure_url (free) or server file path (paid)
 * @property {string} filename
 * @property {string} mimeType
 * @property {number} sizeBytes
 */

/**
 * @typedef {function(): void} Unsubscribe
 */

/**
 * BackendAdapter interface.
 * Both firebase-adapter.js and server-adapter.js MUST implement
 * every method below with the exact signatures specified.
 *
 * @interface BackendAdapter
 */

/**
 * @function login
 * @memberof BackendAdapter
 * @param {string} email
 * @param {string} password
 * @returns {Promise<AuthResult>}
 */

/**
 * @function logout
 * @memberof BackendAdapter
 * @returns {Promise<void>}
 */

/**
 * @function getSession
 * @memberof BackendAdapter
 * @returns {Promise<AdminUser|null>}
 */

/**
 * @function getAll
 * @memberof BackendAdapter
 * @param {string} collection - e.g. "pages", "media", "settings"
 * @returns {Promise<ContentItem[]>}
 */

/**
 * @function getById
 * @memberof BackendAdapter
 * @param {string} collection
 * @param {string} id
 * @returns {Promise<ContentItem>}
 */

/**
 * @function create
 * @memberof BackendAdapter
 * @param {string} collection
 * @param {Object} data
 * @returns {Promise<ContentItem>}
 */

/**
 * @function update
 * @memberof BackendAdapter
 * @param {string} collection
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<ContentItem>}
 */

/**
 * @function softDelete
 * @memberof BackendAdapter
 * @param {string} collection
 * @param {string} id
 * @returns {Promise<void>}
 */

/**
 * @function uploadFile
 * @memberof BackendAdapter
 * @param {File} file
 * @param {string} path - Logical path hint (e.g. "site-images")
 * @returns {Promise<UploadResult>}
 */

/**
 * @function deleteFile
 * @memberof BackendAdapter
 * @param {string} url - The stored URL to delete
 * @returns {Promise<void>}
 */

/**
 * @function subscribe
 * @memberof BackendAdapter
 * @param {string} collection
 * @param {function(ContentItem[]): void} callback
 * @returns {Unsubscribe}
 */

// This file is type-documentation only. No runtime exports needed.
// Adapters import types via JSDoc @type annotations referencing this file.