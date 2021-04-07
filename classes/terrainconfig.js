import { TerrainLayer, terraintype, environment, obstacle } from './terrainlayer.js';
import { log, setting, i18n} from '../terrain-main.js';

Hooks.on("renderSceneConfig", (app, html, data) => {

  if (app.object.getFlag('enhanced-terrain-layer', 'environment') === undefined) {
    app.object.setFlag('enhanced-terrain-layer', 'environment', '');
  }

  let text = ''
  for (let i = 0; i < canvas.terrain.environment().length; i++) {
    if (app.object.getFlag('enhanced-terrain-layer', 'environment') === canvas.terrain.environment()[i].id)
    {
      text += '<option value="' + canvas.terrain.environment()[i].id + '" selected>' + canvas.terrain.environment()[i].text + '</option>';
    } else {
      text += '<option value="' + canvas.terrain.environment()[i].id + '">' + canvas.terrain.environment()[i].text + '</option>';
    }
  };

  const fxHtml = `
  <div class="form-group" id='environment' >
      <label>${game.i18n.localize('EnhancedTerrainLayer.Environment')}</label>
      <select name="flags['enhanced-terrain-layer'].environment", data-dtype="String">
        ${text}
      </select>
  </div>
  `
  const fxFind = html.find("input[name ='backgroundColor']");
  const formGroup = fxFind.closest(".form-group");
  formGroup.after(fxHtml);
  html.find("div[id='environment']").innerHTML = fxHtml;
});

Hooks.on("closeSceneConfig", (app, html, data) => {
  if (app.object.compendium == null) {
    app.object.setFlag('enhanced-terrain-layer', 'environment', html.find("div[id ='environment']")[0].children[1].value)
  }
});

export class TerrainConfig extends FormApplication {

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "terrain-config",
            classes: ["sheet", "terrain-sheet"],
            title: i18n("EnhancedTerrainLayer.Configuration"),
            template: "modules/enhanced-terrain-layer/templates/terrain-config.html",
            width: 400,
            submitOnChange: true
        });
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options) {
        return {
            object: duplicate(this.object.data),
            options: this.options,
            terraintype: terraintype,
            environment: environment,
            obstacle: obstacle,
            submitText: this.options.preview ? "Create" : "Update"
        }
    }

    /* -------------------------------------------- */

    /** @override */
    _onChangeInput(event) {
        if ($(event.target).attr('name') == 'multiple') {
            let val = $(event.target).val();
            $(event.target).next().html(TerrainLayer.multipleText(val));
        }
    }

    /* -------------------------------------------- */

    /** @override */
    async _updateObject(event, formData) {
        if (!game.user.isGM) throw "You do not have the ability to configure a Terrain object.";
        if (this.object.id) {
            let data = duplicate(formData);
            data._id = this.object.id;
            data.multiple = (data.multiple == 0 ? 0.5 : parseInt(data.multiple));
            return this.object.update(data);
        }
        return this.object.constructor.create(formData);
    }

    activateListeners(html) {
        super.activateListeners(html);
    }
}

Hooks.on("renderTerrainConfig", (app, html) => {
    $('[name="terraintype"]', html).val(app.object.data.terraintype);
    $('[name="environment"]', html).val(app.object.data.environment);
    $('[name="obstacle"]', html).val(app.object.data.obstacle);
})
