import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as CANNON from 'cannon-es';


// Inicialização principal
export function init() {

    const collisionSound = new Audio('assets/colisao.mp3');
    collisionSound.volume = 0.7;
    collisionSound.load();
    function playSound(sound) {
        const playPromise = sound.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Reprodução de áudio foi prevenida pelo navegador:", error);
            });
        }
    }

    // Configuração básica
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 12, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const skyShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            cirrus: { value: 0.6 },
            cumulus: { value: 1.0 },
            sunPosition: { value: new THREE.Vector3(-0.5, 0.15, -1) },
            rainbowTime: { value: -1.0 },
            rainbowDuration: { value: 3.0 }
        },

        vertexShader: `
    uniform vec3 sunPosition;
    varying vec3 vPosition;
    varying vec3 vSunPosition;

    void main() {
      vPosition = position;
      vSunPosition = sunPosition;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

        fragmentShader: `
    precision highp float;

uniform float time;
uniform float cirrus;
uniform float cumulus;
uniform vec3 sunPosition;
uniform float rainbowTime;
uniform float rainbowDuration;

varying vec3 vPosition;
varying vec3 vSunPosition;

const float Br = 0.0025;
const float Bm = 0.0003;
const float g = 0.9800;
const vec3 nitrogen = vec3(0.650, 0.570, 0.475);
const vec3 Kr = Br / pow(nitrogen, vec3(4.0));
const vec3 Km = Bm / pow(nitrogen, vec3(0.84));

    // Perlin noise helpers
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

    // Perlin 3D noise
    float cnoise(vec3 P) {
      vec3 Pi0 = floor(P);
      vec3 Pi1 = Pi0 + vec3(1.0);
      Pi0 = mod289(Pi0);
      Pi1 = mod289(Pi1);
      vec3 Pf0 = fract(P);
      vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.y, Pi0.y, Pi1.y, Pi1.y);
      vec4 iz0 = vec4(Pi0.z);
      vec4 iz1 = vec4(Pi1.z);

      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);

      vec4 gx0 = fract(ixy0 * (1.0 / 41.0)) * 2.0 - 1.0;
      vec4 gy0 = abs(gx0) - 0.5;
      vec4 tx0 = floor(gx0 + 0.5);
      gx0 -= tx0;

      vec4 gx1 = fract(ixy1 * (1.0 / 41.0)) * 2.0 - 1.0;
      vec4 gy1 = abs(gx1) - 0.5;
      vec4 tx1 = floor(gx1 + 0.5);
      gx1 -= tx1;

      vec3 g000 = vec3(gx0.x, gy0.x, 1.0 - abs(gx0.x) - abs(gy0.x));
      vec3 g100 = vec3(gx0.y, gy0.y, 1.0 - abs(gx0.y) - abs(gy0.y));
      vec3 g010 = vec3(gx0.z, gy0.z, 1.0 - abs(gx0.z) - abs(gy0.z));
      vec3 g110 = vec3(gx0.w, gy0.w, 1.0 - abs(gx0.w) - abs(gy0.w));
      vec3 g001 = vec3(gx1.x, gy1.x, 1.0 - abs(gx1.x) - abs(gy1.x));
      vec3 g101 = vec3(gx1.y, gy1.y, 1.0 - abs(gx1.y) - abs(gy1.y));
      vec3 g011 = vec3(gx1.z, gy1.z, 1.0 - abs(gx1.z) - abs(gy1.z));
      vec3 g111 = vec3(gx1.w, gy1.w, 1.0 - abs(gx1.w) - abs(gy1.w));

      vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
      g000 *= norm0.x;
      g010 *= norm0.y;
      g100 *= norm0.z;
      g110 *= norm0.w;

      vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
      g001 *= norm1.x;
      g011 *= norm1.y;
      g101 *= norm1.z;
      g111 *= norm1.w;

      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);

      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
      return 2.2 * n_xyz;
    }

    const mat3 m = mat3(0.0, 1.60,  1.20, 
                   -1.6, 0.72, -0.96, 
                   -1.2, -0.96, 1.28);

float fbm(vec3 p) {
    float f = 0.0;
    f += cnoise(p) / 2.0; p = m * p * 1.1;
    f += cnoise(p) / 4.0; p = m * p * 1.2;
    f += cnoise(p) / 6.0; p = m * p * 1.3;
    f += cnoise(p) / 12.0; p = m * p * 1.4;
    f += cnoise(p) / 24.0;
    return f;
}

