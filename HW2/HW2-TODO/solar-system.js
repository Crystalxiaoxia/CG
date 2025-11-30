window.initThreeJS = function () {
  if (window.threeSceneActive) return;
  window.threeSceneActive = true;

  const three = {};
  const container = document.getElementById("container");
  const width = container.clientWidth;
  const height = container.clientHeight;

  // ======= 场景、相机、渲染器 =======
  three.scene = new THREE.Scene();
  three.fov = 75;
  three.isPerspective = true;
  three.orthoSize = 20;
  three.scaleFactor = 1.0;
  three.rotateX = 20;
  three.rotateY = 45;
  three.radius = 30;

  three.camera = new THREE.PerspectiveCamera(three.fov, width / height, 0.1, 1000);
  three.renderer = new THREE.WebGLRenderer({ antialias: true });
  three.renderer.setSize(width, height);
  three.renderer.setClearColor(0x000000);
  container.appendChild(three.renderer.domElement);

  // ======= 光照 =======
  three.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const pointLight = new THREE.PointLight(0xffffff, 1, 100);
  pointLight.position.set(0, 0, 0);
  three.scene.add(pointLight);

  // ======= OrbitControls 鼠标控制 =======
  three.controls = new THREE.OrbitControls(three.camera, three.renderer.domElement);
  three.controls.enableDamping = true;
  three.controls.dampingFactor = 0.05;
  three.controls.enableZoom = true;
  three.controls.enablePan = false;
  three.controls.enableRotate = true;
  three.controls.enableKeys = false;
  three.controls.target.set(0, 0, 0);

  // ======= 模型加载 =======
  const loader = new THREE.TextureLoader();
  const sunTex = loader.load("sun.jpg");
  const earthTex = loader.load("earth.jpg");
  const moonTex = loader.load("moon.jpg");

  const sunMat = new THREE.MeshBasicMaterial({ map: sunTex });
  const earthMat = new THREE.MeshPhongMaterial({ map: earthTex });
  const moonMat = new THREE.MeshPhongMaterial({ map: moonTex });

  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 64), sunMat);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMat);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 64), moonMat);

  three.scene.add(sun);
  three.scene.add(earth);
  three.scene.add(moon);

  three.clock = new THREE.Clock();

  // ======= 更新相机位置 =======
  function updateCameraPosition() {
    const radX = THREE.MathUtils.degToRad(three.rotateX);
    const radY = THREE.MathUtils.degToRad(three.rotateY);
    const r = three.radius;

    const x = r * Math.sin(radY) * Math.cos(radX);
    const y = r * Math.sin(radX);
    const z = r * Math.cos(radY) * Math.cos(radX);

    three.camera.position.set(x, y, z);
    three.camera.lookAt(0, 0, 0);
  }

  updateCameraPosition();

  // ======= 鼠标拖动控制 =======
  let isDragging = false;
  let lastX = 0, lastY = 0;
  const sensitivity = 0.5;

  container.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  container.addEventListener("mouseup", () => (isDragging = false));
  container.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    three.rotateY += dx * sensitivity * 0.5;
    three.rotateX += dy * sensitivity * 0.5;
  });

  // ======= 键盘控制 =======
  window.addEventListener("keydown", (e) => {
    const gl = three.renderer.getContext();
    switch (e.key.toLowerCase()) {
      case "w": three.rotateX -= 5; break;
      case "s": three.rotateX += 5; break;
      case "a": three.rotateY -= 5; break;
      case "d": three.rotateY += 5; break;

      case "z": three.scaleFactor *= 1.1; break;
      case "c": three.scaleFactor *= 0.9; break;

      case "p":
        three.isPerspective = !three.isPerspective;
        switchCamera();
        break;

      case "m":
        if (three.isPerspective) {
          three.fov = Math.min(three.fov + 5, 170);
          switchCamera();
        }
        break;
      case "n":
        if (three.isPerspective) {
          three.fov = Math.max(three.fov - 5, 10);
          switchCamera();
        }
        break;

      case "r":
        [sunMat, earthMat, moonMat].forEach(m => (m.side = THREE.FrontSide));
        alert("开启后向面剔除");
        break;
      case "t":
        [sunMat, earthMat, moonMat].forEach(m => (m.side = THREE.DoubleSide));
        alert("关闭后向面剔除");
        break;
      case "b":
        gl.enable(gl.DEPTH_TEST);
        alert("开启深度缓存消隐");
        break;
      case "v":
        gl.disable(gl.DEPTH_TEST);
        alert("关闭深度缓存消隐");
        break;

      // ✅ 空格复位
      case " ":
        resetView();
        break;
    }
  });

  // ======= 复位函数 =======
  function resetView() {
    three.fov = 75;
    three.isPerspective = true;
    three.scaleFactor = 1.0;
    three.rotateX = 20;
    three.rotateY = 45;
    three.radius = 30;
    switchCamera();
    alert("已复位到初始视角");
  }

  // ======= 切换透视/正交投影 =======
  function switchCamera() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;

    if (three.isPerspective) {
      three.camera = new THREE.PerspectiveCamera(three.fov, aspect, 0.1, 1000);
    } else {
      const s = three.orthoSize;
      three.camera = new THREE.OrthographicCamera(-s * aspect, s * aspect, s, -s, 0.1, 1000);
    }

    updateCameraPosition();
    three.controls = new THREE.OrbitControls(three.camera, three.renderer.domElement);
    three.controls.enableDamping = true;
  }

  // ======= 动画 =======
  function animate() {
    requestAnimationFrame(animate);
    const time = three.clock.getElapsedTime();

    sun.rotation.y = time * 0.1;
    earth.rotation.y = time * 0.5;
    earth.position.x = Math.cos(time * 0.2) * 10;
    earth.position.z = Math.sin(time * 0.2) * 10;

    moon.rotation.y = time * 0.5;
    moon.position.x = earth.position.x + Math.cos(time * 0.5) * 2;
    moon.position.z = earth.position.z + Math.sin(time * 0.5) * 2;

    updateCameraPosition();
    three.scene.scale.set(three.scaleFactor, three.scaleFactor, three.scaleFactor);

    three.controls.update();
    three.renderer.render(three.scene, three.camera);
  }

  animate();
};






