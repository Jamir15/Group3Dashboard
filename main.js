import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ---------------------------------------
   Scene + Renderer
--------------------------------------- */
const container = document.getElementById("canvas-container");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#f5f7fa");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

container.appendChild(renderer.domElement);

/* ---------------------------------------
   Camera + Controls
--------------------------------------- */
const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  200
);
camera.position.set(5, 6, 12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
controls.update();

/* ---------------------------------------
   Lighting (better than your original)
--------------------------------------- */
scene.add(new THREE.AmbientLight(0xffffff, 1));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(10, 15, 10);
sun.castShadow = true;
scene.add(sun);

/* ---------------------------------------
   Load GLB (same folder)
--------------------------------------- */
let mainModel = null;

const loader = new GLTFLoader();
// Load a GLB model from the same folder.
// Callbacks:
//  - onLoad(gltf): receives the parsed GLTF and adds the scene to our scene.
//    It also marks all meshes to cast/receive shadows and recenters the camera.
//  - onProgress(progress): logs percent loaded (useful for large files).
//  - onError(err): logs the error and updates UI status.
loader.load(
  "classroom.glb",
  (gltf) => {
    mainModel = gltf.scene;

    mainModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(mainModel);
    fitCamera(mainModel);
    // listMaterials(mainModel);

    document.getElementById("load-status").textContent = "Loaded ✓";
  },

  (progress) => {
    // onProgress: called periodically during download/parse.
    const percent = ((progress.loaded / progress.total) * 100).toFixed(1);
    console.log(`Loading: ${percent}%`);
  },

  (err) => {
    // onError: called if loading or parsing fails.
    console.error("Model load error:", err);
    document.getElementById("load-status").textContent = "Error ✗";
  }
);

/* ---------------------------------------
   Camera framing function
--------------------------------------- */
/* ---------------------------------------
   Camera framing function
   - Computes a bounding box for `object` and repositions the camera so the
     object fits comfortably within the view. Also updates `controls.target`.
   - Parameters:
     - object: a THREE.Object3D (or group) whose bounding box will determine
       camera distance and framing.
*/
function fitCamera(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = (camera.fov * Math.PI) / 180;

  const camZ = (maxDim / 2) / Math.tan(fov / 2);
  camera.position.set(center.x, center.y + size.y / 3, center.z + camZ * 1.3);
  controls.target.copy(center);
  controls.update();
}

// /* ---------------------------------------
//    Material listing (printed to UI)
//    - (commented out) Traverses a model and builds a newline-separated list of
//      material names to display in the `#materials` UI element.
// */
// function listMaterials(root) {
//   let list = "";
//   root.traverse((o) => {
//     if (o.isMesh && o.material) {
//       list += `- ${o.material.name}\n`;
//     }
//   });
//   document.getElementById("materials").textContent = list || "No materials found.";
// }

/* ---------------------------------------
   Responsive
   - Resize handler keeps the camera aspect and renderer size in sync with
     `#canvas-container` dimensions when the window changes size.
*/
window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

/* ---------------------------------------
   Animation loop
   - `animate` is the per-frame render loop. It schedules itself with
   `requestAnimationFrame`, updates controls (for damping/smoothing), and
   renders the scene from the camera's perspective.
*/
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
