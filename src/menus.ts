import {
    Editor,
    FileView,
    MarkdownView,
    MenuItem,
    Menu,
    App,
    TFile,
    Plugin,
    WorkspaceLeaf,
    TAbstractFile,
    ObsidianProtocolData,
} from 'obsidian';

import * as leaflet from 'leaflet';

import * as settings from 'src/settings';
import * as utils from 'src/utils';
import { LocationSearchDialog } from 'src/locationSearchDialog';
import { UrlConvertor } from 'src/urlConvertor';
import { LocationSuggest } from 'src/locationSuggest';
import { MapState } from 'src/mapState';
import MapViewPlugin from 'src/main';
import { MapContainer } from 'src/mapContainer';
import { ImportDialog } from 'src/importDialog';

export function addShowOnMap(
    menu: Menu,
    geolocation: leaflet.LatLng,
    file: TAbstractFile,
    editorLine: number,
    plugin: MapViewPlugin
) {
    if (geolocation) {
        menu.addItem((item: MenuItem) => {
            item.setTitle('Show on map');
            item.setSection('mapview');
            item.setIcon('globe');
            item.onClick(
                async (evt: MouseEvent) =>
                    await plugin.openMapWithLocation(
                        geolocation,
                        evt.ctrlKey,
                        file,
                        editorLine,
                        evt.shiftKey
                    )
            );
        });
    }
}

export function addOpenWith(
    menu: Menu,
    geolocation: leaflet.LatLng,
    settings: settings.PluginSettings
) {
    if (geolocation) {
        menu.addItem((item: MenuItem) => {
            item.setTitle('Open with default app');
            item.setIcon('map-pin');
            item.setSection('mapview');
            item.onClick((_ev) => {
                open(`geo:${geolocation.lat},${geolocation.lng}`);
            });
        });
        // Populate menu items from user defined "Open In" strings
        populateOpenInItems(menu, geolocation, settings);
    }
}

/**
 * Populate a context menu from the user configurable URLs
 * @param menu The menu to attach
 * @param location The geolocation to use in the menu item
 * @param settings Plugin settings
 */
export function populateOpenInItems(
    menu: Menu,
    location: leaflet.LatLng,
    settings: settings.PluginSettings
) {
    for (let setting of settings.openIn) {
        if (!setting.name || !setting.urlPattern) continue;
        const fullUrl = setting.urlPattern
            .replace('{x}', location.lat.toString())
            .replace('{y}', location.lng.toString());
        menu.addItem((item: MenuItem) => {
            item.setTitle(`Open in ${setting.name}`);
            item.setIcon('map-pin');
            item.setSection('mapview');
            item.onClick((_ev) => {
                open(fullUrl);
            });
        });
    }
}

export function addGeolocationToNote(
    menu: Menu,
    app: App,
	plugin: MapViewPlugin,
    editor: Editor,
    settings: settings.PluginSettings
) {
    menu.addItem((item: MenuItem) => {
        item.setTitle('Add geolocation (front matter)');
        item.setSection('mapview');
        item.setIcon('globe');
        item.onClick(async (_evt: MouseEvent) => {
            const dialog = new LocationSearchDialog(
                app,
				plugin,
                settings,
                'addToNote',
                'Add geolocation to note',
                editor
            );
            dialog.open();
        });
    });
}

export function addFocusNoteInMapView(
    menu: Menu,
    file: TFile,
    settings: settings.PluginSettings,
    plugin: MapViewPlugin
) {
    menu.addItem((item: MenuItem) => {
        const fileName = utils.trimmedFileName(file);
        item.setTitle(`Focus '${fileName}' in Map View`);
        item.setIcon('globe');
        item.setSection('mapview');
        item.onClick(
            async (evt: MouseEvent) =>
                await plugin.openMapWithState(
                    {
                        query: utils.replaceFollowActiveNoteQuery(
                            file,
                            settings
                        ),
                    } as MapState,
                    evt.ctrlKey,
                    true
                )
        );
    });
}

