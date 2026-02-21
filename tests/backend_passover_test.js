
// Mock global objects
global.fetch = async (url, options) => {
    return {
        ok: true,
        json: async () => ({ filename: 'test.jpg' }),
        blob: async () => 'blob-data',
        statusText: 'OK'
    };
};

global.AbortController = class {
    constructor() {
        this.signal = { aborted: false };
    }
    abort() {
        this.signal.aborted = true;
    }
};

global.FormData = class {
    append(key, value) {}
};

global.URL = {
    createObjectURL: (blob) => 'blob:url',
    revokeObjectURL: (url) => {}
};

// Mock Auth
const auth = {
    currentUser: {
        getIdToken: async () => 'mock-token'
    }
};

// Helper function to be tested
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

// Functions to be tested (replicating the logic we want to implement)
async function uploadReceipt(file) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const token = await user.getIdToken();
    const formData = new FormData();
    formData.append('receipt', file);

    const url = `https://api.lehn.site/api/upload`;

    try {
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed: ' + response.statusText);
        }

        const data = await response.json();
        return data.filename;
    } catch (error) {
        throw error;
    }
}

async function fetchReceiptImage(filename) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const token = await user.getIdToken();
    // Use encodeURIComponent
    const url = `https://api.lehn.site/api/receipts/${encodeURIComponent(filename)}`;

    try {
        const response = await fetchWithTimeout(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Fetch failed: ' + response.statusText);
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        throw error;
    }
}

// Tests
async function runTests() {
    console.log("Running tests...");

    // Test 1: URL Encoding
    const filename = "file with spaces.jpg";
    const expectedUrl = `https://api.lehn.site/api/receipts/${encodeURIComponent(filename)}`;

    // Spy on fetch to check URL
    let capturedUrl;
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        capturedUrl = url;
        return originalFetch(url, options);
    };

    await fetchReceiptImage(filename);
    if (capturedUrl === expectedUrl) {
        console.log("PASS: URL Encoding Correct");
    } else {
        console.error(`FAIL: URL Encoding Incorrect. Expected ${expectedUrl}, got ${capturedUrl}`);
        process.exit(1);
    }

    // Test 2: Timeout
    // We need to make fetch slow to trigger timeout
    global.fetch = async (url, options) => {
        if (options.signal) {
             // Simulate a long operation
             await new Promise(resolve => setTimeout(resolve, 200));
             if (options.signal.aborted) {
                 const err = new Error('The user aborted a request.');
                 err.name = 'AbortError';
                 throw err;
             }
        }
        return { ok: true, json: async () => ({}), blob: async () => 'blob' };
    };

    try {
        // Set timeout to 50ms, operation takes 200ms
        await fetchWithTimeout('https://example.com', { timeout: 50 });
        console.error("FAIL: Timeout did not trigger");
        process.exit(1);
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log("PASS: Timeout Triggered Correctly");
        } else {
            console.error("FAIL: Wrong error on timeout", err);
            console.error(err);
            process.exit(1);
        }
    }

    console.log("All tests passed!");
}

runTests();
