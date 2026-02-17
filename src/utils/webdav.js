export const uploadReceipt = async (file) => {
    const username = import.meta.env.VITE_WEBDAV_USERNAME;
    const password = import.meta.env.VITE_WEBDAV_PASSWORD;
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${safeName}`;
    const url = `https://cloud.lehn.site/remote.php/dav/files/${username}/Kassenbongs/${filename}`;

    const headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(username + ':' + password));
    headers.set('Content-Type', file.type);

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: headers,
            body: file
        });

        if (!response.ok) {
            throw new Error('Upload failed: ' + response.statusText);
        }

        return filename;
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
};

export const fetchReceiptImage = async (filename) => {
    const username = import.meta.env.VITE_WEBDAV_USERNAME;
    const password = import.meta.env.VITE_WEBDAV_PASSWORD;
    const url = `https://cloud.lehn.site/remote.php/dav/files/${username}/Kassenbongs/${filename}`;

    const headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(username + ':' + password));

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error('Fetch failed: ' + response.statusText);
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('Fetch image error:', error);
        throw error;
    }
};