export function addUrlConversionItems(
    menu: Menu,
    editor: Editor,
    suggestor: LocationSuggest,
    urlConvertor: UrlConvertor
) {
    if (editor.getSelection()) {
        // If there is text selected, add a menu item to convert it to coordinates using geosearch
        menu.addItem((item: MenuItem) => {
            item.setTitle('Convert to geolocation (geosearch)');
            item.setIcon('search');
            item.setSection('mapview');
            item.onClick(async () => await suggestor.selectionToLink(editor));
        });
    }

    if (urlConvertor.hasMatchInLine(editor))
        // If the line contains a recognized geolocation that can be converted from a URL parsing rule
        menu.addItem(async (item: MenuItem) => {
            item.setTitle('Convert to geolocation');
            item.setIcon('search');
            item.setSection('mapview');
            item.onClick(async () => {
                urlConvertor.convertUrlAtCursorToGeolocation(editor);
            });
        });

    menu.addItem((item: MenuItem) => {
        item.setTitle('Paste as geolocation');
        item.setSection('mapview');
        item.setIcon('clipboard-x');
        item.onClick(async () => {
            const clipboard = await navigator.clipboard.readText();
            let clipboardLocation =
                urlConvertor.parseLocationFromUrl(clipboard);
            if (clipboardLocation instanceof Promise)
                clipboardLocation = await clipboardLocation;
            if (clipboardLocation)
                urlConvertor.insertLocationToEditor(
                    clipboardLocation.location,
                    editor
                );
        });
    });
}

export function addNewNoteItems(
    menu: Menu,
    geolocation: leaflet.LatLng,
    mapContainer: MapContainer,
    settings: settings.PluginSettings,
    app: App
) {
    const locationString = `${geolocation.lat},${geolocation.lng}`;
    menu.addItem((item: MenuItem) => {
        item.setTitle('New note here (inline)');
        item.setIcon('edit');
        item.setSection('new');
        item.onClick(async (ev) => {
            const newFileName = utils.formatWithTemplates(
                settings.newNoteNameFormat
            );
            const file: TFile = await utils.newNote(
                app,
                'multiLocation',
                settings.newNotePath,
                newFileName,
                locationString,
                settings.newNoteTemplate
            );
            mapContainer.goToFile(
                file,
                ev.ctrlKey,
                utils.handleNewNoteCursorMarker
            );
        });
    });
    menu.addItem((item: MenuItem) => {
        item.setTitle('New note here (front matter)');
        item.setIcon('edit');
        item.setSection('new');
        item.onClick(async (ev) => {
            const newFileName = utils.formatWithTemplates(
                settings.newNoteNameFormat
            );
            const file: TFile = await utils.newNote(
                app,
                'singleLocation',
                settings.newNotePath,
                newFileName,
                locationString,
                settings.newNoteTemplate
            );
            mapContainer.goToFile(
                file,
                ev.ctrlKey,
                utils.handleNewNoteCursorMarker
            );
        });
    });
}

export function addCopyGeolocationItems(
    menu: Menu,
    geolocation: leaflet.LatLng
) {
    const locationString = `${geolocation.lat},${geolocation.lng}`;
    menu.addItem((item: MenuItem) => {
        item.setTitle(`Copy geolocation`);
        item.setIcon('copy');
        item.setSection('copy');
        item.onClick((_ev) => {
            navigator.clipboard.writeText(`[](geo:${locationString})`);
        });
    });
    menu.addItem((item: MenuItem) => {
        item.setTitle(`Copy geolocation as front matter`);
        item.setIcon('copy');
        item.setSection('copy');
        item.onClick((_ev) => {
            navigator.clipboard.writeText(
                `---\nlocation: [${locationString}]\n---\n\n`
            );
        });
    });
}

export function addFocusLinesInMapView(
    menu: Menu,
    file: TFile,
    fromLine: number,
    toLine: number,
    numLocations: number,
    plugin: MapViewPlugin,
    settings: settings.PluginSettings
) {
    menu.addItem((item: MenuItem) => {
        item.setTitle(
            `Focus ${numLocations} ${
                numLocations > 1 ? 'geolocations' : 'geolocation'
            } in Map View`
        );
        item.setIcon('globe');
        item.setSection('mapview');
        item.onClick(
            async (evt: MouseEvent) =>
                await plugin.openMapWithState(
                    {
                        query: `path:"${file.path}" AND lines:${fromLine}-${toLine}`,
                    } as MapState,
                    evt.ctrlKey,
                    true
                )
        );
    });
}

export function addImport(
    menu: Menu,
    editor: Editor,
    app: App,
    plugin: MapViewPlugin,
    settings: settings.PluginSettings
) {
    menu.addItem((item: MenuItem) => {
        // TODO: this is an unfinished corner of the code, currently bypassed by default
        item.setTitle('Import geolocations from file...');
        item.setIcon('globe');
        item.setSection('mapview');
        item.onClick(async (evt: MouseEvent) => {
            const importDialog = new ImportDialog(
                editor,
                app,
                plugin,
                settings
            );
            importDialog.open();
        });
    });
}
