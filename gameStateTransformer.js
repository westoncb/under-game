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

const Y_HISTORY_LENGTH = 1000;
const CAVE_SAMPLE_DIST = 4;
const WORM_BLOCK_SPACING = 0.8;

class GameStateTransformer extends StateTransformer {
    setUp() {
        this.quadShaderCanvas = new QuadShaderCanvas('canvas-container', GameFragmentShader.getText());

        this.caveGenerator = new CaveGenerator();

        this.initState(false);

        this.setUpBrowserInputHandlers();
    }

    initState(reset) {
        const lastState = this.state;

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
            camera: {position: this.getInitialWormPosition(),
                     velocity: new vec2(),
                     activeForces: [],
                     mass: 2,
                     velocityCap: new vec2(10, 30),
                    },
            keyStates: {},
            gameTime: 0,
            wormYHistory: [],
            yHistoryIndex: 0,
            timeInZone: 0,
            timeOutOfZone: 0,
            inZone: false,
            pointZoneIntensity: 0,
            points: 0,
        };

        // Takes objects with two properties: 'condition' and 'evolve', both of which
        // should be functions. 'condition' is passed the current state and returns
        // a boolean indicataing whether 'evolve' should be executed each frame.
        // 'evolve' is passed the current state and deltaTime.
        this.contingentEvolvers = [
                                    {condition: (state) => state.inZone,
                                     evolve: (state, deltaTime) => {
                                        state.timeInZone += deltaTime;
                                        state.pointZoneIntensity = Math.min(state.pointZoneIntensity + deltaTime / 3, 1.);
                                        state.points += deltaTime * Math.pow(state.timeInZone + 1, 2);
                                        this.updatePointDisplay(state);
                                     }},
                                    {condition: (state) => !state.inZone,
                                     evolve: (state, deltaTime) => {
                                        state.timeOutOfZone += deltaTime;
                                        state.pointZoneIntensity = Math.max(state.pointZoneIntensity - deltaTime, 0.);
                                     }}
                                  ];

        this.evolveAid = new EvolveAid(state, this.contingentEvolvers);

        this.topHeightTex = this.getCaveDataTexture();
        this.bottomHeightTex = this.getCaveDataTexture();

        const uniforms = this.quadShaderCanvas.uniforms;

        uniforms.topHeights = {type: "t", value: this.topHeightTex};
        uniforms.bottomHeights = {type: "t", value: this.bottomHeightTex};
        uniforms.wormDeathRatio =  {value: 0};
        uniforms.resetTransitionRatio =  {value: 0};
        uniforms.cameraPos = {value: state.camera.position};
        uniforms.wormData =  {value: new Float32Array(16)};
        uniforms.wormData2 =  {value: new Float32Array(16)};
        uniforms.inZone = {value: 0};
        uniforms.pointZoneHeight = {value: 0};
        uniforms.pointZoneIntensity = {value: 0};

        this.updatePointDisplay(state);

