const QuadShaderCanvas = require('./quadShaderCanvas.js');
const StateTransformer = require('./StateTransformer.js');
const CaveGenerator = require('./caveGenerator.js');
const AppState = require('./appState.js');
const Util = require('./util.js');
const Events = require('./events.js');
const EvolveAid = require('./evolveAid.js');
const GameFragmentShader = require('./gameFragmentShader.js');

const THREE = require('three');
const vec2 = THREE.Vector2;
const {Howl, Howler} = require('howler');

const Y_HISTORY_LENGTH = 1000;
const CAVE_SAMPLE_DIST = 4;
const WORM_BLOCK_SPACING = 0.8;
const BASE_POINTS_PER_SEC = 3;

// These are constructed here for performance reasons.
// Probably not actually worthwhile except maybe
// CAVE_TOP/BOTTOM_VEC.
const GRAVITY_VEC = new vec2();
const WORM_FORWARD_VEC = new vec2();
const WORM_UP_VEC = new vec2();
const TOTAL_FORCE_VEC = new vec2();
const ACCEL_VEC = new vec2();
const CAMERA_SHIFT_VEC = new vec2();
const CAVE_TOP_VEC = new vec2();
const CAVE_BOTTOM_VEC = new vec2();

class GameStateTransformer extends StateTransformer {
    setUp() {
        this.quadShaderCanvas = new QuadShaderCanvas('canvas-container', GameFragmentShader.getText(), this.resizeOccurred.bind(this));

        this.caveGenerator = new CaveGenerator();

        this.setUpBrowserInputHandlers();

        this.loadSounds();

        this.createCaveDataTextures();

        this.initGame();
    }

    initGame() {
        this.initState();
        this.initUniforms();
        this.initEvolveAid();

        this.updatePointDisplay();
        this.birthSound.play();
    }

    update(time, deltaTime) {
        if (this.focused) {
            this.assignEnvironmentalForces();

            this.updateKinematics(deltaTime);

            this.updateCameraPosition();

            this.runEnvironmentalEventGenerators();

            this.updateCaveGeometry();

            this.updateWorm();

            this.evolveAid.update(time, deltaTime);

            this.updateGameState(deltaTime);

            this.state.time = time;

            this.mapStateToUniforms(this.state);
        }
    }

    initState() {
        const state = {
            time: 0,
            worm: { position: this.getInitialWormPosition(),
                    velocity: new vec2(),
                    rotation: 0,
                    mass: 40,
                    activeForces: [],
                    velocityCap: new vec2(6.5, 10),
                    collisionBounds: {width: 0.4, height: 0.4},
                    }, 
            camera: {position: this.getInitialWormPosition()},
            keyStates: {}, // Keyboard keys
            gameTime: 0,
            wormYHistory: [],
            yHistoryIndex: 0,
            timeInZone: 0,
            timeOutOfZone: 0,
            inZone: false,
            pointZoneIntensity: 0,
            points: 0,
        };

        state.worm.ignoreKinematics = () => this.state.worm.dying || this.state.resetTransition;

        this.state = state;
    }

    initUniforms() {
        const state = this.state;
        const uniforms = this.quadShaderCanvas.uniforms;

        uniforms.topHeights = {type: "t", value: this.topHeightTex};
        uniforms.bottomHeights = {type: "t", value: this.bottomHeightTex};
        uniforms.wormDeathRebirthRatio = {value: 0};
        uniforms.bgDeathRebirthRatio = {value: 0};
        uniforms.caveShutDeathRebirthRatio = {value: 0};
        uniforms.cavePatternDeathRebirthRatio = {value: 0};
        uniforms.resetTransitionRatio =  {value: 0};
        uniforms.cameraPos = {value: state.camera.position};
        uniforms.wormData =  {value: new Float32Array(16)};
        uniforms.wormData2 =  {value: new Float32Array(16)};
        uniforms.inZone = {value: 0};
        uniforms.pointZoneHeight = {value: 0};
        uniforms.pointZoneIntensity = {value: 0};
    }

