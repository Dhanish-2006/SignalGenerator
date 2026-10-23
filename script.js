/* ========================================
   SIGNALLAB - WAVEFORM ENGINE
   ======================================== */

"use strict";


/* ELEMENTS */

const canvas = document.getElementById("waveCanvas");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);


/* DEFAULT SETTINGS */

const defaults = {
    type: "sine",
    frequency: 2,
    amplitude: 5,
    phase: 0,
    cycles: 2
};


/* APPLICATION STATE */

let running = true;
let elapsed = 0;
let previousTime = performance.now();

let animationFrame = null;
let resizeObserver = null;
let apiRequestId = 0;

let cssWidth = 0;
let cssHeight = 0;


/* ========================================
   READ INPUTS
   ======================================== */

function getParameters() {

    return {
        type: $("waveType").value,

        frequency: Number(
            $("frequency").value
        ),

        amplitude: Number(
            $("amplitude").value
        ),

        phase: Number(
            $("phase").value
        ),

        cycles: Number(
            $("cycles").value
        )
    };

}


/* ========================================
   WAVEFORM CALCULATION
   ======================================== */

function calculateWave(type, angle) {

    const normalized =
        ((angle % (2 * Math.PI)) + 2 * Math.PI)
        % (2 * Math.PI);

    switch (type) {

        case "sine":

            return Math.sin(angle);


        case "square":

            return Math.sin(angle) >= 0 ? 1 : -1;


        case "triangle":

            return (2 / Math.PI) *
                Math.asin(Math.sin(angle));


        case "sawtooth":

            return normalized / Math.PI - 1;


        default:

            return Math.sin(angle);

    }

}


/* ========================================
   RESIZE CANVAS
   ======================================== */

function resizeCanvas() {

    const rect = canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
        return;
    }

    cssWidth = rect.width;
    cssHeight = rect.height;

    const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
    );

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    drawWaveform();

}


/* ========================================
   DRAW OSCILLOSCOPE
   ======================================== */

function drawWaveform() {

    if (!cssWidth || !cssHeight) {
        return;
    }

    const p = getParameters();

    const width = cssWidth;
    const height = cssHeight;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#070e19";

    ctx.fillRect(0, 0, width, height);


    /* GRAPH DIMENSIONS */

    const left = Math.min(55, width * 0.17);
    const right = 13;
    const top = 28;
    const bottom = 31;

    const graphWidth = Math.max(
        1,
        width - left - right
    );

    const graphHeight = Math.max(
        1,
        height - top - bottom
    );

    const middle = top + graphHeight / 2;

    const maxVoltage = p.amplitude * 1.2;


    /* GRID */

    ctx.lineWidth = 1;

    ctx.strokeStyle = "#1e3047";

    ctx.fillStyle = "#91a5c2";

    ctx.font = "10px Consolas, monospace";


    /* VERTICAL GRID */

    for (let i = 0; i <= 10; i++) {

        const x =
            left + graphWidth * i / 10;

        ctx.beginPath();

        ctx.moveTo(x, top);

        ctx.lineTo(
            x,
            top + graphHeight
        );

        ctx.stroke();


        if (i % 2 === 0) {

            const time =
                p.cycles / p.frequency * i / 10;

            ctx.textAlign = "center";

            ctx.fillText(
                time.toFixed(2) + " s",
                x,
                height - 11
            );

        }

    }


    /* HORIZONTAL GRID */

    for (let i = 0; i <= 8; i++) {

        const y =
            top + graphHeight * i / 8;

        ctx.beginPath();

        ctx.moveTo(left, y);

        ctx.lineTo(
            left + graphWidth,
            y
        );

        ctx.stroke();


        const voltage =
            maxVoltage -
            (2 * maxVoltage * i / 8);

        ctx.textAlign = "right";

        ctx.fillText(
            voltage.toFixed(1) + " V",
            left - 7,
            y + 3
        );

    }


    /* ZERO VOLTAGE AXIS */

    ctx.beginPath();

    ctx.strokeStyle = "#50647e";

    ctx.lineWidth = 1.2;

    ctx.moveTo(left, middle);

    ctx.lineTo(
        left + graphWidth,
        middle
    );

    ctx.stroke();


    /* WAVEFORM PARAMETERS */

    const phaseRadians =
        p.phase * Math.PI / 180;

    const timeWindow =
        p.cycles / p.frequency;


    /* DRAW SIGNAL */

    ctx.beginPath();

    ctx.strokeStyle = "#35e8d0";

    ctx.lineWidth = 2.2;

    ctx.lineJoin = "round";

    ctx.lineCap = "round";

    ctx.shadowColor = "#35e8d0";

    ctx.shadowBlur = 8;


    const pixelStep = 1;

    for (
        let xPixel = 0;
        xPixel <= graphWidth;
        xPixel += pixelStep
    ) {

        const t =
            (xPixel / graphWidth) * timeWindow;

        const angle =
            2 * Math.PI * p.frequency *
            (t - elapsed) +
            phaseRadians;

        const voltage =
            p.amplitude *
            calculateWave(p.type, angle);

        const x = left + xPixel;

        const y =
            middle -
            (voltage / maxVoltage) *
            (graphHeight / 2);


        if (xPixel === 0) {

            ctx.moveTo(x, y);

        } else {

            ctx.lineTo(x, y);

        }

    }

    ctx.stroke();

    ctx.shadowBlur = 0;

}


