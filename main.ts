///<reference path="../babylon.d.ts" />
///<reference path="../babylon.gui.d.ts" />

interface StarData {
    rightAscension: number[];
    declination: number[];
    apparentMagnitude: number[];
    colorIndexBV: number[];
    color: number[][];
    asterismIndices: number[];
}

class CelestialSphere extends BABYLON.TransformNode {

    private _starData: StarData;

	private _radius: number;

	private _starLimit: number; // Show this many of the brightest stars as mapped triangles.
	private _starScale: number; // 0.4 // Size of largest star (larger/brighter stars are factors of this number).

    private _showAsterisms: boolean;
    private _asterismColor: BABYLON.Color3;
    
    private _twinkleStars: boolean = true;

    constructor(name: string, scene: BABYLON.Scene, starData: StarData, radius: number, starLimit: number, starScale: number, showAsterisms: boolean, asterismColor: BABYLON.Color3, twinkleStars: boolean) {

        super(name, scene);

        this._starData = starData;
        this._radius = radius;
        this._starLimit = starLimit;
        this._starScale = starScale;
        this._showAsterisms = showAsterisms;
        this._asterismColor = asterismColor;
        this._twinkleStars = twinkleStars;

        // Add empty celestial sphere mesh.
        let starMesh = new BABYLON.Mesh('starMesh', scene);
        starMesh.parent = this;
        starMesh.alphaIndex = 20;

        // Mesh vertex data arrays.
        let positions = [];
        let indices = [];
        let colors = [];
        let uvs = [];
        let uvs2 = [];

        let vertexIndex = 0;
        let numberOfStars = Math.min(starData.rightAscension.length, this._starLimit);

        // Populate vertex data arrays for each star.
        for (let starIndex = 0; starIndex < numberOfStars; starIndex++) {

            // Star celestial coordinates.
            let ra = this._starData.rightAscension[starIndex]; // eastward in radians (around Y axis - yaw)
            let dec = this._starData.declination[starIndex]; // north-south in radians (around X axis - pitch)

            // Star scale factor (based on apparent magnitude).
            var s = this._starScaleFactor(starIndex); 

            // Create star vertices around +Z axis & scale to size.
            let v1 = new BABYLON.Vector3( 0.0 * s,  0.7 * s, this._radius);
            let v2 = new BABYLON.Vector3(-0.5 * s, -0.3 * s, this._radius);
            let v3 = new BABYLON.Vector3( 0.5 * s, -0.3 * s, this._radius);

            // Rotate vertices into position on celestial sphere.
            let rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(-ra, -dec, 0);
            v1 = BABYLON.Vector3.TransformCoordinates(v1, rotationMatrix);
            v2 = BABYLON.Vector3.TransformCoordinates(v2, rotationMatrix);
            v3 = BABYLON.Vector3.TransformCoordinates(v3, rotationMatrix);

            // Add vertex positions.
            positions.push(
                v1.x, v1.y, v1.z,
                v2.x, v2.y, v2.z,
                v3.x, v3.y, v3.z
            );

            // Add vertex color.
            let c = this._starColor(starIndex);
            colors.push(
                c.r, c.g, c.b, c.a,
                c.r, c.g, c.b, c.a,
                c.r, c.g, c.b, c.a
            );

            // Add star texture UV coordinates.
            uvs.push(0.5, 1.0, 0.0, 0.0, 1.0, 0.0);

            // Add 'twinkle' (noise) texture UV coordinates.
            let u = Math.random();
            let v = Math.random();
            uvs2.push(u, v, u, v, u, v);

            // Add indices.
            indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
            vertexIndex += 3;
        }

        // Create & assign vertex data to mesh.
        let vertexData = new BABYLON.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;	
        vertexData.colors = colors;
        vertexData.uvs = uvs;	
        vertexData.uvs2 = uvs2;
        vertexData.applyToMesh(starMesh);        

        // Create & assign star material.        
        let starMaterial = new BABYLON.StandardMaterial('starMaterial', scene);
        let opacityTexture = new BABYLON.Texture('star.png', scene);
        starMaterial.opacityTexture = opacityTexture;
        starMaterial.disableLighting = true;
        starMesh.material = starMaterial;

        // Twinkle stars (simulate atmospheric turbulence).
        if (this._twinkleStars) {

            let emissiveTexture = new BABYLON.Texture('noise.png', scene);
            starMaterial.emissiveTexture = emissiveTexture;
            emissiveTexture.coordinatesIndex = 1; // uvs2            
    
            // Animate emissive texture to simulate star 'twinkle' effect.
            scene.registerBeforeRender(()=> {
                emissiveTexture.uOffset += 0.008;
            });
        }
        else {
            starMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);            
        }