    initEvolveAid() {
        // Takes objects with two properties: 'condition' and 'evolve', both of which
        // should be functions. 'condition' is passed the current state and returns
        // a boolean indicataing whether 'evolve' should be executed each frame.
        // 'evolve' is passed the current state and deltaTime.
        this.contingentEvolvers = [
                                    {condition: (state) => state.inZone,
                                     evolve: (state, deltaTime) => {
                                        state.timeInZone += deltaTime;
                                        state.pointZoneIntensity = Math.min(state.pointZoneIntensity + deltaTime / 3, 1.);
                                        state.points += deltaTime * Math.pow(state.pointZoneIntensity*5 + 1, 2);
                                        this.accelerationSound.volume(state.pointZoneIntensity);
                                     }},
                                    {condition: (state) => !state.inZone,
                                     evolve: (state, deltaTime) => {
                                        state.timeOutOfZone += deltaTime;
                                        state.pointZoneIntensity = Math.max(state.pointZoneIntensity - deltaTime, 0.);
                                     }}
                                  ];

        this.evolveAid = new EvolveAid(this.state, this.contingentEvolvers);
    }

    updateGameState(deltaTime) {
        this.state.gameTime += deltaTime;
        this.state.points += BASE_POINTS_PER_SEC * deltaTime;
        this.updatePointDisplay();
    }

    handleEvent(event) {
        const state = this.state;

        if (event.name === 'worm_cave_collision') {
            state.inZone = false;
            state.pointZoneIntensity = 0;
            state.timeInZone = 0;
            this.evolveAid.runTransientState('worm.dying',
                           {position: event.data.wormPosition}, 1.5);

            this.accelerationSound.stop();
            this.deathSound.play();
            setTimeout(() => this.caveShutSound.play(), 1150);

        } else if (event.name === 'worm.dying_finished') {
            this.evolveAid.runTransientState('resetTransition', {}, 1.5);

            // This is a little trick to regenerate the cave shape using a
            // new seed while in the middle of the 'resetTransition' animation.
            setTimeout(() => {
                this.caveGenerator = new CaveGenerator();
                state.worm.position = this.getInitialWormPosition();
                state.camera.position = this.getInitialWormPosition();
            }, 400);

            setTimeout(() => this.caveOpen.play(), 1000);
        } else if (event.name === 'resetTransition_finished') {

            this.initGame();
        } else if (event.name === 'point_zone_entry') {

            state.timeOutOfZone = 0;
            state.timeInZone = 0;
            if (!state.worm.dying) {
                state.inZone = true;
            }
            
            if (!this.accelerationSound.playing() && !state.worm.dying) {
                this.accelerationSound.play();
            }
        } else if (event.name === 'point_zone_exit') {

            state.timeInZone = 0;
            state.timeOutOfZone = 0;
            state.inZone = false;
            this.accelerationSound.pause();
        }
    }

    updateKinematics(deltaTime) {
        const entities = [this.state.worm];

        entities.forEach(entity => {
            if (!entity.ignoreKinematics()) {

                const totalForce = TOTAL_FORCE_VEC.set(0, 0, 0);
                entity.activeForces.forEach(force => {
                    totalForce.add(force);
                });

                const acceleration = ACCEL_VEC.set(totalForce.x / entity.mass, totalForce.y / entity.mass);
                const velocity = entity.velocity;

                velocity.addScaledVector(acceleration, deltaTime);

                // Cap velocity
                velocity.x = Math.min(Math.abs(velocity.x), Math.abs(entity.velocityCap.x)) * Math.sign(velocity.x);
                velocity.y = Math.min(Math.abs(velocity.y), Math.abs(entity.velocityCap.y)) * Math.sign(velocity.y);

                entity.position.addScaledVector(velocity, deltaTime);
            }

            entity.activeForces.length = 0;
        });
    }

    updateCameraPosition() {
        const camera = this.state.camera;
        const worm = this.state.worm;

        if (!worm.dying) {
            const target = worm.position.clone();
            target.x += 5;
            camera.position.addScaledVector(target.sub(camera.position), 
                                            1 / 10);
        }
    }

