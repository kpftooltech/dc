// IMPORTANT: Replace this with your actual Web App URL from Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYjeM3iIRUi_G6BdjEiyy28EO-BUiQk5hT2OEOQLr9_WcoZHF2aTwiHKn6cio1DXadZA/exec";


 /**
 * Helper function to make GET requests using the JSONP trick.
 * This will reliably bypass CORS errors from Google Apps Script.
 */
function serverGet(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };

        const url = new URL(SCRIPT_URL);
        url.searchParams.append('action', action);
        url.searchParams.append('callback', callbackName);
        for (const key in params) {
            url.searchParams.append(key, params[key]);
        }

        const script = document.createElement('script');
        script.src = url;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

/**
 * Helper function to make POST requests for saving/deleting data.
 */
async function serverPost(action, payload) {
    // We use a redirect workaround for doPost with Apps Script in a no-cors environment
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload }),
        redirect: 'follow'
    });
    // With no-cors, the response is 'opaque', so we can't read its content directly.
    // We assume it was successful and let the server handle any errors.
    return { success: true, message: 'Action sent to server.' };
}

function app() {
    return {
        isLoading: true,
        view: 'welcome',
        dcs: [],
        dropdowns: {},
        currentDc: null,
        formDc: {},

        async init() {
            try {
                this.isLoading = true;
                const [ddData, dcList] = await Promise.all([
                    serverGet('getDropdownData'),
                    serverGet('getDcs')
                ]);
                if (ddData.error) throw new Error(ddData.error);
                if (dcList.error) throw new Error(dcList.error);
                this.dropdowns = ddData;
                this.dcs = dcList;
            } catch (err) {
                alert('Initialization Error: ' + err.message);
            } finally {
                this.isLoading = false;
            }
        },

        async selectDc(transferId) {
            this.isLoading = true;
            try {
                const details = await serverGet('getDcDetails', { transferId });
                if (details.error) throw new Error(details.error);
                this.currentDc = details;
                this.view = 'details';
            } catch (err) {
                alert('Error fetching details: ' + err.message);
            } finally {
                this.isLoading = false;
            }
        },

        showForm(dc = null) {
            if (dc) { this.formDc = JSON.parse(JSON.stringify(dc)); }
            else { this.formDc = { Status: 'Draft', items: [{ ItemCode: '', Quantity: '', Note: '' }] }; }
            this.view = 'form';
        },

        async saveDc() {
            this.isLoading = true;
            try {
                await serverPost('saveDc', this.formDc);
                alert('Save successful! Refreshing data...');
                await this.init(); // Refresh all data
                this.view = 'welcome';
            } catch (err) {
                alert('Error saving DC: ' + err.message);
            } finally {
                this.isLoading = false;
            }
        },
        
        async deleteDc(transferId) {
            if (!confirm('Are you sure you want to delete this DC?')) return;
            this.isLoading = true;
            try {
                await serverPost('deleteDc', { transferId });
                alert('Delete successful! Refreshing data...');
                await this.init();
                this.view = 'welcome';
            } catch (err) {
                alert('Error deleting DC: ' + err.message);
            } finally {
                this.isLoading = false;
            }
        },
        
        // --- Other form helper functions ---
        addItem() { this.formDc.items.push({ ItemCode: '', Quantity: '', Note: '' }); },
        cancelEdit() { this.view = this.currentDc ? 'details' : 'welcome'; }
    }
}

