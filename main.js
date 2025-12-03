/*  main.js  –  DSS Dashboard  –  ESP8266 + BMP280 + Firestore
 *  Three.js viewer  +  Firestore real-time listener
 * ------------------------------------------------------------- */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    onSnapshot,
    query,
    orderBy,
    limit
} from 'firebase/firestore';

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

/* --------------------------------------------------------------
 * 4. Dashboard updating
 * -------------------------------------------------------------- */
function updateDashboard(temp, humidity) {
    document.getElementById("temp-val").textContent = temp.toFixed(1);
    document.getElementById("hum-val").textContent = humidity.toFixed(1);
    document.getElementById("hi-val").textContent = computeHeatIndex(temp, humidity);
}

/* --------------------------------------------------------------
 * 5. Firestore real-time listener
 * -------------------------------------------------------------- */
function listenToData() {
    const q = query(
        collection(db, "sensorData"),
        orderBy("timestamp", "desc"),
        limit(1)
    );

    onSnapshot(q, snapshot => {
        if (snapshot.empty) {
            console.warn("Firestore: No documents found.");
            return;
        }

        const data = snapshot.docs[0].data();
        const temp = Number(data.temperature);
        const hum = Number(data.humidity);

        if (!isNaN(temp) && !isNaN(hum)) {
            updateDashboard(temp, hum);
        } else {
            console.warn("Firestore invalid data:", data);
        }
    }, err => console.error("Firestore listener error:", err));
}

/* --------------------------------------------------------------
 * 6. BOOT ALL SYSTEMS
 * -------------------------------------------------------------- */
window.onload = () => {
    initThreeJS();
    listenToData();
};
