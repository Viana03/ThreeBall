import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';


// Inicialização principal
export function init() {

    // Configuração básica
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 12, 12);

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
    createWall(0.25, 1, 2, new THREE.Vector3(3.65, 0.5, 0.4), { x: 0, y: -Math.PI / 4, z: 0 });
    createWall(0.25, 1, 2, new THREE.Vector3(-5.15, 0.5, 0.4), { x: 0, y: Math.PI / 4, z: 0 });


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
    const circularPlatform2 = createCircularPlatform(new THREE.Vector3(-5.1, 0.5, -0.5));
    const circularPlatform3 = createCircularPlatform(new THREE.Vector3(3.6, 0.5, -0.5));



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

    // Criar o sol
    function createOrbitalSun() {
        const sunGroup = new THREE.Group();

        // Criar uma esfera mais detalhada para o sol (será usada até o modelo 3D carregar)
        const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
        const sunMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffa500,
            emissiveIntensity: 1,
            transparent: true,
            opacity: 0.9
        });

        const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        sunGroup.add(sunMesh);

        const sunLight = new THREE.PointLight(0xffd700, 2, 20);
        sunLight.castShadow = true;
        sunGroup.add(sunLight);

        const sunGlow = new THREE.PointLight(0xffaa00, 1.5, 15);
        sunGroup.add(sunGlow);

        // Tentar carregar o modelo 3D do sol
        try {
            const loader = new GLTFLoader();
            loader.load(
                '../modelos/sun.glb',
                function (gltf) {
                    // Remover a esfera quando o modelo carregar
                    sunGroup.remove(sunMesh);

                    // Adicionar o modelo ao grupo
                    const sunModel = gltf.scene;
                    sunModel.scale.set(1, 1, 1);

                    // Melhorar o material do modelo
                    sunModel.traverse(function (child) {
                        if (child.isMesh) {
                            child.material.emissive = new THREE.Color(0xffa500);
                            child.material.emissiveIntensity = 1;
                        }
                    });

                    sunGroup.add(sunModel);
                    console.log('Modelo do sol carregado com sucesso');
                },
                undefined,
                function (error) {
                    console.error('Erro ao carregar o modelo do sol:', error);
                    console.log('Usando a esfera como sol alternativo');
                }
            );
        } catch (error) {
            console.error('Falha ao iniciar o carregador de modelo:', error);
        }

        sunGroup.position.set(10, 5, -5);
        scene.add(sunGroup);

        return {
            group: sunGroup,
            light: sunLight,
            glow: sunGlow,
            angle: 0,
            radius: 50,
            speed: 0.3,
            height: 5
        };
    }

    const orbitalSun = createOrbitalSun();

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
    const sensorGeometry = new THREE.BoxGeometry(3, 1, 0.5);
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
                <kbd>←</kbd><kbd>→</kbd> for Flippers
                <br>
                <kbd>Space</kbd> to launch
                <br>
                <kbd>B</kbd> to open shop
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
                }); 
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

            // Animar o bumper
            if (otherBody === bumper1.body) {
                bumper1.scale = 1.2;
            } else if (otherBody === bumper2.body) {
                bumper2.scale = 1.2;
            } else if (otherBody === bumper3.body) {
                bumper3.scale = 1.2;
            }
        }

        if (
            (otherBody === circularPlatform.body && !circularPlatform.activated) ||
            (otherBody === circularPlatform2.body && !circularPlatform2.activated) ||
            (otherBody === circularPlatform3.body && !circularPlatform3.activated)
        ) {
            score += 500;
            scoreDiv.textContent = `Score: ${score}`;
            checkShopAvailability();

            // Determinar qual plataforma foi ativada
            let activatedPlatform;
            if (otherBody === circularPlatform.body) {
                activatedPlatform = circularPlatform;
            } else if (otherBody === circularPlatform2.body) {
                activatedPlatform = circularPlatform2;
            } else {
                activatedPlatform = circularPlatform3;
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

        circularPlatform2.scale = lerp(circularPlatform2.scale, 1, dt * 10);
        circularPlatform2.mesh.scale.set(circularPlatform2.scale, 1, circularPlatform2.scale);

        circularPlatform3.scale = lerp(circularPlatform3.scale, 1, dt * 10);
        circularPlatform3.mesh.scale.set(circularPlatform3.scale, 1, circularPlatform3.scale);

        spaceShaderMaterial.uniforms.u_time.value = clock.getElapsedTime();

        // Animar o sol
        orbitalSun.angle += orbitalSun.speed * dt;
        orbitalSun.group.position.x = orbitalSun.radius * Math.cos(orbitalSun.angle);
        orbitalSun.group.position.z = orbitalSun.radius * Math.sin(orbitalSun.angle);
        orbitalSun.group.position.y = orbitalSun.height + Math.sin(orbitalSun.angle * 0.5) * 2;

        const pulseScale = 1 + 0.05 * Math.sin(clock.getElapsedTime() * 2);
        orbitalSun.group.scale.set(pulseScale, pulseScale, pulseScale);

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

// Removido o inicializador automático para evitar conflito com a seleção do tabuleiro