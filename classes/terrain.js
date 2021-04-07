import { makeid, log, setting } from '../terrain-main.js';

export class Terrain extends PlaceableObject {
    constructor(...args) {
        super(...args);

        /**
         * The Terrain image container
         * @type {PIXI.Container|null}
         */
        this.terrain = null;

        /**
         * The tiling texture used for this template, if any
         * @type {PIXI.Texture}
         */
        this.texture = null;

        /**
         * The primary drawing shape
         * @type {PIXI.Graphics}
         */
        this.drawing = null;

        /**
         * The terrain shape used for testing point intersection
         * @type {PIXI.Polygon}
         */
        this.shape = null;

        /**
         * The Terrain border frame
         * @type {PIXI.Container|null}
         */
        this.frame = null;

        /**
         * Internal flag for the permanent points of the polygon
         * @type {boolean}
         * @private
         */
        this._fixedPoints = duplicate(this.data.points || []);
    }

    static get defaults() {
        return {
            width: 0,
            height: 0,
            //rotation:0,
            locked: false,
            hidden: false,
            points: [],
            multiple: this.layer.defaultmultiple,
            terraintype: 'ground',
            environment: canvas.scene.data.flags['enhanced-terrain-layer']?.environment || null,
            obstacle: null
        }
    }

    /* -------------------------------------------- */

    /** @override */
    static get embeddedName() {
        return "Terrain";
    }

    static get layer() {
        return canvas.terrain;
    }

    get multiple() {
        return this.data.multiple || Terrain.defaults.multiple;
    }

    get terraintype() {
        return this.data.terraintype || Terrain.defaults.terraintype;
    }

    get environment() {
        return this.data.environment;
    }

    get obstacle() {
        return this.data.obstacle;
    }
    
    static async create(data, options) {

        //super.create(data, options);
        //canvas.scene._data.terrain
        data._id = data._id || makeid();

        let userId = game.user._id;

        data = data instanceof Array ? data : [data];
        for (let d of data) {
            const allowed = Hooks.call(`preCreateTerrain`, this, d, options, userId);
            if (allowed === false) {
                debug(`Terrain creation prevented by preCreate hook`);
                return null;
            }
        }

        let embedded = data.map(d => {
            let object = canvas.terrain.createObject(d);
            object._onCreate(options, userId);
            canvas.scene.data.terrain.push(d);
            canvas.scene.setFlag('enhanced-terrain-layer', 'terrain' + d._id, d);
            Hooks.callAll(`createTerrain`, canvas.terrain, d, options, userId);
            return d;
        });

        //+++layer.storeHistory("create", result);

        return data.length === 1 ? embedded[0] : embedded;

        /*
        const created = await canvas.scene.createEmbeddedEntity(this.embeddedName, data, options);
        if (!created) return;
        if (created instanceof Array) {
            return created.map(c => this.layer.get(c._id));
        } else {
            return this.layer.get(created._id);
        }*/

        //canvas.scene.data.terrain.push(data);
        //await canvas.scene.setFlag('enhanced-terrain-layer', 'terrain' + data._id, data);

        //return this;
    }

    _onDelete() {
        //+++delete this.layer._controlled[this.id];
        //+++if ( layer._hover === this ) layer._hover = null;
    }

    /* -------------------------------------------- */

    /**
     * Apply initial sanitizations to the provided input data to ensure that a Terrain has valid required attributes.
     * @private
     */
    /*
    _cleanData() {
        if (this.data._id == undefined)
            this.data._id = makeid();

        if (isNaN(parseFloat(this.data.multiple)))
            this.data.multiple = 2;
        this.data.multiple = parseFloat(this.data.multiple);

        this.data.flags = this.data.flags || {};
    }*/

    /* -------------------------------------------- */
    /*  Properties                                  */
    /* -------------------------------------------- */

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @override */
    async draw() {
        this.clear();

        let mult = Math.clamped(this.data.multiple, 0.5, 4);
        this.texture = (mult != 1 ? await loadTexture(`modules/enhanced-terrain-layer/img/${mult}x.svg`) : null);

        // Create the inner Terrain container
        this._createTerrain();

        // Control Border
        this._createFrame();

        // Render Appearance
        this.refresh();

        // Enable Interactivity, if this is a true Terrain
        if (this.id) this.activateListeners();
        return this;
    }

    /* -------------------------------------------- */

    /**
     * Create the components of the terrain element, the terrain container, the drawn shape, and the overlay text
     */
    _createTerrain() {

        // Terrain container
        this.terrain = this.addChild(new PIXI.Container());

        // Terrain Shape
        this.drawing = this.terrain.addChild(new PIXI.Graphics());

        // Overlay Text
        this.text = this.terrain.addChild(this._createText());
        this._positionText();
    }

