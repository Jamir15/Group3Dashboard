/*  main.js  –  DSS Dashboard  –  ESP8266 + BMP280 + Firestore
 *  Three.js viewer  +  Firestore real-time listener
 * ------------------------------------------------------------- */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initializeApp } from 'firebase/app';
import {
    getFirestore,  //Ginawa kong ganito para madali mahanap tsaka readable
    collection,
    onSnapshot,
    query,
    orderBy,
    limit
} from 'firebase/firestore';
import { Chart, registerables } from "chart.js/auto";
Chart.register(...registerables);

/* --------------------------------------------------------------
 * 1. Firebase configuration
 * -------------------------------------------------------------- */
const firebaseConfig = {
    apiKey: "AIzaSyCq6MUL63iHYpOrGqoQrWCjDPWhOnNajmQ",
    authDomain: "dss-database-51609.firebaseapp.com",
    projectId: "dss-database-51609",
    storageBucket: "dss-database-51609.firebasestorage.app",
    messagingSenderId: "514112370816",
    appId: "1:514112370816:web:46c160c80475164b98ce65",
    measurementId: "G-707NP59NVW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* --------------------------------------------------------------
 * 2. Three.js viewer
 * -------------------------------------------------------------- */
function initThreeJS() {
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambient = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 2);
    dir.position.set(5, 5, 5);
    scene.add(dir);

    const loader = new GLTFLoader();
    loader.load(
        './classroom.glb',
        gltf => {
            document.getElementById('loading-overlay').style.display = 'none';
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            scene.add(model);
        },
        undefined,
        error => {
            console.error('GLB load error:', error);
            document.getElementById('loading-overlay').textContent = 'Error Loading Model';
        }
    );

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

/* --------------------------------------------------------------
 * 3. Heat Index helper
 * -------------------------------------------------------------- */
function computeHeatIndex(t, h) {
    return (t + h * 0.01).toFixed(2);
}

// Logic for Decsision Support System
function getHeatIndexAdvisory(hi) {
    if (hi >= 27 && hi <= 32) {
        return [
            "Possible: fatigue with prolonged exposure",
            "Low risk, but still uncomfortable"
        ];
    }
    if (hi >= 33 && hi <= 41) {
        return [
            "Higher chance of heat cramps",
            "Possible heat exhaustion",
            "Extra hydration and breaks needed",
            "Vulnerable groups (children, elderly) are more at risk"
        ];
    }
    if (hi >= 42 && hi <= 51) {
        return [
            "Likely: heat cramps and heat exhaustion",
            "Heat stroke becomes possible with prolonged exposure",
            "Outdoor activities become risky",
            "Reference point often used by Cabuyao for considering class suspension"
        ];
    }
    if (hi >= 52) {
        return [
            "Heat stroke highly likely",
            "Very unsafe for outdoor activities and prolonged exposure",
            "Immediate protective measures required"
        ];
    }

    return ["Heat index below threshold range."];
}

/* --------------------------------------------------------------
 4. Notification Banner for Extreme Heat Index
-------------------------------------------------------------- */
function showAlertBanner(message) {
    const banner = document.getElementById("alert-banner");
    const msg = document.getElementById("alert-message");

    msg.textContent = message;

    banner.classList.remove("hidden");
    banner.classList.add("show");

    // Hide automatically after 5 seconds
    setTimeout(() => {
        banner.classList.remove("show");
        banner.classList.add("hidden");
    }, 5000);
}

// Shift + N
//Manual control for testing notification banner
document.addEventListener("keydown", e => {
    if (e.shiftKey && e.key === "N") {                                    //Press "shift + N" to trigger alert banner
        showAlertBanner("⚠️WARNING: Heat index is greater than 41°C⚠️"); //This will be used for demonstration purposes
    }
});

/* --------------------------------------------------------------
 5. Noticication Banner for Peak Heat Hours
-------------------------------------------------------------- */
function showPeakBanner() {
    const banner = document.getElementById('peak-heat-banner');
    banner.classList.remove('hidden');
    banner.classList.add('show');

    // Hide automatically after 5 seconds
    setTimeout(() => {
        banner.classList.remove('show');
        banner.classList.add('hidden');
    }, 5000);
}

//logic to show the peak heat hours banner
function checkPeakHeatHours() {
    const now = new Date();
    const hour = now.getHours();          // 0-23
    if (hour >= 11 && hour < 16) {        // 11 AM – 4 PM
        showPeakBanner();                 // orange
        return true;
    }
    return false;
}

//Shift + P
//Manual control for testing peak heat hours banner
document.addEventListener("keydown", e => {  
    if (e.shiftKey && e.key === "P") {                       // Press "SHIFT + P" to trigger peak heat hours banner
        showPeakBanner("🌤️ Peak Heat Hours Reminder");     //This will be used for demonstration purposes
    }
});

/* --------------------------------------------------------------
 6. Dashboard updating
-------------------------------------------------------------- */
// Function to display heat index label
function getHeatIndexLabel(hi) {
    if (hi >= 27 && hi <= 32) return "CAUTION";
    if (hi >= 33 && hi <= 41) return "EXTREME CAUTION";
    if (hi >= 42 && hi <= 51) return "DANGER";
    if (hi >= 52) return "EXTREME DANGER";
    return "Normal";
}

// Update dashboard values
function updateDashboard(temp, humidity) {
    const hi = parseFloat(computeHeatIndex(temp, humidity));

    document.getElementById("temp-val").textContent = temp.toFixed(1);
    document.getElementById("hum-val").textContent = humidity.toFixed(1);
    document.getElementById("hi-val").textContent = hi.toFixed(1);

    // Show alert banner if Heat Index exceeds 41°C
    if (hi > 41) {
        showAlertBanner("⚠️WARNING: Heat index is greater than 41°C⚠️");
    }

    // Display Heat Index Label with color and emphasis
    const label = getHeatIndexLabel(hi); // Get label first

    // Determine color per threshold
    let color = "black"; // default
    switch (label) {
        case "CAUTION": color = "green"; break;
        case "EXTREME CAUTION": color = "yellow"; break;
        case "DANGER": color = "orange"; break;
        case "EXTREME DANGER": color = "red"; break;
}

// Update DSS title with styled label
document.getElementById("dss-title").innerHTML = 
    `Heat Index Advisory (Decision Support System): <span style="color:${color}; font-size:1.5em; font-weight:bold;">${label}</span>`;

// Use Logic for Decision Support System
const advisory = getHeatIndexAdvisory(hi);
const dssBox = document.getElementById("dss-content");
dssBox.innerHTML = advisory.map(item => `<p>• ${item}</p>`).join("");
}

/* --------------------------------------------------------------
 * 7. Sparkline Charts Setup
 * -------------------------------------------------------------- */
let sensorChart = null;
let chartData = {
    labels: [],
    temp: [],
    hum: [],
    hi: []
};
// Initialize the bar-chart
function initSparkline() {
    const ctx = document.getElementById('sensorChart').getContext('2d');

    sensorChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: chartData.temp,
                    backgroundColor: 'rgba(255, 0, 0, 0.8)',
                    borderWidth: 0
                },
                {
                    label: 'Humidity (hPa)',
                    data: chartData.hum,
                    backgroundColor: 'rgba(0, 0, 255, 0.8)',
                    borderWidth: 0
                },
                {
                    label: 'Heat Index (°C)',
                    data: chartData.hi,
                    backgroundColor: 'rgba(255, 165, 0, 0.8)',
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: true, position: 'top' } 
            },
            scales: {
                x: { stacked: false },
                y: { beginAtZero: true }
            }
        }
    });
}

