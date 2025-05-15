// This file handles accessing the user's microphone, capturing audio data, and managing real-time processing for the spectrogram display.

// Select the canvas and set up the drawing context
const canvas = document.getElementById('spectrogramCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions to fill the window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawGrid(); // Redraw the grid after resizing
}

// Listen for window resize events
window.addEventListener('resize', resizeCanvas);

// Initial canvas setup
resizeCanvas();

// Function to draw a grid on the canvas
function drawGrid() {
    const gridColor = '#ccc';
    const stepX = 50; // Horizontal grid spacing
    const stepY = 50; // Vertical grid spacing

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;

    // Draw vertical lines
    for (let x = 0; x <= canvas.width; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= canvas.height; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
let microphone = null; // Change from const to let
const dataArray = new Uint8Array(analyser.frequencyBinCount);

async function initMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphone = audioContext.createMediaStreamSource(stream); // Now this reassignment works
        microphone.connect(analyser);
        drawSpectrogram();
    } catch (error) {
        console.error('Error accessing microphone:', error);
    }
}

let isLogScale = false; // Default to linear scale

// Add event listener for the scale toggle button
document.getElementById('toggleScaleButton').addEventListener('click', () => {
    isLogScale = !isLogScale;
    const button = document.getElementById('toggleScaleButton');
    button.textContent = isLogScale ? 'Switch to Linear Scale' : 'Switch to Logarithmic Scale';
});

// Function to map frequency bin index to Y position
function mapFrequencyToY(index, totalBins) {
    if (isLogScale) {
        // Logarithmic scale: Map index to log space
        const logMin = Math.log10(1); // Minimum frequency (1 Hz)
        const logMax = Math.log10(totalBins); // Maximum frequency
        const logIndex = Math.log10(index + 1); // Logarithmic position
        return canvas.height * (1 - (logIndex - logMin) / (logMax - logMin));
    } else {
        // Linear scale: Map index directly to Y position
        return canvas.height * (1 - index / totalBins);
    }
}

let scrollSpeed = 2; // Default scroll speed (pixels per frame)

// Add event listener for the time resolution slider
const timeResolutionSlider = document.getElementById('timeResolutionSlider');
timeResolutionSlider.addEventListener('input', (event) => {
    // Reverse the slider value: left = max time, right = min time
    const sliderValue = parseInt(event.target.value, 10);
    scrollSpeed = 11 - sliderValue; // Invert the slider value (1 becomes 10, 10 becomes 1)
    console.log(`Time resolution updated: scrollSpeed = ${scrollSpeed}`);
});

function drawSpectrogram() {
    requestAnimationFrame(drawSpectrogram);
    analyser.getByteFrequencyData(dataArray);

    // Shift the canvas content to the left
    const imageData = ctx.getImageData(scrollSpeed, 0, canvas.width - scrollSpeed, canvas.height);
    ctx.putImageData(imageData, 0, 0);

    // Clear the rightmost part of the canvas
    ctx.clearRect(canvas.width - scrollSpeed, 0, scrollSpeed, canvas.height);

    // Draw the new frequency data as a vertical line on the right
    for (let i = 0; i < analyser.frequencyBinCount; i++) {
        const intensity = dataArray[i];
        const color = intensityToColor(intensity);
        ctx.fillStyle = color;

        // Map frequency bin index to Y position based on the selected scale
        const y = mapFrequencyToY(i, analyser.frequencyBinCount);
        const nextY = mapFrequencyToY(i + 1, analyser.frequencyBinCount);

        ctx.fillRect(canvas.width - scrollSpeed, nextY, scrollSpeed, y - nextY);
    }

    // Draw the frequency scale on the left-hand side
    drawFrequencyScale();

    // Draw the time axis at the bottom
    drawTimeAxis();
}

// Function to map intensity to a color gradient
function intensityToColor(intensity) {
    // Map intensity (0-255) to a gradient from black to purple to orange to yellow
    const ratio = intensity / 255; // Normalize intensity to a 0-1 range

    const r = Math.min(255, Math.max(0, 255 * ratio)); // Red increases with intensity
    const g = Math.min(255, Math.max(0, 255 * (ratio - 0.5) * 2)); // Green starts increasing at mid-intensity
    const b = Math.min(255, Math.max(0, 255 * (1 - ratio))); // Blue decreases with intensity

    // Adjust for black at the lowest intensity
    const adjustedR = Math.round(r * ratio); // Fade red in from black
    const adjustedG = Math.round(g * ratio); // Fade green in from black
    const adjustedB = Math.round(b * ratio); // Fade blue in from black

    return `rgb(${adjustedR}, ${adjustedG}, ${adjustedB})`;
}

// Function to draw the frequency scale on the left-hand side
function drawFrequencyScale() {
    const numTicks = 10; // Number of ticks on the scale
    const maxFrequency = audioContext.sampleRate / 2; // Nyquist frequency
    const scaleWidth = 100; // Increased width of the scale area
    const tickSpacing = canvas.height / numTicks;

    // Clear the left-hand side of the canvas (scale area)
    ctx.clearRect(0, 0, scaleWidth, canvas.height);

    ctx.font = '14px Arial'; // Slightly larger font for readability
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= numTicks; i++) {
        const y = i * tickSpacing;
        let frequency;

        if (isLogScale) {
            // Logarithmic scale: Map Y position to frequency
            const logMin = Math.log10(1); // Minimum frequency (1 Hz)
            const logMax = Math.log10(maxFrequency);
            const logFrequency = logMin + (logMax - logMin) * (1 - y / canvas.height);
            frequency = Math.pow(10, logFrequency);
        } else {
            // Linear scale: Map Y position to frequency
            frequency = maxFrequency * (1 - y / canvas.height);
        }

        // Format frequency for display
        const frequencyLabel = frequency >= 1000
            ? `${(frequency / 1000).toFixed(1)}kHz`
            : `${Math.round(frequency)}Hz`;

        // Draw the frequency label
        ctx.fillText(frequencyLabel, scaleWidth - 10, y);
    }
}

// Function to draw the time axis at the bottom of the canvas
function drawTimeAxis() {
    const numTicks = 10; // Number of ticks on the time axis
    const tickSpacing = canvas.width / numTicks;
    const totalTime = (canvas.width / scrollSpeed) / 60; // Total time in seconds displayed on the canvas

    ctx.font = '14px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Clear the bottom area for the time axis
    const axisHeight = 30; // Height of the time axis area
    ctx.clearRect(0, canvas.height - axisHeight, canvas.width, axisHeight);

    // Draw the time ticks and labels
    for (let i = 0; i <= numTicks; i++) {
        const x = i * tickSpacing;
        const time = totalTime - (i * totalTime) / numTicks; // Reverse time calculation
        const timeLabel = `${time.toFixed(1)}s`;

        // Draw the tick
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - axisHeight);
        ctx.lineTo(x, canvas.height - axisHeight + 5);
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Draw the label
        ctx.fillText(timeLabel, x, canvas.height - axisHeight + 10);
    }
}

// Initialize the slider to match the current scrollSpeed
document.addEventListener('DOMContentLoaded', () => {
    timeResolutionSlider.value = 11 - scrollSpeed; // Set slider to reflect the inverted scrollSpeed
    initMicrophone();
});

// Ensure the time axis updates when the canvas is resized
window.addEventListener('resize', () => {
    resizeCanvas();
    drawTimeAxis();
});