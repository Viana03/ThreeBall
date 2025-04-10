import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as CANNON from 'cannon-es';
// import { BonusZone } from '../bonusScene.js';

// Inicialização principal
export function init() {
    // Ocultar instruções até que o jogo comece
    const instructionsDiv2 = document.createElement('div');
    instructionsDiv2.id = 'instructions';
    instructionsDiv2.style.display = 'none';
    instructionsDiv2.innerHTML = `
                <kbd>←</kbd><kbd>→</kbd> for Flippers
                <br>
                <kbd>Space</kbd> to launch
            `;
    document.body.appendChild(instructionsDiv2);

    // Variável de pontuação
    let score = 0;
    // Variável de vidas
    let lives = 4;
    // Variável de estado do jogo
    let gameStarted = false;

    // Configuração básica
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 13, 9);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const spaceShaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_time: { value: 0 },
            u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec2 u_resolution;
            uniform float u_time;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            // Noise functions
            float random(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }
            
            // Simplex noise by Ian McEwan
            vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
            vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
            vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
            
            float snoise(vec3 v) {
                const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
                
                vec3 i = floor(v + dot(v, C.yyy));
                vec3 x0 = v - i + dot(i, C.xxx);
                
                vec3 g = step(x0.yzx, x0.xyz);
                vec3 l = 1.0 - g;
                vec3 i1 = min(g.xyz, l.zxy);
                vec3 i2 = max(g.xyz, l.zxy);
                
                vec3 x1 = x0 - i1 + C.xxx;
                vec3 x2 = x0 - i2 + C.yyy;
                vec3 x3 = x0 - D.yyy;
                
                i = mod289(i);
                vec4 p = permute(permute(permute(
                         i.z + vec4(0.0, i1.z, i2.z, 1.0))
                       + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                       + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                
                float n_ = 0.142857142857;
                vec3 ns = n_ * D.wyz - D.xzx;
                
                vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
                
                vec4 x_ = floor(j * ns.z);
                vec4 y_ = floor(j - 7.0 * x_);
                
                vec4 x = x_ *ns.x + ns.yyyy;
                vec4 y = y_ *ns.x + ns.yyyy;
                vec4 h = 1.0 - abs(x) - abs(y);
                
                vec4 b0 = vec4(x.xy, y.xy);
                vec4 b1 = vec4(x.zw, y.zw);
                
                vec4 s0 = floor(b0)*2.0 + 1.0;
                vec4 s1 = floor(b1)*2.0 + 1.0;
                vec4 sh = -step(h, vec4(0.0));
                
                vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                
                vec3 p0 = vec3(a0.xy, h.x);
                vec3 p1 = vec3(a0.zw, h.y);
                vec3 p2 = vec3(a1.xy, h.z);
                vec3 p3 = vec3(a1.zw, h.w);
                
                vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
                p0 *= norm.x;
                p1 *= norm.y;
                p2 *= norm.z;
                p3 *= norm.w;
                
                vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                m = m * m;
                return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
            }
            
            // Star field function
            float stars(vec2 uv, float density) {
                vec2 p = uv * 1000.0;
                vec2 f = fract(p);
                vec2 i = floor(p);
                
                float star = 0.0;
                float twinkle = sin(u_time * 3.0 + i.x * 100.0) * 0.5 + 0.5;
                
                if (random(i) > density) return 0.0;
                
                vec2 center = (f - 0.5) * 2.0;
                float dist = length(center);
                star = smoothstep(0.95, 0.0, dist) * twinkle;
                
                return star;
            }
            
            void main() {
                vec2 st = vUv;
                st.x *= u_resolution.x / u_resolution.y;
                
                // Base space color (dark blue/purple)
                vec3 color = mix(
                    vec3(0.01, 0.02, 0.05),
                    vec3(0.02, 0.01, 0.1),
                    smoothstep(-0.5, 0.5, vPosition.y)
                );
                
                // Add star field
                float starField = 0.0;
                for (int i = 0; i < 3; i++) {
                    float scale = 1.0 + float(i) * 0.3;
                    starField += stars(st * scale + vec2(u_time * 0.01 * float(i)), 0.001);
                }
                color += starField * 0.8;
                
                // Add nebula effect using 3D noise
                vec3 nebulaSt = vec3(st * 5.7, u_time * 0.1);
                float n = snoise(nebulaSt);
                n = smoothstep(-0.3, 1.0, n * 1.5);
                
                vec3 nebulaColor = mix(
                    vec3(0.3, 0.1, 0.5),
                    vec3(0.1, 0.3, 0.6),
                    snoise(nebulaSt * 2.0)
                );
                
                color = mix(color, nebulaColor, n * 0.3);
                
                // Add some bright stars
                if (starField > 0.5) {
                    color = mix(color, vec3(1.0), pow(starField, 5.0));
                }
                
                // Add subtle pulsing effect
                color *= 0.9 + 0.1 * sin(u_time * 0.5);
                
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.BackSide
    });

    const backgroundGeometry = new THREE.SphereGeometry(500, 60, 60);
    const backgroundMesh = new THREE.Mesh(backgroundGeometry, spaceShaderMaterial);
    scene.add(backgroundMesh);

    // Bonus Scene!!!
    // const bonusZone = new BonusZone();
    // let activateCamera = camera;

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


    // Física
    const world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.8, 5)
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
    world.addBody(transparentPlaneBody);

    // Estado do teclado
    const keys = {};
    document.addEventListener('keydown', event => {
        keys[event.code] = true;
    });
    document.addEventListener('keyup', event => {
        keys[event.code] = false;
    });

    // Função auxiliar para criar paredes
    function createWall(width, height, depth, position, rotation = { x: 0, y: 0, z: 0 }) {
        // Visual
        const wallGeometry = new THREE.BoxGeometry(width, height, depth);
        const wallMaterial = new THREE.MeshNormalMaterial({ color: 0x89cff0 });
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

    function createWarpHole(position) {
        // Visual
        const ringGeometry = new THREE.TorusGeometry(0.5, 0.15, 16, 32);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 1
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        ring.rotation.x = Math.PI / 2;
        scene.add(ring);

        // Partículas para efeito
        const particles = new THREE.BufferGeometry();
        const particleCount = 100;
        const posArray = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 1.5;
        }
        particles.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.1,
            transparent: true,
            opacity: 0.8
        });
        const particleSystem = new THREE.Points(particles, particleMaterial);
        particleSystem.position.copy(position);
        scene.add(particleSystem);

        // Física - Corpo de colisão
        const warpShape = new CANNON.Sphere(0.5);
        const warpBody = new CANNON.Body({
            mass: 0,
            material: objectMaterial,
            shape: warpShape,
            isTrigger: true,
            position: new CANNON.Vec3(position.x, position.y, position.z)
        });
        warpBody.userData = { isWarpHole: true };
        world.addBody(warpBody);

        return {
            mesh: ring,
            particles: particleSystem,
            body: warpBody
        };
    }

    // Crie o buraco em algum lugar do tabuleiro
    const warpHole = createWarpHole(new THREE.Vector3(-4.7, 0.5, -9.6));

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
        const boxShape = new CANNON.Box(new CANNON.Vec3(1.25, 0.4, 0.125));

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
        // Visual - parte móvel
        const cylinderGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2);
        const cylinderMaterial = new THREE.MeshNormalMaterial();
        const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
        cylinderMesh.rotation.x = -Math.PI / 2;
        cylinderMesh.position.set(0, 0, 1);

        // Grupo para combinar as partes
        const springGroup = new THREE.Group();
        springGroup.add(cylinderMesh);
        springGroup.position.copy(position);
        springGroup.castShadow = true;
        scene.add(springGroup);

        // Física
        const cylinderShape = new CANNON.Cylinder(0.3, 0.3, 2);

        const springBody = new CANNON.Body({
            mass: 0,
            material: objectMaterial
        });

        const cylinderQuat = new CANNON.Quaternion();
        cylinderQuat.setFromEuler(-Math.PI / 2, 0, 0);
        springBody.addShape(cylinderShape, new CANNON.Vec3(0, 0, 1), cylinderQuat);

        springBody.position.copy(position);
        world.addBody(springBody);

        return {
            mesh: springGroup,
            body: springBody,
            targetPosition: 1,
            currentPosition: 1,
            compressed: false,
            released: false,
        };
    }

    const spring = createSpring(new THREE.Vector3(5.15, 0.5, 0));

    // Criar bola
    function createBall(position) {
        // Visual
        const ballGeometry = new THREE.SphereGeometry(0.5);
        const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd });
        const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
        ballMesh.position.copy(position);
        ballMesh.castShadow = true;
        scene.add(ballMesh);

        // Física
        const ballShape = new CANNON.Sphere(0.5);
        const ballBody = new CANNON.Body({
            mass: 1,
            material: slipperyMaterial,
            shape: ballShape
        });
        ballBody.position.copy(position);
        world.addBody(ballBody);

        return { mesh: ballMesh, body: ballBody };
    }

    const ball = createBall(new THREE.Vector3(spring.body.position.x, spring.body.position.y + 1, spring.body.position.z));

    // Pontuação
    const scoreDiv = document.createElement('div');
    scoreDiv.id = 'score-display';
    scoreDiv.style.position = 'absolute';
    scoreDiv.style.top = '20px';
    scoreDiv.style.left = '20px';
    scoreDiv.style.color = 'white';
    scoreDiv.style.fontFamily = 'Arial, sans-serif';
    scoreDiv.style.fontSize = '24px';
    scoreDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    scoreDiv.textContent = `Score: ${score}`;
    document.body.appendChild(scoreDiv);

    // Vidas
    const livesDiv = document.createElement('div');
    livesDiv.id = 'lives-display';
    updateLivesDisplay();
    livesDiv.style.transform = 'scale(1.4)';
    livesDiv.style.transform = 'transform 0.3s';
    setTimeout(() => {
        livesDiv.style.transform = 'scale(1)';
    }, 300);
    document.body.appendChild(livesDiv);

    function updateLivesDisplay() {
        livesDiv.textContent = '❤️'.repeat(lives);
    }

    // Detectar colisões
    ball.body.addEventListener('collide', (event) => {
        const otherBody = event.body;
        if (otherBody.userData && otherBody.userData.isBumper) {
            // Aplicar impulso na direção oposta
            const contactNormal = new CANNON.Vec3();
            const contactPoint = event.contact.ni;
            contactNormal.copy(contactPoint);

            ball.body.velocity.set(
                contactNormal.x * 10,
                contactNormal.y * 10,
                contactNormal.z * 10
            );

            // Animar o bumper
            if (otherBody === bumper1.body) {
                bumper1.scale = 1.2;
                score += 100;
            } else if (otherBody === bumper2.body) {
                bumper2.scale = 1.2;
                score += 100;
            } else if (otherBody === bumper3.body) {
                bumper3.scale = 1.2;
                score += 100;
            }

            scoreDiv.textContent = `Score: ${score}`;
        }

        if (otherBody === circularPlatform.body && !circularPlatform.activated) {
            circularPlatform.scale = 2.0;
            score += 500;
            scoreDiv.textContent = `Score: ${score}`;
            circularPlatform.activated = true;
            setTimeout(() => {
                circularPlatform.activated = false;
            }, 5000);
        }

        // if (otherBody.userData && otherBody.userData.isWarpHole && !bonusZone.activate) {
        //     activateCamera = bonusZone.activate(ball);
        // }
    });

    // Adicionar instruções
    const instructionsDiv = document.createElement('div');
    instructionsDiv.id = 'instructions';
    instructionsDiv.innerHTML = `
                <kbd>←</kbd><kbd>→</kbd> for Flippers
                <br>
                <kbd>Space</kbd> to launch
            `;
    document.body.appendChild(instructionsDiv);

    // Função de interpolação
    function lerp(from, to, speed) {
        return from + speed * (to - from);
    }

    // Loop de animação
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.1);
        world.step(1 / 60, dt);

        // Atualizar posições dos objetos
        ball.mesh.position.copy(ball.body.position);
        ball.mesh.quaternion.copy(ball.body.quaternion);

        // Verificar se a bola caiu
        if ((ball.body.position.z > 8 || ball.body.position.y < 0 || ball.body.position.y > 1.5)) {
            lives--;
            updateLivesDisplay();

            if (lives <= 0) {
                alert('Game Over!\n Your score: ' + score);
                lives = 3;
                updateLivesDisplay();
                score = 0;
                scoreDiv.textContent = `Score: ${score}`;
                gameStarted = false;
            }

            ball.body.velocity.set(0, 0, 0);
            ball.body.angularVelocity.set(0, 0, 0);
            ball.body.position.set(5.15, 0.5, -0.5);

            setTimeout(() => {
                gameStarted = true;
            }, 500);

            // if (bonusZone.active) {
            //     bonusZone.deactivate(ball);
            //     activateCamera = camera;
            // }
        }

        if (ball.body.position.x >= 4.3 && ball.body.position.x <= 5.9 &&
            Math.abs(ball.body.position.z + 0.5) < 0.2) {

            // Verificar se não está já na posição inicial (com uma pequena tolerância)
            const isAtInitialPosition =
                Math.abs(ball.body.position.x - 5.15) < 0.1 &&
                Math.abs(ball.body.position.z + 0.5) < 0.1;

            // Só resetar se não estiver na posição inicial
            if (!isAtInitialPosition) {
                ball.body.velocity.set(0, 0, 0);
                ball.body.angularVelocity.set(0, 0, 0);
                ball.body.position.set(5.15, 0.5, -0.5);
            }
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
            spring.targetPosition = 3;
            spring.speed = dt * 5;
            spring.compressed = true;
            spring.released = false;

        } else if (spring.compressed) {
            spring.targetPosition = 1;
            spring.speed = dt * 15;
            spring.compressed = false;
            spring.released = true;
        } else {
            spring.targetPosition = 1;
            spring.speed = dt * 10;
            spring.released = false;
        }

        spring.currentPosition = lerp(spring.currentPosition, spring.targetPosition, spring.speed);
        spring.mesh.children[0].position.z = spring.currentPosition;

        // Controlar a interação da mola com a bola
        if (spring.released) {
            // Calcular distância da mola para a bola
            const springPos = new THREE.Vector3(
                spring.body.position.x,
                spring.body.position.y,
                spring.body.position.z
            );
            const ballPos = new THREE.Vector3(
                ball.body.position.x,
                ball.body.position.y,
                ball.body.position.z
            );
            const distance = springPos.distanceTo(ballPos);

            // Se a bola estiver perto da mola quando soltada
            if (distance < 2) {
                gameStarted = true;
                // Calcular direção do impulso (da mola para longe)
                const direction = new THREE.Vector3();
                direction.subVectors(ballPos, springPos).normalize();

                // Aplicar impulso proporcional à compressão da mola
                const springForce = 50 * (spring.targetPosition - spring.currentPosition);
                ball.body.velocity.set(
                    direction.x * springForce,
                    direction.y * springForce,
                    -springForce
                );

                spring.released = false;
            }
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

        spaceShaderMaterial.uniforms.u_time.value = clock.getElapsedTime();

        // Atualizar o bonusZone 
        // if (bonusZone.active) {
        //     const warpEnded = bonusZone.update(dt, ball);
        //     if (warpEnded) {
        //         bonusZone.deactivate(ball);
        //         activateCamera = camera;
        //     }
        // }

        // Renderiza a cena apropriada
        // if (bonusZone.active) {
        //     renderer.render(bonusZone.scene, bonusZone.camera);
        // } else {
        //     renderer.render(scene, camera);
        // }
        renderer.render(scene, camera);
    }

    // Redimensionar janela
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);

        // bonusZone.resize();
    });

    animate();
}

// Iniciar
window.addEventListener('DOMContentLoaded', init);