        // Draw asterism lines.
        if (this._showAsterisms) {

            let points = [];

            for (let i = 0; i < this._starData.asterismIndices.length; i++) {

                let starIndex = this._starData.asterismIndices[i];
                if (starIndex != -1) {
                    
                    // Compute star position.
                    let ra = this._starData.rightAscension[starIndex];
                    let dec = this._starData.declination[starIndex];
            
                    let x = this._radius * Math.cos(dec) * Math.sin(ra);
                    let y = this._radius * Math.sin(dec);
                    let z = this._radius * Math.cos(dec) * Math.cos(ra);
            
                    points.push(new BABYLON.Vector3(-x, y, z));
                }
                else {
                    
                    // Create lines.
                    let asterismLines = BABYLON.Mesh.CreateLines("asterismLines", points, scene);
                    asterismLines.color = this._asterismColor;
                    asterismLines.parent = this;
                    asterismLines.alphaIndex = 10;
     
                    // Clear points array.
                    points = [];
                }
            }
        }

        // Draw helpers (celestial equator and axis).
        let helperColor = new BABYLON.Color3(1, 0, 0);

        // Draw celestial equator.
        let points = [];
        let steps = 100;
        for (let i = 0; i < steps + 1; i++) {

            let a = (Math.PI * 2 * i / steps);
            let x = Math.cos(a) * this._radius;
            let y = 0;
            let z = Math.sin(a) * this._radius;

            points.push(new BABYLON.Vector3(x, y, z));
        }

        radius += 20;
        //Array of paths to construct tube
        let c = 2 * Math.PI * radius;
        let h = c / 4 / 2;
        let myPath = [
            new BABYLON.Vector3(0, 0, h),
            new BABYLON.Vector3(0, 0, -h)
        ];

        //Create ribbon with updatable parameter set to true for later changes
        let tubeParentXform = new BABYLON.TransformNode('tubeParentXform', scene);
        let tubeChildXform = new BABYLON.TransformNode('tubeChildXform', scene);
        let tube = BABYLON.MeshBuilder.CreateTube("tube", {path: myPath, radius: radius, sideOrientation: BABYLON.Mesh.BACKSIDE, updatable: false}, scene);
        tube.alphaIndex = 0;
        let tubeTexture = new BABYLON.Texture("eso0932a.png", scene, true, false);
        tubeTexture.vScale = -1;
        tube.parent = tubeChildXform;
        tubeChildXform.parent = tubeParentXform
        tube.rotate(new BABYLON.Vector3(0,0,-1), 0.57);
        tubeChildXform.rotate(new BABYLON.Vector3(1,0,0), 0.48);
        tubeParentXform.rotate(new BABYLON.Vector3(0,-1,0), 0.22);
        let tubeMaterial = new BABYLON.StandardMaterial("skyBox", scene);
        tubeMaterial.backFaceCulling = true;
        tubeMaterial.disableLighting = true;
        tubeMaterial.emissiveTexture = tubeTexture;
        tube.material = tubeMaterial;
        tube.material.alpha = 0.5;
        tubeParentXform.parent = this;     
    }

    /*
     *  Look-up star color using star's color index B-V.
     * 
     *  See: https://en.wikipedia.org/wiki/Color_index
     *  Blue-white-red star color range from http://www.vendian.org/mncharity/dir3/starcolor/details.html
     */
    private _starColor(starIndex: number): BABYLON.Color4 {

        // Normalize star color fraction from colorIndexBV range of -0.4-2.0 to 0.0-1.0.
        let fraction = BABYLON.Scalar.Normalize(this._starData.colorIndexBV[starIndex], -0.4, 2.0);

        // Calculate star color index.
        let maxColorIndex = this._starData.color.length - 1;
        let colorIndex = Math.round(maxColorIndex * fraction);
        colorIndex = BABYLON.Scalar.Clamp(colorIndex, 0, maxColorIndex);

        // Look-up and return star color.
        let c = this._starData.color[colorIndex];
        return new BABYLON.Color4(c[0], c[1], c[2], 0);
    }

    /*
     *  Compute star scale factor based on apparent magnitude.
     */
    private _starScaleFactor(starIndex: number) {

        // Magnitude is counterintuitive - lower values are hgiher magnitudes!
        // "Lowest" magnitude in star data is 7.8, "highest" is -1.44 for Sirius.
        // So we need to invert these & ensure positive to get scale that approximates magnitude.
        return (8 - this._starData.apparentMagnitude[starIndex]) * this._starScale;
    }
}

