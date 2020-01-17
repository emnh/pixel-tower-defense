const THREE = require('three');

// Set the scene size.
const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

// Set some camera attributes.
const VIEW_ANGLE = 45;
const ASPECT = WIDTH / HEIGHT;
const NEAR = 0.1;
const FAR = 10000;

// Get the DOM element to attach to
const container = document.body;

// Create a WebGL renderer, camera
// and a scene
const renderer = new THREE.WebGLRenderer();
const camera =
    new THREE.PerspectiveCamera(
        VIEW_ANGLE,
        ASPECT,
        NEAR,
        FAR
    );

const scene = new THREE.Scene();

// Add the camera to the scene.
scene.add(camera);

// Start the renderer.
renderer.setSize(WIDTH, HEIGHT);

// Attach the renderer-supplied
// DOM element.
container.appendChild(renderer.domElement);


// create the plane's material
const planeMaterial =
  new THREE.MeshLambertMaterial(
    {
      color: 0xCC0000
    });


// Set up the plane vars
const SIZE = 100;
const XSEGMENTS = 16;
const YSEGMENTS = 16;

// Create a new mesh with
// plane geometry - we will cover
// the planeMaterial next!
const plane = new THREE.Mesh(

  new THREE.PlaneBufferGeometry(
    SIZE,
    SIZE,
    XSEGMENTS,
    YSEGMENTS),

  planeMaterial);

plane.rotation.x = -Math.PI / 2.0;
plane.rotation.z = -Math.PI / 2.0;

// Finally, add the plane to the scene.
scene.add(plane);

camera.position.set(-100, 100, -100);
camera.lookAt(plane.position);

const ambient = new THREE.AmbientLight(0xFFFFFF);
scene.add(ambient);

// create a point light
const pointLight =
  new THREE.PointLight(0xFFFFFF);

// set its position
pointLight.position.x = 0;
pointLight.position.y = 0;
pointLight.position.z = 0;

// add to the scene
scene.add(pointLight);

// Draw!
renderer.render(scene, camera);


function update () {
  // Draw!
  renderer.render(scene, camera);

  // Schedule the next frame.
  requestAnimationFrame(update);
}

// Schedule the first frame.
requestAnimationFrame(update);