/* ========================================
   MEASUREMENTS
   ======================================== */

function calculateMeasurements(p) {

    let rmsFactor;

    switch (p.type) {

        case "square":

            rmsFactor = 1;

            break;


        case "triangle":
        case "sawtooth":

            rmsFactor = 1 / Math.sqrt(3);

            break;


        default:

            rmsFactor = 1 / Math.sqrt(2);

    }


    return {

        peakVoltage: p.amplitude,

        peakToPeak: 2 * p.amplitude,

        rmsVoltage: p.amplitude * rmsFactor,

        frequency: p.frequency,

        periodMs: 1000 / p.frequency,

        angularFrequency:
            2 * Math.PI * p.frequency

    };

}


/* ========================================
   UPDATE MEASUREMENTS
   ======================================== */

function updateMeasurements(p, measurements) {

    $("peakVoltage").textContent =
        measurements.peakVoltage.toFixed(2) + " V";

    $("peakToPeak").textContent =
        measurements.peakToPeak.toFixed(2) + " V";

    $("rmsVoltage").textContent =
        measurements.rmsVoltage.toFixed(2) + " V";

    $("freqMeasure").textContent =
        measurements.frequency.toFixed(2) + " Hz";

    $("period").textContent =
        measurements.periodMs.toFixed(1) + " ms";

    $("angularFrequency").textContent =
        measurements.angularFrequency.toFixed(2) +
        " rad/s";

}


/* ========================================
   UPDATE INTERFACE
   ======================================== */

function updateDisplay() {

    const p = getParameters();


    /* SLIDER VALUES */

    $("frequencyValue").textContent =
        p.frequency + " Hz";

    $("amplitudeValue").textContent =
        p.amplitude + " V";

    $("phaseValue").textContent =
        p.phase + "°";

    $("cyclesValue").textContent =
        p.cycles +
        (p.cycles === 1 ? " cycle" : " cycles");


    /* WAVEFORM NAME */

    const names = {

        sine: "SINE WAVE",

        square: "SQUARE WAVE",

        triangle: "TRIANGLE WAVE",

        sawtooth: "SAWTOOTH WAVE"

    };

    $("waveName").textContent = names[p.type];


    /* MEASUREMENTS */

    const measurements =
        calculateMeasurements(p);

    updateMeasurements(p, measurements);


    /* SIGNAL EQUATION */

    if (p.type === "sine") {

        $("equation").textContent =
            `v(t) = ${p.amplitude} sin(` +
            `2π × ${p.frequency}t + ${p.phase}°)`;

    } else {

        $("equation").textContent =
            `${names[p.type]}: ` +
            `A = ${p.amplitude} V, ` +
            `f = ${p.frequency} Hz, ` +
            `φ = ${p.phase}°`;

    }


    /* REDRAW */

    drawWaveform();


    /* JAVA BACKEND */

    requestJavaMeasurements(p);

}