vec3 calculateRainbow(vec3 pos, float progress) {
    float x = pos.x;
    float z = pos.z;
    float y = pos.y;

    vec3 sunDir = normalize(vSunPosition);
    vec3 center = vec3(-sunDir.x * 0.5, -0.1, -sunDir.z * 0.5);
    float rainbowRadius = 0.7;
    float rainbowWidth = 0.07;

    float distToCenter = length(pos - center);
    float angle = acos(dot(normalize(pos - center), vec3(0.0, 1.0, 0.0)));
    float normAngle = angle / 3.14159265;

    vec3 color = vec3(0.0);

    if (normAngle < 0.5 && distToCenter > (rainbowRadius - rainbowWidth) && distToCenter < (rainbowRadius + rainbowWidth) && y > center.y) {
        float relativeWidth = (distToCenter - (rainbowRadius - rainbowWidth)) / (rainbowWidth * 2.0);
        relativeWidth = 1.0 - relativeWidth;
        float bandPosition = clamp(relativeWidth, 0.0, 1.0) * 7.0;
        int band = int(bandPosition);

        if (band == 0) color = vec3(1.0, 0.0, 0.0);
        else if (band == 1) color = vec3(1.0, 0.5, 0.0);
        else if (band == 2) color = vec3(1.0, 1.0, 0.0);
        else if (band == 3) color = vec3(0.0, 1.0, 0.0);
        else if (band == 4) color = vec3(0.0, 0.0, 1.0);
        else if (band == 5) color = vec3(0.3, 0.0, 0.5);
        else color = vec3(0.5, 0.0, 1.0);

        float bandFrac = fract(bandPosition);
        if (bandFrac < 0.05 || bandFrac > 0.95) color *= 0.8;

        float edgeDistance = abs((distToCenter - rainbowRadius) / rainbowWidth);
        float edgeFactor = 1.0 - pow(edgeDistance, 0.8);
        float heightFactor = pow(1.0 - normAngle / 0.5, 0.3);

        return color * edgeFactor * heightFactor * progress * 1.5;
    }

    return vec3(0.0);
}
    
    
    void main() {
    vec3 pos = normalize(vPosition);
    float absY = abs(pos.y);
    float safeY = max(absY, 0.01); // evitar divisões perigosas

    vec3 posForNoise = pos;
    if (pos.y < 0.0) posForNoise.y = -pos.y;

    float mu = dot(pos, normalize(vSunPosition));
    float rayleigh = 3.0 / (8.0 * 3.14159265) * (1.0 + mu * mu);
    vec3 mie = (Kr + Km * (1.0 - g * g) / (2.0 + g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5)) / (Br + Bm);

    vec3 day_extinction = exp(-exp(-((safeY + vSunPosition.y * 4.0) * (exp(-safeY * 16.0) + 0.1) / 80.0 / Br) *
                       (exp(-safeY * 16.0) + 0.1) * Kr / Br) * 
                       exp(-safeY * exp(-safeY * 8.0) * 4.0) * 
                       exp(-safeY * 2.0) * 4.0);

    vec3 night_extinction = vec3(1.0 - exp(vSunPosition.y)) * 0.2;
    vec3 extinction = mix(day_extinction, night_extinction, -vSunPosition.y * 0.2 + 0.5);
    vec3 color = rayleigh * mie * extinction;

    float cirrusDensity = smoothstep(1.0 - cirrus, 1.0, fbm(posForNoise.xyz / safeY * 2.0 + time * 0.05)) * 0.3;
    color = mix(color, extinction * 4.0, cirrusDensity * safeY);

    for (int i = 0; i < 3; i++) {
        float d = smoothstep(1.0 - cumulus, 1.0, fbm((0.7 + float(i) * 0.01) * posForNoise.xyz / safeY + time * 0.3));
        color = mix(color, extinction * d * 5.0, min(d, 1.0) * safeY);
    }

    color += cnoise(pos * 1000.0) * 0.01;

    if (pos.y < 0.0) color *= 0.7 + 0.3 * (pos.y + 1.0);

    if (rainbowTime >= 0.0) {
        float fadeIn = smoothstep(0.0, 0.5, rainbowTime);
        float fadeOut = smoothstep(rainbowDuration - 0.5, rainbowDuration, rainbowTime);
        float rainbowProgress = fadeIn * (1.0 - fadeOut);

        vec3 sunDir = normalize(vSunPosition);
        vec3 rotatedPos = normalize(vPosition);

        if (dot(sunDir, vec3(0.0, 1.0, 0.0)) > 0.0) {
            rotatedPos.z = -rotatedPos.z;
        }

        vec3 rainbowColor = calculateRainbow(rotatedPos, rainbowProgress);
        color += rainbowColor;
    }

    gl_FragColor = vec4(color, 1.0);
}
  `,

        side: THREE.BackSide
    });

    const backgroundGeometry = new THREE.SphereGeometry(500, 60, 60);
    const backgroundMesh = new THREE.Mesh(backgroundGeometry, skyShaderMaterial);
    backgroundMesh.position.set(0, -200, 0);
    scene.add(backgroundMesh);

    let startTime = Date.now();
    const cycleDuration = 30000;
    let lastRainbowTime = 0;
    const rainbowInterval = 30;

    // Controles de órbita
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, -2);
    controls.enablePan = false;
    controls.update();


    // Luzes
    const spotLight1 = new THREE.SpotLight(0xffffff, 100);
    spotLight1.position.set(5, 8, 8);
    spotLight1.angle = Math.PI / 4;
    spotLight1.penumbra = 0.5;
    spotLight1.castShadow = true;
    scene.add(spotLight1);

    const spotLight2 = new THREE.SpotLight(0xffffff, 100);
    spotLight2.position.set(-5, 8, 8);
    spotLight2.angle = Math.PI / 4;
    spotLight2.penumbra = 0.5;
    spotLight2.castShadow = true;
    scene.add(spotLight2);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(0, 50, -50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    function updateSunPosition() {
        const elapsed = (Date.now() - startTime) % cycleDuration;
        const progress = elapsed / cycleDuration;

        const sunHeight = Math.sin(progress * Math.PI * 2) * 0.5;
        skyShaderMaterial.uniforms.sunPosition.value.y = sunHeight;
        skyShaderMaterial.uniforms.sunPosition.value.x = Math.cos(progress * Math.PI * 2) * 1.0;
    }


    // Física
    const world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -12, 7.5)
    });

    // Materiais
    const objectMaterial = new CANNON.Material('object');
    const slipperyMaterial = new CANNON.Material('slippery');

    // Contato entre materiais
    const slipperyContactMaterial = new CANNON.ContactMaterial(objectMaterial, slipperyMaterial, {
        friction: 0,
        restitution: 0.5,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 1
    });
    world.addContactMaterial(slipperyContactMaterial);

    // Plano base
    const planeGeometry = new THREE.PlaneGeometry(25, 25);
    const planeMaterial = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0 });
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.receiveShadow = true;
    planeMesh.rotation.x = -Math.PI / 2;
    planeMesh.position.y = 0;
    scene.add(planeMesh);

    const planeShape = new CANNON.Plane();
    const planeBody = new CANNON.Body({
        mass: 0,
        material: objectMaterial,
        shape: planeShape
    });
    planeBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    planeBody.position.y = 0;
    world.addBody(planeBody);

    // Plano trasparente
    const transparentPlaneGeometry = new THREE.PlaneGeometry(25, 25);
    const transparentPlaneMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
    });
    const transparentPlaneMesh = new THREE.Mesh(transparentPlaneGeometry, transparentPlaneMaterial);
    transparentPlaneMesh.rotation.x = Math.PI / 2;
    transparentPlaneMesh.position.y = 1.5;
    scene.add(transparentPlaneMesh);

    const transparentPlaneShape = new CANNON.Plane();
    const transparentPlaneBody = new CANNON.Body({
        mass: 0,
        material: objectMaterial,
        shape: transparentPlaneShape
    });

    transparentPlaneBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    transparentPlaneBody.position.set(0, 1, 0);
    world.addBody(transparentPlaneBody);    // Estado do teclado
    const keys = {};
    let gamePaused = false;

    document.addEventListener('keydown', event => {
        keys[event.code] = true;

        if (event.code === 'KeyB') {
            if (gameActive && !shopActive && !gamePaused && lives < shopPoints.maxLives && score >= shopPoints.oneLife) {
                createShopMenu();
            }
        }

        // Adiciona funcionalidade para pausar com ESC
        if (event.code === 'Escape') {
            if (gameActive && !shopActive) {
                if (!gamePaused) {
                    pauseGame();
                } else {
                    resumeGame();
                }
            }
        }
    });

    document.addEventListener('keyup', event => {
        keys[event.code] = false;
    });

    // Função para pausar o jogo
    function pauseGame() {
        gamePaused = true;
        gameActive = false;

        // Criar menu de pausa
        const pauseMenu = document.createElement('div');
        pauseMenu.id = 'pause-menu';
        pauseMenu.innerHTML = `
            <h2>PAUSED</h2>
            <button id="resume-button" class="pause-button">Resume Game</button>
            <button id="menu-button" class="pause-button back-to-menu">Back to Menu</button>
        `;
        document.body.appendChild(pauseMenu);

        // Adicionar eventos aos botões
        document.getElementById('resume-button').addEventListener('click', resumeGame);
        document.getElementById('menu-button').addEventListener('click', backToMenu);
    }

    // Função para retomar o jogo
    function resumeGame() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            document.body.removeChild(pauseMenu);
        }

        gamePaused = false;
        gameActive = true;
        requestAnimationFrame(animate);
    }

    // Função para voltar ao menu de seleção de tabuleiros
    function backToMenu() {
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            document.body.removeChild(pauseMenu);
        }

        // Limpar elementos do jogo
        const gameElements = document.querySelectorAll('#score-display, #lives-display, #instructions');
        gameElements.forEach(el => {
            if (el) el.remove();
        });

        // Mostrar menu de seleção de tabuleiros
        document.getElementById('board-selection').style.display = 'flex';

        // Remover o canvas atual
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.remove();
        }
    }

    // Função auxiliar para criar paredes
    function createWall(width, height, depth, position, rotation = { x: 0, y: 0, z: 0 }) {
        // Visual
        const wallGeometry = new THREE.BoxGeometry(width, height, depth);
        const wallMaterial = new THREE.MeshNormalMaterial();
        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
        wallMesh.position.copy(position);
        wallMesh.rotation.set(rotation.x, rotation.y, rotation.z);
        wallMesh.castShadow = true;
        scene.add(wallMesh);

        // Física
        const wallShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const wallBody = new CANNON.Body({
            mass: 0,
            material: objectMaterial,
            shape: wallShape
        });
        wallBody.position.copy(position);
        wallBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
        world.addBody(wallBody);

        return { mesh: wallMesh, body: wallBody };
    }

    // Criar paredes
    createWall(0.5, 1, 17, new THREE.Vector3(-6, 0.5, -2), { x: 0, y: 0, z: 0 });
    createWall(0.5, 1, 17, new THREE.Vector3(6, 0.5, -2), { x: 0, y: 0, z: 0 });
    createWall(0.25, 1, 15, new THREE.Vector3(4.5, 0.5, -1), { x: 0, y: 0, z: 0 });
    createWall(0.25, 1, 2, new THREE.Vector3(-4.5, 0.5, 2), { x: 0, y: 0, z: 0 });
    createWall(0.25, 1, 2, new THREE.Vector3(3, 0.5, 2), { x: 0, y: 0, z: 0 });
    createWall(0.25, 1, 2, new THREE.Vector3(-4.1, 0.5, 3.9), { x: 0, y: Math.PI / 8, z: 0 });
    createWall(0.25, 1, 2, new THREE.Vector3(2.6, 0.5, 3.9), { x: 0, y: -Math.PI / 8, z: 0 });

    // Criar parede redonda
    function createCurvedWall(start, end, radius, height, segments) {
        // Visual
        const curve = new THREE.QuadraticBezierCurve3(
            start,
            new THREE.Vector3(0, start.y, start.z - radius),
            end
        );

        const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.5, 32, false);
        const tubeMaterial = new THREE.MeshNormalMaterial({ color: 0x0088ff });
        const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
        tubeMesh.castShadow = true;
        scene.add(tubeMesh);

        // Física
        const physicsSeg = segments * 2;
        const segmentBodies = [];

        for (let i = 0; i < physicsSeg; i++) {
            const t1 = i / physicsSeg;
            const t2 = (i + 1) / physicsSeg;

            const point1 = curve.getPoint(t1);
            const point2 = curve.getPoint(t2);

            const midPoint = point1.clone().lerp(point2, 0.5);
            const direction = new THREE.Vector3().subVectors(point2, point1).normalize();
            const segmentLength = point1.distanceTo(point2);
            const segmentShape = new CANNON.Box(new CANNON.Vec3(
                segmentLength / 2,
                height / 2,
                0.1
            ));

            const segmentBody = new CANNON.Body({
                mass: 0,
                material: objectMaterial,
                shape: segmentShape
            });

            segmentBody.position.set(midPoint.x, midPoint.y + height / 2, midPoint.z);
            const angle = Math.atan2(direction.z, direction.x);
            segmentBody.quaternion.setFromEuler(0, angle, 0);

            world.addBody(segmentBody);
            segmentBodies.push(segmentBody);
        }

        return { mesh: tubeMesh, bodies: segmentBodies };
    }

    const guideCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-6, 0.5, -10.5),
        new THREE.Vector3(0, 0.5, -5),
        new THREE.Vector3(6, 0.5, -10.5)
    );

    const guideWall = createCurvedWall(
        new THREE.Vector3(-6, 0.5, -10.5),
        new THREE.Vector3(6, 0.5, -10.5),
        4.5, 1, 30
    );

    // Criar bumpers
    function createBumper(position) {
        // Visual
        const bumperGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.55);
        const bumperMaterial = new THREE.MeshNormalMaterial();
        const bumperMesh = new THREE.Mesh(bumperGeometry, bumperMaterial);
        bumperMesh.position.copy(position);
        bumperMesh.castShadow = true;
        scene.add(bumperMesh);

        // Física
        const bumperShape = new CANNON.Sphere(0.5);
        const bumperBody = new CANNON.Body({
            mass: 0,
            material: objectMaterial,
            shape: bumperShape
        });
        bumperBody.position.copy(position);
        bumperBody.userData = { isBumper: true };
        world.addBody(bumperBody);

        return { mesh: bumperMesh, body: bumperBody, scale: 1 };
    }

    const bumper1 = createBumper(new THREE.Vector3(-2.25, 0.5, -6));
    const bumper2 = createBumper(new THREE.Vector3(0.5, 0.5, -7.5));
    const bumper3 = createBumper(new THREE.Vector3(-0.75, 0.5, -4));

    // Criar plataforma circular
    function createCircularPlatform(position) {
        // Visual
        const platformGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32);
        const platformMaterial = new THREE.MeshNormalMaterial();
        const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
        platformMesh.position.copy(position);
        platformMesh.castShadow = true;
        scene.add(platformMesh);

        const particles = new THREE.BufferGeometry();
        const particleCount = 100;
        const posArray = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 2.5;
        }
        particles.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.07,
            transparent: true,
            opacity: 0.8
        });
        const particleSystem = new THREE.Points(particles, particleMaterial);
        particleSystem.position.copy(position);
        scene.add(particleSystem);

        // Física
        const platformShape = new CANNON.Cylinder(0.5, 0.5, 0.05, 32);
        const platformBody = new CANNON.Body({
            mass: 0,
            material: objectMaterial,
            shape: platformShape,
            collisionResponse: false
        });
        platformBody.isTrigger = true;
        platformBody.userData = { isPlatform: true };
        platformBody.position.copy(position);
        world.addBody(platformBody);

        return {
            mesh: platformMesh,
            body: platformBody,
            scale: 1,
            activated: false
        };
    }
    const circularPlatform = createCircularPlatform(new THREE.Vector3(-0.5, 0.5, -6));

    // Criar plataforma movel
    function createMovingPlatform(position, range, speed) {
        // Visual
        const platformGeometry = new THREE.BoxGeometry(1, 0.5, 0.1);
        const platformMaterial = new THREE.MeshNormalMaterial();
        const platformMesh = new THREE.Mesh(platformGeometry, platformMaterial);
        platformMesh.position.copy(position);
        platformMesh.castShadow = true;
        scene.add(platformMesh);

        // Física
        const platformShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.25, 0.05));
        const platformBody = new CANNON.Body({
            mass: 0,
            material: objectMaterial,
            shape: platformShape
        });
        platformBody.position.copy(position);
        world.addBody(platformBody);

        return {
            mesh: platformMesh,
            body: platformBody,
            range: range,
            speed: speed,
            direction: 1,
            originalPosition: position.clone()
        };
    }
    const movingPlatform = createMovingPlatform(new THREE.Vector3(-0.75, 0.5, -1), 3.5, 1.5);

    // Criar flippers
    function createFlipper(position, isLeft) {
        // Visual - base
        const cylinderGeometry = new THREE.CylinderGeometry(0.25, 0.25, 1);
        const cylinderMaterial = new THREE.MeshNormalMaterial();
        const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

        // Visual - parte que gira
        const boxGeometry = new THREE.BoxGeometry(2.1, 0.65, 0.25);
        const boxMaterial = new THREE.MeshNormalMaterial();
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        boxMesh.position.set(isLeft ? 1.25 : -1.25, 0, 0);

        // Grupo para combinar as partes
        const flipperGroup = new THREE.Group();
        flipperGroup.add(cylinderMesh);
        flipperGroup.add(boxMesh);
        flipperGroup.position.copy(position);
        flipperGroup.castShadow = true;
        scene.add(flipperGroup);

        // Física
        const cylinderShape = new CANNON.Cylinder(0.25, 0.25, 1);
        const boxShape = new CANNON.Box(new CANNON.Vec3(1.25, 0.4, 0.2));

        const flipperBody = new CANNON.Body({
            mass: 0,
            material: objectMaterial
        });

        flipperBody.addShape(cylinderShape);
        flipperBody.addShape(boxShape, new CANNON.Vec3(isLeft ? 1 : -1, 0, 0));
        flipperBody.position.copy(position);
        world.addBody(flipperBody);

        return {
            mesh: flipperGroup,
            body: flipperBody,
            isLeft,
            targetRotation: isLeft ? -0.2 : 0.2,
            currentRotation: isLeft ? -0.2 : 0.2
        };
    }

    const leftFlipper = createFlipper(new THREE.Vector3(-3.6, 0.5, 5), true);
    const rightFlipper = createFlipper(new THREE.Vector3(2.1, 0.5, 5), false);

    // Criar mola
    function createSpring(position) {
        // Visual - base
        const baseGeometry = new THREE.BoxGeometry(1, 1, 0.3);
        const baseMaterial = new THREE.MeshNormalMaterial();
        const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);

        // Visual - parte móvel
        const cylinderGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        const cylinderMaterial = new THREE.MeshNormalMaterial();
        const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        cylinderGeometry.rotateX(-Math.PI / 2);
        cylinderMesh.position.set(0, 0, 1);

        // Grupo para combinar as partes
        const springGroup = new THREE.Group();
        springGroup.add(baseMesh);
        springGroup.add(cylinderMesh);
        springGroup.position.copy(position);
        springGroup.castShadow = true;
        scene.add(springGroup);

        const springBody = new CANNON.Body({
            mass: 0,
            material: objectMaterial,
            position: new CANNON.Vec3(position.x, position.y, position.z)
        });

        const baseShape = new CANNON.Cylinder(1 / 2, 1 / 2, 0.3 / 2);
        const cylinderShape = new CANNON.Cylinder(0.1, 0.1, 2, 8);
        springBody.addShape(baseShape);
        springBody.addShape(
            cylinderShape,
            new CANNON.Vec3(0, 0, 1),
            new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0)
        );

        world.addBody(springBody);

        return {
            mesh: springGroup,
            cylinderMesh: cylinderMesh,
            body: springBody,
            basePosition: new THREE.Vector3(position.x, position.y, position.z),
            currentPosition: 0,
            targetPosition: 0, // 0 = repouso; 2 = comprimida
            speed: 0.1,
            released: false,
            compressed: false,
            readyToLaunch: false,
        };
    }

    const spring = createSpring(new THREE.Vector3(5.2, 0.5, 4));
    spring.readyToLaunch = false;

    // Criar bola
    function createBall(position) {
        // Visual
        const ballGeometry = new THREE.SphereGeometry(0.5);
        const ballMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
        });
        const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
        ballMesh.position.copy(position);
        ballMesh.castShadow = true;
        scene.add(ballMesh);

        // Física
        const ballShape = new CANNON.Sphere(0.5);
        const ballBody = new CANNON.Body({
            mass: 1,
            material: slipperyMaterial,
            shape: ballShape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            linearDamping: 0.3,
            angularDamping: 0.3
        });
        ballBody.velocity.set(0, 0, 0);
        ballBody.angularVelocity.set(0, 0, 0);

        ballBody.sleep();

        ballBody.position.copy(position);
        world.addBody(ballBody);

        return { mesh: ballMesh, body: ballBody };
    }

    const ball = createBall(new THREE.Vector3(5.2, 0.5, 3.3));
    let gameStarted = false;
    setTimeout(() => {
        gameStarted = true;
    }, 1000);

    // Sensor invisível para detetar a queda da bola
    const sensorGeometry = new THREE.BoxGeometry(10, 1, 0.5);
    const sensorMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const sensorMesh = new THREE.Mesh(sensorGeometry, sensorMaterial);
    sensorMesh.position.set(-0.7, 0.5, 6.5);
    scene.add(sensorMesh);

    let sensorCooldown = false;    // Adicionar instruções
    let instructionsDiv = document.getElementById('instructions');
    if (!instructionsDiv) {
        // Se não existir, criar
        instructionsDiv = document.createElement('div');
        instructionsDiv.id = 'instructions';
        instructionsDiv.innerHTML = `
                <kbd>←</kbd><kbd>→</kbd> Flippers
                <br>
                <kbd>Space</kbd> Launch
            `;
        document.body.appendChild(instructionsDiv);
    }

    // Sistema de score
    let scoreDiv = document.getElementById('score-display');
    if (!scoreDiv) {
        scoreDiv = document.createElement('div');
        scoreDiv.id = 'score-display';
        scoreDiv.textContent = 'Score: 0';
        document.body.appendChild(scoreDiv);
    } else {
        scoreDiv.textContent = `Score: ${score}`;
    }

    let score = 0;

    // Sistema de vidas
    let livesDiv = document.getElementById('lives-display');
    if (!livesDiv) {
        livesDiv = document.createElement('div');
        livesDiv.id = 'lives-display';
        livesDiv.textContent = 'Lives: 3';
        document.body.appendChild(livesDiv);
    }

    let lives = 3;
    let gameActive = true;
    let ballInPlay = false;
    let ballWasInPlay = false;

    function updateLivesDisplay() {
        livesDiv.textContent = `Lives: ${'❤️'.repeat(lives)}`;
    }
    updateLivesDisplay();

    // Menu de compra
    const shopStyle = document.createElement('style');
    shopStyle.textContent = `
            #shop-menu {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.85);
                border: 2px solid #4d88ff;
                border-radius: 10px;
                padding: 20px;
                color: white;
                font-family: 'Arial', sans-serif;
                z-index: 1000;
                text-align: center;
                width: 300px;
                box-shadow: 0 0 20px rgba(77, 136, 255, 0.6);
            }
            
            #shop-menu h2 {
                margin-top: 0;
                color: #4d88ff;
                text-shadow: 0 0 5px rgba(77, 136, 255, 0.5);
            }
            
            .shop-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 15px 0;
                padding: 10px;
                background: rgba(40, 40, 60, 0.7);
                border-radius: 5px;
                transition: all 0.3s ease;
            }
            
            .shop-item:hover {
                background: rgba(60, 60, 100, 0.7);
                transform: translateY(-2px);
            }
            
            .shop-item-disabled {
                opacity: 0.5;
                filter: grayscale(1);
                cursor: not-allowed;
            }
            
            .shop-button {
                background: #4d88ff;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .shop-button:hover:not(:disabled) {
                background: #3a6fd6;
                transform: scale(1.05);
            }
            
            .shop-button:disabled {
                background: #666;
                cursor: not-allowed;
            }
            
            .shop-item-info {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .shop-close {
                margin-top: 15px;
                background: #ff4d4d;
            }
            
            .shop-close:hover {
                background: #d63a3a;
            }
        `;
    document.head.appendChild(shopStyle);

    let shopMenu = null;
    let shopActive = false;
    const shopPoints = {
        oneLife: 500,
        maxLives: 3
    };
    const pointsThreshold = 1000;
    let lastShopOfferScore = 0;

    // Criação da loja
    function createShopMenu() {
        if (document.getElementById('shop-menu')) {
            document.body.removeChild(document.getElementById('shop-menu'));
        }

        const previousGameState = gameActive;
        gameActive = false;
        shopActive = true;

        shopMenu = document.createElement('div');
        shopMenu.id = 'shop-menu';
        shopMenu.innerHTML = `
        <h2>Space Shop</h2>
        <p>Current Score: <span style="color: #4d88ff">${score}</span></p>
        
        <div class="shop-item ${lives >= shopPoints.maxLives || score < shopPoints.oneLife ? 'shop-item-disabled' : ''}">
            <div class="shop-item-info">
                <span>❤️</span>
                <span>Extra Life</span>
            </div>
            <button 
                id="buy-life" 
                class="shop-button" 
                ${lives >= shopPoints.maxLives || score < shopPoints.oneLife ? 'disabled' : ''}
            >
                Buy (${shopPoints.oneLife}pts)
            </button>
        </div>
        
        <button id="close-shop" class="shop-button shop-close">Continue Game</button>
    `;

        document.body.appendChild(shopMenu);

        // Adicionar eventos
        document.getElementById('buy-life').addEventListener('click', () => {
            if (score >= shopPoints.oneLife && lives < shopPoints.maxLives) {
                // Comprar vida
                score -= shopPoints.oneLife;
                lives++;
                updateLivesDisplay();
                scoreDiv.textContent = `Score: ${score}`;

                // Fechar e reabrir para atualizar o estado dos botões
                createShopMenu();
            }
        });

        document.getElementById('close-shop').addEventListener('click', () => {
            document.body.removeChild(shopMenu);
            shopActive = false;
            gameActive = previousGameState;
            shopMenu = null;

            if (gameActive) {
                setTimeout(() => {
                    requestAnimationFrame(animate);
                }, 100);
            }
        });

        lastShopOfferScore = score;
    }

    function checkShopAvailability() {
        if (!shopActive &&
            score >= lastShopOfferScore + pointsThreshold &&
            lives < shopPoints.maxLives &&
            lives < 3) {

            // Criar um elemento flutuante para notificar o jogador
            const notification = document.createElement('div');
            notification.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 20px;
            border-radius: 10px;
            border: 2px solid #4d88ff;
            z-index: 1000;
            text-align: center;
            animation: fadeIn 0.5s;
        `;
            notification.innerHTML = `
            <h3>Shop Available!</h3>
            <p>Press <kbd>B</kbd> to open the shop and buy extra lives</p>
        `;
            document.body.appendChild(notification);

            // Remover após 3 segundos
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 3000);

            lastShopOfferScore = score;
        }
    }

    // Detectar colisões
    ball.body.addEventListener('collide', (event) => {
        const otherBody = event.body;
        if (otherBody.userData && otherBody.userData.isBumper) {
            const contactNormal = new CANNON.Vec3();
            const contactPoint = event.contact.ni;
            contactNormal.copy(contactPoint);

            ball.body.velocity.set(
                contactNormal.x * 10,
                contactNormal.y * 10,
                contactNormal.z * 10
            );

            score += 100;
            scoreDiv.textContent = `Score: ${score}`;
            checkShopAvailability();

            collisionSound.currentTime = 0;
            playSound(collisionSound);

            // Animar o bumper
            if (otherBody === bumper1.body) {
                bumper1.scale = 1.2;
            } else if (otherBody === bumper2.body) {
                bumper2.scale = 1.2;
            } else if (otherBody === bumper3.body) {
                bumper3.scale = 1.2;
            }
        }
        if (otherBody === circularPlatform.body && !circularPlatform.activated) {
            score += 500;
            scoreDiv.textContent = `Score: ${score}`;
            checkShopAvailability();

            collisionSound.volume = 0.9;
            collisionSound.currentTime = 0;
            playSound(collisionSound);
            setTimeout(() => {
                collisionSound.volume = 0.7;
            }, 100);

            // Determinar qual plataforma foi ativada
            let activatedPlatform;
            if (otherBody === circularPlatform.body) {
                activatedPlatform = circularPlatform;
            }

            // Aplicar efeito visual
            activatedPlatform.scale = 2.0;
            activatedPlatform.activated = true;

            // Desativar após 5 segundos
            setTimeout(() => {
                activatedPlatform.activated = false;
            }, 5000);
        }
    });

    // Função de interpolação
    function lerp(from, to, speed) {
        return from + speed * (to - from);
    }

    // Loop de animação
    const clock = new THREE.Clock();
    function animate() {
        if (!gameActive) return;

        requestAnimationFrame(animate);

        const currentTime = Date.now();
        if (currentTime - lastRainbowTime > rainbowInterval * 1000) {
            skyShaderMaterial.uniforms.rainbowTime.value = 0.0;
            lastRainbowTime = currentTime;
        }

        if (skyShaderMaterial.uniforms.rainbowTime.value >= 0) {
            skyShaderMaterial.uniforms.rainbowTime.value += clock.getDelta();
            if (skyShaderMaterial.uniforms.rainbowTime.value > skyShaderMaterial.uniforms.rainbowDuration.value) {
                skyShaderMaterial.uniforms.rainbowTime.value = -1;
            }
        }

        updateSunPosition();

        const dt = Math.min(clock.getDelta(), 0.1);
        world.step(1 / 60, dt);

        // Atualizar posições dos objetos
        if (ball && ball.mesh && ball.body) {
            ball.mesh.position.copy(ball.body.position);
            ball.mesh.quaternion.copy(ball.body.quaternion);
        }

        checkSensorCollision();

        function checkSensorCollision() {
            if (sensorCooldown || !gameActive || !gameStarted || !ballInPlay) return;

            const ballBox = new THREE.Box3().setFromObject(ball.mesh);
            const sensorBox = new THREE.Box3().setFromObject(sensorMesh);

            if (ballBox.intersectsBox(sensorBox)) {
                sensorCooldown = true;

                console.log("Perdendo vida, vidas antes:", lives);
                lives--;
                updateLivesDisplay();
                console.log("Vidas depois:", lives);

                setTimeout(() => {
                    resetBall();
                    ballInPlay = false;

                    setTimeout(() => {
                        sensorCooldown = false;
                    }, 2000);
                }, 1000);

                if (lives <= 0) {
                    gameActive = false;
                    const gameOverDiv = document.createElement('div');
                    gameOverDiv.id = 'game-over';
                    gameOverDiv.innerHTML = `
                <h2>GAME OVER</h2>
                <p>Final Score: ${score}</p>
                <button id="restart-button">Play Again</button>`;
                    document.body.appendChild(gameOverDiv);

                    document.getElementById('restart-button').addEventListener('click', () => {
                        document.body.removeChild(gameOverDiv);
                        resetGame();
                    });
                }
            }
        }

        function resetBall() {
            if (ball && ball.body) {
                ball.body.velocity.set(0, 0, 0);
                ball.body.angularVelocity.set(0, 0, 0);
                ball.body.position.set(5.2, 0.5, 3.3);
                ball.body.sleep();

                ballInPlay = false;
                ball.fixedToSpring = false;
                spring.compressed = false;
                spring.readyToLaunch = false;
                spring.currentPosition = 0;
                spring.mesh.position.z = spring.basePosition.z;
                spring.body.position.z = spring.basePosition.z;
            }
        }

        function resetGame() {
            lives = 3;
            score = 0;
            gameActive = true;
            ballInPlay = false;
            ballWasInPlay = false;

            updateLivesDisplay();
            scoreDiv.textContent = `Score: ${score}`;

            resetBall();
            requestAnimationFrame(animate);
        }

        // Controlar flippers
        if (keys['ArrowLeft']) {
            leftFlipper.targetRotation = 0.2;
        } else {
            leftFlipper.targetRotation = -0.2;
        }

        if (keys['ArrowRight']) {
            rightFlipper.targetRotation = -0.2;
        } else {
            rightFlipper.targetRotation = 0.2;
        }

        // Interpolar rotação dos flippers
        leftFlipper.currentRotation = lerp(leftFlipper.currentRotation, leftFlipper.targetRotation, 0.8);
        rightFlipper.currentRotation = lerp(rightFlipper.currentRotation, rightFlipper.targetRotation, 0.8);

        leftFlipper.body.quaternion.setFromEuler(0, leftFlipper.currentRotation, 0);
        rightFlipper.body.quaternion.setFromEuler(0, rightFlipper.currentRotation, 0);

        leftFlipper.mesh.quaternion.copy(leftFlipper.body.quaternion);
        rightFlipper.mesh.quaternion.copy(rightFlipper.body.quaternion);

        // Controlar mola
        if (keys['Space']) {
            if (!spring.compressed) {
                spring.compressed = true;
                ball.body.wakeUp();
                ball.body.type = CANNON.Body.KINEMATIC;
                ball.fixedToSpring = true;
            }
            spring.targetPosition = 2;
            spring.speed = dt * 5;
            spring.released = false;
            spring.readyToLaunch = true;

            if (ball.fixedToSpring) {
                const springZ = spring.body.position.z + spring.currentPosition;
                ball.body.position.set(5.2, 0.5, springZ - 2.5);
                ball.body.velocity.set(0, 0, 0);
            }

        } else {
            if (spring.readyToLaunch && spring.compressed) {
                spring.compressed = false;
                spring.readyToLaunch = false;

                ball.body.type = CANNON.Body.DYNAMIC;
                spring.fixedToSpring = false;
                ballInPlay = true;
                ballWasInPlay = true;

                const force = 15 * spring.currentPosition;
                ball.body.velocity.set(0, 0, -force);
                ball.body.velocity.y += 2;
            }
            spring.targetPosition = 0;
            spring.speed = dt * 10;
        }

        spring.currentPosition = lerp(spring.currentPosition, spring.targetPosition, spring.speed);
        spring.mesh.position.z = spring.basePosition.z + spring.currentPosition;
        spring.body.position.z = spring.basePosition.z + spring.currentPosition;

        spring.body.updateMassProperties();

        // Controlar a interação da mola com a bola
        if (spring.released && ball.fixedToSpring) {
            ball.body.type = CANNON.Body.DYNAMIC;
            ball.fixedToSpring = false;

            const force = 15 * spring.currentPosition;
            ball.body.velocity.set(0, 0, -force);
            ball.body.velocity.y += 2;
            spring.released = false;
        }

        // Animar bumpers
        bumper1.scale = lerp(bumper1.scale, 1, dt * 10);
        bumper2.scale = lerp(bumper2.scale, 1, dt * 10);
        bumper3.scale = lerp(bumper3.scale, 1, dt * 10);

        bumper1.mesh.scale.set(bumper1.scale, 1, bumper1.scale);
        bumper2.mesh.scale.set(bumper2.scale, 1, bumper2.scale);
        bumper3.mesh.scale.set(bumper3.scale, 1, bumper3.scale);

        // Animar plataforma circular
        circularPlatform.scale = lerp(circularPlatform.scale, 1, dt * 10);
        circularPlatform.mesh.scale.set(circularPlatform.scale, 1, circularPlatform.scale);

        // Atualizar posição da plataforma circular
        if (movingPlatform) {
            movingPlatform.body.position.x += movingPlatform.direction * movingPlatform.speed * dt;
            if (movingPlatform.body.position.x <= -5 || movingPlatform.body.position.x >= 3.5) {
                movingPlatform.direction *= -1;
            }
            movingPlatform.mesh.position.copy(movingPlatform.body.position);
        }

        skyShaderMaterial.uniforms.time.value = clock.getElapsedTime();

        renderer.render(scene, camera);
    }

    // Redimensionar janela
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}