class WebGL {

    private _canvas: HTMLCanvasElement;
    private _engine: BABYLON.Engine;
    private _scene: BABYLON.Scene;

    constructor(canvasElement: string) {

        // Instantiate engine.
        this._canvas = document.getElementById(canvasElement) as HTMLCanvasElement;
        this._engine = new BABYLON.Engine(this._canvas, true);
    }

    public createScene(): void {

        // Instantiate scene.
        this._scene = new BABYLON.Scene(this._engine);

        // Display debug layer.
        //this._scene.debugLayer.show();

        this._scene.clearColor = new BABYLON.Color4(0, 0, 0, 1.0);

        // Load and parse star data.
        let assetsManager = new BABYLON.AssetsManager(this._scene);

        let starDataTask = assetsManager.addTextFileTask("star-data", "star-data.json");

        let starData: StarData;
        let celestialSphere;
        let starLimit = 5000;
        let starScale = 0.5;
        let radius = 300;
        let showAsterisms = true;
        let asterismColor = new BABYLON.Color3(0, 0, 0.7);
        let twinkleStars = true;
    
        starDataTask.onSuccess = (starDataTask) => {
            starData = JSON.parse(starDataTask.text);
            celestialSphere = new CelestialSphere("celestialSphere", this._scene, starData, radius, starLimit, starScale, showAsterisms, asterismColor, twinkleStars);
        }

        assetsManager.load();
        
        // GUI
        let guiControlWidth = "200px";
        let guiControlHeight = "40px";
        let guiColor = "white";
        let guiBackgroundColor = "green";
        let guiPaddingSmall = "10px";
        let guiPaddingLarge = "20px";
        let guiFontSizeSmall = "15px";
        let guiFontSizeMedium = "18px";
        let guiFontSizeLarge = "22px";

        let guiAdvancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

        // Stack panel container.
        let guiPanel = new BABYLON.GUI.StackPanel();
        guiPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        guiPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        guiPanel.paddingTop = guiPaddingLarge;
        guiPanel.paddingRight = guiPaddingLarge;
        guiPanel.width = "220px";
        guiPanel.height = "700px";
        guiPanel.background = "#3338";
        guiAdvancedTexture.addControl(guiPanel);

        // Header - project title.
        let guiHeader = new BABYLON.GUI.TextBlock();
        guiHeader.text = "Celestial Sphere";
        guiHeader.fontSize = guiFontSizeLarge;
        guiHeader.height = guiControlHeight;
        guiHeader.color = guiColor;
        guiHeader.paddingTop = guiPaddingLarge;
        guiPanel.addControl(guiHeader); 

        // Star limit slider label.
        let starLimitLabel = new BABYLON.GUI.TextBlock();
        starLimitLabel.text = "Number of stars: " + starLimit.toFixed(0);
        starLimitLabel.fontSize = guiFontSizeSmall;
        starLimitLabel.height = guiControlHeight;
        starLimitLabel.color = guiColor;
        starLimitLabel.paddingTop = guiPaddingLarge;
        guiPanel.addControl(starLimitLabel); 

        // Star limit slider.
        let starLimitSlider = new BABYLON.GUI.Slider();
        starLimitSlider.minimum = 100;
        starLimitSlider.maximum = 5000;
        starLimitSlider.value = starLimit;
        starLimitSlider.width = guiControlWidth;
        starLimitSlider.height = "30px";
        starLimitSlider.thumbWidth = "15px";
        starLimitSlider.color = guiBackgroundColor;
        starLimitSlider.borderColor = guiColor;
        starLimitSlider.background = "black";
        starLimitSlider.paddingTop = "7px";
        starLimitSlider.paddingLeft = guiPaddingSmall;
        starLimitSlider.paddingRight = guiPaddingSmall;
        starLimitSlider.onValueChangedObservable.add((value) => {
            starLimitLabel.text = "Number of stars: " + value.toFixed(0);
            starLimit = value;
        });
        guiPanel.addControl(starLimitSlider); 

        // Star scale slider label.
        let starScaleLabel = new BABYLON.GUI.TextBlock();
        starScaleLabel.text = "Star scale: " + starScale.toFixed(1);
        starScaleLabel.fontSize = guiFontSizeSmall;
        starScaleLabel.height = guiControlHeight;
        starScaleLabel.color = guiColor;
        starScaleLabel.paddingTop = guiPaddingLarge;
        guiPanel.addControl(starScaleLabel); 

        // Star scale slider.
        let starScaleSlider = new BABYLON.GUI.Slider();
        starScaleSlider.minimum = 0.1;
        starScaleSlider.maximum = 2.0;
        starScaleSlider.value = starScale;
        starScaleSlider.width = guiControlWidth;
        starScaleSlider.height = "30px";
        starScaleSlider.thumbWidth = "15px";
        starScaleSlider.color = guiBackgroundColor;
        starScaleSlider.borderColor = guiColor;
        starScaleSlider.background = "black";
        starScaleSlider.paddingTop = "7px";
        starScaleSlider.paddingLeft = guiPaddingSmall;
        starScaleSlider.paddingRight = guiPaddingSmall;
        starScaleSlider.onValueChangedObservable.add((value) => {
            starScaleLabel.text = "Star scale: " + value.toFixed(1);
            starScale = value;
        });
        guiPanel.addControl(starScaleSlider); 

        // Radius slider label.
        let radiusLabel = new BABYLON.GUI.TextBlock();
        radiusLabel.text = "Sphere radius: " + radius.toFixed(0);
        radiusLabel.fontSize = guiFontSizeSmall;
        radiusLabel.height = guiControlHeight;
        radiusLabel.color = guiColor;
        radiusLabel.paddingTop = guiPaddingLarge;
        guiPanel.addControl(radiusLabel); 

        // Radius slider.
        let radiusSlider = new BABYLON.GUI.Slider();
        radiusSlider.minimum = 100;
        radiusSlider.maximum = 900;
        radiusSlider.value = radius;
        radiusSlider.width = guiControlWidth;
        radiusSlider.height = "30px";
        radiusSlider.thumbWidth = "15px";
        radiusSlider.color = guiBackgroundColor;
        radiusSlider.borderColor = guiColor;
        radiusSlider.background = "black";
        radiusSlider.paddingTop = "7px";
        radiusSlider.paddingLeft = guiPaddingSmall;
        radiusSlider.paddingRight = guiPaddingSmall;
        radiusSlider.onValueChangedObservable.add((value) => {
            radiusLabel.text = "Sphere radius: " + value.toFixed(0);
            radius = value;
        });
        guiPanel.addControl(radiusSlider);

        // Twinkle stars checkbox.
        var twinkleCheckbox = new BABYLON.GUI.Checkbox();
        twinkleCheckbox.width = "20px";
        twinkleCheckbox.height = "20px";
        twinkleCheckbox.isChecked = twinkleStars;
        twinkleCheckbox.color = guiBackgroundColor;
        twinkleCheckbox.onIsCheckedChangedObservable.add((value) => {
            twinkleStars = value;
        });

        // Twinkle stars checkbox header.
        var twinkleHeader = BABYLON.GUI.Control.AddHeader(twinkleCheckbox, " Twinkle stars", "180px", { isHorizontal: true, controlFirst: true });
        twinkleHeader.height = "60px";
        twinkleHeader.paddingLeft = "20px";
        twinkleHeader.fontSize = guiFontSizeSmall;
        twinkleHeader.paddingTop = guiPaddingLarge;
        twinkleHeader.color = guiColor;
        twinkleHeader.children[1].onPointerDownObservable.add(() => {
            twinkleCheckbox.isChecked = !twinkleCheckbox.isChecked;
        });
        guiPanel.addControl(twinkleHeader);

        // Show asterisms checkbox.
        var asterismsCheckbox = new BABYLON.GUI.Checkbox();
        asterismsCheckbox.width = "20px";
        asterismsCheckbox.height = "20px";
        asterismsCheckbox.isChecked = showAsterisms;
        asterismsCheckbox.color = guiBackgroundColor;
        asterismsCheckbox.onIsCheckedChangedObservable.add((value) => {
            showAsterisms = value;
        });

        // Show asterisms checkbox header.
        var asterismsHeader = BABYLON.GUI.Control.AddHeader(asterismsCheckbox, " Show asterisms", "180px", { isHorizontal: true, controlFirst: true });
        asterismsHeader.height = "60px";
        asterismsHeader.paddingLeft = "20px";
        asterismsHeader.fontSize = guiFontSizeSmall;
        asterismsHeader.paddingTop = guiPaddingSmall;
        asterismsHeader.color = guiColor;
        asterismsHeader.children[1].onPointerDownObservable.add(() => {
            asterismsCheckbox.isChecked = !asterismsCheckbox.isChecked;
        });
        guiPanel.addControl(asterismsHeader);
        
        // Asterism color header.
        let asterismColorHeader = new BABYLON.GUI.TextBlock();
        asterismColorHeader.text = "Asterism color";
        asterismColorHeader.fontSize = guiFontSizeSmall;
        asterismColorHeader.height = guiControlHeight;
        asterismColorHeader.color = guiColor;
        guiPanel.addControl(asterismColorHeader); 

        // Asterism color picker.
        var asterismColorPicker = new BABYLON.GUI.ColorPicker();
        asterismColorPicker.value = asterismColor;
        asterismColorPicker.height = guiControlWidth;
        asterismColorPicker.width = guiControlWidth;
        asterismColorPicker.paddingLeft = guiPaddingSmall;
        asterismColorPicker.paddingRight = guiPaddingSmall;
        asterismColorPicker.onValueChangedObservable.add((value) => { // value is a color3
            asterismColor = value;
        });    
        guiPanel.addControl(asterismColorPicker); 
        
        var regenButton = BABYLON.GUI.Button.CreateSimpleButton("regenButton", "Regenerate!");
        regenButton.width = guiControlWidth;
        regenButton.height = "70px";
        regenButton.color = guiColor;
        regenButton.fontSize = guiFontSizeMedium;
        //button2.cornerRadius = 20;
        regenButton.background = guiBackgroundColor;
        regenButton.paddingLeft = guiPaddingLarge;
        regenButton.paddingRight = guiPaddingLarge;
        regenButton.paddingTop = guiPaddingSmall;
        regenButton.paddingBottom = guiPaddingLarge;
        regenButton.onPointerUpObservable.add(() => {
            celestialSphere.dispose();
            celestialSphere = new CelestialSphere("celestialSphere", this._scene, starData, radius, starLimit, starScale, showAsterisms, asterismColor.clone(), twinkleStars);
        });
        guiPanel.addControl(regenButton);


        // Add default hemisphere light & camera that frames all above scene elements.
        this._scene.createDefaultCameraOrLight(true, true, true);

        let gl = new BABYLON.GlowLayer("glow", this._scene);
        gl.intensity = 1;
    }

    public renderScene(): void {

        // Start render loop.
        this._engine.runRenderLoop(() => {
            this._scene.render();
        });

        // Add resize event listener.
        window.addEventListener('resize', () => {
            this._engine.resize();
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {

    // Instantiate engine.
    let webgl = new WebGL('render-canvas');

    // Create scene.
    webgl.createScene();

    // Start render loop.
    webgl.renderScene();
});