/* ========================================
   JAVA BACKEND CONNECTION
   ======================================== */

async function requestJavaMeasurements(p) {

    /*
     * The Java server is expected to run on
     * http://localhost:8080.
     *
     * When using Live Server on port 5500,
     * calculations are performed locally.
     */

    if (
        location.port !== "8080" &&
        location.port !== ""
    ) {

        return;

    }


    const requestId = ++apiRequestId;

    const query = new URLSearchParams({

        waveform: p.type,

        frequency: String(p.frequency),

        amplitude: String(p.amplitude)

    });


    try {

        const response = await fetch(
            "/api/measure?" + query.toString()
        );


        if (!response.ok) {

            return;

        }


        const result = await response.json();


        /* Ignore outdated responses */

        if (requestId !== apiRequestId) {

            return;

        }


        if (result.error) {

            return;

        }


        updateMeasurements(p, result);


    } catch (error) {

        /*
         * Local calculations still work if the
         * backend is unavailable.
         */

        console.warn(
            "Java backend unavailable; using local calculations."
        );

    }

}


/* ========================================
   PLAY / PAUSE
   ======================================== */

function updateRunningStatus() {

    const dot =
        document.querySelector(".header-right .status-dot");

    if (running) {

        $("runButton").textContent =
            "Ⅱ Pause Signal";

        $("systemStatus").textContent =
            "SYSTEM ONLINE";

        $("scopeStatus").textContent =
            "LIVE OUTPUT";

        $("controlStatus").textContent =
            "Signal running";


        if (dot) {

            dot.classList.remove("paused");

        }

    } else {

        $("runButton").textContent =
            "▶ Resume Signal";

        $("systemStatus").textContent =
            "SIGNAL PAUSED";

        $("scopeStatus").textContent =
            "PAUSED";

        $("controlStatus").textContent =
            "Signal paused";


        if (dot) {

            dot.classList.add("paused");

        }

    }

}


$("runButton").addEventListener("click", () => {

    running = !running;

    updateRunningStatus();

});


/* ========================================
   RESET
   ======================================== */

$("resetButton").addEventListener("click", () => {

    $("waveType").value =
        defaults.type;

    $("frequency").value =
        defaults.frequency;

    $("amplitude").value =
        defaults.amplitude;

    $("phase").value =
        defaults.phase;

    $("cycles").value =
        defaults.cycles;


    elapsed = 0;

    running = true;


    updateRunningStatus();

    updateDisplay();

});


/* ========================================
   INPUT EVENTS
   ======================================== */

[
    "waveType",
    "frequency",
    "amplitude",
    "phase",
    "cycles"

].forEach(id => {

    $(id).addEventListener(
        "input",
        updateDisplay
    );

});


/* ========================================
   ANIMATION LOOP
   ======================================== */

function animate(now) {

    const delta = Math.min(
        (now - previousTime) / 1000,
        0.05
    );

    previousTime = now;


    if (running) {

        elapsed += delta;

        drawWaveform();

    }


    animationFrame =
        requestAnimationFrame(animate);

}


/* ========================================
   RESIZE OBSERVER
   ======================================== */

if ("ResizeObserver" in window) {

    resizeObserver = new ResizeObserver(() => {

        resizeCanvas();

    });

    resizeObserver.observe(
        canvas.parentElement
    );

} else {

    window.addEventListener(
        "resize",
        resizeCanvas
    );

}


/* ========================================
   INITIALIZE
   ======================================== */

function initializeSignalLab() {

    updateRunningStatus();

    resizeCanvas();

    updateDisplay();

    previousTime = performance.now();

    animationFrame =
        requestAnimationFrame(animate);

}


initializeSignalLab();