        this.state = state;
    }

    handleEvent(event) {
        const state = this.state;

        if (event.name === 'worm_cave_collision') {
            state.inZone = false;
            state.pointZoneIntensity = 0;
            state.timeInZone = 0;
            this.evolveAid.runTransientState('worm.dying',
                           {position: event.data.wormPosition}, 1.5);
        } else if (event.name === 'worm.dying_finished') {
            this.evolveAid.runTransientState('resetTransition', {}, 1.5);

            // This is a little trick to regenerate the cave shape using a
            // new seed while in the middle of the 'resetTransition' animation.
            setTimeout(() => {
                this.caveGenerator = new CaveGenerator();
                this.state.worm.position = this.getInitialWormPosition();
                this.state.camera.position = this.getInitialWormPosition();
            }, 400);
        } else if (event.name === 'resetTransition_finished') {

            this.initState(true)
        } else if (event.name === 'point_zone_entry') {

            state.timeOutOfZone = 0;
            state.timeInZone = 0;
            if (!state.worm.dying) {
                state.inZone = true;
            }
        } else if (event.name === 'point_zone_exit') {

            state.timeInZone = 0;
            state.timeOutOfZone = 0;
            state.inZone = false;
        }
    }

    update(time, deltaTime) {
        if (this.focused) {
            this.assignEnvironmentalForces();

            this.updateKinematics(deltaTime);

            this.runEnvironmentalEventGenerators();

            this.updateCaveGeometry();

            this.updateWorm();

            this.evolveAid.update(time, deltaTime);

            this.state.time = time;

            this.state.gameTime += deltaTime;

            this.mapStateToUniforms(this.state);
        }
    }

    updateKinematics(deltaTime) {
        const entities = [this.state.camera];

        if (!this.state.worm.dying && !this.state.resetTransition);
            entities.push(this.state.worm);

        entities.forEach(entity => {
            if (entity === this.state.camera) {
                if (!this.state.worm.dying) {
                    const target = this.state.worm.position.clone().add(new vec2(5, 0));
                    entity.position.addScaledVector(target.sub(this.state.camera.position), 
                                                    1 / 10);
                }
            } else {
                const totalForce = new vec2();
                entity.activeForces.forEach(force => {
                    totalForce.add(force);
                });

                const acceleration = new vec2(totalForce.x / entity.mass, totalForce.y / entity.mass);
                const velocity = entity.velocity;

                velocity.addScaledVector(acceleration, deltaTime);

                // Cap velocity
                velocity.x = Math.min(Math.abs(velocity.x), Math.abs(entity.velocityCap.x)) * ((velocity.x + 1) / Math.abs(velocity.x + 1));
                // velocity.y = Math.min(Math.abs(velocity.y), Math.abs(entity.velocityCap.y)) * ((velocity.y + 1) / Math.abs(velocity.y + 1));

                entity.position.addScaledVector(velocity, deltaTime);
            }

            entity.activeForces.length = 0;
        });
    }

    updateWorm() {
        this.updateWormYHistory(this.state.worm.position);
    }

    updateWormYHistory(wormPos) {
        const state = this.state;
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

        worm.activeForces.push(new vec2(0, -gravityForceMagnitude * introScale));

        worm.activeForces.push(new vec2(100, 0));

        if (this.state.keyStates.ArrowUp) {
            worm.activeForces.push(new vec2(0, 1000 * introScale));         
        }
    }

    updateCaveGeometry() {
        const camX = Math.floor(Util.toPixels(this.state.camera.position.x)) - Math.floor(AppState.canvasWidth / 2);
        const texelCount = AppState.canvasWidth / (CAVE_SAMPLE_DIST);

        for (let i = 0; i < texelCount; i++) {
            const xPixelInMeters = Util.toMeters(i*CAVE_SAMPLE_DIST + camX);

            const topY = this.caveGenerator.getTopSurfaceY(xPixelInMeters);
            this.topHeightTex.image.data[i] = this.cameraTransform(new vec2(0, topY)).y;

            const bottomY = this.caveGenerator.getBottomSurfaceY(xPixelInMeters);
            this.bottomHeightTex.image.data[i] = this.cameraTransform(new vec2(0, bottomY)).y;
        }

        this.topHeightTex.needsUpdate = true;
        this.bottomHeightTex.needsUpdate = true;
    }

    mapStateToUniforms(state) {
        const uniforms = this.quadShaderCanvas.uniforms;
        const aspectRatio = AppState.canvasWidth / AppState.canvasHeight;

        const wormPos = this.cameraTransform(state.worm.position);

        const cameraPos = Util.toPixelsV(state.camera.position);
        cameraPos.x /= AppState.canvasWidth;
        cameraPos.x *= aspectRatio;
        cameraPos.y /= AppState.canvasHeight;

        uniforms.time.value = state.time;
        uniforms.cameraPos.value = cameraPos;

        if (state.worm.dying)
            uniforms.wormDeathRatio.value = state.worm.dying.completion;
        if (state.resetTransition)
            uniforms.resetTransitionRatio.value = state.resetTransition.completion;

        uniforms.pointZoneIntensity.value = Util.smoothstep(0.1, 1., state.pointZoneIntensity);
        uniforms.pointZoneHeight.value = Util.toPixels(this.getPointZoneHeight(state.timeInZone)) / AppState.canvasHeight * (1/aspectRatio);

        // Update trailing worm block positions
        // and copy into matrix uniforms
        for (let i = 0; i < 6; i++) {
            const rotation = state.worm.velocity.clone().normalize().angle();

            const wormPosClone = state.worm.position.clone();
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

    cameraTransform(vec) {
        const campPosInPixels = Util.toPixelsV(this.state.camera.position);
        const camShift = new vec2(-campPosInPixels.x + AppState.canvasWidth/2,
                                  -campPosInPixels.y + AppState.canvasHeight/2);
        const newVec = Util.toPixelsV(vec).add(camShift);
        newVec.x /= AppState.canvasWidth;
        newVec.x *= (AppState.canvasWidth / AppState.canvasHeight);
        newVec.y /= AppState.canvasHeight;

        return newVec;
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
        });
        canvas.addEventListener('keyup', (e) => {
            this.state.keyStates[e.key] = false;
        });

        this.focused = true;

        canvas.addEventListener('blur', (e) => {
            this.focused = false;
        });
        canvas.addEventListener('focus', (e) => {
            this.focused = true;
        });
    }

    updatePointDisplay(state) {
        document.getElementById('points').innerHTML = "" + Math.floor(state.points);
    }

    tearDown() {}
}

module.exports = GameStateTransformer;