    updateWorm() {
        const state = this.state;
        const wormPos = state.worm.position;
        const newYHistoryIndex = Math.floor(Util.toPixels(wormPos.x)) % Y_HISTORY_LENGTH;

        if (state.yHistoryIndex > newYHistoryIndex) {
            for (let i = state.yHistoryIndex; i < state.wormYHistory.length; i++) {
                state.wormYHistory[i] = wormPos.y;
            }
            for (let i = 0; i <= newYHistoryIndex; i++) {
                state.wormYHistory[i] = wormPos.y;
            }
        } else {
            for (let i = state.yHistoryIndex; i <= newYHistoryIndex; i++) {
                state.wormYHistory[i] = wormPos.y;
            }
        }
        state.yHistoryIndex = newYHistoryIndex;
    }

    assignEnvironmentalForces() {
        const worm = this.state.worm;
        const camera = this.state.camera;

        const gravityConstant = 6.673e-11;
        const earthMass = 5.98e24;
        const earthRadius = 6.38e6;
        const gravityForceMagnitude = (gravityConstant * earthMass * worm.mass) / 6.38e6 ** 2;

        // Weaken gravity and thrust for the first few seconds
        const introScale = Util.smoothstep(0, 2.5, this.state.gameTime);

        worm.activeForces.push(GRAVITY_VEC.set(0, -gravityForceMagnitude * introScale));

        worm.activeForces.push(WORM_FORWARD_VEC.set(100, 0));

        if (this.state.keyStates.ArrowUp) {
            worm.activeForces.push(WORM_UP_VEC.set(0, 1000 * introScale));         
        }
    }

    updateCaveGeometry() {
        const camPosInPixels = Util.toPixelsV(this.state.camera.position);
        const camX = Math.floor(Util.toPixels(this.state.camera.position.x)) - Math.floor(AppState.canvasWidth / 2);
        const texelCount = AppState.canvasWidth / (CAVE_SAMPLE_DIST);

        for (let i = 0; i < texelCount; i++) {
            const xPixelInMeters = Util.toMeters(i*CAVE_SAMPLE_DIST + camX);

            const topY = this.caveGenerator.getTopSurfaceY(xPixelInMeters);
            this.topHeightTex.image.data[i] = this.cameraTransform(CAVE_TOP_VEC.set(0, topY), camPosInPixels).y;

            const bottomY = this.caveGenerator.getBottomSurfaceY(xPixelInMeters);
            this.bottomHeightTex.image.data[i] = this.cameraTransform(CAVE_BOTTOM_VEC.set(0, bottomY), camPosInPixels).y;
        }

        this.topHeightTex.needsUpdate = true;
        this.bottomHeightTex.needsUpdate = true;
    }

    mapStateToUniforms(state) {
        const uniforms = this.quadShaderCanvas.uniforms;
        const aspectRatio = AppState.canvasWidth / AppState.canvasHeight;
        const worm = state.worm;

        const wormPos = this.cameraTransform(worm.position.clone());

        const cameraPos = Util.toPixelsV(state.camera.position);
        cameraPos.x /= AppState.canvasWidth;
        cameraPos.x *= aspectRatio;
        cameraPos.y /= AppState.canvasHeight;

        uniforms.time.value = state.time;
        uniforms.cameraPos.value = cameraPos;

        if (state.resetTransition)
            uniforms.resetTransitionRatio.value = state.resetTransition.completion;

        uniforms.pointZoneIntensity.value = Util.smoothstep(0.1, 1., state.pointZoneIntensity);
        uniforms.pointZoneHeight.value = Util.toPixels(this.getPointZoneHeight(state.timeInZone)) / AppState.canvasHeight * (1/aspectRatio) * uniforms.pointZoneIntensity.value;

        const wormDeathRatio = worm.dying ? worm.dying.completion : 0;
        const resetTransitionRatio = uniforms.resetTransitionRatio.value;

        // These are all timed-event completion ratios for effects that play forward for death
        // then in reverse for rebirth.
        uniforms.wormDeathRebirthRatio.value = Util.smoothstep(0., 0.35, wormDeathRatio) - Util.smoothstep(0.75, 1., resetTransitionRatio);
        uniforms.bgDeathRebirthRatio.value = Util.smoothstep(0., 0.4, wormDeathRatio) - resetTransitionRatio;
        uniforms.caveShutDeathRebirthRatio.value = Util.smoothstep(0., 0.4, Math.pow(wormDeathRatio, 4.)) - Util.smoothstep(.5, 1., resetTransitionRatio);
        uniforms.cavePatternDeathRebirthRatio.value = (wormDeathRatio - Util.smoothstep(.5, 1., Math.pow(resetTransitionRatio, 2.)));


        // Update trailing worm block positions
        // and copy into matrix uniforms
        for (let i = 0; i < 6; i++) {
            const rotation = worm.velocity.clone().normalize().angle();

            const wormPosClone = worm.position.clone();
            wormPosClone.x += -WORM_BLOCK_SPACING * i;
            wormPosClone.y = this.getPastWormY(wormPosClone.x);
            this.setWormPartData(this.cameraTransform(wormPosClone), rotation, i);
        }
    }

