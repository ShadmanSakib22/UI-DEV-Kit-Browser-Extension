class UIDevKitMeasurement {
    constructor() {
        this.measuring = false;
        this.measurements = [];
        this.currentMeasurement = null;
        this.overlay = null;
        this.startPoint = null;
        this.isDrawing = false;
        this.shiftPressed = false;
        
        this.init();
    }

    init() {
        this.createOverlay();
        this.setupEventListeners();
        this.setupMessageListener();
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'uidevkit-overlay';
        document.body.appendChild(this.overlay);
    }

    setupEventListeners() {
        // Mouse events for measurement
        this.overlay.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                this.shiftPressed = true;
                if (this.isDrawing) {
                    // Update the temp line immediately when shift is pressed
                    this.updateTempLine(e.clientX, e.clientY);
                }
            }
            if (e.key === 'Escape') {
                this.stopMeasuring();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                this.shiftPressed = false;
                if (this.isDrawing) {
                    // Update the temp line immediately when shift is released
                    this.updateTempLine(e.clientX, e.clientY);
                }
            }
        });
    }

    setupMessageListener() {
        browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'toggleMeasurement':
                    this.toggleMeasurement();
                    sendResponse({ measuring: this.measuring });
                    break;
                case 'clearMeasurements':
                    this.clearMeasurements();
                    sendResponse({ success: true });
                    break;
                case 'getState':
                    sendResponse({ measuring: this.measuring });
                    break;
            }
        });
    }

    toggleMeasurement() {
        if (this.measuring) {
            this.stopMeasuring();
        } else {
            this.startMeasuring();
        }
    }

    startMeasuring() {
        this.measuring = true;
        this.overlay.classList.add('measuring');
        document.body.classList.add('uidevkit-no-select');
        
        // Create notification
        this.showNotification('Click and drag to measure distance. Hold Shift for straight lines. Press ESC to stop.');
    }

    stopMeasuring() {
        this.measuring = false;
        this.overlay.classList.remove('measuring');
        document.body.classList.remove('uidevkit-no-select');
        
        // Clean up any temporary elements
        this.cleanupTempElements();
        
        this.hideNotification();
    }

    handleMouseDown(e) {
        if (!this.measuring) return;
        
        e.preventDefault();
        this.isDrawing = true;
        this.startPoint = { x: e.clientX, y: e.clientY };
        
        // Create temporary line for visual feedback
        this.createTempLine();
    }

    handleMouseMove(e) {
        if (!this.measuring || !this.isDrawing) return;
        
        e.preventDefault();
        this.updateTempLine(e.clientX, e.clientY);
    }

    handleMouseUp(e) {
        if (!this.measuring || !this.isDrawing) return;
        
        e.preventDefault();
        this.isDrawing = false;
        
        let endPoint = { x: e.clientX, y: e.clientY };
        
        // Apply shift constraint for final measurement
        if (this.shiftPressed) {
            endPoint = this.constrainToAxis(this.startPoint, endPoint);
        }
        
        const distance = this.calculateDistance(this.startPoint, endPoint);
        
        // Only create measurement if there's meaningful distance
        if (distance > 5) {
            this.createMeasurement(this.startPoint, endPoint, distance);
        }
        
        this.cleanupTempElements();
        this.startPoint = null;
    }

    constrainToAxis(startPoint, endPoint) {
        const deltaX = Math.abs(endPoint.x - startPoint.x);
        const deltaY = Math.abs(endPoint.y - startPoint.y);
        
        // Choose the axis with more movement
        if (deltaX > deltaY) {
            // Horizontal line
            return { x: endPoint.x, y: startPoint.y };
        } else {
            // Vertical line
            return { x: startPoint.x, y: endPoint.y };
        }
    }

    createTempLine() {
        this.tempLine = document.createElement('div');
        this.tempLine.className = 'uidevkit-temp-line';
        this.overlay.appendChild(this.tempLine);
    }

    updateTempLine(endX, endY) {
        if (!this.tempLine || !this.startPoint) return;
        
        let constrainedEnd = { x: endX, y: endY };
        
        // Apply shift constraint if needed
        if (this.shiftPressed) {
            constrainedEnd = this.constrainToAxis(this.startPoint, constrainedEnd);
        }
        
        const deltaX = constrainedEnd.x - this.startPoint.x;
        const deltaY = constrainedEnd.y - this.startPoint.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        this.tempLine.style.left = this.startPoint.x + 'px';
        this.tempLine.style.top = this.startPoint.y + 'px';
        this.tempLine.style.width = distance + 'px';
        this.tempLine.style.transform = `rotate(${angle}rad)`;
        
        // Add visual indicator when shift is pressed
        if (this.shiftPressed) {
            this.tempLine.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.8), 0 0 8px rgba(59, 130, 246, 0.6)';
        } else {
            this.tempLine.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.8)';
        }
    }

    cleanupTempElements() {
        if (this.tempLine) {
            this.tempLine.remove();
            this.tempLine = null;
        }
    }

    calculateDistance(point1, point2) {
        const deltaX = point2.x - point1.x;
        const deltaY = point2.y - point1.y;
        return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    createMeasurement(startPoint, endPoint, distance) {
        const measurement = {
            id: Date.now(),
            startPoint,
            endPoint,
            distance,
            elements: {}
        };

        // Create visual elements
        measurement.elements.line = this.createLineElement(startPoint, endPoint);
        measurement.elements.startPoint = this.createPointElement(startPoint);
        measurement.elements.endPoint = this.createPointElement(endPoint);
        measurement.elements.label = this.createLabelElement(startPoint, endPoint, distance);

        this.measurements.push(measurement);
        this.overlay.appendChild(measurement.elements.line);
        this.overlay.appendChild(measurement.elements.startPoint);
        this.overlay.appendChild(measurement.elements.endPoint);
        this.overlay.appendChild(measurement.elements.label);
    }

    createLineElement(startPoint, endPoint) {
        const line = document.createElement('div');
        line.className = 'uidevkit-measurement-line';
        
        const deltaX = endPoint.x - startPoint.x;
        const deltaY = endPoint.y - startPoint.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        line.style.left = startPoint.x + 'px';
        line.style.top = startPoint.y + 'px';
        line.style.width = distance + 'px';
        line.style.transform = `rotate(${angle}rad)`;
        
        return line;
    }

    createPointElement(point) {
        const pointEl = document.createElement('div');
        pointEl.className = 'uidevkit-measurement-point';
        pointEl.style.left = point.x + 'px';
        pointEl.style.top = point.y + 'px';
        return pointEl;
    }

    createLabelElement(startPoint, endPoint, distance) {
        const label = document.createElement('div');
        label.className = 'uidevkit-measurement-label';
        
        // Check if it's a straight line and add direction info
        const deltaX = Math.abs(endPoint.x - startPoint.x);
        const deltaY = Math.abs(endPoint.y - startPoint.y);
        const isHorizontal = deltaY < 2;
        const isVertical = deltaX < 2;
        
        let labelText = `${Math.round(distance)}px`;
        if (isHorizontal) {
            labelText += ' →';
        } else if (isVertical) {
            labelText += ' ↑';
        }
        
        label.textContent = labelText;
        
        // Position label at midpoint
        const midX = (startPoint.x + endPoint.x) / 2;
        const midY = (startPoint.y + endPoint.y) / 2;
        
        label.style.left = midX + 'px';
        label.style.top = (midY - 25) + 'px';
        label.style.transform = 'translateX(-50%)';
        
        return label;
    }

    clearMeasurements() {
        this.measurements.forEach(measurement => {
            Object.values(measurement.elements).forEach(element => {
                if (element && element.parentNode) {
                    element.remove();
                }
            });
        });
        this.measurements = [];
    }

    showNotification(message) {
        // Remove existing notification
        this.hideNotification();
        
        this.notification = document.createElement('div');
        this.notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1e293b;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000003;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 350px;
            pointer-events: none;
        `;
        this.notification.textContent = message;
        document.body.appendChild(this.notification);
    }

    hideNotification() {
        if (this.notification) {
            this.notification.remove();
            this.notification = null;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new UIDevKitMeasurement();
    });
} else {
    new UIDevKitMeasurement();
}