// Update sparkline with new data
function updateSparkline(temp, hum, hi) {
    const ts = new Date().toLocaleTimeString();

    chartData.labels.push(ts);
    chartData.temp.push(temp);
    chartData.hum.push(hum);
    chartData.hi.push(hi);

    // Keep only last 20 points
    if (chartData.labels.length > 20) {
        chartData.labels.shift();
        chartData.temp.shift();
        chartData.hum.shift();
        chartData.hi.shift();
    }

    if (sensorChart) sensorChart.update();
}

/* --------------------------------------------------------------
 * 8. Firestore real-time listener
 * -------------------------------------------------------------- */
function listenToData() {
    const q = query(
        collection(db, "sensorData"),
        orderBy("timestamp", "desc"),
        limit(1)
    );

    // Snapshot should exist inside this callback
    onSnapshot(
        q,
        (snapshot) => {
            console.log("Firestore listener triggered. Doc count =", snapshot.size);

            if (snapshot.empty) {
                console.warn("Firestore: No documents found.");
                return;
            }

            const data = snapshot.docs[0].data();
            const temp = Number(data.temperature);
            const hum = Number(data.humidity);

            console.log("Received Firestore data:", data);

            if (!isNaN(temp) && !isNaN(hum)) {
                updateDashboard(temp, hum);                                          // Update dashboard values
                updateSparkline(temp, hum, parseFloat(computeHeatIndex(temp, hum))); // Update sparkline chart
            } else {
                console.warn("Firestore invalid numeric data:", data);
            }
        },
        (err) => console.error("Firestore listener error:", err)
    );
}

/* --------------------------------------------------------------
 * 8. BOOT ALL SYSTEMS
 * -------------------------------------------------------------- */
window.onload = () => {

    //Check for Peak Heat Hours on load
    checkPeakHeatHours();

    //Check every minute if it is still Peak Heat Hours
    // setInterval(checkPeakHeatHours, 60000); // 60000 ms = 1 minute

    //Initialize Three.js viewer
    initThreeJS();

    //Initialize Sparkline Chart
    initSparkline();

    //Start listening to Firestore data
    listenToData();
};