    setWormPartData(position, rotation, index) {
        if (index < 4) {
            const i = index * 4;
            const wormData = this.quadShaderCanvas.uniforms.wormData;
            wormData.value[i + 0] = position.x;
            wormData.value[i + 1] = position.y;
            wormData.value[i + 2] = rotation;
        } else {
            const i = (index - 4) * 4;
            const wormData = this.quadShaderCanvas.uniforms.wormData2;
            wormData.value[i + 0] = position.x;
            wormData.value[i + 1] = position.y;
            wormData.value[i + 2] = rotation;
        }
    }

    cameraTransform(vec, camPosInPixels) {

        // `camPosInPixels` can be provided optionally
        // for performance reasons        
        if (!camPosInPixels) {
            camPosInPixels = Util.toPixelsV(this.state.camera.position);
        }

        const camShift = CAMERA_SHIFT_VEC.set(-camPosInPixels.x + AppState.canvasWidth/2,
                                              -camPosInPixels.y + AppState.canvasHeight/2);
        const transformedVec = Util.toPixelsVModify(vec).add(camShift);
        transformedVec.x /= AppState.canvasWidth;
        transformedVec.x *= (AppState.canvasWidth / AppState.canvasHeight);
        transformedVec.y /= AppState.canvasHeight;

        return transformedVec;
    }   

    // Previous y position of worm head segment in pixels
    getPastWormY(x) {
        const i = Math.floor(Util.toPixels(x)) % Y_HISTORY_LENGTH;
        const y = this.state.wormYHistory[i];

        if (isNaN(y)) {
            return this.getInitialWormPosition().y;
        } else {
            return y;
        }
    }

    runEnvironmentalEventGenerators() {
        const state = this.state;

        this.detectWormCaveCollision(state);
        this.detectPointZoneEvents(state);
    }

    detectWormCaveCollision(state) {
        const worm = state.worm;

        if (worm.dying) {
            return;
        }

        const testPoints = this.getWormCollisionTestPoints(worm);
        for (let i = 0; i < testPoints.length; i++) {
            const testPoint = testPoints[i];
            const caveTopY = this.caveGenerator.getTopSurfaceY(testPoint.x);
            const caveBottomY = this.caveGenerator.getBottomSurfaceY(testPoint.x);
            
            if (testPoint.y < caveBottomY || testPoint.y > caveTopY) {
                const wormPosition = worm.position.clone();
                Events.enqueue('worm_cave_collision', {collisionPoint: testPoint, wormPosition});

                return;
            }
        }
    }

