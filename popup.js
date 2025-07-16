class UIDevKitPopup {
    constructor() {
        this.measureBtn = document.getElementById('measureBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.status = document.getElementById('status');
        this.statusText = this.status.querySelector('.status-text');
        
        this.init();
    }

    init() {
        this.measureBtn.addEventListener('click', () => this.toggleMeasurement());
        this.clearBtn.addEventListener('click', () => this.clearMeasurements());
        
        // Check current state when popup opens
        this.checkCurrentState();
    }

    async checkCurrentState() {
        try {
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            const results = await browser.tabs.sendMessage(tab.id, { action: 'getState' });
            
            if (results && results.measuring) {
                this.measureBtn.classList.add('active');
                this.measureBtn.querySelector('span:last-child').textContent = 'Stop Measuring';
                this.updateStatus('Click and drag to measure distance');
            }
        } catch (error) {
            console.log('Content script not ready yet');
        }
    }

    async toggleMeasurement() {
        try {
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            const results = await browser.tabs.sendMessage(tab.id, { action: 'toggleMeasurement' });
            
            if (results && results.measuring) {
                this.measureBtn.classList.add('active');
                this.measureBtn.querySelector('span:last-child').textContent = 'Stop Measuring';
                this.updateStatus('Click and drag to measure distance');
            } else {
                this.measureBtn.classList.remove('active');
                this.measureBtn.querySelector('span:last-child').textContent = 'Measure Distance';
                this.updateStatus('Ready to measure');
            }
        } catch (error) {
            console.error('Error toggling measurement:', error);
            this.updateStatus('Error: Please refresh the page');
        }
    }

    async clearMeasurements() {
        try {
            const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
            await browser.tabs.sendMessage(tab.id, { action: 'clearMeasurements' });
            this.updateStatus('All measurements cleared');
        } catch (error) {
            console.error('Error clearing measurements:', error);
        }
    }

    updateStatus(message) {
        this.statusText.textContent = message;
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new UIDevKitPopup();
});