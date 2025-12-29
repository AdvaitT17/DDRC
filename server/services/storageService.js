/**
 * Storage Service - Environment-aware file storage abstraction
 * Uses local disk in development, Azure Blob Storage in production
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } = require('@azure/storage-blob');

class StorageService {
    constructor() {
        this.useAzure = process.env.NODE_ENV === 'production' &&
            !!process.env.AZURE_STORAGE_CONNECTION_STRING;

        this.localUploadsDir = path.join(__dirname, '../uploads');
        this.containerName = process.env.AZURE_STORAGE_CONTAINER || 'uploads';

        // Initialize Azure Blob client in production
        if (this.useAzure) {
            try {
                this.blobServiceClient = BlobServiceClient.fromConnectionString(
                    process.env.AZURE_STORAGE_CONNECTION_STRING
                );
                this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);

                // Parse connection string for SAS generation
                this._parseConnectionString();

                console.log('✅ Azure Blob Storage initialized');
            } catch (error) {
                console.error('❌ Failed to initialize Azure Blob Storage:', error.message);
                // Fall back to local storage
                this.useAzure = false;
            }
        } else {
            console.log('📁 Using local file storage');
            // Ensure local uploads directory exists (only needed for local storage)
            this._ensureLocalDirs();
        }
    }

    /**
     * Parse connection string to extract account details for SAS generation
     */
    _parseConnectionString() {
        const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
        const parts = {};
        connStr.split(';').forEach(part => {
            const [key, ...valueParts] = part.split('=');
            if (key && valueParts.length) {
                parts[key] = valueParts.join('=');
            }
        });

        this.accountName = parts['AccountName'];
        this.accountKey = parts['AccountKey'];

        if (this.accountName && this.accountKey) {
            this.sharedKeyCredential = new StorageSharedKeyCredential(
                this.accountName,
                this.accountKey
            );
        }
    }

    /**
     * Ensure local upload directories exist
     */
    _ensureLocalDirs() {
        const dirs = ['', 'news', 'events', 'forms', 'documents', 'admin'];
        dirs.forEach(dir => {
            const fullPath = path.join(this.localUploadsDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    }

    /**
     * Generate a unique filename
     */
    generateFilename(originalname) {
        const timestamp = Date.now();
        const hash = crypto.randomBytes(8).toString('hex');
        const cleanName = originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const ext = path.extname(cleanName);
        const baseName = path.basename(cleanName, ext);
        return `${timestamp}-${hash}-${baseName}${ext}`;
    }

    /**
     * Save a file to storage
     * @param {Buffer} buffer - File buffer
     * @param {string} folder - Folder name (news, events, forms, documents)
     * @param {string} filename - Filename to save as
     * @returns {Promise<string>} - Relative file path (e.g., "news/1234-abc.pdf")
     */
    async saveFile(buffer, folder, filename) {
        const relativePath = `${folder}/${filename}`;

        if (this.useAzure) {
            return await this._saveToAzure(buffer, relativePath);
        } else {
            return await this._saveToLocal(buffer, relativePath);
        }
    }

    /**
     * Save file to local disk
     */
    async _saveToLocal(buffer, relativePath) {
        const fullPath = path.join(this.localUploadsDir, relativePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await fs.promises.writeFile(fullPath, buffer);
        return relativePath;
    }

    /**
     * Save file to Azure Blob Storage
     */
    async _saveToAzure(buffer, relativePath) {
        const blockBlobClient = this.containerClient.getBlockBlobClient(relativePath);

        // Determine content type based on extension
        const ext = path.extname(relativePath).toLowerCase();
        const contentType = this._getContentType(ext);

        await blockBlobClient.upload(buffer, buffer.length, {
            blobHTTPHeaders: { blobContentType: contentType }
        });

        return relativePath;
    }

    /**
     * Delete a file from storage
     * @param {string} relativePath - Relative path (e.g., "news/1234-abc.pdf")
     */
    async deleteFile(relativePath) {
        if (!relativePath) return;

        // Clean the path - remove leading /uploads/ if present
        const cleanPath = relativePath.replace(/^\/?(uploads\/)?/, '');

        if (this.useAzure) {
            return await this._deleteFromAzure(cleanPath);
        } else {
            return await this._deleteFromLocal(cleanPath);
        }
    }

    /**
     * Delete file from local disk
     */
    async _deleteFromLocal(relativePath) {
        const fullPath = path.join(this.localUploadsDir, relativePath);

        try {
            if (fs.existsSync(fullPath)) {
                await fs.promises.unlink(fullPath);
            }
        } catch (error) {
            console.error(`Error deleting local file ${relativePath}:`, error.message);
        }
    }

    /**
     * Delete file from Azure Blob Storage
     */
    async _deleteFromAzure(relativePath) {
        try {
            const blockBlobClient = this.containerClient.getBlockBlobClient(relativePath);
            await blockBlobClient.deleteIfExists();
        } catch (error) {
            console.error(`Error deleting blob ${relativePath}:`, error.message);
        }
    }

    /**
     * Get a URL for accessing a file
     * For public files (news, events): direct URL or local path
     * For private files (forms, documents): SAS URL with expiry
     * 
     * @param {string} relativePath - Relative path (e.g., "forms/1234-abc.pdf")
     * @param {object} options - Options
     * @param {boolean} options.private - Generate SAS token for private access
     * @param {number} options.expiryMinutes - SAS token expiry in minutes (default: 60)
     * @returns {string} - URL to access the file
     */
    getFileUrl(relativePath, options = {}) {
        if (!relativePath) return null;

        // Clean the path
        const cleanPath = relativePath.replace(/^\/?(uploads\/)?/, '');

        if (this.useAzure) {
            return this._getAzureUrl(cleanPath, options);
        } else {
            // For local, return the relative path that Express will serve
            return `/uploads/${cleanPath}`;
        }
    }

    /**
     * Get Azure Blob URL with optional SAS token
     */
    _getAzureUrl(relativePath, options = {}) {
        const blockBlobClient = this.containerClient.getBlockBlobClient(relativePath);

        if (options.private && this.sharedKeyCredential) {
            // Generate SAS token for private access
            const expiryMinutes = options.expiryMinutes || 60;
            const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

            const sasToken = generateBlobSASQueryParameters({
                containerName: this.containerName,
                blobName: relativePath,
                permissions: BlobSASPermissions.parse('r'), // Read only
                expiresOn: expiresOn,
            }, this.sharedKeyCredential).toString();

            return `${blockBlobClient.url}?${sasToken}`;
        }

        // Public URL
        return blockBlobClient.url;
    }

    /**
     * Get a readable stream for a file
     * @param {string} relativePath - Relative path
     * @returns {Promise<ReadableStream>}
     */
    async getFileStream(relativePath) {
        if (!relativePath) return null;

        // Clean the path
        const cleanPath = relativePath.replace(/^\/?(uploads\/)?/, '');

        if (this.useAzure) {
            return await this._getAzureStream(cleanPath);
        } else {
            return this._getLocalStream(cleanPath);
        }
    }

    /**
     * Get local file stream
     */
    _getLocalStream(relativePath) {
        const fullPath = path.join(this.localUploadsDir, relativePath);

        if (!fs.existsSync(fullPath)) {
            throw new Error('File not found');
        }

        return fs.createReadStream(fullPath);
    }

    /**
     * Get Azure Blob stream
     */
    async _getAzureStream(relativePath) {
        const blockBlobClient = this.containerClient.getBlockBlobClient(relativePath);
        const downloadResponse = await blockBlobClient.download(0);
        return downloadResponse.readableStreamBody;
    }

    /**
     * Check if a file exists
     * @param {string} relativePath - Relative path
     * @returns {Promise<boolean>}
     */
    async fileExists(relativePath) {
        if (!relativePath) return false;

        const cleanPath = relativePath.replace(/^\/?(uploads\/)?/, '');

        if (this.useAzure) {
            try {
                const blockBlobClient = this.containerClient.getBlockBlobClient(cleanPath);
                return await blockBlobClient.exists();
            } catch {
                return false;
            }
        } else {
            const fullPath = path.join(this.localUploadsDir, cleanPath);
            return fs.existsSync(fullPath);
        }
    }

    /**
     * Get content type from file extension
     */
    _getContentType(ext) {
        const types = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
        };
        return types[ext] || 'application/octet-stream';
    }

    /**
     * Get file info (size, content type)
     * @param {string} relativePath - Relative path
     * @returns {Promise<{size: number, contentType: string} | null>}
     */
    async getFileInfo(relativePath) {
        if (!relativePath) return null;

        const cleanPath = relativePath.replace(/^\/?(uploads\/)?/, '');

        if (this.useAzure) {
            try {
                const blockBlobClient = this.containerClient.getBlockBlobClient(cleanPath);
                const properties = await blockBlobClient.getProperties();
                return {
                    size: properties.contentLength,
                    contentType: properties.contentType,
                };
            } catch {
                return null;
            }
        } else {
            const fullPath = path.join(this.localUploadsDir, cleanPath);
            try {
                const stats = await fs.promises.stat(fullPath);
                const ext = path.extname(cleanPath).toLowerCase();
                return {
                    size: stats.size,
                    contentType: this._getContentType(ext),
                };
            } catch {
                return null;
            }
        }
    }
}

// Export singleton instance
module.exports = new StorageService();