    detectPointZoneEvents(state) {
        const testPoints = this.getWormCollisionTestPoints(state.worm);
        let testPointsInZone = 0
        
        for (let i = 0; i < testPoints.length; i++) {
            const testPoint = testPoints[i];
            const pointZoneHeight = this.getPointZoneHeight(state.timeInZone);
            const pointZoneTopY = this.caveGenerator.getTopSurfaceY(testPoint.x) - pointZoneHeight;
            const pointZoneBottomY = this.caveGenerator.getBottomSurfaceY(testPoint.x) + pointZoneHeight;
            
            if (testPoint.y < pointZoneBottomY || testPoint.y > pointZoneTopY) {
                if (!state.inZone) {
                    Events.enqueue('point_zone_entry', {});
                }

                testPointsInZone++;
            } 
        }

        if (testPointsInZone === 0 && state.inZone) {
            Events.enqueue('point_zone_exit', {});
        }
    }

    getWormCollisionTestPoints(worm) {
        const bounds = worm.collisionBounds;
        const wormTopY = worm.position.y + bounds.height / 2;
        const wormBottomY = worm.position.y - bounds.height / 2;
        const startX = worm.position.x - bounds.width/2;
        const finishX = worm.position.x + bounds.width/2;
        const samples = 3;
        const increment = (finishX - startX) / (samples - 1);

        const points = [];
        for (let i = 0; i < samples; i++) {
            const wormSampleX = startX + increment * i;

            points.push(new vec2(wormSampleX, wormTopY));
            points.push(new vec2(wormSampleX, wormBottomY));
        }

        return points;
    }

    getPointZoneHeight(timeInZone) {
        return Util.mix(1.5, 2.5, Util.smoothstep(0., 3, timeInZone));
    }

    render() {
        if (this.focused) {
            this.quadShaderCanvas.render();
        }
    }

    getCaveDataTexture() {
        const width = AppState.canvasWidth/CAVE_SAMPLE_DIST;

        return new THREE.DataTexture(new Float32Array(width), 
                                       width, 
                                       1,
                                       THREE.AlphaFormat,
                                       THREE.FloatType,
                                       THREE.UVMapping,
                                       THREE.ClampWrapping,
                                       THREE.ClampWrapping,
                                       THREE.LinearFilter,
                                       THREE.LinearFilter,
                                       1);
    }

    getInitialWormPosition() {
        const x = Util.toMeters(AppState.canvasWidth * 0.1);
        const y = (this.caveGenerator.getTopSurfaceY(x) + this.caveGenerator.getBottomSurfaceY(x)) / 2;

        return new vec2(x, y);
    }

    setUpBrowserInputHandlers() {
        const canvas = this.quadShaderCanvas.renderer.domElement;
        canvas.tabIndex = 0;
        canvas.focus();
        canvas.style.outline = 'none';

        canvas.addEventListener('keydown', (e) => {
            this.state.keyStates[e.key] = true;

            if (e.key === 'ArrowUp') {
                Events.enqueue("accel_start", {});
            }
        });
        canvas.addEventListener('keyup', (e) => {
            this.state.keyStates[e.key] = false;

            if (e.key === 'ArrowUp') {
                Events.enqueue("accel_end", {});
            }
        });

        this.focused = true;

        canvas.addEventListener('blur', (e) => {
            this.focused = false;
        });
        canvas.addEventListener('focus', (e) => {
            this.focused = true;
        });
    }

    updatePointDisplay() {
        document.getElementById('points').innerHTML = "" + Math.floor(this.state.points);
    }

    loadSounds() {
        this.deathSound = new Howl({
              src: ['sounds/exit.wav']
            });
        this.birthSound = new Howl({
              src: ['sounds/link.wav']
            });
        this.caveShutSound = new Howl({
              src: ['sounds/rock_breaking.flac']
            });
        this.accelerationSound = new Howl({
              src: ['sounds/engine.wav'],
              loop: true,
            });
        this.caveOpen = new Howl({
              src: ['sounds/powerDrain.ogg'],
            });
    }

    createCaveDataTextures() {
        this.topHeightTex = this.getCaveDataTexture();
        this.bottomHeightTex = this.getCaveDataTexture();
    }

    resizeOccurred(canvasWidth, canvasHeight) {
        this.createCaveDataTextures();
    }

    tearDown() {}
}

module.exports = GameStateTransformer;