    /* -------------------------------------------- */

    /**
     * Create elements for the foreground text
     * @private
     */
    _createText() {
        if (this.text && !this.text._destroyed) {
            this.text.destroy();
            this.text = null;
        }
        let s = canvas.dimensions.size;
        let fontsize = (s / 3);
        let mult = Math.clamped(this.data.multiple, 0.5, 4);

        const stroke = Math.max(Math.round(fontsize / 32), 2);

        // Define the text style
        const textStyle = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: fontsize,
            fill: "#FFFFFF",
            stroke: "#111111",
            strokeThickness: stroke,
            dropShadow: true,
            dropShadowColor: "#000000",
            dropShadowBlur: Math.max(Math.round(fontsize / 16), 2),
            dropShadowAngle: 0,
            dropShadowDistance: 0,
            align: "center",
            wordWrap: false,
            wordWrapWidth: 1.5 * this.data.width,
            padding: stroke
        });

        return new PreciseText('x' + mult, textStyle);;
    }

    _positionText() {
        //center text
        var points = this.data.points;
        var x = 0,
            y = 0,
            i,
            j,
            f;

        var area = function (points) {
            var area = 0,
                i,
                j;

            for (i = 0, j = points.length - 1; i < points.length; j = i, i++) {
                var point1 = points[i];
                var point2 = points[j];
                area += point1[0] * point2[1];
                area -= point1[1] * point2[0];
            }
            area /= 2;

            return area;
        }

        for (i = 0, j = points.length - 1; i < points.length; j = i, i++) {
            var point1 = points[i];
            var point2 = points[j];
            f = point1[0] * point2[1] - point2[0] * point1[1];
            x += (point1[0] + point2[0]) * f;
            y += (point1[1] + point2[1]) * f;
        }

        f = area(points) * 6;

        this.text.anchor.set(0.5, 0.5);
        this.text.x = parseInt(x / f);
        this.text.y = parseInt(y / f);
    }

    /* -------------------------------------------- */

    /**
     * Create elements for the Terrain border and handles
     * @private
     */
    _createFrame() {
        this.frame = this.addChild(new PIXI.Container());
        this.frame.border = this.frame.addChild(new PIXI.Graphics());
        this.frame.handle = this.frame.addChild(new ResizeHandle([1, 1]));
    }

    /* -------------------------------------------- */

    /** @override */
    refresh() {
        if (this._destroyed || this.drawing._destroyed) return;

        this.drawing.clear();

        let s = canvas.dimensions.size;

        // Outer Stroke
        //const colors = CONFIG.Canvas.dispositionColors;
        let sc = colorStringToHex("#FFFFFF"); //this.data.hidden ? colorStringToHex("#C0C0C0") :
        let lStyle = new PIXI.LineStyle();
        mergeObject(lStyle, { width: s / 20, color: sc, alpha: 1, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND, visible: true });
        this.drawing.lineStyle(lStyle);

        let drawAlpha = (ui.controls.activeControl == 'terrain' ? 1.0 : setting('opacity')); //this.data.hidden ? 0.5

        // Fill Color or Texture
        if (this.texture) {
            let sW = (canvas.grid.w / (this.texture.width * 2));
            let sH = (canvas.grid.h / (this.texture.height * 2));
            this.drawing.beginTextureFill({
                texture: this.texture,
                color: sc,
                alpha: drawAlpha,
                matrix: new PIXI.Matrix().scale(sW, sH)
            });
        }

        // Draw polygon
        let points = this.data.points || [];
        if (points.length >= 2) {
            if (points.length === 2) this.drawing.endFill();
            this.shape = new PIXI.Polygon(points.deepFlatten());
        }

        if (this.shape) {
            if (this.data.hidden) {
                this.drawing.drawDashedPolygon(points, 0, 0, 0, 1, 5, 0);
                lStyle.width = 0;
                this.drawing.lineStyle(lStyle);
            }
            this.drawing.drawShape(this.shape);
        }

        // Conclude fills
        this.drawing.lineStyle(0x000000, 0.0).closePath();
        this.drawing.endFill();
        this.drawing.alpha = drawAlpha;

        /*
        // Set shape rotation, pivoting about the non-rotated center
        this.drawing.pivot.set(this.data.width / 2, this.data.height / 2);
        this.drawing.position.set(this.data.width / 2, this.data.height / 2);
        this.drawing.rotation = toRadians(this.data.rotation || 0);
        */
        this.text.visible = setting('showText') && this.id && this.multiple != 1 && !this._original;
        this.text.alpha = drawAlpha;

        // Determine drawing bounds and update the frame
        const bounds = this.terrain.getLocalBounds();
        if (this.id && this._controlled) this._refreshFrame(bounds);
        else this.frame.visible = false;

        // Toggle visibility
        this.position.set(this.data.x, this.data.y);
        this.terrain.hitArea = bounds;
        this.alpha = 1;
        this.visible = !this.data.hidden || game.user.isGM;

        return this;
    }

    /* -------------------------------------------- */

    /**
     * Refresh the boundary frame which outlines the Terrain shape
     * @private
     */
    _refreshFrame({ x, y, width, height }) {

        // Determine the border color
        const colors = CONFIG.Canvas.dispositionColors;
        let bc = colors.INACTIVE;
        if (this._controlled) {
            bc = this.data.locked ? colors.HOSTILE : colors.CONTROLLED;
        }

        // Draw the border
        const pad = 6;
        const t = CONFIG.Canvas.objectBorderThickness;
        const h = Math.round(t / 2);
        const o = Math.round(h / 2) + pad;
        this.frame.border.clear()
            .lineStyle(t, 0x000000).drawRect(x - o, y - o, width + (2 * o), height + (2 * o))
            .lineStyle(h, bc).drawRect(x - o, y - o, width + (2 * o), height + (2 * o))

        // Draw the handle
        this.frame.handle.position.set(x + width + o, y + height + o);
        this.frame.handle.clear()
            .beginFill(0x000000, 1.0).lineStyle(h, 0x000000).drawCircle(0, 0, pad + h)
            .lineStyle(h, bc).drawCircle(0, 0, pad);
        this.frame.visible = true;
    }

    /* -------------------------------------------- */

    /**
     * Add a new polygon point to the terrain, ensuring it differs from the last one
     * @private
     */
    _addPoint(position, temporary = true) {
        const point = [position.x - this.data.x, position.y - this.data.y];
        this.data.points = this._fixedPoints.concat([point]);
        if (!temporary) {
            this._fixedPoints = this.data.points;
            this._drawTime = Date.now();
        }
    }

    /* -------------------------------------------- */

    /**
     * Remove the last fixed point from the polygon
     * @private
     */
    _removePoint() {
        if (this._fixedPoints.length) this._fixedPoints.pop();
        this.data.points = this._fixedPoints;
    }

    /* -------------------------------------------- */

    cost(options) {
        if (this.data.hidden) {
            return 1;
        } else
            return this.data.multiple;
    }

    /** @override */
    activateListeners() {
        super.activateListeners();
        /*
        this.frame.handle.off("mouseover").off("mouseout").off("mousedown")
            .on("mouseover", this._onHandleHoverIn.bind(this))
            .on("mouseout", this._onHandleHoverOut.bind(this))
            .on("mousedown", this._onHandleMouseDown.bind(this));
        this.frame.handle.interactive = true;*/
    }

    /* -------------------------------------------- */
    /*  Database Operations                         */
    /* -------------------------------------------- */

    /** @override */
    _onUpdate(data) {
        const changed = new Set(Object.keys(data));
        if (changed.has("z")) {
            this.zIndex = parseInt(data.z) || 0;
        }

        // Full re-draw or partial refresh
        if (changed.has("multiple"))
            this.draw().then(() => super._onUpdate(data));
        else {
            this.refresh();
            super._onUpdate(data);
        }

        // Update the sheet, if it's visible
        if (this._sheet && this._sheet.rendered) this.sheet.render();
    }

    /* -------------------------------------------- */
    /*  Interactivity                               */
/* -------------------------------------------- */

    /** @override */
    _canControl(user, event) {
        if (this._creating) {  // Allow one-time control immediately following creation
            delete this._creating;
            return true;
        }
        if (this._controlled) return true;
        if (game.activeTool !== "select") return false;
        return user.isGM;
    }

    /** @override */
    _canHUD(user, event) {
        return this._controlled;
    }

    /* -------------------------------------------- */

    /** @override */
    _canConfigure(user, event) {
        if (!this._controlled) return false;
        return super._canConfigure(user);
    }

    /* -------------------------------------------- */
    /*  Event Listeners and Handlers                */
    /* -------------------------------------------- */

    /** @override */
    activateListeners() {
        super.activateListeners();
        this.frame.handle.off("mouseover").off("mouseout").off("mousedown")
            .on("mouseover", this._onHandleHoverIn.bind(this))
            .on("mouseout", this._onHandleHoverOut.bind(this))
            .on("mousedown", this._onHandleMouseDown.bind(this));
        this.frame.handle.interactive = true;
    }

    /* -------------------------------------------- */

    /**
     * Handle mouse movement which modifies the dimensions of the drawn shape
     * @param {PIXI.interaction.InteractionEvent} event
     * @private
     */
    _onMouseDraw(event) {
        const { destination, originalEvent } = event.data;
        const isShift = originalEvent.shiftKey;
        const isAlt = originalEvent.altKey;

        // Determine position
        let position = destination;
        if (!isShift) {
            position = canvas.grid.getSnappedPosition(position.x, position.y, this.layer.gridPrecision);
        } else {
            position = { x: parseInt(position.x), y: parseInt(position.y) };
        }

        this._addPoint(position, true);

        // Refresh the display
        this.refresh();
    }

    /* -------------------------------------------- */
    /*  Interactivity                               */
    /* -------------------------------------------- */

    /** @override */
    _onDragLeftStart(event) {
        if (this._dragHandle) return this._onHandleDragStart(event);
        return super._onDragLeftStart(event);
    }

    /* -------------------------------------------- */

    /** @override */
    _onDragLeftMove(event) {
        if (this._dragHandle) return this._onHandleDragMove(event);
        return super._onDragLeftMove(event);
    }

    /* -------------------------------------------- */

    /** @override */
    _onDragLeftDrop(event) {
        if (this._dragHandle) return this._onHandleDragDrop(event);

        // Update each dragged Terrain
        const clones = event.data.clones || [];
        const updates = clones.map(c => {
            let dest = { x: c.data.x, y: c.data.y };
            if (!event.data.originalEvent.shiftKey) {
                dest = canvas.grid.getSnappedPosition(c.data.x, c.data.y, this.layer.options.gridPrecision);
            }

            // Define the update
            const update = {
                _id: c._original.id,
                x: dest.x,
                y: dest.y//,
                //rotation: c.data.rotation
            };

            // Hide the original until after the update processes
            c._original.visible = false;
            return update;
        });
        return this.layer.updateMany(updates);
    }

    /* -------------------------------------------- */

    /** @override */
    _onDragLeftCancel(event) {
        if (this._dragHandle) return this._onHandleDragCancel(event);
        return super._onDragLeftCancel(event);
    }

    /* -------------------------------------------- */
    /*  Resize Handling                             */
    /* -------------------------------------------- */

    /**
     * Handle mouse-over event on a control handle
     * @param {PIXI.interaction.InteractionEvent} event   The mouseover event
     * @private
     */
    _onHandleHoverIn(event) {
        const handle = event.target;
        handle.scale.set(1.5, 1.5);
        event.data.handle = event.target;
    }

    /* -------------------------------------------- */

    /**
     * Handle mouse-out event on a control handle
     * @param {PIXI.interaction.InteractionEvent} event   The mouseout event
     * @private
     */
    _onHandleHoverOut(event) {
        event.data.handle.scale.set(1.0, 1.0);
    }

    /* -------------------------------------------- */

    /**
     * When we start a drag event - create a preview copy of the Tile for re-positioning
     * @param {PIXI.interaction.InteractionEvent} event   The mousedown event
     * @private
     */
    _onHandleMouseDown(event) {
        if (!this.data.locked) {
            this._dragHandle = true;
            this._original = duplicate(this.data);
        }
    }

    /* -------------------------------------------- */

    /**
     * Handle the beginning of a drag event on a resize handle
     * @param event
     * @private
     */
    _onHandleDragStart(event) {
        const handle = event.data.handle;
        const aw = Math.abs(this.data.width);
        const ah = Math.abs(this.data.height);
        const x0 = this.data.x + (handle.offset[0] * aw);
        const y0 = this.data.y + (handle.offset[1] * ah);
        event.data.origin = { x: x0, y: y0, width: aw, height: ah };
        this.resizing = true;
    }

    /* -------------------------------------------- */

    /**
     * Handle mousemove while dragging a tile scale handler
     * @param {PIXI.interaction.InteractionEvent} event   The mousemove event
     * @private
     */
    _onHandleDragMove(event) {
        const { destination, origin, originalEvent } = event.data;

        // Pan the canvas if the drag event approaches the edge
        canvas._onDragCanvasPan(originalEvent);

        // Update Terrain dimensions
        const dx = destination.x - origin.x;
        const dy = destination.y - origin.y;
        const update = this._rescaleDimensions(this._original, dx, dy);
        mergeObject(this.data, update);

        this.refresh();
    }

    /* -------------------------------------------- */

    /**
     * Handle mouseup after dragging a tile scale handler
     * @param {PIXI.interaction.InteractionEvent} event   The mouseup event
     * @private
     */
    _onHandleDragDrop(event) {
        let { destination, handle, origin, originalEvent } = event.data;
        if (!originalEvent.shiftKey) {
            destination = canvas.grid.getSnappedPosition(destination.x, destination.y, this.layer.gridPrecision);
        }

        // Update dimensions
        const dx = destination.x - origin.x;
        const dy = destination.y - origin.y;
        const update = this._rescaleDimensions(this._original, dx, dy);
        this.resizing = false;

        this._positionText();

        // Commit the update
        this.data = this._original;
        return this.update(update);
    }

    /* -------------------------------------------- */

    /**
     * Handle cancellation of a drag event for one of the resizing handles
     * @private
     */
    _onHandleDragCancel(event) {
        this.data = this._original;
        this._dragHandle = false;
        delete this._original;
        this.refresh();
    }

    /* -------------------------------------------- */

    /**
     * Apply a vectorized rescaling transformation for the terrain data
     * @param {Object} original     The original terrain data
     * @param {number} dx           The pixel distance dragged in the horizontal direction
     * @param {number} dy           The pixel distance dragged in the vertical direction
     * @private
     */
    _rescaleDimensions(original, dx, dy) {
        let { points, width, height } = original;
        width += dx;
        height += dy;

        // Rescale polygon points
        const scaleX = 1 + (dx / original.width);
        const scaleY = 1 + (dy / original.height);
        points = points.map(p => [p[0] * scaleX, p[1] * scaleY]);

        // Normalize the shape
        const update = this.constructor.normalizeShape({
            x: original.x,
            y: original.y,
            width: width,
            height: height,
            points: points
        });
        return update;
    }

    /* -------------------------------------------- */

    /**
     * Adjust the location, dimensions, and points of the Terrain before committing the change
     * @param {Object} data   The Terrain data pending update
     * @return {Object}       The adjusted data
     * @private
     */
    static normalizeShape(data) {
        // Adjust shapes with an explicit points array
        let points = data.points;
        if (points && points.length) {
            //Close the shape
            points.push([points[0][0], points[0][1]]);

            // De-dupe any points which were repeated in sequence
            points = points.reduce((arr, p1) => {
                let p0 = arr.length ? arr[arr.length - 1] : null;
                if (!p0 || !p1.equals(p0)) arr.push(p1);
                return arr;
            }, []);

            // Adjust points for the minimal x and y values
            const [xs, ys] = data.points.reduce((arr, p) => {
                arr[0].push(p[0]);
                arr[1].push(p[1]);
                return arr;
            }, [[], []]);

            // Determine minimal and maximal points
            let minX = Math.min(...xs);
            let maxX = Math.max(...xs);
            let minY = Math.min(...ys);
            let maxY = Math.max(...ys);

            // Normalize points
            points = points.map(p => [p[0] - minX, p[1] - minY]);

            // Update data
            data.x += minX;
            data.y += minY;
            data.width = parseInt(maxX - minX);
            data.height = parseInt(maxY - minY);
            data.points = points;
        }
        return data;
    }

    async update(data, options = {save: true}) {
        //update this object
        mergeObject(this.data, data);
        delete this.data.id; //remove the id if I've accidentally added it.  We should be using _id
        if (options.save === true) {
            //update the data and save it to the scene
            let objectdata = duplicate(canvas.scene.getFlag("enhanced-terrain-layer", `terrain${this.data._id}`));
            mergeObject(objectdata, this.data);
            //let updates = {};
            //updates['flags.enhanced-terrain-layer.terrain' + this.data._id + '.multiple'] = data.multiple;
            let key = `flags.enhanced-terrain-layer.terrain${this.data._id}`;
            await canvas.scene.update({ [key]: objectdata }, { diff: false });
		canvas.terrain._costGrid = null;
        }
        //await canvas.scene.setFlag("enhanced-terrain-layer", "terrain" + this.data._id, objectdata, {diff: false});
        //if the multiple has changed then update the image
        if (data.multiple != undefined) {
            this.draw();
        }else
            this.refresh();
        return this;
    }

    async delete(options) {
        let layerdata = duplicate(this.scene.getFlag("enhanced-terrain-layer", "data"));
        let idx = layerdata.findIndex(t => { return t._id == this.id });
        layerdata.splice(idx, 1);
        await this.scene.setFlag("enhanced-terrain-layer", "data", layerdata);
        return this;
    }
}
